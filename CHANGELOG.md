# Change Log

All notable changes to the "osciloscope" extension are documented here, following
[Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).

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

[0.1.2]: https://github.com/sdkurjnk/OsciloScope/releases/tag/v0.1.2
[0.1.1]: https://github.com/sdkurjnk/OsciloScope/releases/tag/v0.1.1
[0.1.0]: https://github.com/sdkurjnk/OsciloScope/releases/tag/v0.1.0
