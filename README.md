<p align="center">
  <img src="public/logo.svg" width="64" alt="PastePath Logo" />
</p>

<h1 align="center">PastePath</h1>

<p align="center">
  <strong>Screenshot Annotation, Step-by-Step Guides & Visual Sharing Tool</strong>
</p>

<p align="center">
  <a href="https://github.com/naimurhasan/PastePath/stargazers">
    <img src="https://img.shields.io/github/stars/naimurhasan/PastePath?style=social" alt="GitHub Stars" />
  </a>
  <a href="https://github.com/naimurhasan/PastePath/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
  </a>
</p>

<p align="center">
  <a href="https://pastepath.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/Open%20PastePath.com-Live%20App-25c2a0?style=for-the-badge&logo=cloudflare&logoColor=white&labelColor=111827" />
      <img src="https://img.shields.io/badge/Open%20PastePath.com-Live%20App-25c2a0?style=for-the-badge&logo=cloudflare&logoColor=white&labelColor=111827" alt="Open PastePath.com live app" />
    </picture>
  </a>
</p>

<p align="center">
  Drop screenshots, annotate with shapes, arrows, text & freehand, arrange them into clear steps, then share as a link, copy to clipboard, or export.
</p>

<p align="center">
  Great for tutorials, documentation, product reviews, bug reports, QA walkthroughs, onboarding guides, feature handoffs, support replies, and many more visual workflows.
</p>

---

<p align="center">
  <img src="public/screenshot.png" alt="PastePath – annotate and share screenshots" width="800" />
</p>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🖼️ **Multi-image steps** | Add multiple screenshots as ordered steps for tutorials, docs, reviews, and walkthroughs |
| ✏️ **Rich annotation tools** | Rectangle, circle, arrow, pencil, eraser, and text |
| 🔤 **Unicode text** | Full emoji & multilingual text support (CJK, Devanagari, etc.) |
| 🎨 **Color & size** | 8 preset colors, 4 stroke sizes, keyboard shortcuts |
| 🔍 **Zoom & pan** | Zoom in/out with hand tool; mouse wheel support |
| ↕️ **Reorder steps** | Move steps up/down to rearrange your guide |
| 📋 **Captions** | Add multiline captions per step |
| 🔗 **One-click sharing** | Generate a shareable link with optional password protection |
| 📥 **Export** | Copy to clipboard, download annotated images, or use share links for longer guides |
| 🌙 **Dark UI** | Sleek dark theme by default |

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/naimurhasan/PastePath.git
cd PastePath

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Backend With SQLite

PastePath now uses the frontend -> backend -> database flow for shares. The browser never talks to the database directly. Share links are still clean `/view/:id` URLs like `https://pastepath.com/view/abc12345`.

To serve OG/Twitter metadata on the same clean route, run the tiny Node server after building the app:

```bash
pnpm install
pnpm build
pnpm serve:share
```

The share server uses Node's built-in SQLite module and requires Node `22.5.0` or newer.

Required environment variables:

- `VITE_PUBLIC_SITE_URL` — your app's domain (for example: `https://pastepath.com`); used by both frontend for clean share links and backend for OG metadata
- `VITE_API_BASE_URL` — backend URL for local frontend development (for example: `http://localhost:4173`)
- `SHARE_SQLITE_PATH` — local SQLite database file path (optional, defaults to `./data/pastepath.sqlite`)
- `FRONTEND_ORIGIN` — allowed frontend origin for local development CORS (defaults to `http://localhost:5173`)
- `SHARE_SERVER_PORT` — port for the metadata server (optional, defaults to `4173`)

Create a local `.env` from `.env.example`:

```bash
cp .env.example .env
```

Then fill it like this:

```bash
VITE_PUBLIC_SITE_URL="https://pastepath.com"
VITE_API_BASE_URL="http://localhost:4173"

SHARE_SQLITE_PATH="./data/pastepath.sqlite"

FRONTEND_ORIGIN="http://localhost:5173"
SHARE_SERVER_PORT="4173"
```

No AWS or Cloudflare database credentials are required for the current backend. The app stores shares in a local SQLite file.

Deployment note:

- Route all requests for `/view/:id` to this server.
- The server returns OG metadata HTML for crawlers and serves the SPA for normal browser requests.

Database setup:

- No Supabase files, migrations, AWS credentials, or manual SQL steps are required.
- The backend creates the SQLite schema automatically on startup.
- The default database file is `./data/pastepath.sqlite`; override it with `SHARE_SQLITE_PATH`.
- It runs `CREATE TABLE IF NOT EXISTS shares (...)` and `CREATE INDEX IF NOT EXISTS idx_shares_auto_delete_at ...`, so restarting the server is safe and will not overwrite existing share rows.

## 🛠️ Tech Stack

- **React 18** + **TypeScript**
- **Vite** — blazing-fast dev & build
- **Tailwind CSS** — utility-first styling
- **shadcn/ui** — accessible, composable components
- **Node + Express** — backend API and OG metadata server
- **SQLite** — local database for share persistence
- **Canvas API** — high-resolution annotation rendering

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Rectangle tool |
| `2` | Circle tool |
| `3` | Arrow tool |
| `4` | Pencil (freehand) |
| `5` | Eraser |
| `6` | Text tool |
| `7` | Hand (pan & zoom) |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |

## 📁 Project Structure

```
src/
├── components/
│   ├── AnnotationCanvas.tsx   # Canvas rendering & drawing logic
│   ├── AnnotationToolbar.tsx  # Tool, color & size selection
│   ├── CaptionInput.tsx       # Step captions
│   ├── ImagePanel.tsx         # Per-step panel with toolbar & canvas
│   ├── ImageUploader.tsx      # Drag-drop, paste, URL image input
│   ├── ShareDialog.tsx        # Share link generation
│   └── ui/                    # shadcn/ui primitives
├── pages/
│   ├── Index.tsx              # Main editor page
│   └── ViewShare.tsx          # Shared link viewer
├── types/
│   └── annotation.ts          # TypeScript types
└── lib/
    └── api.ts                 # Frontend client for backend API
```

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

Good next feature idea: add a highlighter annotation tool for marking text or UI areas with translucent strokes.

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/awesome`)
3. Commit changes (`git commit -m 'Add awesome feature'`)
4. Push to branch (`git push origin feature/awesome`)
5. Open a Pull Request

## ⭐ Star History

If you find this project useful, please consider giving it a ⭐ on GitHub!

[![Star this repo](https://img.shields.io/github/stars/naimurhasan/PastePath?style=for-the-badge&logo=github&label=Star%20on%20GitHub)](https://github.com/naimurhasan/PastePath)

---

<p align="center">
  Initial development started with <a href="https://lovable.dev">❤️ Lovable</a>
</p>
