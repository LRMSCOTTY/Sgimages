# Sgimages — AI Image Editor

A browser-based AI image editor built with **React + Vite**, designed around two
principles that set it apart from typical web editors: **efficiency**
(it never blocks the UI and never re-does work it doesn't have to) and
**correctness** (edits are reproducible, testable data — preview always equals
export).

It runs entirely client-side with a mock AI engine, so there are no API keys or
costs required to try it. The AI layer is isolated so a real provider can be
dropped in without touching the rest of the app.

```bash
npm install
npm run dev      # start the app
npm test         # run the test suite (35 tests)
npm run build    # production build
```

## How it compares

We looked at what leading 2026 editors (Adobe Lightroom, Luminar Neo, Canva,
YouCam) do well, and built the architecture around their strongest ideas:

| Competitor strength | How Sgimages implements it |
| --- | --- |
| **Non-destructive editing** (Lightroom/Luminar store *instructions*, not baked pixels) | Every edit is a layer in a **recipe**; the image is a pure function `render(source, ops)`. Toggle, reorder, re-tune, or delete any edit at any time. |
| **Generative "AI agent"** text edits (the 2026 baseline) | Prompt-driven **Generate** and **Reimagine** tools, added as re-editable layers. |
| **Real-time responsiveness** | All pixel work runs **off the main thread** in a Web Worker (OffscreenCanvas). Rapid slider drags supersede in-flight renders; identical recipes are served from cache. |

## The two core systems

### 1. Non-destructive recipe engine (`src/lib/recipe.js`, `renderEngine.js`)

A *document* is an immutable `source` plus an ordered list of `ops`:

```
image = render(source, ops)
```

- **Efficient:** undo history stores a few hundred bytes of JSON per state — not
  multi-megabyte image snapshots — so deep history is cheap. Consecutive
  adjustment layers are collapsed into a single filter pass.
- **Correct:** edits are data, so they can be toggled, reordered, and removed
  without re-doing the work above them, and without the cumulative quantization
  you get from repeatedly baking pixels. A `generated` source stores only its
  prompt + size (reproducible), so it costs nothing to keep.

### 2. Off-main-thread render pipeline (`src/lib/renderClient.js`, `workers/render.worker.js`)

The exact same `renderDocument` pipeline runs in a Web Worker via
`OffscreenCanvas`, with a synchronous main-thread fallback when the browser
lacks support:

- **Off-thread:** pixel work never freezes scrolling, typing, or slider drags.
- **Latest-wins coalescing:** while you drag a slider, superseded renders are
  dropped — only the newest result is ever painted.
- **Memoization:** an identical recipe (e.g. `undo` then `redo`) returns the
  cached bitmap instantly with no re-render.
- **One render path:** preview and export share the same deterministic code, so
  what you see is exactly what you export.

### Correctness backbone: the test suite

35 unit tests (`npm test`) lock in the behaviour that makes the above safe:

- **Determinism** — same seed ⇒ same sequence (`seededRandom`).
- **Adjustment clamping / normalization** and one shared filter string for
  preview and bake (`adjustments`).
- **Recipe invariants** — immutable transforms, move-bounds, adjust-collapse,
  serialization round-trips, and a cache key that's stable yet sensitive to
  enabled ops and params (`recipe`).
- **Undo/redo invariants** — inverse operations, redo-stack clearing on branch,
  no-op de-duplication, history cap (`history`).
- **Render orchestration** — correct dimensions, op ordering, disabled-op
  skipping, single collapsed filter pass (`renderEngine`, via a canvas mock).

## Features

| Tool | What it does | Engine |
| --- | --- | --- |
| ✨ **Generate** | Text prompt → image | Procedural, prompt-seeded (deterministic) |
| 🎛️ **Adjust** | Brightness, contrast, saturation, hue, grayscale, sepia, blur, invert + rotate/flip | Real canvas filters, live preview through the real pipeline |
| ✂️ **Background** | Remove a photo's background | Corner-color chroma key with feathered edge |
| 🪄 **Reimagine** | Re-style an image from a prompt | Prompt-seeded grade |

Plus an **edit stack** (toggle / reorder / delete any layer), undo/redo,
transparent-background checkerboard, and one-click PNG export.

## Project structure

```
src/
├── App.jsx                     # Controller: history, draft preview, tool routing
├── styles.css
├── lib/
│   ├── seededRandom.js         # Deterministic hash + PRNG + clamping  (tested)
│   ├── adjustments.js          # Adjust params: normalize + filter string (tested)
│   ├── recipe.js               # Non-destructive document/op model      (tested)
│   ├── history.js              # Undo/redo reducer                      (tested)
│   ├── generation.js           # Pixel ops (DOM-free, runs in worker)
│   ├── renderEngine.js         # Replays a recipe into a canvas         (tested)
│   ├── renderClient.js         # Worker orchestration: coalesce + memo + fallback
│   └── __tests__/              # 35 unit tests
├── workers/
│   └── render.worker.js        # OffscreenCanvas render worker
└── components/
    ├── Sidebar / Toolbar / CanvasStage / EditStack / UploadButton
    └── Generate / Adjust / Background / GenerativeEdit panels
```

## Swapping in a real AI provider

The procedural drawing in `src/lib/generation.js` is the only thing standing in
for a real model. Replace `paintGeneration` / `paintGenerative` with calls to
your backend (returning pixels the engine composites), keeping the function
shapes intact, and the entire non-destructive + off-thread architecture keeps
working unchanged. Do the API call from a server route so your key never reaches
the browser.

## License

MIT
