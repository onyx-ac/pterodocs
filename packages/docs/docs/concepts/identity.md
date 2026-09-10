---
title: Identity and ownership
description: How pterodocs recognises a page it wrote, what a re-sync overwrites, and the one surprise worth knowing about.
---

# Identity and ownership

## How a page is identified

By its **parent and its slug** — not by a stored id, not by a database of past runs.

That has a consequence worth stating plainly: pterodocs keeps no state between runs. It
reads the site, works out what should be there, and writes the difference. Delete
`.pterodocs/`, move the repository, run from another machine — the result is the same.

It also means renaming a document is a **move**. The old slug no longer matches anything,
so a new page appears at the new slug and the old one is left behind until you
[prune](prune-and-purge) it.

## What a run overwrites

For every page it owns, a sync compares and rewrites: title, content, excerpt, status,
menu order, template, parent, slug, and any configured metadata field.

If a field matches, nothing is sent. That is why a second run reports `unchanged`.

:::warning Editor changes are reverted

pterodocs owns the **content** of every page it publishes. If you open a synced page in the
WordPress editor and change a block — a colour, a padding, a heading — the next sync
rewrites the page and the change is gone.

This is the surprise that reads as a bug, so it is worth being explicit about where changes
should live instead:

| Change | Where it belongs |
| :--- | :--- |
| Anything about the documentation's content | The markdown, in Docusaurus |
| Anything about how it is published | `pterodocs.config.mjs` |
| Site-wide appearance and behaviour | The [plugin's settings page](../plugin/settings), never touched by a sync |

The editor controls are for pages WordPress owns, and for trying something before
committing it to configuration.

:::

## What a run never touches

- **Pages above the documentation root.** Created once if missing, then owned by you.
- **Any page pterodocs does not recognise as its own.** Recognition is by class prefix:
  the markup carries `<prefix>-docs` classes, and a page without them is left alone by both
  prune and purge, even inside the tree.
- **The plugin's settings.** They are site configuration, not content.
- **Media already uploaded.** Files are identified by a content hash in the slug, so the
  same image is uploaded once and reused.
