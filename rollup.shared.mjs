import path from 'node:path';
import { builtinModules, createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';

/**
 * One Node package: tsc owns every .d.ts under lib/, rollup owns every .js.
 *
 * Nothing is bundled from node_modules: this is a Node CLI, not a browser
 * artefact, and inlining the remark ecosystem would only make stack traces
 * worse. Sibling `@pterodoc/*` packages are external for free, because they are
 * ordinary entries in the package's own dependencies.
 *
 * Every path is absolutised against the calling config, because rollup resolves
 * a relative path against the working directory: without this the aggregated
 * root build would look for `src/index.ts` at the repository root.
 *
 * @param configUrl `import.meta.url` of the calling package's rollup config.
 * @param entries Entry name — its path under lib/, without extension — to source file.
 */
export function nodePackage(configUrl, entries) {
  const dir = path.dirname(fileURLToPath(configUrl));
  const pkg = createRequire(configUrl)('./package.json');

  const externalNames = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...builtinModules,
  ];

  /** @param {string} id */
  const isExternal = (id) =>
    id.startsWith('node:') ||
    /^@docusaurus\//.test(id) ||
    externalNames.some((name) => id === name || id.startsWith(`${name}/`));

  return {
    input: Object.fromEntries(
      Object.entries(entries).map(([name, file]) => [name, path.join(dir, file)]),
    ),
    external: isExternal,
    output: {
      dir: path.join(dir, 'lib'),
      format: 'es',
      // Entry names mirror the source path under src/, so lib/<x>.js and
      // lib/<x>.d.ts always agree and every `exports` path is mechanical.
      entryFileNames: '[name].js',
      chunkFileNames: 'chunks/[name]-[hash].js',
      sourcemap: true,
      generatedCode: 'es2015',
    },
    plugins: [
      typescript({
        tsconfig: path.join(dir, 'tsconfig.json'),
        // tsc owns the declarations; this pass only emits JavaScript.
        declaration: false,
        declarationMap: false,
        emitDeclarationOnly: false,
        composite: false,
        incremental: false,
        rootDir: path.join(dir, 'src'),
        outDir: path.join(dir, 'lib'),
        sourceMap: true,
      }),
      // After typescript, never before: the token is declared as a `declare
      // const` in globals.d.ts, and a text replace over the raw source would
      // rewrite that declaration into a syntax error. By now it is gone.
      replace({
        preventAssignment: true,
        values: { __PTERODOC_VERSION__: JSON.stringify(pkg.version) },
      }),
    ],
  };
}
