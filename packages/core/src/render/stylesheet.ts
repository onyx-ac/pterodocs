/**
 * The stylesheet published with the documentation.
 *
 * WordPress renders core blocks with almost no opinion, so documentation that
 * ships as core blocks and nothing else arrives looking like an unstyled
 * outline: list markers down the navigation, a column too narrow to hold a
 * word, code in the body font. Anything that fixes that has to travel with the
 * content, because a site that has installed nothing has nowhere else to put it.
 *
 * Structure that core blocks can express stays in block attributes, where the
 * editor can see it: the layout's full-width alignment is one. Everything below
 * is what an attribute cannot reach — list markers, a sticky column, a scroll
 * container, and colour that has to adapt to a theme this code has never seen.
 * Emitting the rest as `style` attributes was considered and rejected: each one
 * must byte-match what the block's own save function would have written, or the
 * editor reports every block as corrupt.
 *
 * Every colour is mixed from `currentColor`, so the result follows whatever the
 * theme paints its text and never assumes light or dark. Every rule is wrapped
 * in `:where()`, so a theme that does have opinions keeps them.
 */

import type { Theme } from './theme';

/**
 * The stylesheet, with `{p}` standing in for the class prefix.
 *
 * Written compactly on purpose: it is stored on every page, so a kilobyte here
 * is a kilobyte times the size of the documentation.
 */
