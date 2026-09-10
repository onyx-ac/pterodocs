---
title: render
description: How markdown becomes blocks — the class prefix, the stylesheet, syntax highlighting and what happens to links that leave the tree.
---

# `render`

How a document becomes block markup.

```js
render: {
  classPrefix: 'pterodocs',
  blocks: 'core',
  styles: 'inline',
  highlight: true,
  dedupeTitle: true,
  unpublishedLinks: 'site',
  siteUrl: '',
  excerptLength: 160,
  strings: {},
  localeStrings: {},
}
```

## `classPrefix`

**Default `'pterodocs'`.** Every class name pterodocs writes starts with this —
`pterodocs-docs`, `pterodocs-docs-nav`, `pterodocs-docs-breadcrumb`.

Two things depend on it, and both break quietly if it disagrees:

- The emitted stylesheet is written with the same prefix.
- The [WordPress plugin](../plugin/settings) styles what it finds under **its** configured
  prefix. If the plugin says `pterodocs` and your content says `docstack`, the plugin
  loads and does nothing at all.

Change it only if you have a reason, and change it in both places.

## `styles`

**Default `'inline'`.** Whether a stylesheet travels with each page.

| Value | Meaning |
| :--- | :--- |
| `'inline'` | Each page carries a `core/html` block holding the stylesheet |
| `'none'` | No stylesheet is stored |

`'inline'` is the default because a site that has installed nothing has nowhere else to
read it from — WordPress renders core blocks with almost no opinion. The cost is a copy
per page.

Use `'none'` when the theme already styles these class names, or when the plugin is
installed and bringing its own. Either way `render` still writes `docs.css` to the output
directory, so you can paste it into **Appearance → Customise → Additional CSS** once and
switch to `'none'`.

Every colour in that stylesheet is mixed from `currentColor`, so it follows whatever the
theme paints its text and never assumes a light or a dark theme.

## `highlight`

**Default `true`.** Fenced code blocks are tokenised **at publish time** with Prism, and
what lands in the page is `<span class="token keyword">` — classes, never colours.

The palette therefore lives in CSS, which means restyling code is a stylesheet change, not
a republication of every page. It also means highlighting needs no JavaScript on the front
end and cannot flash unhighlighted first.

A language Prism does not know is left as plain text rather than mangled.

## `blocks`

**Default `'core'`.** `'plugin'` additionally carries instructions the WordPress plugin
understands — chiefly highlighted line ranges, which core blocks cannot express — in block
comment attributes rather than in markup, so WordPress stores the same content either way.
Set it once the plugin is installed; `pterodocs doctor` says whether it is.

## `unpublishedLinks`

**Default `'site'`.** What to do with a link to a document that this run does not publish.

| Value | Result |
| :--- | :--- |
| `'site'` | Points at the Docusaurus site, using the URL Docusaurus itself would serve |
| `'drop'` | Keeps the text, removes the link |

`'site'` is what makes a partial mirror workable: publish the hand-written sidebar, leave
the API reference behind, and cross-references still resolve.

## `dedupeTitle`

**Default `true`.** Drops a leading `# Heading` that repeats the page title, since the
theme prints the title already.

## `excerptLength`

**Default `160`.** Characters of the excerpt, taken from the front-matter description or,
failing that, the opening paragraph.

## `strings` and `localeStrings`

Override the handful of words pterodocs writes — the breadcrumb separator, the previous
and next labels, the "on this page" heading. `localeStrings` keys the same object by
locale.
