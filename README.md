<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)"  srcset="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-dark@2x.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-light@2x.png">
    <img src="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-banner-dark@2x.png" alt="OsciloScope" width="100%">
  </picture>
</p>

<p align="center">Visualize how your variables change over time — right inside VS Code.</p>

<p align="center">
  <a href="https://open-vsx.org/extension/sdkurjnk/osciloscope"><img src="https://img.shields.io/open-vsx/v/sdkurjnk/osciloscope" alt="Open VSX Version"></a>
  <a href="https://open-vsx.org/extension/sdkurjnk/osciloscope"><img src="https://img.shields.io/open-vsx/dt/sdkurjnk/osciloscope" alt="Open VSX Downloads"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
</p>

**English** | [한국어](docs/README.ko.md)

OsciloScope reads the `.jsonl` monitoring logs produced by [oscilo](https://github.com/sdkurjnk/oscilo)
and renders each variable's history as an interactive timeline. It is the viewer half of the pair:
oscilo records how your Python variables change; OsciloScope shows it — grouped by scope, kept distinct
across recursive calls, and annotated with a per-step change tag.

## Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick start](#quick-start)
- [The interface](#the-interface)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Documentation](#documentation)
- [Related](#related)
- [License](#license)

## Overview

A monitoring log is a flat stream of variable events — one JSON object per change, hard to read directly:

```json
{"name":"acc","var_id":47,"data":0,"event":"init","domain":"LOCAL","line":12,"func":"process","call_id":47}
{"name":"acc","var_id":47,"data":1,"event":"updated","domain":"LOCAL","line":14,"func":"process","call_id":47}
```

OsciloScope folds that stream into a per-variable timeline you can scan at a glance: which variables
exist, in what scope, and how each value moved step by step.

## Installation

Install from the [Open VSX Registry](https://open-vsx.org/extension/sdkurjnk/osciloscope):

- In VS Code — open the **Extensions** view, search **OsciloScope**, and click **Install**.
- From a `.vsix` — **Extensions** view → **⋯** menu → **Install from VSIX…**

## Quick start

1. Produce a log with oscilo:

   ```python
   import oscilo

   def run():
       acc = 0
       oscilo.register("acc")   # every change to `acc` is recorded
       for x in range(3):
           acc += x

   run()
   # writes oscilo.jsonl on exit
   ```

2. Open the **OsciloScope** view from the Activity Bar.
3. Under **SOURCE**, pick the `.jsonl` file, then click **START**.
4. Select a variable in the list to see its per-step history.

## The interface

<p align="center">
  <img src="https://raw.githubusercontent.com/sdkurjnk/OsciloScope/master/docs/assets/OsciloScope-test.png" alt="OsciloScope timeline view" width="100%">
</p>

| Area | What it shows |
| --- | --- |
| **SOURCE** (sidebar) | Pick a `.jsonl` log and **START** rendering |
| **Variables** (sidebar) | Variables grouped by scope (Local / Global); recursive or repeated calls stay distinct by call frame (`#call_id`) |
| **Timeline header** | The selected variable's function, call id, parent call, and depth |
| **Timeline** | Each step's value, source line, and change tag |

Change tags:

| Tag | Meaning |
| --- | --- |
| `init` | first recorded value |
| `+n` / `-n` / `±0` | numeric delta from the previous step |
| `changed` | non-numeric value changed |
| `deleted` | variable went out of scope |

## How it works

OsciloScope mirrors VS Code's process split into two coordinated pieces:

- an **Extension Host** side that reads the log, parses it, and groups variables by identity;
- a **Webview** side that renders the sidebar and the timeline.

The two communicate only over `postMessage`. Variable identity is keyed on oscilo's `var_id`, so the
same name across recursive calls stays separate. Full details are in the [design docs](docs/).

## Requirements

- VS Code `^1.120.0` or later.
- A `.jsonl` log produced by [oscilo](https://github.com/sdkurjnk/oscilo).

## Documentation

Architecture, data model, message protocol, and FE/BE API references live in [`docs/`](docs/).
Release history is in [`CHANGELOG.md`](CHANGELOG.md).

## Related

- [oscilo](https://github.com/sdkurjnk/oscilo) — the zero-invasive Python variable tracker that
  produces the logs OsciloScope reads.

## License

[MIT](./LICENSE) © 2026 [sdkurjnk](https://github.com/sdkurjnk)
