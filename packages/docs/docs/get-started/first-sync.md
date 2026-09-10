---
title: Your first sync
description: Render locally, plan against the live site, then publish — and confirm the second run changes nothing.
---

# Your first sync

Work outwards: render with no network, then plan against the site, then publish.

## 1. Render, touching nothing

```bash
npx pterodocs render
```

Writes the rendered block markup for every page into `.pterodocs/`, along with
`manifest.json` (what goes where), `plan.json` (what would happen) and `docs.css`.
It contacts nothing and needs no credentials.

Open a file under `.pterodocs/pages/` and read it. That is exactly what will be stored as
the page's content.

## 2. Plan against the live site

```bash
npx pterodocs sync --dry-run --env-file .env
```

Now it reaches the site, reads what is already there, and reports what it *would* change
— without writing anything:

```
create-root 2 · create 6 · update 6 · 50 requests
Dry run: the site was not modified.
```

`create-root` is the path pages above your documentation root — `/products` and
`/products/pterodocs` in this site's case. They are created once if missing and never
edited again.

## 3. Publish

```bash
npx pterodocs sync --env-file .env
```

## 4. Run it again

This is the check that matters:

```bash
npx pterodocs sync --env-file .env
```

```
48 unchanged · 50 requests
```

**Everything should report `unchanged`.** If a second run still finds differences, the
rendered output and the stored output disagree about something, and every future run will
rewrite every page. Report it — that is a bug, not a quirk.

## Useful flags on the way

| Flag | What it buys |
| :--- | :--- |
| `--only <prefix>` | Restrict writes to one subtree while you experiment |
| `--verbose` | A line per page as it is processed |
| `--json` | A machine-readable summary, for CI |
| `--strict` | Fail the run when an issue reaches the configured severity |
| `--no-media` | Skip uploads and leave image URLs as written |

## Then what

- Check the result at your root path, and check the sidebar renders.
- Install the [WordPress plugin](../plugin/) if you want the documentation to look like
  documentation rather than like unstyled blocks.
- Read [what a re-sync overwrites](../concepts/identity) before you edit anything in the
  WordPress editor.
