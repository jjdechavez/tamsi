# AGENTS.md

This file guides coding agents working in this repository.

## Project snapshot
- Name: Tamsi
- Description: Lightweight micro-engine for explicit h3-based servers.
- Runtime: Node.js (ESM, NodeNext module resolution).
- Language: TypeScript (strict mode enabled).
- Tests: Vitest.
- Package manager: pnpm (see `pnpm-lock.yaml`).

## Repo layout
- `src/` core library and CLI implementation.
- `test/` Vitest test suite.
- `templates/` starter templates used by the CLI.
- `examples/` example apps for documentation.
- `build.config.ts` unbuild configuration.
- `tsconfig.json` compiler options.

## Build, lint, test commands

### Install
- `pnpm install`

### Build
- `pnpm run build`
  - Runs `unbuild` to emit `dist/`.

### Test (full suite)
- `pnpm test`
  - Equivalent to `vitest run`.

### Test (single file)
- `pnpm test -- test/app.test.ts`
- `pnpm exec vitest run test/app.test.ts`

### Test (single test by name)
- `pnpm test -- -t "createTamsiApp"`
- `pnpm exec vitest run -t "createTamsiApp"`

### Lint / format
- No lint or format script is configured in `package.json`.
- Keep changes consistent with existing formatting and style.

## Cursor / Copilot rules
- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` found.

## TypeScript and module conventions
- ESM-only project; imports are `type` safe and use `.js` extensions.
- Local imports in TS use the emitted `.js` extension, e.g. `./app.js`.
- Node built-ins are imported via the `node:` prefix.
- `tsconfig.json` uses `module`/`moduleResolution: NodeNext` and `strict: true`.

## Import style
- Order imports by source group:
  1. Third-party modules.
  2. `node:` built-ins.
  3. Local modules.
- Keep a blank line between groups.
- Prefer `import type { ... }` for types.
- Combine type and value imports only when unavoidable.

## Formatting conventions
- 2-space indentation.
- Double quotes for strings.
- Semicolons are used consistently.
- Trailing commas appear where they already exist; match nearby style.
- Keep lines reasonably short, but do not reflow existing code unnecessarily.

## Naming conventions
- `camelCase` for variables and functions.
- `PascalCase` for types, interfaces, classes.
- Constants are `camelCase` unless they are true constants (then `SCREAMING_SNAKE_CASE`).
- File names are lowercase, often `kebab-case` (e.g. `config-utils.ts`).
- Tests are named `*.test.ts` in `test/`.

## Error handling patterns
- Use `Error`/`TypeError` with clear messages for invalid inputs.
- Guard invalid states early (fail fast).
- Return `undefined` or short-circuit for not-found cases.
- Prefer `try/catch` only when a failure is expected and recovery is needed.

## API design and behavior
- Public APIs live in `src/index.ts` as named exports.
- Prefer small, focused functions with explicit inputs.
- Preserve existing default behaviors (e.g. health route enabled by default).
- When adding options, ensure defaults are backward compatible.

## Testing conventions
- Vitest with `describe`/`it` and `expect` assertions.
- Tests use real filesystem primitives when needed (`node:fs/promises`).
- Favor focused tests with explicit setup and teardown.

## CLI conventions
- CLI entry point: `src/cli.ts`.
- Commands are defined via `citty` and use `consola` for logging.
- Keep CLI behavior deterministic and output user-friendly.

## When editing or adding code
- Respect ESM import rules and `.js` extension conventions.
- Keep exports stable; avoid breaking changes without strong justification.
- Update tests when behavior changes.
- Update README/examples if public behavior changes.

## Suggestions for agents
- Read nearby files before making broad changes.
- Align with current patterns rather than introducing new ones.
- Avoid introducing new dependencies unless necessary.
