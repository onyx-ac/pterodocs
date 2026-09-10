---
title: doctor
description: Check the configuration, the credentials and the target before a sync.
---

# `doctor`

```bash
pterodocs doctor --env-file .env
```

Answers "will a sync work, and where would it write?" without writing anything.

It reports the resolved configuration — site directory, config file, root path, status,
class prefix — then, if credentials are present, opens a session and reports what it found:

```
target      https://example.com
root path   /products/pterodocs/docs/
status      publish

Reached the target: 47 page(s) exist.
```

Without credentials it stops after the configuration and says so:

```
No credentials, so the target was not contacted.
```

## What it is for

- Confirming `--env-file` is being read at all.
- Confirming the root path resolves to what you expected, before a first sync creates
  pages somewhere surprising.
- Confirming the credentials work, separately from anything else that might fail.
- Checking whether the [WordPress plugin](../plugin/) is installed, its version, and
  whether its class prefix agrees with [`render.classPrefix`](../config/render#classprefix)
  — a disagreement is why an installed plugin can appear to do nothing.

Run it first when something is not behaving and you do not yet know which half is at fault.
