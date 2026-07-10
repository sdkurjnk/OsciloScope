# OsciloScope

[![Version](https://img.shields.io/github/package-json/v/sdkurjnk/OsciloScope)](https://github.com/sdkurjnk/OsciloScope/releases)

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
