---
title: Credentials
description: Application Passwords, the three environment variables pterodocs reads, and why no .env file is read unless you name it.
---

# Credentials

pterodocs authenticates as a WordPress user over HTTP Basic, using an **Application
Password**. Not the login password — a separate credential WordPress issues per
application and you can revoke on its own.

## Create one

In WordPress: **Users → Profile → Application Passwords**. Name it something you will
recognise later, and copy the generated password. WordPress shows it once.

The user needs to be able to create and edit pages. An Editor is enough for publishing;
Administrator is only needed if you want the [plugin's settings](../plugin/settings)
written by a run.

:::note Two-factor authentication does not apply

An Application Password bypasses the login form entirely, so a 2FA plugin does not
interfere. That is the point of it. It also means the password is worth protecting as
carefully as the login one — revoke it from the same screen if it leaks.

:::

## The three variables

```ini
WP_URL=https://example.com
WP_USER=your-wordpress-username
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

Spaces in the password are ignored, so paste it exactly as WordPress showed it.

## No file is read unless you name it

pterodocs **never** loads a `.env` file on its own. It reads the environment it is given,
and a file only when you point at one:

```bash
pterodocs sync --env-file .env
```

or by setting `PTERODOCS_ENV_FILE`. This is deliberate: a tool that writes to a live
website should not pick up credentials it was not handed.

Add `.env` to `.gitignore` and commit a `.env.example` with empty values instead.

## Running without credentials

Every command still works without them. `sync` downgrades to a render, reports what it
*would* have done, and contacts nothing:

```
note: No target URL or credentials (WP_USER, WP_APP_PASSWORD): running offline.
```

That makes it safe to run in CI, or on a laptop, before you have decided anything.
