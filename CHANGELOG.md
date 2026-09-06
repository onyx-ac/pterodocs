# Changelog

## Unreleased

### Added
- Project skeleton: TypeScript sources, a Rollup build emitting `lib/`, declarations from
  `tsc`, and a `prepare` script so the package can be consumed straight from git.
- Errors and exit codes, structured issues, path, hash and media-type helpers.
- The renderer: markdown to Gutenberg blocks, with a configurable class prefix and string
  table so the output is not tied to one site's theme. Verified byte-identical to the
  DocStack script it was extracted from on a shared fixture.

### Fixed
Carried over from the original script, each with a test:
- Reference-style links (`[text][ref]`) resolve instead of printing as literal text, and
  the definitions no longer appear on the page.
- Images are found wherever they sit, so a standalone image becomes an image block and an
  inline one stays inline. Their URLs and alt text are escaped.
- Shortcode brackets are escaped on the tree rather than by pattern-matching the HTML, so
  a `>` inside an attribute no longer confuses the escaper.
- A leading H1 is recognised as the title even when a comment precedes it.
- Code fences keep their `title` and `showLineNumbers`; a dropped highlight range is
  reported rather than lost in silence.
