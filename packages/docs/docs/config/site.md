---
title: site
description: Which documents get published — instances, sidebars, versions, locales, drafts and orphans.
---

# `site`

What to publish. Every option here is a filter over what Docusaurus loaded.

```js
site: {
  instances: 'all',
  sidebars: ['docs'],
  versions: 'last',
  locales: 'default',
  includeDrafts: false,
  includeUnlisted: false,
  includeOrphans: false,
}
```

## `sidebars`

**Default `'all'`.** The sidebar ids to publish, or `'all'`.

This is the most consequential option in the file, because **a document no published
sidebar reaches is not published**. That is a feature: a generated API reference in its own
sidebar can be left on the Docusaurus site while the hand-written documentation is
mirrored to WordPress.

```js
// Only the hand-written sidebar; the generated API reference stays behind.
sidebars: ['docs'],
```

Links from a published page into an unpublished one still work — they point back at the
Docusaurus site. See [`render.unpublishedLinks`](render#unpublishedlinks).

## `instances`

**Default `'all'`.** Docs plugin instance ids, for a site running
`@docusaurus/plugin-content-docs` more than once. `--instance` overrides, and repeats.

## `versions`

**Default `'last'`** — the version served at the docs root, which is what most sites want.
Also `'all'`, or explicit names:

```js
versions: ['current', '2.0.0'],
```

`--docs-version` and `--all-versions` override.

## `locales`

**Default `'default'`** — the site's default locale only. `'all'` publishes every locale
the site declares; an array names them. `--locale` and `--all-locales` override.

Multiple locales need Polylang on the WordPress side; set `target.lang` accordingly.

## `includeDrafts`

**Default `false`.** Docusaurus excludes drafts from a production build, and so does
pterodocs. Turning this on publishes them, and the run reports how many were included.

## `includeUnlisted`

**Default `false`.** An unlisted document is reachable but hidden from navigation. With
this on it is published and appears in the tree.

## `includeOrphans`

**Default `false`.** A document that belongs to no sidebar at all. Off, it is skipped
silently — it was not part of what you asked for. On, it is published as a child of the
root.
