/**
 * Command line entry point.
 *
 * The only place that catches: every other module raises, and this decides how
 * it is shown and which exit code it becomes.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { EXIT, ConfigError, PterodocError, TargetError } from '../errors';
import { VERSION } from '../version';
import { compareSeverity } from '../util/issues';
import { loadConfig, type ResolvedConfig } from '../config/load';
import {
  createCaptureReader,
  createDocusaurusReader,
  type SourceReader,
} from '../docusaurus/reader';
import { writeCapture } from '../docusaurus/capture';
import { createWordpressTarget } from '../target/wordpress/index';
import type { Target } from '../target/target';
import { runSync } from '../sync/run';
import { parseCliArgs, USAGE, type ParsedArgs } from './args';
import { createReporter, type Reporter } from './reporter';

/** Run the CLI. */
export async function main(argv: string[]): Promise<number> {
  let parsed: ParsedArgs;
  try {
    parsed = parseCliArgs(argv);
  } catch (error) {
    return report(error);
  }

  if (parsed.help) {
    process.stdout.write(`${USAGE}\n`);
    return EXIT.ok;
  }
  if (parsed.version) {
    process.stdout.write(`${VERSION}\n`);
    return EXIT.ok;
  }

  const reporter = createReporter({
    verbose: parsed.verbose,
    quiet: parsed.quiet,
    json: parsed.json,
  });

  try {
    const config = await loadConfig(parsed.flags);
    for (const notice of config.notices) reporter.info(`note: ${notice}`);

    switch (parsed.command) {
      case 'init':
        return await commandInit(config, reporter);
      case 'capture':
        return await commandCapture(config, parsed, reporter);
      case 'doctor':
        return await commandDoctor(config, reporter);
      case 'render':
      case 'sync':
        return await commandSync(config, parsed, reporter);
      default:
        return EXIT.ok;
    }
  } catch (error) {
    return report(error);
  }
}

/** Build the reader the commands share. */
function readerFor(config: ResolvedConfig, reporter: Reporter): SourceReader {
  if (config.modelFile) return createCaptureReader(config.modelFile);
  return createDocusaurusReader({
    siteDir: config.siteDir,
    configPath: config.docusaurusConfig,
    instances: config.instances,
    versions: config.versions,
    includeDrafts: config.includeDrafts,
    warn: (message) => reporter.issue({ code: 'docusaurus-version', severity: 'warning', message }),
  });
}

/**
 * Build the target.
 *
 * Always built, even offline: the target decides what a page's URL is, and a
 * render with the wrong URLs is worse than no render at all. Only opening a
 * session needs credentials.
 */
function targetFor(config: ResolvedConfig): Target {
  return createWordpressTarget({
    url: config.targetUrl,
    user: config.user,
    appPassword: config.appPassword,
    policy: {
      rootSegments: config.rootSegments,
      baseSegments: config.baseSegments,
      primaryVersion: undefined,
      primaryLocale: undefined,
    },
    status: config.status,
    template: config.template,
    lang: config.lang,
    mediaSlugPrefix: config.mediaSlugPrefix,
    methodOverride: config.methodOverride,
    retry: config.retry,
  });
}

/** `sync` and `render`. */
async function commandSync(
  config: ResolvedConfig,
  parsed: ParsedArgs,
  reporter: Reporter,
): Promise<number> {
  const render = parsed.command === 'render';
  const reader = readerFor(config, reporter);
  const target = targetFor(config);
  const renderOnly = render || config.offline;

  const where = `/${[...config.rootSegments, ...config.baseSegments].join('/')}/`;
  reporter.info(
    renderOnly
      ? `Rendering the documentation for ${where}.`
      : `${config.dryRun ? 'Planning' : 'Publishing'} the documentation to ${config.targetUrl}${where} as ${config.status}.`,
  );

  const { plan } = await runSync(config, {
    reader,
    target,
    renderOnly,
    log: (message) => reporter.detail(message),
  });

  if (parsed.capture) {
    await writeCapture(parsed.capture, await reader.read());
    reporter.info(`Model written to ${parsed.capture}`);
  }

  for (const issue of plan.issues) reporter.issue(issue);
  reporter.summary(plan);

  if (plan.mediaPending > 0) {
    reporter.info(
      `${plan.mediaPending} file(s) would be uploaded. Until they are, the rendered pages show the paths from the source.`,
    );
  }
  const pruneable = plan.actions.filter((action) => action.op === 'prune' && action.applied !== true);
  if (pruneable.length > 0) {
    reporter.info(`${pruneable.length} page(s) have no source document. Re-run with --prune to trash them.`);
  }
  if (plan.artifactError) {
    reporter.issue({
      code: 'artifacts-unwritten',
      severity: 'warning',
      message: `The run finished but its output could not be written: ${plan.artifactError}`,
    });
  } else {
    reporter.info(`Rendered pages and plan.json written to ${path.relative(process.cwd(), config.outDir) || config.outDir}/`);
  }
  if (config.dryRun && !config.offline) reporter.info('Dry run: the site was not modified.');

  if (config.strict) {
    const blocking = plan.issues.filter((issue) => compareSeverity(issue.severity, config.strictAt) >= 0);
    if (blocking.length > 0) {
      reporter.info(`\n${blocking.length} issue(s) at or above "${config.strictAt}" with --strict.`);
      return EXIT.strict;
    }
  }
  return EXIT.ok;
}

