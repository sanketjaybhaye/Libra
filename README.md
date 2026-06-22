# Libra — your shelf, on your network

A self-hosted library for e-books and comics. Upload EPUB, PDF, CBZ, or CBR files; Libra
reads titles, authors, series, and cover art straight out of the files. Read everything
in the browser, track progress per page or percent, and share one library across multiple
accounts on your home network — each person gets their own reading progress and favorites.

## What's inside

- **Backend**: Node.js + Express + SQLite (via `better-sqlite3`), single process, no external
  database to configure.
- **Frontend**: React (Vite), built to static files and served by the same Node process —
  one server, one port, nothing else to run.
- **Readers**: EPUB (paginated, with themes and font sizing), PDF (canvas-rendered), and
  CBZ/CBR (page-by-page comic viewer).
- **Accounts**: the first person to register becomes the admin. Everyone after that is a
  regular user. Progress and favorites are private to each account; the library itself is shared.

## Requirements

- Node.js 18 or newer (20+ recommended) on the machine that will run the server.
- That's it. No Docker, no separate database server.

## Setup

```bash
cd server
npm install
npm start
```

On first run the server prints both a local and a LAN address:

```
Libra is running.
  Local:   http://localhost:4100
  Network: http://192.168.1.42:4100
```

Open the **Network** address from any device on the same Wi-Fi/LAN to use Libra from your
phone, tablet, or another computer. The first account you create becomes the admin.

To change the port, set `PORT` before starting:

```bash
PORT=8080 npm start
```

### A note on `npm install` and native modules

`better-sqlite3` compiles a small native binary during install. On almost every normal
machine with Node.js installed, `npm install` handles this automatically — nothing extra
to do. If you're on a locked-down or offline machine and the install fails while trying to
fetch Node headers, try:

```bash
npm install --nodedir=/usr
```

(pointing at wherever your system's Node headers actually live), or install build tools
(`python3`, `make`, a C compiler) and retry. This is rare — most setups just work.

## Running it permanently (so it survives reboots/closed terminals)

The simplest option is a process manager like `pm2`:

```bash
npm install -g pm2
cd server
pm2 start src/index.js --name libra
pm2 save
pm2 startup   # follow the printed instructions to enable on boot
```

Or use a systemd service, or just run it in a `screen`/`tmux` session — whatever you'd
normally use to keep a personal server alive.

## Rebuilding the frontend

The `public/` folder at the project root is the built frontend the server serves. If you
want to make changes to the UI:

```bash
cd web
npm install
npm run dev      # local dev server with hot reload, proxies API calls to :4100
npm run build    # builds into ../public, which the Node server serves
```

You'll need the backend (`cd server && npm start`) running in another terminal for `npm run
dev` to have something to talk to.

## How metadata is found

- **EPUB**: reads the book's internal `content.opf` for title, author, description, cover
  image, and Calibre-style series metadata if present.
- **PDF**: reads the embedded document title/author and page count.
- **CBZ/CBR**: uses the first image inside the archive as the cover and counts image
  files as pages — no metadata file needed.

If a file doesn't carry good metadata, the title falls back to the filename, and you can
always fix it afterward from the item's "Edit details" button — title, author, series,
series number, and tags are all editable, and tags double as a free-form shelf filter.

## Where things are stored

- `server/data/libra.sqlite` — all library metadata, accounts, progress, and favorites.
- `server/uploads/books/` — the original files you upload.
- `server/uploads/covers/` — extracted cover images.

Back up the `server/data` and `server/uploads` folders together to preserve your whole
library, including reading progress.

## Limitations to know about

- Upload size is capped at 1 GB per file (generous for scanned PDFs and most comics —
  raise the limit in `server/src/routes/items.js` if you need more).
- MOBI files can be uploaded and stored, but there's no in-browser MOBI reader yet —
  they're downloadable, not readable in-app. Converting MOBI to EPUB beforehand (with a
  tool like Calibre) gets you the full reading experience.
- There's no automatic folder-watching/import — files come in through the upload screen
  (drag-and-drop, multiple at once). This was a deliberate simplicity trade-off; ask if
  you'd like folder scanning added later.
