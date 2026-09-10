---
title: capture
description: Write the loaded site model to JSON, then run against it without loading Docusaurus.
---

# `capture`

```bash
pterodocs capture --capture model.json
```

Writes the loaded site model — every document, sidebar, version and permalink Docusaurus
resolved — to a JSON file.

## Why

Loading a Docusaurus site is the slowest part of a run, and on a large site it dominates
everything else. A capture is that work, saved:

```bash
pterodocs capture --capture model.json      # slow, once
pterodocs render --model model.json         # fast, repeatedly
pterodocs sync   --model model.json --env-file .env
```

With `--model`, Docusaurus is never loaded at all.

Three uses:

- **Iterating on rendering.** Seconds instead of minutes per attempt.
- **CI.** Capture in the job that already built the site; sync in another without a
  Docusaurus install.
- **Reporting a bug.** A capture is a reproduction — it carries exactly what pterodocs saw.

## Staleness

A capture is a snapshot. Edit a document and the capture no longer describes it; rendering
reads document bodies from disk at their recorded paths, so a moved or deleted file is
reported as unreadable. Recapture when the site changes structurally.

`sync --capture <file>` writes one as a side effect of a normal run, so you can keep the
model of whatever you just published.
