import { nodePackage } from '../../rollup.shared.mjs';

export default nodePackage(import.meta.url, {
  index: 'src/index.ts',
  'model/index': 'src/model/index.ts',
  'render/index': 'src/render/index.ts',
  'target/index': 'src/target/index.ts',
  'util/index': 'src/util/index.ts',
});
