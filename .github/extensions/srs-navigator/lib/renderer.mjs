// HTML renderer for the SRS Navigator canvas
// Generates a self-contained HTML page with D3.js force-directed graph
// Styled to match the original Problem-Based SRS Navigator application

const NODE_COLORS = {
  problem: { fill: 'oklch(0.65 0.19 50)', stroke: 'oklch(0.55 0.19 50)', text: '#fff', label: 'Problem', fullLabel: 'Customer Problem' },
  need: { fill: 'oklch(0.60 0.15 200)', stroke: 'oklch(0.50 0.15 200)', text: '#fff', label: 'Need', fullLabel: 'Customer Need' },
  fr: { fill: 'oklch(0.55 0.18 265)', stroke: 'oklch(0.45 0.18 265)', text: '#fff', label: 'FR', fullLabel: 'Functional Requirement' },
  nfr: { fill: 'oklch(0.68 0.15 330)', stroke: 'oklch(0.58 0.15 330)', text: '#fff', label: 'NFR', fullLabel: 'Non-Functional Requirement' }
};

// SVG icons matching Phosphor icons from the original (using currentColor for dynamic coloring)
const NODE_ICONS = {
  problem: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM152,176a8,8,0,0,1-8,8H108a8,8,0,0,1-7.41-11l20-48H108a8,8,0,0,1,0-16h36a8,8,0,0,1,7.41,11l-20,48H144A8,8,0,0,1,152,176Z"/></svg>`,
  need: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 256 256" fill="currentColor"><path d="M221.87,83.16l-40-32A8,8,0,0,0,176,48H80a8,8,0,0,0-5.87,2.56l-40,32A8,8,0,0,0,32,88v80a8,8,0,0,0,2.13,5.44l40,44A8,8,0,0,0,80,220h96a8,8,0,0,0,5.87-2.56l40-44A8,8,0,0,0,224,168V88A8,8,0,0,0,221.87,83.16ZM208,165.1l-36.42,40H84.42L48,165.1V90.9l36.42-26.9h87.16L208,90.9Z"/></svg>`,
  fr: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 256 256" fill="currentColor"><path d="M69.12,94.15,28.5,128l40.62,33.85a8,8,0,1,1-10.24,12.29l-48-40a8,8,0,0,1,0-12.29l48-40a8,8,0,0,1,10.24,12.29Zm176,27.7-48-40a8,8,0,1,0-10.24,12.29L227.5,128l-40.62,33.85a8,8,0,1,0,10.24,12.29l48-40a8,8,0,0,0,0-12.29ZM162.73,32.48a8,8,0,0,0-10.25,4.79l-64,176a8,8,0,0,0,4.79,10.26A8.14,8.14,0,0,0,96,224a8,8,0,0,0,7.52-5.27l64-176A8,8,0,0,0,162.73,32.48Z"/></svg>`,
  nfr: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 256 256" fill="currentColor"><path d="M208,40H48A16,16,0,0,0,32,56v58.77c0,89.62,75.82,119.34,91,124.39a15.53,15.53,0,0,0,10,0c15.2-5.05,91-34.77,91-124.39V56A16,16,0,0,0,208,40Zm0,74.79c0,78.42-66.35,104.62-80,109.18-13.53-4.51-80-30.69-80-109.18V56H208ZM82.34,141.66a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32l-56,56a8,8,0,0,1-11.32,0Z"/></svg>`
};

/**
 * Render the full interactive HTML page for the SRS graph
 * Styled to match the original Problem-Based SRS Navigator
 */
