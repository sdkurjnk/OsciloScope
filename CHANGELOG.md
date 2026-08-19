# Change Log

All notable changes to the "osciloscope" extension are documented here, following
[Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).

## [0.2.1] - 2026-08-19

### Changed
- **FE/BE messaging consolidated into a single `ApiTable`.** Command strings are now
  single-sourced and each API is tied to its payload via a `ProtocolMap`, removing the
  duplicated protocol definitions that were spread across the extension host and webviews.
- Frontend constants are generated from the shared source (`scripts/gen-constants.mjs`) so
  the two sides can no longer drift apart. No user-facing behavior changes.

### Documentation
- Annotate each API in the message-protocol reference with its direction and payload.
- Embed a component-map overview diagram in the architecture doc.

## [0.2.0] - 2026-08-16

### Added
- **Analysis tool plugins.** Write custom analysis/visualization tools in
  `.osciloscope/tools/<id>.tool.js` and pick them from the new **TOOLS** section in the
  sidebar. A tool is handed the parsed `RawLog[]` and a DOM container; the computation
  (`analyze`) and the presentation (`render`) are the tool's to own.
- Standard widgets (layout, variable list, timeline) that custom tools can reuse instead
  of drawing everything from scratch.
- Tool scaffolding: create a tool from a skeleton, or copy a bundled tool to customize.
  Bundled TypeScript type definitions give autocomplete and type-checking in the editor.
- Tool validation: a blackbox 12-check suite runs each tool against standard fixtures in a
  dedicated panel, with a timeout that reclaims tools stuck in an infinite loop.
- Two built-in tools shipped as plugins: `change-detector` (the default — the previous
  variables/timeline view) and `monotonic` (a from-scratch inline-SVG sparkline example).
- User guide `docs/plugin-tools.md` (interface, lifecycle, widgets, conventions, checks,
  limits).

### Changed
- The fixed analysis and UI moved into the default `change-detector` tool; with no tool
  selected the behavior is unchanged.
- Tool code runs in the webview rather than the extension host, which structurally blocks
  `fs`/`child_process` and outbound network access. A Content-Security-Policy is applied to
  both webviews.
- `LogParser` now only parses logs into `RawLog[]`; grouping and per-variable history moved
  to each tool's `analyze`.
- Logged values are rendered with `textContent` instead of `innerHTML` to prevent HTML
  injection from log contents.

### Removed
- Parser transforms `transformData`/`getVarKey`/`getGroupKey` (moved into the default tool).
- The `VARIABLE_CHANGED` message command; variable selection is now internal to tools.

## [0.1.2] - 2026-08-07

### Documentation
- Rewrite README to match the current sidebar-based workflow (SOURCE picker + START),
  with an interface screenshot and version badge pointing at the Open VSX listing.
- Add internal design docs: Korean README, FE/BE API reference specs, and sequence
  flows rendered as mermaid diagrams.
- Update the GitFlow section to reflect the direct-merge CD pipeline.
- Remove leftover generator boilerplate (quickstart doc).

## [0.1.1] - 2026-08-07

### Fixed
- Add MIT license (LICENSE file + `package.json` `license` field). Open VSX rejects
  publishing an extension without a license.

## [0.1.0] - 2026-08-07

### Added
- Initial release.
- Activity Bar sidebar to pick an oscilo `.jsonl` log (SOURCE) and render it (START).
- Variables grouped by scope (Local / Global); names reused across recursive or repeated
  calls are kept distinct by their owning call frame.
- Per-step value timeline with change tags (`init`, numeric `+/-` deltas, `changed`,
  `deleted`) and a call-context header (function, call id, parent call, depth).

[0.2.1]: https://github.com/sdkurjnk/OsciloScope/releases/tag/v0.2.1
[0.2.0]: https://github.com/sdkurjnk/OsciloScope/releases/tag/v0.2.0
[0.1.2]: https://github.com/sdkurjnk/OsciloScope/releases/tag/v0.1.2
[0.1.1]: https://github.com/sdkurjnk/OsciloScope/releases/tag/v0.1.1
[0.1.0]: https://github.com/sdkurjnk/OsciloScope/releases/tag/v0.1.0
