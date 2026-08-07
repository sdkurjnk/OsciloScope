<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)"  srcset="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-dark@2x.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-light@2x.png">
    <img src="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-dark@2x.png" alt="OsciloScope" width="100%">
  </picture>
</p>

[![Open VSX](https://img.shields.io/open-vsx/v/sdkurjnk/osciloscope)](https://open-vsx.org/extension/sdkurjnk/osciloscope)

> 🌐 한국어: [`docs/README.ko.md`](docs/README.ko.md) · Internal design docs: [`docs/`](docs/)

OsciloScope is a Visual Studio Code extension that visualizes how variable values change over
time. It reads the `.jsonl` monitoring logs produced by
[oscilo](https://github.com/sdkurjnk/oscilo) and turns each variable's history into an
interactive timeline — you instrument nothing in VS Code, you just open the log.

## Features

- **Reads any oscilo log.** Pick a `.jsonl` file from the sidebar — no fixed path or filename.
- **Scope grouping.** Variables are grouped by scope (Local / Global). Names reused across
  recursive or repeated calls are kept apart by their owning call frame, so each instance
  stays distinct.
- **Value timeline.** For the selected variable, every step shows its value, source line, and a
  change tag — `init`, numeric `+/-` deltas, `changed`, or `deleted`.
- **Call context at a glance.** The timeline header surfaces the function, call id, parent call,
  and depth behind each variable.

## Usage

1. Open the **OsciloScope** view from the Activity Bar.
2. Under **SOURCE**, pick a `.jsonl` log file produced by oscilo.
3. Click **START** to render the value timeline in the main panel.
4. Select a variable in the left list to see its per-step history.

## Requirements

- VS Code `^1.120.0` or later.
- A `.jsonl` log produced by [oscilo](https://github.com/sdkurjnk/oscilo).

## Documentation

Design docs — architecture, data model, message protocol, and FE/BE API references — live in
[`docs/`](docs/).

## Release Notes

See [`CHANGELOG.md`](CHANGELOG.md) for release history.
