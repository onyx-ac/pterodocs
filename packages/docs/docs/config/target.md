---
title: target
description: Where the documentation is published — the path it hangs from, the status pages take, and how a busy site is retried.
---

# `target`

Where the pages go.

```js
target: {
  type: 'wordpress',
  url: 'https://example.com',
  root: '/docs',
  base: '',
  title: '',
  status: 'publish',
  template: '',
  lang: '',
  meta: { description: '' },
  methodOverride: false,
  retry: { attempts: 4, baseDelayMs: 1000, maxDelayMs: 30000 },
}
```

## `root` and `base`

**`root` defaults to `/docs`; `base` defaults to `''`.** Together they decide the path the
tree hangs from, and they are separate because they are owned differently:

```
root: '/products/pterodocs'
base: 'docs'
                                    →  /products/pterodocs/docs/
```

| | |
| :--- | :--- |
| **Everything above the last segment** | Created once if missing, never edited again. Yours to design. |
| **The last segment** | The documentation root. pterodocs owns its content. |

So with the pair above, `/products` and `/products/pterodocs` are created as stub pages if
they do not exist — each with a navigation block listing what is under it — and then left
alone forever. `/products/pterodocs/docs/` is the documentation root, rewritten on every run.

That is why this site's product page can be authored by hand in WordPress: it sits above
the root, so a sync never touches it.

Setting `base: ''` publishes the documentation directly at the root path.

`--root` and `--base` override, as do `WP_ROOT` and `WP_BASE`. Every segment must be a
slug: lowercase letters, digits, hyphens and underscores.

## `url`

The WordPress site's origin. Usually supplied as `WP_URL` instead, since it travels with
the credentials.

## `status`

**Default `'publish'`.** Also `'draft'` and `'private'`. Applied to every synced page, and
compared on every run — so changing it here republishes everything with the new status.

`--status` and `WP_STATUS` override. `--status draft` is a good way to stage a large first
import for review.

## `title`

Title of the documentation root when no document claims it. If a document sits at the root
of your tree, its own title wins.

## `template`

A WordPress page template slug. Empty means the theme's default. It is compared like any
other field, so setting it moves every page onto that template on the next run.

A site whose theme has no such template will refuse it; pterodocs then publishes the page
without it and warns rather than failing.

## `meta.description`

Names a WordPress custom field that should receive each page's excerpt. For Jetpack:

```js
meta: { description: 'advanced_seo_description' },
```

Left empty, no metadata is written. A locked-down site that refuses the field gets the
page published without it, with a warning.

## `lang`

A Polylang language code. Set when publishing more than one locale.

## `methodOverride`

**Default `false`.** Some hosts block `DELETE`. With this on, deletions are sent as `POST`
with an `X-HTTP-Method-Override: DELETE` header. `METHOD_OVERRIDE=1` also turns it on.

## `retry`

**Defaults: 4 attempts, 1s base delay, 30s cap.** Exponential backoff, honouring
`Retry-After`. Only `429` and `5xx` are retried — a `4xx` is a real answer and is not
worth repeating.

## `auth`

Names the environment variables holding the credentials, if the defaults do not suit:

```js
auth: { userEnv: 'WP_USER', passwordEnv: 'WP_APP_PASSWORD' },
```
