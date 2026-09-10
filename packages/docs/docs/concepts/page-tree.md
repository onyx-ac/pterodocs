---
title: The page tree
description: How a sidebar becomes a hierarchy of WordPress pages, and what decides each page's position.
---

# The page tree

Pages mirror your documentation URLs. `/docs/guides/sync` on Docusaurus becomes
`/<root>/<base>/guides/sync/` on WordPress.

## What becomes a page

A document is published when a **published sidebar reaches it**. That is the whole rule.
[`site.sidebars`](../config/site#sidebars) names which sidebars count.

A document in no published sidebar is not published — not an error, just not part of what
you asked for. A generated API reference in its own sidebar stays on the Docusaurus site
while the hand-written documentation is mirrored.

## Directories become pages too

A category becomes a page of its own, titled by the category label. What it contains
depends on how the category is declared:

| Category link | The page's content |
| :--- | :--- |
| `{ type: 'doc', id }` | That document |
| `{ type: 'generated-index' }` | A list of children, grouped by the categories that named them |
| none | The same generated list, when [`layout.childIndex`](../config/layout#childindex) is `auto` |

## Position

Two things are derived from sidebar order and stored on each page:

- **`menu_order`** — ten times the position among siblings, matching WordPress's
  convention of leaving room to insert by hand.
- **Previous and next** — from Docusaurus's own pagination, so the links match the
  Docusaurus site exactly.

## Where the tree hangs

[`target.root`](../config/target#root-and-base) and `target.base` decide the path, and they
divide it into two ownerships:

```
/products/pterodocs/docs/intro/
 |________________| |__| |____|
   created once     root  the tree
   never edited     owned owned
```

Everything above the last segment is created if missing — each with a navigation block
listing what is under it — and then never touched again. That is what lets you author a
product page by hand at `/products/pterodocs` and have a sync leave it alone forever.

## Links

A link between two published documents is rewritten to the WordPress URL. A link to a
document this run does not publish points back at the Docusaurus site, or is dropped —
see [`render.unpublishedLinks`](../config/render#unpublishedlinks).

Relative links resolve against the linking document's own permalink, which is what makes
this work regardless of where the documentation is mounted.
