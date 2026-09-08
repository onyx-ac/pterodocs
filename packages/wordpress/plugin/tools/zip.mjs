/**
 * Build the installable plugin zip.
 *
 * What goes in is what WordPress runs: no tools, no node_modules, no lockfile.
 * The archive has a single `pterodoc/` directory at its root, which is what
 * Plugins, Add New, Upload Plugin expects.
 *
 * The archive is written here rather than shelled out to, for two reasons.
 * PowerShell's Compress-Archive writes entry names with backslashes, which PHP
 * unzips as filenames that happen to contain a backslash rather than as
 * directories — the plugin then installs as a heap of oddly named files. And
 * `zip` is not present on Windows while `tar` there cannot write zips at all,
 * so shelling out means branching per platform and testing none of them.
 *
 * Timestamps are fixed, so the same sources always produce the same archive.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

/** What ships. Everything else is tooling. */
const INCLUDE = ['pterodoc.php', 'uninstall.php', 'readme.txt', 'LICENCE.md', 'inc', 'assets', 'languages'];

/* -------------------------------------------------------------------------
 * Zip
 * ---------------------------------------------------------------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

/**
 * CRC-32 of a buffer, as the zip format wants it.
 *
 * @param {Buffer} buffer Bytes to sum.
 * @returns {number} The checksum, unsigned.
 */
function crc32(buffer) {
  let c = 0 ^ -1;
  for (let i = 0; i < buffer.length; i += 1) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ buffer[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}

// 1980-01-01 00:00, the earliest a zip can express, for a reproducible build.
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

/**
 * Write a zip archive.
 *
 * @param {string} file    Where to write it.
 * @param {Array<{name: string, data: Buffer}>} entries Files, in order.
 */
function writeZip(file, entries) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const sum = crc32(entry.data);
    const deflated = zlib.deflateRawSync(entry.data, { level: 9 });

    // Storing beats deflating when deflating made it bigger.
    const stored = deflated.length >= entry.data.length;
    const payload = stored ? entry.data : deflated;
    const method = stored ? 0 : 8;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: names are UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(sum, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    locals.push(local, name, payload);

    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(0x031e, 4); // made by: unix
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x0800, 8);
    directory.writeUInt16LE(method, 10);
    directory.writeUInt16LE(DOS_TIME, 12);
    directory.writeUInt16LE(DOS_DATE, 14);
    directory.writeUInt32LE(sum, 16);
    directory.writeUInt32LE(payload.length, 20);
    directory.writeUInt32LE(entry.data.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt16LE(0, 30); // extra
    directory.writeUInt16LE(0, 32); // comment
    directory.writeUInt16LE(0, 34); // disk
    directory.writeUInt16LE(0, 36); // internal attributes
    // Shifted with >>> 0: a 32-bit shift in JavaScript is signed, and this
    // value overflows into a negative number without it.
    directory.writeUInt32LE((0o100644 << 16) >>> 0, 38); // unix mode
    directory.writeUInt32LE(offset, 42);

    central.push(directory, name);

    offset += local.length + name.length + payload.length;
  }

  const body = Buffer.concat(locals);
  const directory = Buffer.concat(central);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(body.length, 16);
  end.writeUInt16LE(0, 20);

  fs.writeFileSync(file, Buffer.concat([body, directory, end]));
}

/* -------------------------------------------------------------------------
 * Collect
 * ---------------------------------------------------------------------- */

/**
 * Every file below a path, as archive entries.
 *
 * Entry names always use a forward slash, whatever the platform separator is.
 *
 * @param {string} from Absolute path to a file or directory.
 * @param {string} base Its name inside the archive.
 * @returns {Array<{name: string, data: Buffer}>} Entries, sorted by name.
 */
function collect(from, base) {
  const stat = fs.statSync(from);

  if (stat.isFile()) {
    return [{ name: base, data: fs.readFileSync(from) }];
  }

  const found = [];
  for (const name of fs.readdirSync(from).sort()) {
    found.push(...collect(path.join(from, name), `${base}/${name}`));
  }
  return found;
}

const entries = [];
const missing = [];

for (const name of INCLUDE) {
  const from = path.join(root, name);
  if (!fs.existsSync(from)) {
    missing.push(name);
    continue;
  }
  entries.push(...collect(from, `pterodoc/${name}`));
}

entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

if (!entries.some((entry) => entry.name.endsWith('assets/vendor/prism/prism.js'))) {
  process.stdout.write('note: Prism is not vendored, so nothing will be highlighted. Run `npm run vendor` first.\n');
}
if (missing.length > 0) {
  process.stdout.write(`note: not present, so not packaged: ${missing.join(', ')}\n`);
}

const output = path.join(root, 'pterodoc.zip');
writeZip(output, entries);

const size = (fs.statSync(output).size / 1024).toFixed(0);
process.stdout.write(`wrote ${path.relative(process.cwd(), output)} — ${entries.length} files, ${size} kB\n`);