export function renderGraphHtml(graphData, options = {}) {
  const { title = 'SRS Navigator', analysisMode = 'customer-problem', selectedNodeId = null } = options;
  const graphJSON = JSON.stringify(graphData);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
  <script src="https://d3js.org/d3.v7.min.js"><\/script>
  <style>
    :root {
      --background: oklch(0.98 0 0);
      --foreground: oklch(0.15 0.02 240);
      --card: oklch(1 0 0);
      --card-foreground: oklch(0.15 0.02 240);
      --primary: oklch(0.35 0.12 265);
      --primary-foreground: oklch(0.98 0 0);
      --secondary: oklch(0.55 0.02 240);
      --muted: oklch(0.75 0.01 240);
      --muted-foreground: oklch(0.45 0.02 240);
      --accent: oklch(0.65 0.15 200);
      --border: oklch(0.85 0.01 240);
      --node-problem: oklch(0.65 0.19 50);
      --node-need: oklch(0.60 0.15 200);
      --node-fr: oklch(0.55 0.18 265);
      --node-nfr: oklch(0.68 0.15 330);
      --radius: 0.5rem;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Space Grotesk', sans-serif;
      background: var(--background);
      color: var(--foreground);
      overflow: hidden;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .toolbar {
      border-bottom: 1px solid var(--border);
      background: var(--card);
      flex-shrink: 0;
    }
    .toolbar-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
    }
    .toolbar-row:first-child {
      justify-content: space-between;
    }
    .toolbar-row:last-child {
      padding-top: 0;
      padding-bottom: 12px;
    }
    .title-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .title-section h1 {
      font-size: 24px;
      font-weight: 700;
      color: var(--foreground);
      letter-spacing: -0.02em;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
      background: var(--secondary);
      color: var(--primary-foreground);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: transparent;
      color: var(--foreground);
      font-size: 14px;
      font-weight: 500;
      font-family: 'Space Grotesk', sans-serif;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .btn:hover { background: oklch(0.95 0.01 240); }
    .btn.active { background: var(--primary); color: var(--primary-foreground); border-color: var(--primary); }
    .btn-icon {
      width: 36px;
      height: 36px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--card);
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-icon:hover { background: oklch(0.95 0.01 240); }
    .btn-group {
      display: flex;
      align-items: center;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 4px;
      background: oklch(0.97 0 0);
      gap: 2px;
    }
    .btn-group .btn { border: none; height: 32px; }
    .btn-group .btn.active { box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .search-container {
      position: relative;
      flex: 1;
      max-width: 400px;
    }
    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--muted-foreground);
    }
    .search-input {
      width: 100%;
      padding: 8px 12px 8px 40px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      font-size: 14px;
      font-family: 'Space Grotesk', sans-serif;
      background: var(--card);
      color: var(--foreground);
      height: 40px;
    }
    .search-input:focus { outline: 2px solid var(--accent); border-color: transparent; }
    .search-input::placeholder { color: var(--muted-foreground); }
    .spec-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--card);
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      height: 40px;
      font-family: 'Space Grotesk', sans-serif;
    }
    .spec-btn:hover { background: oklch(0.95 0.01 240); }
    .analysis-section {
      display: flex;
      align-items: center;
      gap: 0;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 4px;
      background: oklch(0.97 0 0);
      height: 40px;
    }
    .analysis-section .btn { border: none; height: 32px; }
    .analysis-section .btn.active { box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .type-indicators {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: 8px;
      padding-left: 8px;
      border-left: 1px solid var(--border);
    }
    .type-indicator {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .type-dot {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .type-dot svg { width: 12px; height: 12px; }
    .type-label { font-size: 12px; font-weight: 500; }
    .graph-container {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    svg {
      width: 100%;
      height: 100%;
      background:
        radial-gradient(circle at 20% 30%, oklch(0.75 0.05 200 / 0.1) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, oklch(0.75 0.05 280 / 0.1) 0%, transparent 50%),
        linear-gradient(135deg, oklch(0.98 0 0) 0%, oklch(0.96 0.01 240) 100%);
    }
    .zoom-controls {
      position: absolute;
      top: 16px;
      left: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .node { cursor: pointer; }
    .node text.node-id {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      fill: var(--foreground);
      text-anchor: middle;
      pointer-events: none;
    }
    .node text.node-label {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 10px;
      font-weight: 500;
      fill: var(--foreground);
      text-anchor: middle;
      pointer-events: none;
    }
    .link {
      stroke: oklch(0.65 0.05 240);
      stroke-width: 2;
      stroke-opacity: 0.4;
      stroke-dasharray: 5,5;
      fill: none;
    }
    /* Detail Panel - slide from right, full height */
    .detail-panel {
      position: absolute;
      top: 0;
      right: 0;
      width: 384px;
      height: 100%;
      background: var(--card);
      border-left: 1px solid var(--border);
      box-shadow: -4px 0 24px rgba(0,0,0,0.08);
      display: none;
      flex-direction: column;
      z-index: 10;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .detail-panel.active {
      display: flex;
      transform: translateX(0);
    }
    .detail-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      border-bottom: 1px solid var(--border);
    }
    .detail-header h2 {
      font-size: 20px;
      font-weight: 700;
    }
    .detail-close {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      border: none;
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--muted-foreground);
      font-size: 20px;
    }
    .detail-close:hover { background: oklch(0.95 0.01 240); color: var(--foreground); }
    .detail-body {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }
    .detail-body .node-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
      margin-bottom: 12px;
      color: white;
    }
    .detail-body .node-id-text {
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      color: var(--muted-foreground);
      margin-bottom: 4px;
    }
    .detail-body .node-title {
      font-size: 24px;
      font-weight: 700;
      line-height: 1.3;
      margin-bottom: 16px;
    }
    .detail-body .separator {
      height: 1px;
      background: var(--border);
      margin: 16px 0;
    }
    .detail-body .section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted-foreground);
      margin-bottom: 8px;
    }
    .detail-body .description {
      font-size: 14px;
      line-height: 1.6;
      color: var(--foreground);
      white-space: pre-wrap;
    }
    .complexity-bar {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .complexity-bar .bar {
      height: 12px;
      width: 32px;
      border-radius: 4px;
    }
    .complexity-bar .bar.filled { background: var(--accent); }
    .complexity-bar .bar.empty { background: oklch(0.90 0 0); }
    .complexity-bar .level { margin-left: 8px; font-size: 14px; color: var(--muted-foreground); }
    .connections-section { margin-top: 4px; }
    .conn-direction { font-size: 12px; color: var(--muted-foreground); margin-bottom: 8px; }
    .conn-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .conn-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
    }
    .conn-badge:hover { background: oklch(0.95 0 0); }
    /* Hull polygon for selection */
    .hull-path {
      pointer-events: none;
      transition: opacity 0.4s;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-row">
      <div class="title-section">
        <h1>Problem-Based SRS</h1>
        <span class="badge" id="problem-badge"></span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="btn-group">
          <button class="btn active" id="btn-graph">
            <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor"><path d="M200,152a31.84,31.84,0,0,0-19.53,6.68l-23.11-18A31.65,31.65,0,0,0,160,128a31.28,31.28,0,0,0-1.2-8.63l21.4-11.89A32,32,0,1,0,168,88a31.28,31.28,0,0,0,1.2,8.63l-21.4,11.89A32,32,0,0,0,96,104a31.65,31.65,0,0,0,2.64,12.68L75.53,134.68A32,32,0,1,0,88,168a31.65,31.65,0,0,0-2.64-12.68l23.11-18A31.84,31.84,0,0,0,128,160a32,32,0,0,0,19.53-6.68l23.11,18A32,32,0,1,0,200,152Z"/></svg>
            Graph
          </button>
          <button class="btn" id="btn-hierarchy" disabled title="Hierarchy view (not available in canvas mode)">
            <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor"><path d="M168,120H136V88h8a16,16,0,0,0,16-16V40a16,16,0,0,0-16-16H112A16,16,0,0,0,96,40V72a16,16,0,0,0,16,16h8v32H88a24,24,0,0,0-24,24v16H56a16,16,0,0,0-16,16v32a16,16,0,0,0,16,16H88a16,16,0,0,0,16-16V176a16,16,0,0,0-16-16H80V144a8,8,0,0,1,8-8h80a8,8,0,0,1,8,8v16h-8a16,16,0,0,0-16,16v32a16,16,0,0,0,16,16h32a16,16,0,0,0,16-16V176a16,16,0,0,0-16-16h-8V144A24,24,0,0,0,168,120Z"/></svg>
            Hierarchy
          </button>
        </div>
      </div>
    </div>
    <div class="toolbar-row">
      <button class="spec-btn" id="spec-btn">
        <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor"><path d="M245,110.64A16,16,0,0,0,232,104H216V88a16,16,0,0,0-16-16H130.67L102.94,51.2a16.14,16.14,0,0,0-9.6-3.2H40A16,16,0,0,0,24,64V208h0a8,8,0,0,0,8,8H211.1a8,8,0,0,0,7.59-5.47l28.49-85.47A16.05,16.05,0,0,0,245,110.64Z"/></svg>
        <span>Specification: ${escapeHtml(title)}</span>
      </button>
      <div class="search-container">
        <svg class="search-icon" width="18" height="18" viewBox="0 0 256 256" fill="currentColor"><path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/></svg>
        <input class="search-input" type="text" placeholder="Search requirements..." id="search"/>
      </div>
      <div class="analysis-section">
        <button class="btn ${analysisMode === 'customer-problem' ? 'active' : ''}" data-mode="customer-problem">Problem Focus</button>
        <button class="btn ${analysisMode === 'implementation' ? 'active' : ''}" data-mode="implementation">Implementation</button>
        <div class="type-indicators" id="type-indicators"></div>
      </div>
    </div>
  </div>

  <div class="graph-container" id="graph-container">
    <svg id="graph-svg"></svg>
    <div class="zoom-controls">
      <button class="btn-icon" id="zoom-in" title="Zoom In">
        <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor"><path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Zm104,0a8,8,0,0,1-8,8H120v16a8,8,0,0,1-16,0V120H88a8,8,0,0,1,0-16h16V88a8,8,0,0,1,16,0v16h16A8,8,0,0,1,144,112Z"/></svg>
      </button>
      <button class="btn-icon" id="zoom-out" title="Zoom Out">
        <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor"><path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Zm104,0a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h48A8,8,0,0,1,144,112Z"/></svg>
      </button>
      <button class="btn-icon" id="zoom-reset" title="Reset Zoom">
        <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor"><path d="M216,48V96a8,8,0,0,1-8,8H160a8,8,0,0,1,0-16h28.69L163.31,62.63A80,80,0,0,0,48,128a8,8,0,0,1-16,0A96,96,0,0,1,174.63,51.37L200,76.69V48a8,8,0,0,1,16,0ZM224,120a8,8,0,0,0-8,8A80,80,0,0,1,92.69,193.37L68,168H96a8,8,0,0,0,0-16H48a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l25.37,25.32A96,96,0,0,0,232,128,8,8,0,0,0,224,120Z"/></svg>
      </button>
    </div>
    <div class="detail-panel" id="detail-panel">
      <div class="detail-header">
        <h2>Details</h2>
        <button class="detail-close" id="close-panel">&times;</button>
      </div>
      <div class="detail-body" id="panel-content"></div>
    </div>
  </div>

  <script>
  (function() {
    const graphData = ${graphJSON};
    const nodeColors = ${JSON.stringify(NODE_COLORS)};
    const nodeIcons = ${JSON.stringify(NODE_ICONS)};
    let currentMode = "${analysisMode}";
    let searchTerm = "";
    let selectedNode = ${selectedNodeId ? `"${selectedNodeId}"` : 'null'};

    // Problem badge
    const problemCount = graphData.nodes.filter(n => n.type === "problem").length;
    document.getElementById("problem-badge").textContent = problemCount + " Customer Problem" + (problemCount !== 1 ? "s" : "");

    // Type indicators
    function updateTypeIndicators() {
      const types = currentMode === "customer-problem" ? ["problem", "need"] : ["need", "fr", "nfr"];
      const container = document.getElementById("type-indicators");
      container.innerHTML = types.map(type => {
        const c = nodeColors[type];
        return '<div class="type-indicator"><div class="type-dot" style="background:' + c.fill + '">' + nodeIcons[type].replace('width="28" height="28"', 'width="12" height="12"') + '</div><span class="type-label" style="color:' + c.fill + '">' + c.label + '</span></div>';
      }).join("");
    }
    updateTypeIndicators();

    // Analysis mode buttons
    document.querySelectorAll(".analysis-section .btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".analysis-section .btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentMode = btn.dataset.mode;
        updateTypeIndicators();
        updateVisibility();
      });
    });

    // Search
    document.getElementById("search").addEventListener("input", (e) => {
      searchTerm = e.target.value.toLowerCase();
      updateVisibility();
    });

    // D3 Setup
    const container = document.getElementById("graph-container");
    const svg = d3.select("#graph-svg");
    const width = container.clientWidth;
    const height = container.clientHeight;
    const g = svg.append("g");

    // Zoom
    const zoom = d3.zoom().scaleExtent([0.1, 4]).on("zoom", (event) => {
      g.attr("transform", event.transform);
    });
    svg.call(zoom);

    // Zoom controls
    document.getElementById("zoom-in").addEventListener("click", () => {
      svg.transition().duration(300).call(zoom.scaleBy, 1.3);
    });
    document.getElementById("zoom-out").addEventListener("click", () => {
      svg.transition().duration(300).call(zoom.scaleBy, 0.7);
    });
    document.getElementById("zoom-reset").addEventListener("click", () => {
      svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    });

    // Build simulation
    const links = graphData.links.map(d => ({...d}));
    const nodes = graphData.nodes.map(d => ({...d}));

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(50));

    // Hull group (for selection highlighting)
    const hullGroup = g.append("g").attr("class", "hull-group");

    // Links (dashed like original)
    const linkElements = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("class", "link");

    // Nodes
    const nodeElements = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Background rect for selection highlight
    nodeElements.append("rect")
      .attr("x", -35).attr("y", -35)
      .attr("width", 70).attr("height", 70)
      .attr("rx", 12).attr("ry", 12)
      .attr("fill", d => nodeColors[d.type]?.fill || "#999")
      .attr("fill-opacity", 0)
      .attr("stroke", "transparent")
      .attr("stroke-width", 0);

    // Icon via foreignObject (like original)
    nodeElements.append("foreignObject")
      .attr("x", -20).attr("y", -20)
      .attr("width", 40).attr("height", 40)
      .attr("pointer-events", "none")
      .attr("style", "filter: drop-shadow(0 2px 8px oklch(0 0 0 / 0.15))")
      .html(d => '<div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;color:' + (nodeColors[d.type]?.fill || '#666') + '">' + (nodeIcons[d.type] || '') + '</div>');

    // Node ID text
    nodeElements.append("text")
      .attr("class", "node-id")
      .attr("dy", 35)
      .text(d => d.id);

    // Node label text (with word wrap)
    nodeElements.each(function(d) {
      const group = d3.select(this);
      const words = d.label.split(/\\s+/);
      const maxWidth = 120;
      const lineHeight = 1.1;
      const lines = [];
      let line = [];

      // Simple word wrap estimation (10px font, ~6px per char)
      for (const word of words) {
        line.push(word);
        if (line.join(" ").length * 6 > maxWidth && line.length > 1) {
          line.pop();
          lines.push(line.join(" "));
          line = [word];
        }
      }
      if (line.length > 0) lines.push(line.join(" "));

      const text = group.append("text")
        .attr("class", "node-label")
        .attr("y", 48);

      lines.forEach((lineText, i) => {
        text.append("tspan")
          .attr("x", 0)
          .attr("dy", i === 0 ? "0em" : lineHeight + "em")
          .text(lineText);
      });
    });

    nodeElements.on("click", (event, d) => {
      event.stopPropagation();
      selectedNode = d.id;
      showDetail(d);
      updateVisibility();
    });

    svg.on("click", () => {
      selectedNode = null;
      hideDetail();
      updateVisibility();
    });

    // Detail panel
    const panel = document.getElementById("detail-panel");
    document.getElementById("close-panel").addEventListener("click", () => {
      selectedNode = null;
      hideDetail();
      updateVisibility();
    });

    function showDetail(node) {
      panel.classList.add("active");
      const colors = nodeColors[node.type];
      const upstream = [];
      const downstream = [];
      for (const link of links) {
        const src = typeof link.source === "object" ? link.source.id : link.source;
        const tgt = typeof link.target === "object" ? link.target.id : link.target;
        if (tgt === node.id) upstream.push(src);
        if (src === node.id) downstream.push(tgt);
      }

      let html = '<span class="node-badge" style="background:' + colors.fill + '">' + colors.fullLabel + '</span>';
      html += '<div class="node-id-text">' + node.id + '</div>';
      html += '<h3 class="node-title">' + escapeHtml(node.label) + '</h3>';
      html += '<div class="separator"></div>';
      html += '<div class="section-title">Description</div>';
      html += '<p class="description">' + escapeHtml(node.data?.description || '') + '</p>';

      if (node.complexity) {
        html += '<div class="separator"></div>';
        html += '<div class="section-title">Complexity</div>';
        html += '<div class="complexity-bar">';
        for (let i = 1; i <= 5; i++) {
          html += '<div class="bar ' + (i <= node.complexity ? 'filled' : 'empty') + '"></div>';
        }
        html += '<span class="level">' + node.complexity + '/5</span></div>';
      }

      if (upstream.length > 0 || downstream.length > 0) {
        html += '<div class="separator"></div>';
        html += '<div class="section-title">Dependencies</div>';
        html += '<div class="connections-section">';
        if (upstream.length > 0) {
          html += '<div class="conn-direction">Upstream</div><div class="conn-badges">';
          for (const id of upstream) {
            const n = nodes.find(x => x.id === id);
            const c = n ? nodeColors[n.type] : nodeColors.need;
            html += '<span class="conn-badge" data-id="' + id + '" style="border-color:' + c.fill + ';color:' + c.fill + '">' + id + '</span>';
          }
          html += '</div>';
        }
        if (downstream.length > 0) {
          html += '<div class="conn-direction">Downstream</div><div class="conn-badges">';
          for (const id of downstream) {
            const n = nodes.find(x => x.id === id);
            const c = n ? nodeColors[n.type] : nodeColors.need;
            html += '<span class="conn-badge" data-id="' + id + '" style="border-color:' + c.fill + ';color:' + c.fill + '">' + id + '</span>';
          }
          html += '</div>';
        }
        html += '</div>';
      }

      document.getElementById("panel-content").innerHTML = html;
      document.querySelectorAll(".conn-badge").forEach(el => {
        el.addEventListener("click", () => {
          const target = nodes.find(n => n.id === el.dataset.id);
          if (target) { selectedNode = target.id; showDetail(target); updateVisibility(); }
        });
      });
    }

    function hideDetail() { panel.classList.remove("active"); }

    function getVisibleTypes() {
      if (currentMode === "customer-problem") return new Set(["problem", "need"]);
      if (currentMode === "implementation") return new Set(["need", "fr", "nfr"]);
      return new Set(["problem", "need", "fr", "nfr"]);
    }

    function updateVisibility() {
      const visibleTypes = getVisibleTypes();
      const downstreamIds = new Set();
      const downstreamLinkPairs = new Set();

      if (selectedNode) {
        downstreamIds.add(selectedNode);
        const findDownstream = (nodeId) => {
          for (const link of links) {
            const src = typeof link.source === "object" ? link.source.id : link.source;
            const tgt = typeof link.target === "object" ? link.target.id : link.target;
            if (src === nodeId && !downstreamIds.has(tgt)) {
              downstreamIds.add(tgt);
              downstreamLinkPairs.add(src + "->" + tgt);
              findDownstream(tgt);
            }
          }
        };
        findDownstream(selectedNode);
      }

      // Hull polygon
      hullGroup.selectAll("*").remove();
      if (selectedNode && downstreamIds.size > 1) {
        const hullPoints = [];
        downstreamIds.forEach(id => {
          const node = nodes.find(n => n.id === id);
          if (node && node.x != null && node.y != null) {
            const pad = 60;
            hullPoints.push([node.x - pad, node.y - pad]);
            hullPoints.push([node.x + pad, node.y - pad]);
            hullPoints.push([node.x - pad, node.y + pad]);
            hullPoints.push([node.x + pad, node.y + pad]);
          }
        });
        if (hullPoints.length >= 6) {
          const hull = d3.polygonHull(hullPoints);
          if (hull) {
            const line = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5));
            hullGroup.append("path")
              .attr("d", line(hull))
              .attr("fill", "oklch(0.65 0.15 200 / 0.08)")
              .attr("stroke", "oklch(0.65 0.15 200 / 0.3)")
              .attr("stroke-width", 2)
              .attr("stroke-dasharray", "8,4")
              .attr("class", "hull-path")
              .style("filter", "drop-shadow(0 4px 16px oklch(0.65 0.15 200 / 0.2))")
              .attr("opacity", 0)
              .transition().duration(400).attr("opacity", 1);
          }
        }
      }

      let firstMatch = null;

      nodeElements.each(function(d) {
        const el = d3.select(this);
        const isFiltered = !visibleTypes.has(d.type);
        const matchesSearch = !searchTerm || d.id.toLowerCase().includes(searchTerm) || d.label.toLowerCase().includes(searchTerm);
        const isSelected = d.id === selectedNode;
        const isDownstream = downstreamIds.has(d.id);
        const shouldDim = (isFiltered && !isDownstream) || (searchTerm && !matchesSearch);

        if (!shouldDim && searchTerm && matchesSearch && !firstMatch) firstMatch = d;

        el.select("rect")
          .transition().duration(250)
          .attr("fill-opacity", isDownstream && !isSelected ? 0.05 : 0)
          .attr("stroke", isDownstream && !isSelected ? "oklch(0.65 0.15 200)" : "transparent")
          .attr("stroke-width", isDownstream && !isSelected ? 2 : 0);

        el.select("foreignObject")
          .transition().duration(250)
          .attr("opacity", shouldDim ? 0.2 : 1)
          .attr("style", isSelected
            ? "filter: drop-shadow(0 0 12px oklch(0.65 0.15 200)) drop-shadow(0 2px 8px oklch(0 0 0 / 0.15))"
            : isDownstream
            ? "filter: drop-shadow(0 0 8px oklch(0.65 0.15 200 / 0.5)) drop-shadow(0 2px 8px oklch(0 0 0 / 0.15))"
            : "filter: drop-shadow(0 2px 8px oklch(0 0 0 / 0.15))");

        el.selectAll("text")
          .transition().duration(250)
          .attr("opacity", shouldDim ? 0.2 : 1);
      });

      linkElements.each(function(d) {
        const src = typeof d.source === "object" ? d.source.id : d.source;
        const tgt = typeof d.target === "object" ? d.target.id : d.target;
        const srcVisible = visibleTypes.has(nodes.find(n => n.id === src)?.type);
        const tgtVisible = visibleTypes.has(nodes.find(n => n.id === tgt)?.type);
        const linkKey = src + "->" + tgt;
        const isDownstream = downstreamLinkPairs.has(linkKey);
        const bothVisible = srcVisible && tgtVisible;

        d3.select(this)
          .transition().duration(250)
          .attr("stroke-opacity", isDownstream ? 0.9 : (bothVisible ? 0.4 : 0.1))
          .attr("stroke", isDownstream ? "oklch(0.65 0.15 200)" : "oklch(0.65 0.05 240)")
          .attr("stroke-width", isDownstream ? 3 : 2)
          .style("display", bothVisible || isDownstream ? null : "none");
      });

      // Auto-zoom to first match
      if (firstMatch && searchTerm) {
        const scale = 1.2;
        const x = firstMatch.x || width / 2;
        const y = firstMatch.y || height / 2;
        const transform = d3.zoomIdentity.translate(width/2, height/2).scale(scale).translate(-x, -y);
        svg.transition().duration(750).call(zoom.transform, transform);
      }
    }

    // Simulation tick
    simulation.on("tick", () => {
      linkElements
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
      nodeElements.attr("transform", d => "translate(" + d.x + "," + d.y + ")");
    });

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    }
    function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null; d.fy = null;
    }

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // Initial visibility
    updateVisibility();

    // Handle resize
    window.addEventListener("resize", () => {
      simulation.force("center", d3.forceCenter(container.clientWidth / 2, container.clientHeight / 2));
      simulation.alpha(0.3).restart();
    });

    // Public API
    window.srsNavigator = {
      getState: () => ({ selectedNode, currentMode, searchTerm }),
      selectNode: (id) => {
        const node = nodes.find(n => n.id === id);
        if (node) { selectedNode = id; showDetail(node); updateVisibility(); }
      },
      setMode: (mode) => {
        currentMode = mode;
        document.querySelectorAll(".analysis-section .btn").forEach(b => {
          b.classList.toggle("active", b.dataset.mode === mode);
        });
        updateTypeIndicators();
        updateVisibility();
      }
    };
  })();
  <\/script>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
