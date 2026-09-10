---
title: init
description: Write a starter pterodocs.config.mjs.
---

# `init`

```bash
pterodocs init
```

Writes a starter `pterodocs.config.mjs` in the site directory, with the options most sites
set and comments explaining them. It will not overwrite an existing file.

```js
import { defineConfig } from 'pterodocs';

export default defineConfig({
  site: { sidebars: ['docs'] },
  target: { type: 'wordpress', root: '/docs' },
});
```

That is the whole minimum. Everything else has a default — see [Configuration](../config/).

The credentials deliberately do not go in this file. They come from the environment; see
[Credentials](../get-started/credentials).
