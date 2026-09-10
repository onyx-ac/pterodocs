# AGENTS.md

## Purpose

How automated coding assistants should work in this repository. pterodocs publishes a
Docusaurus site to WordPress; it is a small, single-purpose tool and should stay one.

## Layout

Four packages in an npm workspace. The dependency graph is acyclic and points inwards,
and `npm ls` rather than convention is what enforces it.

| Package | Responsibility |
| :--- | :--- |
| `@pterodocs/core` | Everything that knows neither the source nor the target. See below. |
| `@pterodocs/docusaurus` | Everything that knows Docusaurus exists. Produces a `SiteModel`. |
| `@pterodocs/wordpress` | The WordPress REST target, and the WordPress plugin under `plugin/`. |
| `pterodocs` | The command line, the Docusaurus build plugin, and the public barrel. Depends on all three. |

```
@pterodocs/core  <-  @pterodocs/docusaurus  <-  pterodocs
                <-  @pterodocs/wordpress   <-
```

`@pterodocs/core` must never import `@pterodocs/docusaurus` or `@pterodocs/wordpress`.
Wiring the three together is what the `pterodocs` package is for, and it is the only one
allowed to name a concrete source or target.

Inside `packages/core/src`:

| Directory | Responsibility |
| :--- | :--- |
| `config/` | Discover, merge and validate configuration. No I/O beyond reading the config. |
| `model/` | The site model, the page tree and the `SourceReader` contract. Knows no source. |
| `render/` | Markdown and MDX to Gutenberg blocks. Pure: no network, no source, no target. |
| `target/` | The contract a publishing target implements. No implementation. |
| `sync/` | Reconciles a model with a target. The only layer that knows about all the others. |
| `util/` | Small shared helpers with no domain knowledge, and the error types. |

`render/` must never import from `model/`; URL policy belongs to the target. Each of
`model`, `render`, `target` and `util` has a barrel that is also a published subpath
(`@pterodocs/core/render` and so on), so a cross-directory import goes through the barrel
and a cross-package one is a mechanical rename away.

## Building and testing

`npm test` runs every package's suites from source through `tsconfig.dev.json`, with no
build in the way. `npm run typecheck` is the only thing that typechecks `test/`; `tsx`
strips types without checking them. `npm run build` is `tsc -b` for every `.d.ts` then
rollup for every `.js` — they share `lib/`, which is why the base tsconfig sets
`emitDeclarationOnly`. `prepare` is defined at the workspace root only.

The four packages are versioned in lockstep
(`npm version <v> --workspaces --include-workspace-root`); a test enforces it.

## The WordPress plugin

`packages/wordpress/plugin` is PHP, CSS and plain JavaScript, with no bundler:
the file that ships is the file that was written. Four rules hold it together.

- **It registers no block types.** Everything is `render_block` filters over the
  core blocks pterodocs already emits. The test of any change is: deactivate the
  plugin, and the documentation must still read.
- **Build on the block supports, never fight them.** Tokens resolve through
  `--wp--preset--*` and `--wp--style--*` first; colours are derived with
  `color-mix` from the block's own resolved colours; the gutter is padding on the
  column, never on a block. Every default is wrapped in `:where()`. There is no
  `!important` except where an inline style is being answered — the block
  theme's own `margin-top` on `#wp--skip-link--target` is the only such case
  today, and it carries a comment saying so. Anywhere else, adding one is a bug.
- **`WP_HTML_Tag_Processor` cannot insert elements.** It changes attributes.
  Anything needing new DOM is either a wrapper around a whole block or is added
  by the front-end script.
- **The server decides state; the script only changes it.** Which sidebar
  branches are open is settled in PHP, so the first paint is right and there is
  no flash of an expanded tree.

Anything pterodocs emits for the plugin travels in block-comment attributes, never
in markup. WordPress re-runs a block's save function on edit and compares, so
markup core would not have written is markup the editor refuses.

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
