# AGENTS.md — Maglev Validator

Quick orientation for coding agents working on this codebase.

## What this project is

Maglev Validator is a SvelteKit developer tool for the OneBusAway ecosystem. It has two main jobs:

1. **API Comparator** — Fetch the same OneBusAway REST endpoint from two servers and diff the JSON side-by-side.
2. **GTFS Tools** — Decode GTFS-Realtime protobuf feeds and browse GTFS Static (SQLite-backed) datasets.

It also logs watched API keys to a local SQLite DB and lets you review that history.

## Tech stack

- **Framework:** SvelteKit 2.x, Svelte 5 runes (`$state`, `$derived`, `$effect`)
- **Language:** TypeScript (ESM)
- **Styling:** Tailwind CSS 4.x, custom dark mode via `class="dark"` on `<html>`
- **DB:** `better-sqlite3` (local `keylog.db`)
- **Package manager:** pnpm (use `pnpm install`, `pnpm dev`, etc.)

## Project layout

```text
src/
  routes/
    +page.svelte           # Main app shell: tab bar, split view, panel routing
    api/
      proxy/+server.ts     # Proxies two URLs and returns both responses
      gtfs-rt/+server.ts   # Decodes GTFS-RT protobuf
      gtfs-static/+server.ts
      gtfs-static-db/+server.ts
      protobuf/+server.ts
      keylog/+server.ts    # Stores watched-key diffs in SQLite
  lib/
    components/            # All UI components
      ComparatorPanel.svelte      # API Comparator inputs + results
      DiffViewer.svelte           # Side-by-side JSON diff + search/sort toolbar
      JsonViewer.svelte           # Single JSON tree with diff highlighting
      JsonTree.svelte             # Recursive tree rendering
      ProtobufPanel.svelte        # GTFS-Realtime decoder UI
      GtfsStaticViewer.svelte     # GTFS Static browser / SQL editor

      KeyLogViewer.svelte         # Watched-key history
      GtfsRtLogViewer.svelte      # GTFS-RT snapshot history
      ToolsPanel.svelte           # Developer utilities modal
      SplitPane.svelte            # Resizable split view used in +page.svelte
      TraceChart.svelte
      SqlEditor.svelte
    panelState.svelte.ts   # Central shared reactive state singletons
    logState.svelte.ts     # Triggers log viewer refresh
    endpoints.ts           # OneBusAway endpoint definitions
    utils/
      jsonCompare.ts       # Diff counting, path helpers, array alignment
      search.ts            # Deep JSON search
      date.ts
    server/db.ts           # better-sqlite3 setup
```

## State management

All global UI state lives in `src/lib/panelState.svelte.ts` as module singletons:

```ts
import {
	comparatorState,
	protobufState,
	gtfsStaticState,
	loggerState
} from '$lib/panelState.svelte';
```

Key classes:

- `ComparatorState` — server URLs, selected endpoint, params, responses, ignore/watch keys, batch results, collapse/expand flags.
- `ProtobufState` — GTFS-RT feed URLs, decoded results, refresh state.
- `GtfsStaticState` — uploaded GTFS static files, SQL query state.
- `LoggerState` — key log filter/time-range state.

Important: `panelState.svelte.ts` already wires up `$effect.root` persistence for many fields to `localStorage`. If you add a new persisted toggle/field, follow the same pattern (load on init + `$effect` to save).

## Common patterns

### Svelte runes

This is Svelte 5. State is declared with `$state`, derived values with `$derived`/`$derived.by`, side effects with `$effect`. No more `$:` in new code.

### Endpoints

`endpoints.ts` exports an array of endpoint objects. Each has `id`, `name`, `path`, and `params[]`. Params can be `inPath: true` (replaced in the URL path) or query params. `ComparatorPanel.svelte` builds URLs via `buildUrl()`.

### Diff / JSON compare

- `DiffViewer.svelte` renders two `JsonViewer` instances.
- `JsonViewer.svelte` accepts `mode="server1" | "server2"`, `searchQuery`, `matchingPaths`, `syncedExpandedPaths`, `ignoredKeys`.
- `jsonCompare.ts` has `countDifferences`, `countComparableItems`, `getByPath`, `matchArraysById`, etc.
- `JsonTree.svelte` does the heavy lifting of recursive rendering and expansion state.

### Layout gotchas

- `+page.svelte` mounts panels inside `main` with `display: flex; flex-direction: column` and each active tab panel uses `flex-1 min-h-0` so it fills the viewport below the header.
- `ComparatorPanel.svelte` is itself `flex flex-col h-full`. Its input card is `shrink-0`, and the results area uses `min-h-0 flex-1 flex flex-col` so the JSON diff can fill remaining space.
- `DiffViewer.svelte` uses `flex flex-col h-full` with a `grid grid-rows-[auto_1fr]` for the two panes; the scroll containers use `h-full` instead of a fixed `max-h`.

If you see unexpected empty space or scrolling issues, check the flex chain: `main` → tab panel → `ComparatorPanel` → results container → `DiffViewer` → grid.

## Local dev commands

```bash
pnpm install
pnpm dev                 # http://localhost:5173
pnpm run build           # production build
pnpm run check           # svelte-check + TypeScript
pnpm run lint            # prettier + eslint
pnpm run format          # prettier --write + organizes imports
```

## Adding a feature

1. If it touches shared UI state, add fields to the appropriate class in `panelState.svelte.ts`.
2. Persist user preferences to `localStorage` using the existing `$effect.root` pattern when it makes sense.
3. Keep components modular; the main panels live in `src/lib/components/`.
4. Run `pnpm run check && pnpm run lint` before committing.

## Notes for agents

- The app is dark-mode aware. Always test both `html.light` (default) and `html.dark`.
- The comparator supports batch mode: when an endpoint has an `inPath` param and the Batch IDs textarea has multiple lines, it fetches each ID and lets the user switch between results.
- `showIgnoreModal` / `showWatchModal` render fixed modals in `ComparatorPanel.svelte`.
- Several pre-existing `svelte-check` warnings/errors (a11y label associations, TS indexing in `DiffViewer.svelte`) exist; don't let them block you, but don't add new ones.
