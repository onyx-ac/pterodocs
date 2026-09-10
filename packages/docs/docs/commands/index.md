---
title: Commands
description: sync, render, doctor, capture, purge and init — what each one is for and which of them write to your site.
---

# Commands

```
pterodocs <command> [options]
```

`sync` is the default, so `pterodocs` on its own is `pterodocs sync`.

| Command | Writes to the site? | For |
| :--- | :--- | :--- |
| [`sync`](sync) | **Yes** | Reconcile the target with your documentation |
| [`render`](render) | No | Render every page to disk; contacts nothing |
| [`doctor`](doctor) | No | Check the configuration, the credentials and the target |
| [`capture`](capture) | No | Write the loaded site model to a JSON file |
| [`purge`](purge) | **Yes, destructively** | Remove documentation pterodocs published at a path |
| [`init`](init) | No | Write a starter `pterodocs.config.mjs` |

Only `sync` and `purge` change anything, and both refuse to by default — `sync` needs
credentials, and `purge` needs `--apply`.

## Options every command shares

```
--site-dir <dir>      Docusaurus site directory (default: the working directory)
--config <file>       pterodocs config file
--model <file>        Use a captured model; Docusaurus is never loaded
--env-file <file>     Read this .env file. None is read otherwise
--out <dir>           Output directory (default <site-dir>/.pterodocs)
--json                Print a machine-readable summary
--verbose             Log every page as it is processed
--quiet               Only print errors
--strict              Fail when an issue reaches the configured severity
--help, --version
```

## Nothing is destructive by accident

- `sync` writes pages but never deletes one unless you pass `--prune`.
- `--prune` moves pages to the **trash**. Nothing is ever permanently deleted.
- `purge` reports and changes nothing unless you pass `--apply`.
- Neither will touch a page it cannot recognise as its own.
