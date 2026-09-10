---
title: pterodocs
sidebar_label: Introduction
description: Publish a Docusaurus site to WordPress as a tree of pages built from core Gutenberg blocks.
slug: /
---

# pterodocs

pterodocs publishes a Docusaurus site to WordPress as a tree of real pages, built from
**core Gutenberg blocks**. No custom block types, no shortcodes, no page builder: the
markup it writes is the markup the WordPress editor itself would have written.

This site is published by pterodocs. If you are reading it on onyx.ac, that is the proof.

## Why core blocks

Because the pages have to outlive the tool. A documentation set stored as proprietary
markup is hostage to whatever wrote it. Stored as `core/paragraph`, `core/heading`,
`core/code` and `core/table`, it is ordinary WordPress content — editable by hand,
readable by every theme, and unaffected if pterodocs is never run again.

The [WordPress plugin](plugin/) is optional for the same reason. It makes the published
documentation look and behave better, and deactivating it leaves pages that still read.

## What a run does

```bash
npx pterodocs sync --env-file .env
```

1. Loads your site through **Docusaurus's own loader** — so sidebar order, permalinks,
   versions, locales and draft status are the ones Docusaurus itself would use.
2. Builds a page tree from the sidebars you name.
3. Renders each document to core blocks, uploading images as it goes.
4. Writes only what differs. A second run reports everything as `unchanged`.

## Where to start

- [Get started](get-started/) — install, credentials, and a first dry run.
- [Configuration](config/) — every option in `pterodocs.config.mjs`.
- [Commands](commands/) — `sync`, `render`, `doctor`, `capture`, `purge`, `init`.
- [How it works](concepts/) — the page tree, identity, and what a re-sync overwrites.

:::warning A re-sync rewrites page content

pterodocs owns the body of every page it publishes. Edits made in the WordPress editor
on a synced page are **reverted by the next sync**. The durable places to change things
are your `pterodocs.config.mjs` and the plugin's settings page — neither is ever touched
by a run. See [Identity and ownership](concepts/identity).

:::
