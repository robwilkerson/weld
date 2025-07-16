# 🧑‍🏭 Weld

[![CI](https://github.com/lookout-software/weld/actions/workflows/ci.yml/badge.svg)](https://github.com/lookout-software/weld/actions/workflows/ci.yml)

Weld is a visual diff and merge tool targeted at developers.

It is inspired by and modeled after [Meld](https://github.com/yousseb/meld) which seems to have been deprecated (at best) in favor of [this fork](https://gitlab.com/dehesselle/meld_macos) - at least in terms of the [Homebrew](https://brew.sh/) package. Recent(-ish) churn due to bugs and slow development inspired me to start this project as an alternative, but seem to have stabilized in recent weeks. Nonetheless, the idea lingered and I decided to explore it as an experiment in some new technologies and as a use case for heavy AI usage.

Weld, while inspired by Meld, offers a slightly streamlined set of functionality. The following features of Meld are not part of Weld:

* 3-way comparison
* Version control integration

Weld is licensed under the terms of the MIT license.

# Wails

This is the official Wails Svelte-TS template.

## Live Development

To run in live development mode, run `wails dev` in the project directory. This will run a Vite development
server that will provide very fast hot reload of your frontend changes. If you want to develop in a browser
and have access to your Go methods, there is also a dev server that runs on http://localhost:34115. Connect
to this in your browser, and you can call your Go code from devtools.

## Building

To build a redistributable, production mode package, use `wails build`.
