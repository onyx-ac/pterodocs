import { builtinModules, createRequire } from 'node:module';
import typescript from '@rollup/plugin-typescript';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

// Nothing is bundled from node_modules: this is a Node CLI, not a browser
// artifact, and inlining the remark ecosystem would only make stack traces
// worse. Docusaurus is resolved from the *site* at runtime, never from here.
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

export default {
  input: {
    index: 'src/index.ts',
    cli: 'src/cli/run.ts',
    plugin: 'src/plugin/index.ts',
  },
  external: isExternal,
  output: {
    dir: 'lib',
    format: 'es',
    // Entries sit directly in lib/ so `version.ts` can read ../package.json.
    entryFileNames: '[name].js',
    chunkFileNames: 'chunks/[name]-[hash].js',
    sourcemap: true,
    generatedCode: 'es2015',
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      // tsc owns the declarations; this pass only emits JavaScript.
      declaration: false,
      declarationMap: false,
      emitDeclarationOnly: false,
      composite: false,
      incremental: false,
      outDir: 'lib',
      sourceMap: true,
    }),
  ],
};
