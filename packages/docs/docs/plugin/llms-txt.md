---
title: llms.txt
description: How the plugin serves llms.txt and llms-full.txt, and why they live at the documentation root rather than the site root.
---

# llms.txt

pterodocs builds `llms.txt` and `llms-full.txt` from the documentation it publishes and
stores them on the documentation root page. The plugin serves them:

```
https://example.com/<root>/<base>/llms.txt
https://example.com/<root>/<base>/llms-full.txt
```

Both are `text/plain`, and both carry `X-Robots-Tag: noindex` — they are for machines, not
for search results.

## Why not `/llms.txt`

The convention puts the file at the top of a site. But that file is meant to describe
**everything** a domain publishes, and pterodocs only knows about its own tree. Serving a
subtree from a path that promises the whole site would be a lie that gets worse as the site
grows, and it would collide with any SEO plugin that generates one.

So it is served from the documentation's own root. There is no standard way to advertise an
`llms.txt` that is not at the site root — the convention *is* the path — so the plugin adds
two hints rather than a mechanism:

- a `<link rel="alternate" type="text/plain">` on documentation pages
- a comment in `robots.txt` naming the real location

## Nothing appears until a sync has run

The plugin serves what pterodocs stored. Before the first sync there is nothing there, and
the URL 404s exactly as WordPress would have without the plugin.

## When the sync says the site refused it

```
warning llms-not-stored: WordPress refused the llms.txt metadata. The pterodocs
plugin registers it, so this usually means it is not installed or not active.
```

That is a 400 from WordPress rejecting a metadata key nothing registered. The plugin
registers those keys, so the message means it was not active when the run happened. The
pages still published — metadata is never worth failing a publish over.

## How it is stored

On the documentation root page, as post metadata, rather than in a site option. Three
consequences worth knowing:

- A site publishing two documentation sets gets two of them, each correct.
- Each is removed with the page it belongs to.
- The plugin needs no configuration to find them: it resolves the request path to a page
  and asks whether **that page** carries an index. So it works at whatever path you publish
  to, with nothing to keep in sync.

## Turning it off

[`llms.publish: false`](../config/llms#publish) keeps the files local. `llms.index` and
`llms.full` turn off either file entirely.
