<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)"  srcset="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-dark@2x.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-light@2x.png">
    <img src="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-dark@2x.png" alt="OsciloScope" width="100%">
  </picture>
</p>

[![Open VSX](https://img.shields.io/open-vsx/v/sdkurjnk/osciloscope)](https://open-vsx.org/extension/sdkurjnk/osciloscope)

> 🌐 한국어: [`docs/README.ko.md`](docs/README.ko.md) · Internal design docs: [`docs/`](docs/)

OsciloScope visualizes how variable values change over time. It reads the `.jsonl` logs produced
by [oscilo](https://github.com/sdkurjnk/oscilo) and renders each variable's history as an
interactive timeline.

## Features

- **Any log.** Pick a `.jsonl` file from the sidebar.
- **Scope grouping.** Variables split by scope (Local / Global), with recursive or repeated calls kept distinct.
- **Value timeline.** Per-step value, source line, and change tag (`init`, `+/-`, `changed`, `deleted`).
- **Call context.** Function, call id, parent, and depth in the header.

## Usage

1. Open the **OsciloScope** view from the Activity Bar.
2. Pick a `.jsonl` log under **SOURCE**.
3. Click **START** to render the timeline.
4. Select a variable to see its history.

## Requirements

- VS Code `^1.120.0` or later.
- A `.jsonl` log produced by [oscilo](https://github.com/sdkurjnk/oscilo).

## More

- Design docs: [`docs/`](docs/)
- Release history: [`CHANGELOG.md`](CHANGELOG.md)
