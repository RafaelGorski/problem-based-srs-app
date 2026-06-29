# Copilot Instructions — Problem-Based SRS Navigator

A GitHub Copilot **canvas extension** that renders Problem-Based SRS specs as an
interactive D3 graph and bundles the 9 methodology skills as agent tools. There is
no traditional backend — the extension forks `extension.mjs`, which serves a
self-contained HTML graph from a loopback HTTP server per canvas instance.

## Layout
- `extension.mjs` — entry point: skill tools, canvas, actions, one shared `createCanvasServer` route table, `session.idle` refresh hook.
- `lib/parser.mjs` — markdown/JSON → spec → graph data.
- `lib/validation.mjs` — schema + reference-integrity checks.
- `lib/renderer.mjs` — self-contained HTML (D3 + inline CSS/JS). Pure: `renderGraphHtml(graphData, opts)`.
- `lib/decompose.mjs` — deterministic, model-free node decomposition.
- `lib/text-refs.mjs` — shared `extractRefs(content, pattern)` for parser + compiler.
- `lib/http-guard.mjs` — `isTrustedLoopbackRequest` CSRF/DNS-rebinding guard for `/api/*`.
- `lib/spec-compiler.mjs` — compile `.spec/*.md` → JSON. `lib/demo-spec.mjs` — demo data.
- `tests/*.test.mjs` — `node --test` unit suites; `visual.test.mjs` — Playwright e2e.

## Working directives
- **TDD.** Write/extend a `tests/*.test.mjs` first, watch it fail, then implement. Keep `lib/*` pure and import-testable (no SDK).
- **No duplication.** Both the landing overlay and graph view share one `createCanvasServer`; both prompts use `LEARN_PROMPT`/`LOAD_PROMPT`/`buildActionPrompt`. Add routes/prompts there once — never fork the server.
- **No dead code.** Remove unused functions; don't leave commented-out blocks.
- **Prefer local over the model.** Slow model round-trips hurt iteration. Do deterministic work (decompose, compile, validate) in `lib/` and expose a fast `/api/*` route, falling back to a skill prompt only when reasoning is required.
- **Security.** Always escape spec content embedded in `<script>` (`< > → \u003c \u003e`); escape any spec text rendered as HTML via `escapeHtml`, including node IDs. Server stays bound to `127.0.0.1`, and every `/api/*` request must pass `isTrustedLoopbackRequest` (Host + Origin/Referer check). Honor parser size limits.

## Verify before commit
```
cd .github/extensions/srs-navigator
node --check extension.mjs
node --test tests/parser.test.mjs tests/validation.test.mjs tests/renderer.test.mjs tests/action-bar.test.mjs tests/integration.test.mjs tests/decompose.test.mjs tests/text-refs.test.mjs tests/http-guard.test.mjs
```
All unit tests must pass. For UI changes, run Playwright (`visual.test.mjs`) against a live graph server. Don't add new build/lint tooling.
