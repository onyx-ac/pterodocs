// The four packages in one process. Order is irrelevant — siblings are external
// — but `build:types` must have run first, because each package typechecks
// against its siblings' emitted declarations.
import core from './packages/core/rollup.config.mjs';
import docusaurus from './packages/docusaurus/rollup.config.mjs';
import wordpress from './packages/wordpress/rollup.config.mjs';
import cli from './packages/cli/rollup.config.mjs';

export default [core, docusaurus, wordpress, cli];
