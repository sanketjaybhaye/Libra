# 📚 Libra — Your Personal Library, On Your Network

<p align="center">
  <img src="assets/banner.png" alt="Libra Banner" width="100%" style="border-radius: 8px; margin: 20px 0;" />
</p>

<p align="center">
  <strong>A premium, self-hosted, lightweight library and reader for e-books and comics.</strong>
  <br />
  <em>Upload EPUB, PDF, CBZ, or CBR files, extract metadata automatically, track reading progress, and sync notes to Notion.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-blue?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js version" />
  <img src="https://img.shields.io/badge/React-18%2B-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React version" />
  <img src="https://img.shields.io/badge/SQLite-WAL_Mode-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
</p>

---

## ✨ Key Features

- 📖 **All-in-One Readers:** Paginated EPUB reader with customizable themes and font sizes, high-performance canvas-rendered PDF viewer, and page-by-page CBZ/CBR comic viewer.
- ⚡ **Zero Configuration:** Powered by SQLite in WAL mode. Single-process server served on a single port. No complex database engines to set up.
- 👥 **Multi-User Support:** Share your library across your home network. Each user gets isolated reading progress, history tracking, daily goals, and favorite lists.
- 🚀 **Automatic Metadata:** Extracts title, author, description, cover image, and series metadata directly from EPUB files on upload. Supports web metadata lookup if local files are missing metadata.
- 🔄 **Notion Sync Integration:** Export your reading highlights and annotations directly to a personal Notion database with one click.
- 📱 **Premium Mobile UX:** Responsive layouts optimized for smartphones, including swipe page turns, floating mini-timers, scroll-constrained highlights search/filter, and touch-friendly avatar overlays.

---

## 🛠️ Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Backend** | Node.js + Express | Single-process runtime, light and fast. |
| **Database** | SQLite (`node:sqlite`) | Embedded database with zero server config, WAL enabled. |
| **Frontend** | React + Vite | Clean, single-page app served statically by the Node server. |
| **Styling** | Vanilla CSS | Bespoke, premium dark-mode theme utilizing CSS custom properties. |

---

## 🚀 Quick Start

Get your personal server running in under a minute:

### 🐋 Option A: Run with Docker (Recommended)

If you have Docker and Docker Compose installed, run this single command from the project root:

```bash
docker compose up -d --build
```

*   💾 **Persistence:** Database records and uploaded books are mapped and saved locally under `server/data/` and `server/uploads/` on your host machine.
*   🔌 **Access:** The application runs on port `4100` (`http://localhost:4100`).

---

### 💻 Option B: Run Locally (Node/NPM)

#### 1. Start the Server
```bash
cd server
npm install
npm start
```

#### 2. Access the Dashboard
On first run, the server prints local and LAN addresses:
```text
Libra is running.
  Local:   http://localhost:4100
  Network: http://192.168.1.42:4100
```

> [!TIP]
> Open the **Network** address from your phone, tablet, or another computer on the same Wi-Fi/LAN to read from anywhere! The first account created automatically becomes the administrator.

To run the server on a custom port, set the `PORT` environment variable before running:
```bash
PORT=8080 npm start
```

---

## 🕒 Running Permanently

To run Libra persistently in the background (surviving terminal closures and system reboots), use a process manager like **PM2**:

```bash
# Install PM2 globally
npm install -g pm2

# Start the server
cd server
pm2 start src/index.js --name libra

# Save state and configure boot startup
pm2 save
pm2 startup
```

---

## 💻 Frontend Development & UI Customization

The `public/` directory at the project root holds the built client assets served by Node. If you want to modify or customize the UI layout:

```bash
# 1. Start backend in one terminal
cd server
npm start

# 2. Open another terminal and start web dev environment
cd web
npm install
npm run dev      # Launch dev server with hot reload and API proxying

# 3. Rebuild static assets once changes are made
npm run build    # Compiles assets directly into the server's public folder
```

---

## 📂 Storage & Backup Directories

All uploads and database records are kept in simple, accessible folders. Back up these directories to secure your library:

- 💾 **`server/data/libra.sqlite`** — Database storing user profiles, reading progress, shelves, highlights, comments, and daily goals.
- 📚 **`server/uploads/books/`** — Folder containing original uploaded books and comic files.
- 🖼️ **`server/uploads/covers/`** — Extracted cover image caches.

---

## 📝 Limitations & Notes

> [!NOTE]
> - **File Limits:** Default upload size is capped at 1 GB per file (ideal for heavy scanned PDFs and graphic novels). This can be adjusted in [items.js](file:///c:/Users/Sanket/Documents/Bucket%20List/libra/server/src/routes/items.js).
> - **MOBI Format:** MOBI files can be uploaded and downloaded, but cannot be read in the browser yet. Convert MOBI files to EPUB (e.g. using Calibre) for full in-browser reading.
> - **Import Pipeline:** Files are imported through drag-and-drop on the upload screen (supports bulk upload). There is no auto-folder scanning by default to keep the storage layer simple and predictable.
