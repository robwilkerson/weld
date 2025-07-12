# Development Guidelines

## Tech Stack

Backend: Go 1.24+ using the [Wails](https://wails.io/) framework; documentation is available at https://wails.io/docs/introduction
Frontend: Svelte, Typescript, ES modules, [Bun](https://bun.sh/)
Build Tool: Wails CLI

## Project Structure

* bin/: Any executable scripts
* build/: Production build artifact(s)
* conf/: Any configuration files
* src/: All application source code
* src/frontend/: Svelte frontend source code
* src/backend/: Go backend source code
* .gitignore: A Git ignore file consistent with a Wails project
* wails.json: Wails project configuration

## Common Commands

* wails init - Initialize a Wails project
* wails dev — Start development server with hot reload
* wails build — Build the application for production
* wails generate module — Generate a new Go module
* wails doctor — Diagnose project setup issues after verifying or installing the tech stack

## Code Style

Go: Use gofmt for formatting; follow idiomatic Go conventions
Frontend: Use Biome with it's default settings for linting and formatting

Use ES modules for frontend code.

## Workflow

* Create feature branches from main
* Run single tests
* Use pull requests for all merges
* Run wails build and ensure no errors before merging
* Do not commit files generated in build/
* Never create sample/example code unless requested
* After every change:
  * Frontend:
    * Run `npx @biomejs/biome format --write <files>` against every changed file
    * Run `npx @biomejs/biome lint --write <files>` against every changed file
    * Fix any errors reported by either of the above commands
  * Backend:
    * Run `go fmt`
  * Ensure that the app builds successfully

## Testing

Backend: Use go test ./... for Go unit tests
Frontend: Use the Vitest test runner

## Do Not

* Do not edit files in build/ or wailsjs/
* Do not push directly to main
* Do not use npm, use Bun instead

# Developer Environment Setup

* Use [mise](https://mise.jdx.dev/getting-started.html) to install Go, Node.js, Wails, and Bun only if they are not installed, not in `$PATH`, or if the installed version is lower than that specified in the Tech Stack instructions above
  * Install the latest version of Go and make it the default version for the project directory only by running `mise use go@latest`
  * Install the latest version of Node.js and make it the default version for the project directory only by running `mise use node@latest`
  * Install the latest version of Bun and make it the default version for the project directory only by running `mise use bun@latest`
  * If the Wails CLI isn't already installed, run `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
* Run `wails doctor` after setup to verify environment