/** `capture`. */
async function commandCapture(
  config: ResolvedConfig,
  parsed: ParsedArgs,
  reporter: Reporter,
): Promise<number> {
  const file = parsed.capture ?? path.join(config.outDir, 'model.json');
  const model = await readerFor(config, reporter).read();
  await writeCapture(file, model);
  const docs = model.instances.reduce(
    (total, instance) =>
      total + instance.versions.reduce((count, version) => count + version.docs.length, 0),
    0,
  );
  reporter.info(`Captured ${docs} document(s) from ${model.siteDir} to ${file}`);
  return EXIT.ok;
}

/** `doctor`. */
async function commandDoctor(config: ResolvedConfig, reporter: Reporter): Promise<number> {
  reporter.info('Checking the setup.\n');
  reporter.info(`  config      ${config.configFile ?? 'none found; using defaults'}`);
  reporter.info(`  site        ${config.siteDir}`);
  reporter.info(`  target      ${config.targetUrl || 'not set'}`);
  reporter.info(`  root path   /${[...config.rootSegments, ...config.baseSegments].join('/')}/`);
  reporter.info(`  credentials ${config.user ? `as ${config.user}` : 'missing'}`);

  const reader = readerFor(config, reporter);
  const model = await reader.read();
  reporter.info(`  docusaurus  ${model.docusaurusVersion}`);
  reporter.info(`  locales     ${model.locales.join(', ')} (default ${model.defaultLocale})`);
  for (const instance of model.instances) {
    const versions = instance.versions.map((version) => version.name).join(', ');
    const docs = instance.versions.reduce((count, version) => count + version.docs.length, 0);
    reporter.info(`  instance    ${instance.id}: ${docs} document(s), version(s) ${versions}`);
  }

  if (config.offline) {
    reporter.info('\nNo credentials, so the target was not contacted.');
    return EXIT.ok;
  }

  const session = await targetFor(config).open({ locale: model.locale, dryRun: true });
  const index = await session.loadIndex();
  reporter.info(`\nReached the target: ${index.length} page(s) exist.`);

  const media = await session.loadMediaIndex();
  reporter.info(`${media.size} file(s) previously uploaded by pterodoc.`);
  return EXIT.ok;
}

/** `init`. */
async function commandInit(config: ResolvedConfig, reporter: Reporter): Promise<number> {
  const file = path.join(config.siteDir, 'pterodoc.config.mjs');
  try {
    await fs.access(file);
    throw new ConfigError(`${file} already exists.`);
  } catch (error) {
    if (error instanceof ConfigError) throw error;
  }

  await fs.writeFile(
    file,
    `import { defineConfig } from 'pterodoc';

export default defineConfig({
  site: {
    // Sidebars to publish. A document no listed sidebar reaches is not published.
    sidebars: 'all',
    versions: 'last',
    locales: 'default',
  },
  target: {
    type: 'wordpress',
    // Where the documentation hangs on the site. Missing pages along this path
    // are created once and never edited again.
    root: '/docs',
    base: '',
    status: 'publish',
  },
});
`,
    'utf8',
  );
  reporter.info(`Wrote ${file}`);
  return EXIT.ok;
}

/** Present an error the way its type deserves. */
function report(error: unknown): number {
  if (error instanceof ConfigError) {
    process.stderr.write(`\n${error.message}\n`);
    return error.exitCode;
  }
  if (error instanceof TargetError) {
    process.stderr.write(`\nThe target refused a request: ${error.message}\n`);
    if (error.bodySnippet) process.stderr.write(`  body: ${error.bodySnippet}\n`);
    return error.exitCode;
  }
  if (error instanceof PterodocError) {
    process.stderr.write(`\n${error.message}\n`);
    return error.exitCode;
  }
  process.stderr.write(
    `\n${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  return EXIT.internal;
}
