import { nodePackage } from '../../rollup.shared.mjs';

export default nodePackage(import.meta.url, {
  index: 'src/index.ts',
});
