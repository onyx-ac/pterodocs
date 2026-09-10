---
title: The WordPress plugin
description: What the optional plugin adds, how it is built, and why deactivating it still leaves readable pages.
---

# The WordPress plugin

Optional. It makes the pages pterodocs publishes look and behave like documentation.

Install it from the zip in the repository, or build it with
`npm run --workspace @pterodocs/wp-plugin build`.

## What it adds

- A collapsible sidebar whose open branches are decided **in PHP**, so the first paint is
  right and there is no flash of a fully expanded tree.
- A responsive bottom sheet for the navigation on small screens.
- Highlighted code with a copy button.
- Tables that scroll inside their own region instead of overflowing.
- A full-width layout built from your theme's own palette and spacing scale.
- [`llms.txt` and `llms-full.txt`](llms-txt), served from the documentation root.

## Four rules it is built on

**It registers no block types.** Everything is `render_block` filters over the core blocks
pterodocs already emits. The test of any change is: deactivate the plugin, and the
documentation must still read.

**It builds on the block supports, never fights them.** Tokens resolve through
`--wp--preset--*` and `--wp--style--*` first, so a theme's palette and spacing scale drive
the design. Colours are derived with `color-mix` from the block's own resolved colours — so
painting a code block from your palette repaints its syntax colours to match. Every default
sits inside `:where()`, which scores zero specificity, so anything you set in the inspector
wins. There is no `!important` in the stylesheet.

**The server decides state; the script only changes it.** Which branches are open is settled
before the page is sent.

**Anything pterodocs emits for the plugin travels in block comment attributes, never in
markup.** WordPress re-runs a block's save function on edit and compares — markup core
would not have written is markup the editor refuses.

## No build step

The plugin is PHP, CSS and plain JavaScript, with no bundler. The file that ships is the
file that was written.

## Deactivating it

The pages are core blocks and stay readable — that is the whole design. You lose the
sidebar behaviour, the copy button, the table scrolling and the `llms.txt` route. You do
not lose any content.

## Next

- [Settings](settings) — the site-wide defaults, and the one that must match your config.
- [llms.txt](llms-txt) — what it serves, and from where.
