import { nodePackage } from '../../rollup.shared.mjs';

export default nodePackage(import.meta.url, {
  index: 'src/index.ts',
  'cli/run': 'src/cli/run.ts',
  'plugin/index': 'src/plugin/index.ts',
});
