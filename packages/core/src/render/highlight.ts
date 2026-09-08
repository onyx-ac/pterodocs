/**
 * Syntax highlighting, done here rather than in the browser.
 *
 * A site that has installed nothing has no JavaScript to run, so the only place
 * highlighting can happen is at publish time. Prism runs perfectly well in Node,
 * and what it emits is `<span class="token keyword">` — classes, not colours.
 *
 * That distinction is the whole design. The palette lives in the stylesheet, so
 * changing how code looks is a CSS change rather than a re-publication of every
 * page, and the markup is identical to what the WordPress plugin's browser-side
 * Prism produces, so one set of rules dresses both.
 *
 * Grammars are resolved through Prism's own manifest before being loaded, so an
 * unknown language is a quiet miss rather than a warning printed at whoever is
 * running the build.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Prism's description of one grammar. */
interface Component {
  /** Grammars that must be loaded first. */
  require?: string | string[];
  /** Other names this grammar answers to. */
  alias?: string | string[];
}

/** The subset of Prism this module uses. */
interface PrismLike {
  languages: Record<string, unknown>;
  highlight(code: string, grammar: unknown, language: string): string;
}

let prism: PrismLike | undefined;
let manifest: Record<string, Component> | undefined;
let aliases: Map<string, string> | undefined;

/** Load Prism and its manifest once, the first time a fence needs them. */
function load(): void {
  if (prism) return;

  prism = require('prismjs') as PrismLike;
  const components = require('prismjs/components.js') as {
    languages: Record<string, Component & { meta?: unknown }>;
  };

  manifest = {};
  aliases = new Map();

  for (const [name, entry] of Object.entries(components.languages)) {
    // `meta` sits alongside the grammars in the same object and is not one.
    if (name === 'meta' || typeof entry !== 'object' || entry === null) continue;

    manifest[name] = entry;
    aliases.set(name, name);

    const alias = entry.alias;
    for (const other of Array.isArray(alias) ? alias : alias ? [alias] : []) {
      aliases.set(other, name);
    }
  }
}

/**
 * Make a grammar available, with whatever it depends on.
 *
 * @param name A Prism grammar name, already resolved from any alias.
 * @param seen Guards against a cycle in the dependency data.
 * @returns Whether the grammar can now be used.
 */
function ensure(name: string, seen = new Set<string>()): boolean {
  if (!prism || !manifest) return false;
  if (prism.languages[name]) return true;
  if (seen.has(name)) return false;
  seen.add(name);

  const entry = manifest[name];
  if (!entry) return false;

  const needs = entry.require;
  for (const dependency of Array.isArray(needs) ? needs : needs ? [needs] : []) {
    ensure(dependency, seen);
  }

  try {
    require(`prismjs/components/prism-${name}.js`);
  } catch {
    return false;
  }

  return Boolean(prism.languages[name]);
}

/**
 * Highlight a fence.
 *
 * @param code The source, exactly as written.
 * @param language The fence's language, or an alias for one.
 * @returns Markup with Prism's token classes, or undefined when the language is
 *   not one Prism knows — in which case the caller should escape the source
 *   itself and leave it plain.
 */
export function highlightCode(code: string, language: string): string | undefined {
  if (!language) return undefined;

  load();
  if (!prism || !aliases) return undefined;

  const name = aliases.get(language.toLowerCase());
  if (!name || !ensure(name)) return undefined;

  try {
    // Prism escapes `&`, `<` and `>` itself. `[` it does not, and WordPress
    // expands shortcodes inside code as happily as anywhere else, so that one
    // is still ours to deal with. Prism never puts a `[` in an attribute, so
    // replacing every one of them cannot damage the markup it produced.
    return prism.highlight(code, prism.languages[name], name).replace(/\[/g, '&#91;');
  } catch {
    return undefined;
  }
}
