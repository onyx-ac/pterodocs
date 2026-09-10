---
title: purge
description: Remove documentation pterodocs published at a path — a different job from pruning, and deliberately a different command.
---

# `purge`

```bash
pterodocs purge --root /products/old-name --base docs --env-file .env
```

Removes the documentation pterodocs published at one path. **Reports only, until you pass
`--apply`.**

## How it differs from `--prune`

They sound alike and are the opposite question.

| | `sync --prune` | `purge` |
| :--- | :--- | :--- |
| Asks | "What is left over from this documentation?" | "What did pterodocs put at this path?" |
| Needs the site model | **Yes** | **No** |
| Scope | Inside the tree being published | The whole tree at that path, root included |

Pruning happens during a sync and needs to know what the documentation *should* contain.
Purging needs no model at all, which is the point: the usual reason to purge is that the
documentation **moved**, and the old location is no longer part of any run. Asking
Docusaurus to describe a site in order to delete pages from a place that site no longer
publishes to would be absurd, and slow.

## The move it exists for

```bash
# Publish at the new path
pterodocs sync --root /products/new-name --base docs --env-file .env

# Then take away the old tree, root and all
pterodocs purge --root /products/old-name --base docs --env-file .env
pterodocs purge --root /products/old-name --base docs --apply --env-file .env
```

## What it will not remove

Every candidate page is fetched and read before anything happens. A page pterodocs cannot
recognise as its own is left standing, however squarely it sits inside the tree:

```
trashed /products/old-name/docs/intro/
kept    /products/old-name/docs/hand-written/ — not written by pterodocs
```

Recognition is by class prefix, so a tree published under a different
[`render.classPrefix`](../config/render#classprefix) is not recognised and **nothing is
removed**. Pass the prefix the tree was published with.

Pages *above* the documentation root are never touched — they were created once and never
owned.

## Nothing is permanently deleted

Everything goes to the WordPress trash, deepest first so a parent is never removed before
its children. Emptying the trash is your decision, made in WordPress.
