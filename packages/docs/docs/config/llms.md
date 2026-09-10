---
title: llms
description: llms.txt and llms-full.txt, built from what the run published rather than from the Docusaurus build.
---

# `llms`

The two files an LLM reads instead of the site, described at
[llmstxt.org](https://llmstxt.org).

```js
llms: {
  index: true,
  full: true,
  publish: true,
  title: '',
  description: '',
}
```

Every run writes both into the output directory, and stores them on the documentation root
page for the WordPress plugin to serve:

```
https://example.com/<root>/<base>/llms.txt
https://example.com/<root>/<base>/llms-full.txt
```

## Why they are generated, not copied

A Docusaurus plugin can write these at build time, and if you have one, it is describing a
different website. pterodocs builds them from **what this run published**:

- **The links are the WordPress URLs.** An index served from your site whose every link
  points at a Docusaurus deployment is worse than no index.
- **The selection is what was published** — the sidebars, locales and versions your
  configuration names. A build-time plugin has its own idea of "the docs", which may
  include pages you do not publish and exclude pages you do.
- **It needs no build.** `pterodocs sync` reads the loaded site model and never looks at
  `build/`, which on most runs does not exist.

The markdown copy is taken in the middle of the render — just after links have been
pointed at WordPress and before the tree becomes blocks — so image sources resolve to
their uploaded copies exactly as the image blocks do.

## Where they are served from

The documentation's own root, not the top of the domain. `/llms.txt` is the convention,
but that file is meant to describe everything a site publishes, and pterodocs only knows
about its own tree — claiming the site root would promise the whole site and deliver a
subtree, and would collide with any SEO plugin that generates one.

The plugin advertises the real location from a `<link rel="alternate">` on documentation
pages and a comment in `robots.txt`.

## `index` and `full`

**Both default `true`.** `index` writes `llms.txt` — the title, a summary, and every
published page as a link, nested to match your sidebar. `full` writes `llms-full.txt` —
the same index with every document inlined as markdown.

## `publish`

**Default `true`.** Store them on the site as well as writing them locally.

Serving them needs the plugin, because WordPress serves nothing statically. Without it the
site refuses the metadata, the run reports it as a warning, and the files are still written
to the output directory:

```
warning llms-not-stored: WordPress refused the llms.txt metadata. The pterodocs
plugin registers it, so this usually means it is not installed or not active.
```

The publish itself is never failed over this. The pages matter more than the index.

## `title` and `description`

The heading and the summary. Default to the site's own title and the documentation root's
description.

## Multiple locales

A site has one root, so it gets one `llms.txt`, describing the primary locale. A run that
published others says so rather than dropping them silently:

```
info llms-single-locale: llms.txt describes the "en" documentation; the other
2 locale(s) published are not indexed.
```
