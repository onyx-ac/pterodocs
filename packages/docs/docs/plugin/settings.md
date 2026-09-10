---
title: Settings
description: Site-wide defaults under Settings, pterodocs — and the one setting that silently disables everything if it disagrees with your config.
---

# Settings

**Settings → pterodocs.** Every setting is a default that a single block can override from
the block inspector.

They are stored in one option, exposed over the REST API, so the settings page and the
block inspector read the same source. A block says "inherit" by simply not carrying an
attribute.

:::warning `classPrefix` must match your config

The plugin styles what it finds under **its** configured class prefix. pterodocs writes
classes under [`render.classPrefix`](../config/render#classprefix), which defaults to
`pterodocs` but is often changed.

If the two disagree, the plugin loads on the page and **does nothing at all** — no error,
no warning, just an unstyled page with an active plugin. It is the first thing to check
when the plugin appears to have no effect.

`pterodocs doctor` reports a mismatch.

:::

## What you can set

| Panel | Settings |
| :--- | :--- |
| **Layout** | Class prefix, width, gutter, measure, whether code and tables bleed to the column edge |
| **Sidebar** | Collapsible, collapsed depth, sticky, max height, sticky offset, behaviour on small screens, animation, scroll model |
| **Code** | Syntax highlighting, copy button, line numbers, wrapping |
| **Tables** | Scrolling |
| **Breadcrumb** | Separator, schema markup |
| **Appearance** | Colour scheme |

## Settings are never touched by a sync

This is the durable place to change how the documentation looks. A sync rewrites page
content and nothing else — it does not read or write these settings.

So the division is:

| | |
| :--- | :--- |
| **The markdown** | What the documentation says |
| **`pterodocs.config.mjs`** | What gets published, and where |
| **This page** | How it looks and behaves on the site |
| **The block inspector** | A one-off override on one block, or trying something before committing it |

Only the last is at risk from a re-sync — see [Identity and ownership](../concepts/identity).

## Sidebar behaviour on small screens

`bottom-sheet` is the default: below the breakpoint the navigation becomes a sheet that
slides up over the content, opened from a row that shares its space with the breadcrumb.

The pages pterodocs publishes carry a checkbox and a label for exactly this, so the sheet
works **with no JavaScript** — which is why it still behaves when the plugin is not
installed at all.
