# Query

A modern desktop SQL database client built with Tauri 2.0, React 19, and TypeScript. Query provides a powerful Monaco-based SQL editor with IntelliSense, schema browsing, query history, and saved queries.

## Features

- **Monaco SQL Editor** with IntelliSense (keyword, table, and column completion)
- **Optional Vim Mode** for keyboard-driven editing
- **Schema Browser** with interactive table and column exploration
- **Query History** with automatic saving and quick access
- **Saved Queries** with pinning support
- **Command Palette** (Cmd+K) for quick navigation and query templates
- **TanStack Table** with sorting, filtering, and virtual scrolling for large result sets
- **Secure Password Storage** via OS keychain (passwords never stored on disk)
- **Project Workspaces** to organize connections and queries by project

## Prerequisites

Before running Query, ensure you have the following installed:

- **Node.js** 18+ (or **Bun** 1.0+)
- **Rust** 1.70+ (install via [rustup](https://rustup.rs/))
- **Tauri CLI** (installed automatically via npm/bun)

### Platform-Specific Requirements

**macOS:**
- Xcode Command Line Tools: `xcode-select --install`
- Install dependencies via Homebrew:
  ```bash
  # Install Bun (recommended) or Node.js
  brew install bun
  # Or: brew install node

  # Install Rust (alternatively, use rustup)
  brew install rust
  # Or: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```

**Linux:**
- Development libraries:
  ```bash
  # Debian/Ubuntu
  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

  # Fedora
  sudo dnf install webkit2gtk4.1-devel openssl-devel gtk3-devel libappindicator-gtk3-devel librsvg2-devel
  ```

**Windows:**
- Microsoft Visual Studio C++ Build Tools
- WebView2 (usually pre-installed on Windows 10/11)

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/wsoule/Query
   cd Query
   ```

2. **Install dependencies:**
   ```bash
   # Using Bun (recommended)
   bun install

   # Or using npm
   npm install
   ```

3. **Install Rust dependencies:**
   ```bash
   cd src-tauri
   cargo build
   cd ..
   ```

## Running the Application

### Development Mode

Start the app with hot reload for both frontend and backend:

```bash
# Using Bun
bun run tauri dev

# Or using npm
npm run tauri dev
```

This will:
- Start the Vite dev server on port 1420
- Launch the Tauri desktop app
- Enable hot reload for both React and Rust code

### Frontend Only

To run just the frontend in a browser:

```bash
bun run dev
# or
npm run dev
```

## Building for Production

### Build the complete desktop application:

```bash
# Build frontend assets
bun run build

# Build the Tauri app (creates installer/DMG/AppImage)
bun run tauri build
```

The built application will be in `src-tauri/target/release/bundle/`

### Build artifacts by platform:
- **macOS:** `.dmg` and `.app` in `bundle/dmg/` and `bundle/macos/`
- **Linux:** `.AppImage` and `.deb` in `bundle/appimage/` and `bundle/deb/`
- **Windows:** `.msi` and `.exe` in `bundle/msi/` and `bundle/nsis/`

## Tech Stack

### Frontend
- **React 19.1** - UI framework
- **TypeScript 5.8** - Type safety
- **Vite 7** - Build tool and dev server
- **Tailwind CSS 4** - Utility-first styling
- **Monaco Editor** - SQL editor with IntelliSense
- **TanStack Table 8.21** - Data table with sorting/filtering
- **monaco-vim** - Vim mode support
- **Shadcn UI** - React UI components

### Backend
- **Tauri 2.0** - Desktop app framework
- **Rust** - Native backend (async with Tokio)
- **SQLx 0.8.6** - SQL database driver (PostgreSQL, SQLite, MySQL)
- **keyring** - OS keychain integration for secure password storage

### Databases
- **PostgreSQL** - Fully supported remote database
- **SQLite** - Local storage (query history, saved queries)
- **MySQL** - Partial support (dependencies ready, commands in progress)

## Project Structure

```
Query/
├── src/                      # Frontend React app
│   ├── components/
│   │   ├── editor/          # SqlEditor with Monaco + Vim
│   │   ├── results/         # ResultsTableEnhanced (TanStack)
│   │   ├── sidebar/         # SchemaExplorer, QueryHistory, SavedQueries
│   │   └── modals/          # CommandPalette, SaveQueryModal, ProjectSettings
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Tauri command wrappers, utilities
│   └── App.tsx             # Main application component
│
├── src-tauri/               # Rust backend
│   ├── src/
│   │   ├── commands/        # Tauri command handlers
│   │   ├── models/          # Shared data structures
│   │   ├── storage/         # Database and file I/O
│   │   └── utils/           # Helper functions
│   └── Cargo.toml          # Rust dependencies
│
└── CLAUDE.md               # Detailed developer documentation
```

## Data Storage

Query stores data in the following locations:

- **Query History:** `{project_path}/history.db` (SQLite)
- **Saved Queries:** `{project_path}/saved_queries.db` (SQLite)
- **Connection Configs:** `{project_path}/connections.json` (without passwords)
- **App Settings:** `~/.query/settings.json` (global settings)
- **Passwords:** OS Keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)

Default project path is `~/.query/`, but can be changed via Project Settings.

## Development

### TypeScript Compilation Check
```bash
bun run build
```

### Rust Compilation Check
```bash
cd src-tauri
cargo build
```

### Running Tests
```bash
# Rust tests
cd src-tauri
cargo test
```

## Keyboard Shortcuts

- **Cmd/Ctrl + Enter** - Execute query
- **Cmd/Ctrl + K** - Open command palette
- **Cmd/Ctrl + /** - Toggle comment
- **Cmd/Ctrl + S** - Save query (when in editor)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CLAUDE.md](./CLAUDE.md) for detailed architecture and development guidelines.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
  - [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
  - [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
  - [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

## License

[MIT](LICENSE)