const TEMPLATE = `
:where(.{p}-docs){--{p}-gutter:clamp(1rem,4vw,2rem);--{p}-measure:var(--wp--style--global--content-size,46rem);--{p}-rule:color-mix(in oklab,currentColor 14%,transparent);--{p}-muted:color-mix(in oklab,currentColor 62%,transparent);--{p}-surface:color-mix(in oklab,currentColor 5%,transparent);--{p}-radius:8px}
:where(.{p}-docs){display:flex;gap:clamp(1.5rem,4vw,3rem);align-items:flex-start}
:where(.{p}-docs-main){min-width:0;flex:1 1 auto}
:where(.{p}-docs-main)>*{max-width:var(--{p}-measure)}
:where(.{p}-docs-main)>.wp-block-code,:where(.{p}-docs-main)>.wp-block-table,:where(.{p}-docs-main)>figure{max-width:none}

/* Navigation. The list markers and the cramped column are the two things that
   make an unstyled docs page unreadable. */
:where(.{p}-docs-nav){flex:0 0 auto;min-width:0;max-width:20rem;position:sticky;top:2rem;max-height:calc(100vh - 4rem);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}
:where(.{p}-docs-nav) ul{list-style:none;margin:0;padding-inline-start:0}
:where(.{p}-docs-nav) li{margin:0}
:where(.{p}-docs-nav) ul ul{margin-inline-start:.75em;padding-inline-start:.75em;border-inline-start:1px solid var(--{p}-rule)}
:where(.{p}-docs-nav) a{display:block;padding:.25rem .5rem;border-radius:6px;color:inherit;text-decoration:none;font-size:.9375em;line-height:1.5}
:where(.{p}-docs-nav) a:hover{background:var(--{p}-surface)}
:where(.{p}-docs-nav) .current-menu-item>a{background:color-mix(in oklab,currentColor 10%,transparent);font-weight:600}

/* Code. */
:where(.{p}-docs-main) .wp-block-code{background:var(--{p}-surface);border:1px solid var(--{p}-rule);border-radius:var(--{p}-radius);padding:1rem 1.15rem;overflow-x:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.875em;line-height:1.6;tab-size:2}
:where(.{p}-docs-main) .wp-block-code code{font-family:inherit;white-space:pre}
:where(.{p}-code-title){margin-bottom:0;font-size:.8125em;color:var(--{p}-muted);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}

/* Syntax tokens. Prism tokenises at publish time and emits these classes; the
   colours live here, so changing them is a CSS edit rather than a republication.
   Every one is mixed from currentColor, so it follows the theme into dark. */
:where(.{p}-docs-main) .token{color:inherit}
:where(.{p}-docs-main) :is(.token.comment,.token.prolog,.token.cdata){color:color-mix(in oklab,currentColor 50%,transparent);font-style:italic}
:where(.{p}-docs-main) :is(.token.punctuation,.token.operator){color:color-mix(in oklab,currentColor 70%,transparent)}
:where(.{p}-docs-main) :is(.token.keyword,.token.atrule,.token.rule,.token.important){color:color-mix(in oklab,#7c4dff 70%,currentColor);font-weight:600}
:where(.{p}-docs-main) :is(.token.string,.token.char,.token.attr-value,.token.regex){color:color-mix(in oklab,#1a7f5a 70%,currentColor)}
:where(.{p}-docs-main) :is(.token.number,.token.boolean,.token.constant,.token.symbol){color:color-mix(in oklab,#b34700 70%,currentColor)}
:where(.{p}-docs-main) :is(.token.function,.token.class-name,.token.builtin){color:color-mix(in oklab,#0b6bcb 70%,currentColor)}
:where(.{p}-docs-main) :is(.token.tag,.token.selector,.token.attr-name,.token.property){color:color-mix(in oklab,#1a7f5a 60%,currentColor)}
:where(.{p}-docs-main) .token.deleted{color:color-mix(in oklab,#c62828 75%,currentColor)}
:where(.{p}-docs-main) .token.inserted{color:color-mix(in oklab,#1a7f5a 75%,currentColor)}
:where(.{p}-docs-main) .token.bold{font-weight:700}
:where(.{p}-docs-main) .token.italic{font-style:italic}

/* Tables scroll rather than overflow the page. */
:where(.{p}-docs-main) .wp-block-table{overflow-x:auto;overscroll-behavior-inline:contain}
:where(.{p}-docs-main) .wp-block-table table{border-collapse:collapse;width:100%}
:where(.{p}-docs-main) .wp-block-table :is(th,td){padding:.5rem .75rem;border:0;border-bottom:1px solid var(--{p}-rule);text-align:start;vertical-align:top}
:where(.{p}-docs-main) .wp-block-table thead th{white-space:nowrap;font-weight:600}

:where(.{p}-docs-breadcrumb){font-size:.875em;color:var(--{p}-muted)}
:where(.{p}-docs-breadcrumb) p{margin:0}
:where(.{p}-docs-breadcrumb) a{color:inherit;text-decoration:none}
:where(.{p}-docs-breadcrumb) a:hover{text-decoration:underline}

:where(.{p}-docs-pagination){display:flex;gap:1rem;justify-content:space-between;margin-top:2.5rem;padding-top:1.25rem;border-top:1px solid var(--{p}-rule)}
:where(.{p}-docs-pagination) p{margin:0}
:where(.{p}-docs-pagination-next){margin-inline-start:auto;text-align:end}

:where(.{p}-docs-index) li{margin-block:.25rem}
:where(.{p}-docs-index-heading){margin-top:2.5rem}

:where(.{p}-admonition){padding:.85rem 1.1rem;border-inline-start:3px solid var(--{p}-rule);border-radius:0 var(--{p}-radius) var(--{p}-radius) 0;background:var(--{p}-surface)}
:where(.{p}-admonition)>*{margin-block:.35rem}
:where(.{p}-admonition-title){font-weight:600}

:where(.{p}-version-banner){padding:.75rem 1rem;border:1px solid var(--{p}-rule);border-radius:var(--{p}-radius);background:var(--{p}-surface);font-size:.9375em}

/* One column once there is no room for two. */
@media (max-width:781.98px){
:where(.{p}-docs){display:block}
:where(.{p}-docs-nav){position:static;max-height:none;overflow:visible;margin-bottom:2rem;padding-bottom:1.25rem;border-bottom:1px solid var(--{p}-rule)}
}
`;

/**
 * Build the stylesheet for one run.
 *
 * @param theme The class prefix and strings in force.
 * @returns CSS, with the run's own class prefix substituted in.
 */
export function stylesheetFor(theme: Theme): string {
  return TEMPLATE.replace(/\{p\}/g, theme.classPrefix).trim();
}

/**
 * How the stylesheet reaches the page.
 *
 * `inline` stores it with each page, which is the only place a site that has
 * installed nothing can read it from. `none` writes no styles at all, for a
 * site whose theme already dresses these class names, or one running the
 * pterodoc WordPress plugin, which brings its own and a good deal more.
 */
export type StylePolicy = 'inline' | 'none';
