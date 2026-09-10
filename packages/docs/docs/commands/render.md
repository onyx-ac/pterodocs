---
title: render
description: Render every page to the output directory without contacting anything.
---

# `render`

```bash
pterodocs render
```

Renders every page and writes the result to the output directory. It contacts nothing and
needs no credentials, which makes it the safe thing to run first, and safe in CI.

## What it writes

```
.pterodocs/
  pages/<locale>/<version>/<path>.html   the composed block markup, one file per page
  manifest.json                          every page, with its parent, slug, order and URL
  media.json                             every image, its hash and whether it uploaded
  plan.json                              what a sync would do, and every issue raised
  docs.css                               the stylesheet the pages were rendered against
  llms.txt, llms-full.txt                the LLM index and full text
```

Open a file under `pages/` to see exactly what would be stored as a page's content.

## Reviewing a change

`render` is how you review a rendering change before it reaches a site. Render, keep the
output, make the change, render again, and diff the two trees:

```bash
npx pterodocs render --out /tmp/before
# change something
npx pterodocs render --out /tmp/after
diff -r /tmp/before/pages /tmp/after/pages
```

An empty diff means the change is invisible to WordPress.

## `docs.css`

Written whether or not the pages carry it, because storing one stylesheet on fifty pages
is fifty copies. Paste it into **Appearance → Customise → Additional CSS** and set
[`render.styles`](../config/render#styles) to `'none'`.

## Relation to `sync`

`render` is `sync` with the network switched off — the same code path, the same output.
`sync --offline` is the same thing.
