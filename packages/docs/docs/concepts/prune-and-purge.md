---
title: Prune and purge
description: The two ways a page is removed, why they are different commands, and why neither deletes anything permanently.
---

# Prune and purge

Two ways something gets removed, answering opposite questions.

| | `sync --prune` | `purge` |
| :--- | :--- | :--- |
| Asks | What is left over from *this* documentation? | What did pterodocs put at *this path*? |
| Needs the site model | Yes | No |
| Scope | Inside the tree being published | The whole tree, root included |
| Runs | During a sync | On its own |

## Pruning

A document you delete leaves a page behind. `--prune` trashes pages under the documentation
root that no document accounts for:

```bash
pterodocs sync --prune --env-file .env
```

It is opt-in because the alternative — deleting by default — turns a mistyped `--only` or a
half-loaded site into data loss.

`--prune` is ignored when `--only` is set, and says so: a restricted run has not seen enough
of the tree to judge what is missing.

## Purging

The documentation moved, and the old location is no longer part of any run:

```bash
pterodocs purge --root /products/old-name --base docs --env-file .env
pterodocs purge --root /products/old-name --base docs --apply --env-file .env
```

`purge` loads no site model at all. Asking Docusaurus to describe a site in order to delete
pages from a place that site no longer publishes to would be absurd, and slow.

See [the purge command](../commands/purge) for the full flags.

## What neither will do

**Remove a page it cannot recognise.** Every candidate is fetched and read first. A page
without pterodocs's class prefix in its content is reported and left standing:

```
kept /docs/hand-written/ - not written by pterodocs
```

A tree published under a different class prefix is not recognised either, so purging with
the wrong prefix removes **nothing** rather than guessing.

**Delete anything permanently.** Both move pages to the WordPress trash, deepest first so a
parent is never removed before its children. Emptying the trash is a decision you make in
WordPress.
