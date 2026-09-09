/**
 * Everything that knows Docusaurus exists.
 *
 * The model vocabulary it produces belongs to `src/model`; it is re-exported
 * here so a caller that thinks in Docusaurus terms has one import.
 */

export type {
  Doc,
  DocNeighbour,
  DocsInstance,
  DocsVersion,
  SidebarCategoryItem,
  SidebarCategoryLink,
  SidebarDocItem,
  SidebarHtmlItem,
  SidebarItem,
  SidebarLinkItem,
  SiteModel,
} from '@pterodocs/core/model';
export { buildPageTree } from '@pterodocs/core/model';
export type { BuildPageTreeInput, PageKind, PageNode, PageTree } from '@pterodocs/core/model';
export { createCaptureReader, readCapture, writeCapture, serializeModel } from '@pterodocs/core/model';
export type { CapturedModel } from '@pterodocs/core/model';
export { createMemoryReader } from '@pterodocs/core/model';
export type { SourceReader } from '@pterodocs/core/model';
export { loadModel, toSiteModel } from './model';
export type { LoadModelOptions } from './model';
export { loadDocusaurusServer, SUPPORTED_RANGE } from './server';
export type { DocusaurusServer, LoadedSite, LoadSiteParams } from './server';
export { createDocusaurusReader, readerFromLoadedSite } from './reader';
