---
title: Install
description: Add pterodocs to a Docusaurus site and write the smallest configuration that works.
---

# Install

```bash
npm install --save-dev pterodocs
```

Install it in the package that holds your Docusaurus site, next to `docusaurus.config.ts`.
pterodocs loads the site through Docusaurus's own loader, so it has to run where
Docusaurus would run.

## Write a configuration

```bash
npx pterodocs init
```

That writes a starter `pterodocs.config.mjs` beside your Docusaurus config. The smallest
useful version of it:

```js
import { defineConfig } from 'pterodocs';

export default defineConfig({
  site: { sidebars: ['docs'] },
  target: { type: 'wordpress', root: '/docs' },
});
```

`defineConfig` is an identity function — it exists only so your editor types the object.

## What you do not repeat here

Anything Docusaurus already knows is read from `docusaurus.config.ts` and must **not** be
restated:

| Read from Docusaurus | Why it matters |
| :--- | :--- |
| `url`, `baseUrl` | Where links that leave the published tree should point |
| `routeBasePath` | How a permalink maps to a position in the tree |
| `i18n.locales` | Which locales exist |
| `markdown.format` | Whether a file is parsed as Markdown or MDX |
| Admonition keywords | Which `:::` directives are admonitions |

This is the rule the tool is built on: **do not re-derive what Docusaurus already knows.**
If you find yourself copying sidebar order or permalinks into `pterodocs.config.mjs`,
something has gone wrong.

## Add some scripts

```json
{
  "scripts": {
    "wp:render": "pterodocs render",
    "wp:sync:dry": "pterodocs sync --dry-run",
    "wp:sync": "pterodocs sync"
  }
}
```
