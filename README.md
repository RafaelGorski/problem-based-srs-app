# Problem-Based SRS Navigator — Canvas Extension

An interactive force-directed graph visualization for **Problem-Based SRS** specifications, packaged as a [GitHub Copilot](https://github.com/features/copilot) canvas extension.

![SRS Navigator Screenshot](.github/extensions/srs-navigator/docs/screenshot.png)

## What is this?

This repository contains a **GitHub Copilot canvas extension** that renders Problem-Based SRS (Software Requirements Specification) documents as an interactive, navigable graph. It visualizes the relationships between:

- **Customer Problems (CP)** — pain points driving the system
- **Customer Needs (CN)** — what users need to solve those problems
- **Functional Requirements (FR)** — what the system must do
- **Non-Functional Requirements (NFR)** — quality attributes the system must satisfy

Engineers can explore traceability (problem → need → requirement), filter by analysis mode, search nodes, and inspect detailed dependencies — all inside the Copilot side panel without leaving their editor.

## Architecture

```
.spec/                                 # Auto-discovered spec files
│   └── crm-system.json               # Default demo spec (JSON)
.github/extensions/srs-navigator/
├── extension.mjs              # Entry point — canvas + 5 agent actions
├── copilot-extension.json     # Manifest for gist sharing
├── README.md                  # Extension-specific docs
├── docs/
│   └── screenshot.png         # UI screenshot
├── lib/
│   ├── parser.mjs             # Markdown/JSON spec parsing + graph builder
│   ├── validation.mjs         # Schema + reference integrity validation
│   ├── renderer.mjs           # Self-contained HTML renderer (D3.js + CSS)
│   └── demo-spec.mjs          # Built-in CRM System demo data
└── tests/
    ├── parser.test.mjs        # 16 tests
    ├── validation.test.mjs    # 19 tests
    ├── renderer.test.mjs      # 20 tests
    └── integration.test.mjs   # 13 tests (68 total)
```

### How it works

1. **Extension loads** — The CLI discovers `extension.mjs` in `.github/extensions/srs-navigator/` and forks it as a child process speaking JSON-RPC over stdio.
2. **Canvas opens** — When the agent (or user) calls `open_canvas`, the extension parses the spec, builds graph data, renders a self-contained HTML page, and serves it on a loopback HTTP server (`127.0.0.1:<ephemeral-port>`).
3. **Agent actions** — The agent can invoke `load_specification`, `validate_specification`, `inspect_node`, `get_summary`, and `search_nodes` to interact with the loaded spec programmatically.
4. **Interactive UI** — The HTML page uses D3.js for a force-directed layout with zoom, search, analysis mode filtering, node selection with hull highlighting, and a detail panel.

### Key design decisions

| Decision | Rationale |
|----------|-----------|
| Single `extension.mjs` entry (ES modules only) | Required by the Copilot CLI extension runtime |
| No `package.json` or `node_modules` | `@github/copilot-sdk` is auto-resolved by the CLI |
| Self-contained HTML (inline CSS + JS + CDN D3) | Canvas iframe has no access to local files |
| Loopback HTTP server per instance | Host only embeds `127.0.0.1` URLs |
| OKLCH color system | Perceptually uniform, matches the original app |
| Node.js built-in test runner | Zero dependencies for testing |

## Installation in GitHub Copilot App

### Option 1: Install from this repository (Recommended)

Use the `install_extension` tool or command palette to install directly from this repo:

```
install_extension({
  url: "https://github.com/RafaelGorski/problem-based-srs-app/tree/main/.github/extensions/srs-navigator",
  scope: "user"
})
```

Or via the **Command Palette** (Ctrl+Shift+P / Cmd+Shift+P):
1. Search **"Install extension from gist…"**
2. Paste the gist URL (if shared as a gist)

### Option 2: Clone into your project

Copy `.github/extensions/srs-navigator/` into your repo's `.github/extensions/` directory:

```bash
# From your project root
mkdir -p .github/extensions
cp -r <this-repo>/.github/extensions/srs-navigator .github/extensions/
```

Once committed, the extension is available to everyone on the repo.

### Option 3: Install as a user extension

Copy to your personal extensions directory:

```bash
cp -r .github/extensions/srs-navigator ~/.copilot/extensions/
```

This makes it available across all your projects.

### Verify installation

1. Open a Copilot session
2. The agent should list `srs-navigator` in available canvases
3. Ask: *"Open the SRS Navigator"*
4. The canvas panel appears with the demo CRM System spec

If it doesn't appear:
```
extensions_manage({ operation: "list" })       # Is it loaded?
extensions_manage({ operation: "inspect", name: "srs-navigator" })  # Check logs
```

## Usage

### Auto-discovery via `.spec/` folder

Place your SRS specification JSON files in a `.spec/` folder at the repository root:

```
your-project/
├── .spec/
│   └── my-system.json    ← Auto-loaded on canvas open
├── src/
└── ...
```

When the canvas opens without explicit input, it scans `.spec/*.json` and loads the first valid spec found. If no `.spec/` folder exists (or contains no valid specs), the built-in **demo** data loads instead with a "DEMO" badge.

### Open the canvas

Ask the Copilot agent naturally:

```
Open the SRS Navigator to visualize my specification
```

Or with a specific file:

```
Open the SRS Navigator with my spec at ./docs/srs.json
```

### Load your own specification

Provide a Problem-Based SRS JSON file:

```json
{
  "name": "My System",
  "version": "1.0",
  "problems": [{ "id": "CP-1", "title": "..." }],
  "needs": [{ "id": "CN-1", "title": "...", "problemIds": ["CP-1"] }],
  "functionalRequirements": [{ "id": "FR-1", "title": "...", "needIds": ["CN-1"] }],
  "nonFunctionalRequirements": [{ "id": "NFR-1", "title": "...", "needIds": ["CN-1"] }]
}
```

### Agent actions

| Action | Description |
|--------|-------------|
| `load_specification` | Load a spec (JSON, file path, or markdown) |
| `validate_specification` | Validate schema + reference integrity |
| `inspect_node` | Get full details for a node by ID |
| `get_summary` | Node/link counts for the loaded spec |
| `search_nodes` | Search by ID or label text |

## Development

### Run tests

```bash
cd .github/extensions/srs-navigator
node --test tests/parser.test.mjs tests/validation.test.mjs tests/renderer.test.mjs tests/integration.test.mjs
```

All **68 tests** should pass (parser: 16, validation: 19, renderer: 20, integration: 13).

### Iterate on the extension

1. Edit files in `.github/extensions/srs-navigator/`
2. Call `extensions_reload` in Copilot to restart the extension
3. Reopen the canvas to see changes

### Share as a gist

From the Command Palette: **"Share extension as gist…"** → select `srs-navigator`

Or via the agent:
```
Share the srs-navigator extension as a gist
```

## Requirements

- **GitHub Copilot** app (desktop) or Copilot CLI v1.0+
- **Node.js** v18+ (provided by the Copilot runtime)
- No additional dependencies

## Related

- [Problem-Based SRS Methodology](https://github.com/RafaelGorski/Problem-Based-SRS)
- [Problem-Based SRS Navigator (original web app)](https://github.com/RafaelGorski/problem-based-srs-na)

## License

See repository license.
