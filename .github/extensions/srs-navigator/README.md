# SRS Navigator Canvas Extension

An interactive force-directed graph visualization for **Problem-Based SRS** specifications, running as a Copilot CLI canvas extension.

## Features

- **Interactive D3.js graph** — Force-directed layout showing relationships between problems, needs, and requirements
- **Analysis modes** — Switch between "All", "Problem Focus" (problems + needs), and "Implementation" (needs + requirements) views
- **Search & filter** — Find nodes by ID or label text, toggle node types via the legend
- **Detail panel** — Click any node to see its full description and connections
- **Agent actions** — Load specs, validate, inspect nodes, and search programmatically

## Installation

### From this repository

Copy the `.github/extensions/srs-navigator/` folder into your own repo:

```
your-repo/
└── .github/
    └── extensions/
        └── srs-navigator/
            ├── extension.mjs
            ├── copilot-extension.json
            └── lib/
                ├── parser.mjs
                ├── validation.mjs
                ├── renderer.mjs
                └── demo-spec.mjs
```

### Via gist (share/install)

If someone has shared this extension as a gist, install it using the Copilot CLI command palette:
- **"Install extension from gist…"** → paste the gist URL

Or use the `install_extension` tool with the gist URL.

## Usage

Once installed, the canvas is available as `srs-navigator` in any Copilot CLI session.

### Opening the canvas

The agent can open it with:
```
open_canvas({ canvasId: "srs-navigator", instanceId: "my-srs" })
```

With a specification file:
```
open_canvas({ 
  canvasId: "srs-navigator", 
  instanceId: "my-srs",
  input: { filePath: "./path/to/spec.json" }
})
```

### Available actions

| Action | Description |
|--------|-------------|
| `load_specification` | Load a new spec (JSON object, file path, or markdown) |
| `validate_specification` | Validate a spec against schema and reference integrity |
| `inspect_node` | Get details about a specific node by ID |
| `get_summary` | Get node/link counts for the loaded spec |
| `search_nodes` | Search nodes by ID or label text |

### Specification format

The extension accepts specifications in the Problem-Based SRS JSON format:

```json
{
  "name": "My System",
  "description": "System description",
  "version": "1.0",
  "problems": [
    { "id": "CP-1", "title": "...", "description": "..." }
  ],
  "needs": [
    { "id": "CN-1", "title": "...", "description": "...", "problemIds": ["CP-1"] }
  ],
  "functionalRequirements": [
    { "id": "FR-1", "title": "...", "description": "...", "needIds": ["CN-1"] }
  ],
  "nonFunctionalRequirements": [
    { "id": "NFR-1", "title": "...", "description": "...", "needIds": ["CN-1"] }
  ]
}
```

## Testing

Run the test suite with Node.js built-in test runner:

```bash
cd .github/extensions/srs-navigator
node --test tests/parser.test.mjs tests/validation.test.mjs tests/renderer.test.mjs tests/integration.test.mjs
```

## Related

- [Problem-Based SRS Methodology](https://github.com/RafaelGorski/Problem-Based-SRS)
- [Problem-Based SRS Navigator](https://github.com/RafaelGorski/problem-based-srs-na)
