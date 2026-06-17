# Sgimages — AI Image Editor

A browser-based AI image editing app built with **React + Vite**. It runs
entirely client-side with a **mock AI engine**, so there are no API keys or
costs required to try it. The mock layer is isolated behind a small module so
you can swap in a real provider later without touching the UI.

## Features

| Tool | What it does | Powered by |
| --- | --- | --- |
| ✨ **Generate** | Turn a text prompt into an image | Mock AI (procedural, prompt-seeded) |
| 🎛️ **Adjust** | Brightness, contrast, saturation, hue, grayscale, sepia, blur, invert, rotate & flip | Real canvas filters |
| ✂️ **Background** | Remove the background of a photo | Real corner-color chroma key |
| 🪄 **Reimagine** | Re-style an image from a prompt | Mock AI (prompt-seeded grade) |

Plus: undo/redo history, live adjustment preview, transparent-background
checkerboard, and one-click PNG export.

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

To build for production:

```bash
npm run build
npm run preview
```

## Project structure

```
src/
├── App.jsx                 # State, history (undo/redo), tool routing
├── styles.css              # App-wide styling (dark theme)
├── lib/
│   ├── imageUtils.js       # Real canvas transforms (filters, rotate, flip, export)
│   └── mockAI.js           # Mock AI engine — replace with real API calls
└── components/
    ├── Sidebar.jsx
    ├── Toolbar.jsx
    ├── CanvasStage.jsx
    ├── UploadButton.jsx
    ├── GeneratePanel.jsx
    ├── AdjustPanel.jsx
    ├── BackgroundPanel.jsx
    └── GenerativeEditPanel.jsx
```

## Swapping in a real AI provider

Every AI call lives in [`src/lib/mockAI.js`](src/lib/mockAI.js). Each function
returns a `Promise<dataURL>`. Replace the body of `generateImage`,
`generativeEdit`, or `removeBackground` with a `fetch()` to your backend (keep
the signatures the same) and the rest of the app keeps working unchanged. Do
the API call from a server route so your key is never exposed in the browser.

## License

MIT
