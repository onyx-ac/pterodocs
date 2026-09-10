---
title: How it works
description: The page tree, how a page is identified, and what a re-sync overwrites.
---

# How it works

Three ideas explain nearly every behaviour worth knowing about.

- **[The page tree](page-tree)** — your sidebar is the structure that gets published.
- **[Identity and ownership](identity)** — what pterodocs owns, and what a re-sync overwrites.
- **[Prune and purge](prune-and-purge)** — the two ways something gets removed.

## The rule underneath all of it

**Do not re-derive what Docusaurus already knows.**

Sidebar order, permalinks, versions, locales, draft and unlisted status, previous and next
links — all of it comes from Docusaurus's own loader. pterodocs never walks a `docs/`
directory and never parses `sidebars.ts` itself.

That is why a category's position is right, why a front-matter `slug` is honoured for free,
and why `sidebar_position` behaves exactly as it does on the Docusaurus site. It is also
why the tool needs a working Docusaurus site rather than just a folder of markdown.
