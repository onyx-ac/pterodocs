---
title: Get started
description: Install pterodocs, point it at a WordPress site, and publish a first tree of documentation.
---

# Get started

Three steps, in order. The first two change nothing on your site.

1. [Install](install) — add pterodocs to your Docusaurus site and write a config.
2. [Credentials](credentials) — an Application Password, kept in a file nothing reads by accident.
3. [Your first sync](first-sync) — render locally, plan against the site, then publish.

## What you need

- **Node 20.11 or newer.**
- **A Docusaurus site**, version 3.6 or newer. pterodocs loads it through Docusaurus's
  own loader, so the site has to be one Docusaurus can build.
- **A WordPress site** you can create pages on, with the REST API reachable and
  Application Passwords enabled (they are, unless a plugin or `wp-config.php` disabled them).

Nothing else. There is no build step on the WordPress side and no plugin required to
publish — the [plugin](../plugin/) is worth having, but it is not a prerequisite.
