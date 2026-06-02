# Agent Guidelines

Memor is a secure Tauri desktop app with a React/TypeScript frontend, a Rust/Tauri backend, encrypted SQLite persistence, Semantic UI React components, and Playwright e2e coverage. Treat it as a desktop app first: UI state belongs in React, while persistence, filesystem, keyring, app lifecycle, and native integration belong behind Tauri/Rust commands.

## Working Style

- Start by understanding the request, nearby code, and expected user-visible behavior. For multi-step work, define what success looks like and how it will be verified before editing.
- Make reasonable assumptions for low-risk ambiguity, but state them when they affect behavior. Ask a concise question when a wrong assumption would cause churn, data loss, security risk, or a misleading UX.
- Prefer the simplest change that fully solves the problem. Do not add speculative features, future-proofing, broad configurability, or single-use abstractions.
- Keep diffs surgical. Every changed line should trace back to the user's request, a test update, or cleanup caused by your own change.
- If you notice unrelated bugs, dead code, or style issues, mention them separately instead of fixing them opportunistically.
- Remove imports, variables, files, and test fixtures that your change makes obsolete. Do not remove pre-existing unused code unless asked.
- Surface meaningful tradeoffs when there are multiple viable approaches, especially across frontend/backend boundaries, persistence, security, or test strategy.

## Repository Map

- `src/app/`: app shell, tab routing, unlock state, app-wide Tauri event listeners.
- `src/features/`: feature UI for auth, dashboard, timeline, summaries, and settings.
- `src/domain/types.ts`: frontend models that should match Rust/database response shapes.
- `src/shared/utils/`: shared frontend utilities such as idle locking and dialog helpers.
- `src/styles/App.css`: app-level styling and Semantic UI visual corrections.
- `src/test/e2e/`: Playwright fixtures and the browser-side Tauri IPC mock.
- `src-tauri/src/lib.rs`: registered Tauri commands, app state, tray behavior, config, and emitted events.
- `src-tauri/src/db.rs`: schema migrations and database reads/writes.
- `src-tauri/src/http_server.rs`: local HTTP API on `127.0.0.1:3030`.
- `src-tauri/src/keyring_helper.rs`: OS credential manager integration.

Avoid spending time in generated or heavy artifact directories unless the task explicitly needs them: `node_modules/`, `dist/`, `coverage/`, `test-results/`, and `src-tauri/target/`.

## UI Implementation

- Use Semantic UI React components as the default for app UI: `Button`, `Card`, `Checkbox`, `Dropdown`, `Form`, `Grid`, `Icon`, `Input`, `Label`, `Menu`, `Modal`, `Segment`, `Table`, and related primitives.
- Only implement custom controls or custom interaction markup when Semantic UI React does not provide the needed behavior.
- Before adding custom CSS, check whether a Semantic UI prop, variation, size, state, or composition pattern can solve the problem.
- Keep custom CSS narrowly scoped to project-specific layout, responsive behavior, accessibility fixes, or visual corrections that Semantic UI React cannot express cleanly.
- Avoid recreating standard controls such as buttons, menus, dialogs, cards, forms, checkboxes, inputs, tabs, and dropdowns with plain `div`/`span` markup.
- Prefer in-app Semantic UI modals and controls over blocking browser dialogs such as `alert`, `confirm`, and `prompt`.

## UI Consistency

- Match the existing Semantic UI React style already used in nearby files.
- Prefer incremental migration over broad rewrites. Keep changes focused on the feature or bug being addressed.
- Preserve existing behavior, accessibility labels, test selectors, and user-facing copy unless the task explicitly calls for changing them.
- When replacing custom UI with Semantic UI React, update tests to target stable accessible names or meaningful UI structure rather than brittle class chains.
- Keep desktop-app ergonomics in mind: dense but readable task workflows, clear affordances, responsive layouts, and no marketing-page treatment for app screens.

## Tauri Command Contracts

- Use `@tauri-apps/api/core` `invoke` calls for backend operations instead of browser-only storage or ad hoc IPC.
- Follow existing Tauri v2 patterns in this repo first. When an API detail is unclear, especially around commands, events, capabilities, tray/window behavior, plugins, or invoke serialization, check the official Tauri v2 documentation instead of guessing.
- Check `src-tauri/src/lib.rs` before changing an `invoke` payload. Rust command arguments are snake_case, while the frontend commonly passes camelCase keys such as `saveInKeyring` and `restoreTasks`.
- Keep command names, argument names, and returned data aligned across Rust, TypeScript models, and `src/test/e2e/tauri-mock.ts`.
- When backend data changes, emit or handle the appropriate app event so other views stay in sync. Current app-wide events include `tasks-changed` and `database-locked`.
- If a command contract changes, update the e2e mock router in `src/test/e2e/tauri-mock.ts` and any tests that depend on the old shape.
- Validate and sanitize data at the Rust command boundary, especially for filesystem paths, external inputs, keyring state, HTTP payloads, and destructive actions.

## Data And Persistence

- Keep database schema changes explicit and backward-compatible where possible by updating migrations in `src-tauri/src/db.rs`.
- Prefer typed frontend models in `src/domain/types.ts` that match Rust/database response structs.
- Preserve security-sensitive behavior: encrypted database unlock/lock flow, keyring save/delete behavior, idle auto-lock, and locked-database errors.
- For local HTTP API changes, keep README documentation, Rust handlers, emitted events, and e2e/mock behavior consistent.
- Avoid adding new native dependencies unless the standard library, existing crates, or Tauri APIs cannot reasonably solve the problem.

## Testing And Verification

- For frontend/type changes, run `npm run build` when practical.
- For user-facing UI behavior changes, run focused Playwright tests or `npm run test:e2e`. The Playwright config starts Vite at `http://localhost:1420` and uses the Tauri mock.
- For coverage-oriented changes, use `npm run test:e2e:coverage`.
- For Rust/backend changes, run commands from `src-tauri/` such as `cargo check` and focused `cargo test` when practical.
- Be aware that `npm run lint` includes `--fix` and may rewrite files. On a dirty worktree, run it only when that is intended and inspect the resulting changes.
- If a full verification command is too slow or blocked by the environment, run the most focused useful check and report what was not run.

## Project Workflow

- Read the surrounding code before editing and follow local patterns.
- Use `rg`/`rg --files` for searching. Exclude generated directories when broad searches would otherwise include `src-tauri/target`, `node_modules`, or build outputs.
- Keep edits scoped to the requested feature or bug. Do not perform broad refactors, style churn, or dependency upgrades unless needed.
- Do not revert unrelated worktree changes. If the worktree is dirty, assume those changes belong to the user and work around them.
- When changing command contracts, models, or persistence behavior, update the implementation, mock/test surface, and documentation together.
