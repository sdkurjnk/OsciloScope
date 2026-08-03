<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)"  srcset="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/assets/OsciloScope-banner-dark@2x.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/assets/OsciloScope-banner-light@2x.png">
    <img src="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/assets/OsciloScope-banner-dark@2x.png" alt="OsciloScope" width="100%">
  </picture>
</p>

[![Version](https://img.shields.io/github/package-json/v/sdkurjnk/OsciloScope)](https://github.com/sdkurjnk/OsciloScope/releases)

> 🌐 한국어: [`docs/README.ko.md`](docs/README.ko.md)

A Visual Studio Code extension that reads variable monitoring logs and visualizes how variable values change over time.

## Features

- Parses `log.jsonl` (JSON Lines) monitoring logs.
- Groups variables by scope (Local / Global) and tracks their value history per step.
- Renders the result in a Webview panel.

## Usage

1. Place a `log.jsonl` file in the extension root.
2. Run **`OsciloScope: Open Visualizer`** from the Command Palette (`Ctrl+Shift+P`).

## Requirements

- VS Code `^1.120.0` or later.

## Release Notes

See `CHANGELOG.md` for release history.
