# AGENTS.md

## Purpose

How automated coding assistants should work in this repository. pterodoc publishes a
Docusaurus site to WordPress; it is a small, single-purpose tool and should stay one.

## Layout

| Directory | Responsibility |
| :--- | :--- |
| `src/cli/` | Argument parsing, output, exit codes. The only place that catches errors. |
| `src/config/` | Discover, merge and validate configuration. No I/O beyond reading the config. |
| `src/docusaurus/` | Everything that knows Docusaurus exists. Produces a `SiteModel`. |
| `src/render/` | Markdown and MDX to Gutenberg blocks. Pure: no network, no Docusaurus, no target. |
| `src/target/` | Where pages are published. WordPress today; the interface allows others. |
| `src/sync/` | Reconciles a model with a target. The only layer that knows about all the others. |
| `src/util/` | Small shared helpers with no domain knowledge. |

The dependency graph is acyclic and points inwards: `cli → config → {docusaurus, render, target} → sync`.
`render/` must never import from `target/` or `docusaurus/`; URL policy belongs to the target.

## The rule that matters most

**Do not re-derive what Docusaurus already knows.** Sidebar order, permalinks, versions,
locales, draft and unlisted status, previous and next links: all of it comes from
`loadSite()`. If you find yourself walking a `docs/` directory or parsing `sidebars.ts`,
stop — that is the bug this tool was rewritten to remove.

## Style

- TypeScript, strict. JSDoc on every exported function, class and type.
- For interface and type properties, put the comment on the line **above** the property,
  not inline, so editors show it.
- Plain `node:test` with `node:assert/strict`. Flat `test('lowercase sentence describing
  behaviour')` calls, no describe blocks, no mocking library: inject dependencies instead.
  `fetch`, `sleep` and the clock are always injectable.
- A test asserts behaviour a user would notice. Do not weaken a test to make it pass.

## Safety

- Never publish, tag or bump a version unless asked.
- The sync is destructive by request only: `--prune` trashes, and nothing ever
  hard-deletes.
- Anything that cannot be represented faithfully must be reported as an issue, never
  silently dropped. Silent data loss is the worst failure this tool can have.
