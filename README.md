<div align="center">

# LocalDesk

[![Version](https://img.shields.io/badge/version-0.0.5-blue.svg)](https://github.com/vakovalskii/LocalDesk/releases)
[![Platform](https://img.shields.io/badge/platform-%20Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/vakovalskii/LocalDesk)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Desktop AI Assistant with Local Model Support**

</div>

---


https://github.com/user-attachments/assets/a8c54ce0-2fe0-40c3-8018-026cab9d7483


## ✨ Features

### Core Capabilities
- ✅ **OpenAI SDK** — full API control, compatible with any OpenAI-compatible endpoint
- ✅ **Local Models** — vLLM, Ollama, LM Studio support
- ✅ **WASM Sandbox** — secure JavaScript execution via QuickJS (no Node.js required)
- ✅ **Document Support** — PDF and DOCX text extraction (bundled, works out of the box)
- ✅ **Web Search** — Tavily and Z.AI integration for internet search
- ✅ **Security** — directory sandboxing for safe file operations
- ✅ **Cross-platform** — Windows, macOS, Linux with proper shell commands

### UI/UX Features
- ✅ **Modern Interface** — React + Electron with smooth auto-scroll and streaming
- ✅ **Message Editing** — edit and resend messages with history truncation
- ✅ **Session Management** — pin important sessions, search through chat history
- ✅ **Keyboard Shortcuts** — Cmd+Enter/Ctrl+Enter to send messages
- ✅ **Spell Check** — built-in spell checking with context menu suggestions
- ✅ **Permission System** — ask/default modes for tool execution control

### Advanced Features
- ✅ **Memory System** — persistent storage of user preferences in `~/.localdesk/memory.md`
- ✅ **Token Tracking** — display input/output tokens and API duration
- ✅ **Optimized Streaming** — requestAnimationFrame-based UI updates (60fps)
- ✅ **Stop Streaming** — interrupt LLM responses at any time

## 🚀 Quick Start

### Installation (npm)

```bash
# Clone the repository
git clone https://github.com/vakovalskii/LocalDesk.git
cd LocalDesk

# Install dependencies
npm install

# Rebuild native modules for Electron
npx electron-rebuild -f -w better-sqlite3

# Run in development mode
npm run dev
```

### Installation (bun) ⚡

```bash
# Clone the repository
git clone https://github.com/vakovalskii/LocalDesk.git
cd LocalDesk

# Install dependencies (faster)
bun install

# Rebuild native modules for Electron
bunx electron-rebuild -f -w better-sqlite3

# Run in development mode
bun run dev
```

> **Note:** Bun is significantly faster for dependency installation (~3x speedup)

### Configuration

1. Click **Settings** (⚙️) in the app
2. Configure your API:
   - **API Key** — your key (or `dummy-key` for local models)
   - **Base URL** — API endpoint (must include `/v1`)
   - **Model Name** — model identifier
   - **Temperature** — 0.0-2.0 (default: 0.3)
3. Click **Save Settings**

### Example Configurations

**Local vLLM:**
```json
{
  "apiKey": "dummy-key",
  "baseUrl": "http://localhost:8000/v1",
  "model": "qwen3-30b-a3b-instruct-2507"
}
```

**OpenAI:**
```json
{
  "apiKey": "sk-...",
  "baseUrl": "https://api.openai.com/v1",
  "model": "gpt-4"
}
```

## 🛠️ Available Tools

All tools follow `snake_case` naming convention (`verb_noun` pattern):

### File Operations
| Tool | Description |
|------|-------------|
| `run_command` | Execute shell commands (PowerShell/bash) |
| `read_file` | Read text file contents |
| `write_file` | Create new files |
| `edit_file` | Modify files (search & replace) |
| `search_files` | Find files by glob pattern (`*.pdf`, `src/**/*.ts`) |
| `search_text` | Search text content in files (grep) |
| `read_document` | Extract text from PDF/DOCX (max 10MB) |

### Code Execution
| Tool | Description |
|------|-------------|
| `execute_js` | Run JavaScript in secure WASM sandbox (QuickJS) |

**execute_js** features:
- Available globals: `fs`, `path`, `console`, `JSON`, `Math`, `Date`, `__dirname`
- No imports needed — use globals directly
- No TypeScript, no async/await, no npm packages
- Use `return` statement to output results

### Web Tools (Optional)
| Tool | Description |
|------|-------------|
| `search_web` | Search the internet (Tavily/Z.AI) |
| `extract_page` | Extract full page content (Tavily only) |
| `read_page` | Read web page content (Z.AI Reader) |

### Memory (Optional)
| Tool | Description |
|------|-------------|
| `manage_memory` | Store/read persistent user preferences |

> **Security:** All file operations are sandboxed to the workspace folder only.

## 🏗️ Project Structure

```
src/
├── electron/                    # Electron main process
│   ├── main.ts                 # Entry point
│   ├── ipc-handlers.ts         # IPC communication
│   └── libs/
│       ├── runner-openai.ts    # OpenAI API runner
│       ├── tools-executor.ts   # Tool execution logic
│       ├── container/
│       │   └── quickjs-sandbox.ts  # WASM sandbox
│       ├── prompts/
│       │   └── system.txt      # System prompt template
│       └── tools/              # Tool definitions (snake_case)
│           ├── bash-tool.ts        # run_command
│           ├── read-tool.ts        # read_file
│           ├── write-tool.ts       # write_file
│           ├── edit-tool.ts        # edit_file
│           ├── glob-tool.ts        # search_files
│           ├── grep-tool.ts        # search_text
│           ├── execute-js-tool.ts  # execute_js
│           ├── read-document-tool.ts # read_document
│           ├── web-search.ts       # search_web
│           ├── extract-page-content.ts # extract_page
│           ├── zai-reader.ts       # read_page
│           └── memory-tool.ts      # manage_memory
└── ui/                         # React frontend
    ├── App.tsx                 # Main component
    ├── components/             # UI components
    └── store/                  # Zustand state management
```

## 📦 Building

```bash
# macOS (DMG)
npm run dist:mac

# Windows (EXE)
npm run dist:win

# Linux (AppImage)
npm run dist:linux
```

## 🔐 Data Storage

### Application Data
- **Windows:** `C:\Users\YourName\AppData\Roaming\localdesk\`
- **macOS:** `~/Library/Application Support/localdesk/`
- **Linux:** `~/.config/localdesk/`

Files:
- `sessions.db` — SQLite database with chat history
- `api-settings.json` — API configuration

### Global Data
- `~/.localdesk/memory.md` — persistent memory storage

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

<div align="center">

**Made with ❤️ by [Valerii Kovalskii](https://github.com/vakovalskii)**

</div>
