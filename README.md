<div align="center">

# LocalDesk

[![Version](https://img.shields.io/badge/version-0.0.7-blue.svg)](https://github.com/vakovalskii/LocalDesk/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/vakovalskii/LocalDesk)
[![License](https://img.shields.io/badge/license-Community-blue.svg)](LICENSE)

**Desktop AI Assistant with Local Model Support**

[Features](#-features) • [Quick Start](#-quick-start) • [Tools](#-tools) • [Skills](https://vakovalskii.github.io/LocalDesk-Skills/) • [License](#-license)

</div>

---

https://github.com/user-attachments/assets/a8c54ce0-2fe0-40c3-8018-026cab9d7483

## ✨ Features

### Core
- **Multi-Provider LLM** — OpenAI, vLLM, Ollama, LM Studio, LiteLLM with auto model discovery
- **Multi-Thread Tasks** — run N models in parallel, Consensus Mode for best answer
- **Skills Marketplace** — [browse and install skills](https://vakovalskii.github.io/LocalDesk-Skills/) for specialized tasks
- **WASM Sandbox** — secure JavaScript execution via QuickJS
- **Memory System** — persistent user preferences in `~/.localdesk/memory.md`

### Tools (40+ available)
| Category | Tools |
|----------|-------|
| **File Operations** | read, write, edit, search_files, search_text, read_document (PDF/DOCX) |
| **Shell** | run_command (PowerShell/bash with directory sandboxing) |
| **Git** | status, log, diff, branch, checkout, add, commit, push, pull, reset, show |
| **Browser Automation** | navigate, click, type, select, hover, scroll, press_key, wait_for, snapshot, screenshot, execute_script |
| **Web Search** | search_web (Tavily/DuckDuckGo), extract_page (Tavily), read_page (Z.AI) |
| **HTTP** | fetch, fetch_json, download |
| **Other** | execute_js, attach_image, manage_todos, manage_memory, load_skill, render_page |

### UI/UX
- Modern React + Electron interface with streaming
- Session management with pinning and search
- Visual todo panel with progress tracking
- Token tracking and request logging
- Permission modes: auto-execute or ask

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/vakovalskii/LocalDesk.git
cd LocalDesk
npm install

# macOS/Linux: rebuild native modules
npx electron-rebuild -f -w better-sqlite3

# Run
npm run dev
```

**Windows:** use `npm run dev:win`

### Configuration

Settings → LLM & Models → Add Provider:
- **Base URL** — API endpoint (e.g., `http://localhost:8000/v1`)
- **API Key** — your key or `dummy-key` for local models
- Models are auto-discovered from `/v1/models`

## 🛠️ Tools

All tools use `snake_case` naming (`verb_noun` pattern). Enable/disable tool groups in Settings → Tools.

<details>
<summary><b>File Operations</b></summary>

| Tool | Description |
|------|-------------|
| `read_file` | Read text file contents |
| `write_file` | Create new files |
| `edit_file` | Modify files (search & replace) |
| `search_files` | Find files by glob pattern |
| `search_text` | Search text in files (grep) |
| `read_document` | Extract text from PDF/DOCX |
</details>

<details>
<summary><b>Git Tools</b></summary>

| Tool | Description |
|------|-------------|
| `git_status` | Show working tree status |
| `git_log` | Show commit history |
| `git_diff` | Show changes |
| `git_branch` | List/create/delete branches |
| `git_checkout` | Switch branches |
| `git_add` | Stage files |
| `git_commit` | Commit changes |
| `git_push` | Push to remote |
| `git_pull` | Pull from remote |
| `git_reset` | Reset changes |
| `git_show` | Show commit details |
</details>

<details>
<summary><b>Browser Automation</b></summary>

| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to URL |
| `browser_click` | Click element |
| `browser_type` | Type text |
| `browser_select` | Select dropdown option |
| `browser_hover` | Hover over element |
| `browser_scroll` | Scroll page |
| `browser_press_key` | Press keyboard key |
| `browser_wait_for` | Wait for element/condition |
| `browser_snapshot` | Get page accessibility tree |
| `browser_screenshot` | Take screenshot |
| `browser_execute_script` | Run JavaScript |
</details>

<details>
<summary><b>Web & HTTP</b></summary>

| Tool | Description |
|------|-------------|
| `search_web` | Search internet (Tavily/DuckDuckGo) |
| `search_news` | Search news (DuckDuckGo) |
| `search_images` | Search images (DuckDuckGo) |
| `extract_page` | Extract page content (Tavily) |
| `read_page` | Read page (Z.AI Reader) |
| `render_page` | Render JS-heavy pages (Telegram, SPAs) |
| `fetch` | HTTP GET request |
| `fetch_json` | HTTP GET returning JSON |
| `download` | Download file |
</details>

## 🎯 Multi-Thread Tasks

Run the same task with multiple models in parallel:

- **Consensus Mode** — N models solve same task, auto-generates summary of best answers
- **Different Tasks** — assign different prompts to different models
- **Shared Web Cache** — avoid duplicate requests across threads

## 📦 Downloads

| Platform | Download |
|----------|----------|
| Windows | [LocalDesk-0.0.7.exe](https://github.com/vakovalskii/LocalDesk/releases/latest) (portable) / .msi (installer) |
| macOS | [LocalDesk-0.0.7-arm64.dmg](https://github.com/vakovalskii/LocalDesk/releases/latest) |
| Linux | [LocalDesk-0.0.7.AppImage](https://github.com/vakovalskii/LocalDesk/releases/latest) |

## 📄 License

**LocalDesk Community License** — free for individuals and companies under $1M/year revenue. Commercial license required for larger organizations.

See [LICENSE](LICENSE) for full terms.

---

<div align="center">

**Made with ❤️ by [Valerii Kovalskii](https://github.com/vakovalskii)**

</div>
