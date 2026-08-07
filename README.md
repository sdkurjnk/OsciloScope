<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)"  srcset="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-dark@2x.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-light@2x.png">
    <img src="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-dark@2x.png" alt="OsciloScope" width="100%">
  </picture>
</p>

[![Version](https://img.shields.io/github/package-json/v/sdkurjnk/OsciloScope)](https://open-vsx.org/extension/sdkurjnk/osciloscope)

> 🌐 한국어: [`docs/README.ko.md`](docs/README.ko.md) · Internal design docs: [`docs/`](docs/)

A Visual Studio Code extension that reads variable monitoring logs and visualizes how variable values change over time.

## Features

- Parses `log.jsonl` (JSON Lines) monitoring logs.
- Groups variables by scope (Local / Global) and tracks their value history per step.
- Renders the result in a Webview panel.

## Usage

1. Open the **OsciloScope** view from the Activity Bar.
2. Under **SOURCE**, pick a `.jsonl` log file.
3. Click **START** to render the value timeline in the main panel.

## Requirements

- VS Code `^1.120.0` or later.

## Release Notes

See `CHANGELOG.md` for release history.
