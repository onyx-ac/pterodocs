---
title: layout
description: The shape of each published page — columns, navigation, breadcrumb, pagination and the child index.
---

# `layout`

What each published page is made of. These become real block attributes, so the WordPress
editor sees exactly what you configured.

```js
layout: {
  kind: 'two-column',
  navWidth: '25%',
  mainWidth: '75%',
  align: 'full',
  nav: 'page-list',
  breadcrumb: true,
  pagination: true,
  childIndex: 'auto',
  navToggle: true,
}
```

Every value above is the default.

## `align`

**Default `'full'`.** The documentation root is a `core/columns` block, and `full` gives it
the theme's own full-width alignment.

This matters more than it looks. Without it a theme's constrained content width squeezes
two columns into a single narrow measure, and documentation arrives looking like an
unstyled outline. Because the pages then escape the theme's page padding, the stylesheet
pterodocs emits puts that padding back — using the theme's own root-padding variables
where the theme defines them.

## `nav`

**Default `'page-list'`.** The navigation column is a `core/page-list` block pointed at the
documentation root's page id, so WordPress renders the tree server-side, always current,
with no stored copy to go stale.

`'none'` omits the navigation column entirely.

## `navWidth` and `mainWidth`

**Defaults `'25%'` and `'75%'`.** The column widths. `navWidth` also reaches the emitted
stylesheet as a custom property, because the layout is a CSS grid and a grid ignores the
`flex-basis` the columns carry.

## `breadcrumb`

**Default `true`.** A trail from the documentation root to the current page, at the top of
the main column. On a small screen it shares a row with the navigation toggle.

## `pagination`

**Default `true`.** Previous and next links at the foot of each page, in **Docusaurus's own
sidebar order** — not alphabetical, not by date.

## `childIndex`

**Default `'auto'`.** What a category page with no document of its own contains:

| Value | Result |
| :--- | :--- |
| `'auto'` | A list of its children, grouped by the categories that named them |
| `'none'` | Nothing |

## `navToggle`

**Default `true`.** Emits a checkbox and a label so the navigation can open as a bottom
sheet on a narrow screen — with no JavaScript at all. The stylesheet does the rest.

Turn it off if your theme provides its own documentation navigation.

## `kind`

**Default `'two-column'`.** The only value today.
