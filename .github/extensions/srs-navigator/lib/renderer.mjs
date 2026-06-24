// HTML renderer for the SRS Navigator canvas
// Generates a self-contained HTML page with D3.js force-directed graph

const NODE_COLORS = {
  problem: { fill: '#e67e22', stroke: '#d35400', text: '#fff' },
  need: { fill: '#2980b9', stroke: '#1a5276', text: '#fff' },
  fr: { fill: '#8e44ad', stroke: '#6c3483', text: '#fff' },
  nfr: { fill: '#e84393', stroke: '#c0392b', text: '#fff' }
};

const NODE_LABELS = {
  problem: 'Customer Problem',
  need: 'Customer Need',
  fr: 'Functional Requirement',
  nfr: 'Non-Functional Requirement'
};

/**
 * Render the full interactive HTML page for the SRS graph
 */
export function renderGraphHtml(graphData, options = {}) {
  const { title = 'SRS Navigator', analysisMode = 'all', selectedNodeId = null } = options;
  const graphJSON = JSON.stringify(graphData);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(title)}</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
      font-size: var(--text-body-medium, 14px);
      line-height: var(--leading-body-medium, 20px);
      background: var(--background-color-default, #0d1117);
      color: var(--text-color-default, #e6edf3);
      overflow: hidden;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      background: var(--background-color-default, #161b22);
      border-bottom: 1px solid var(--border-color-default, #30363d);
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .toolbar h1 {
      font-size: 16px;
      font-weight: var(--font-weight-semibold, 600);
      white-space: nowrap;
    }
    .toolbar .stats {
      font-size: 12px;
      color: var(--text-color-muted, #8b949e);
    }
    .search-box {
      margin-left: auto;
      padding: 4px 10px;
      border: 1px solid var(--border-color-default, #30363d);
      border-radius: 6px;
      background: var(--background-color-default, #0d1117);
      color: var(--text-color-default, #e6edf3);
      font-size: 13px;
      width: 200px;
    }
    .search-box:focus { outline: 2px solid var(--color-focus-outline, #1f6feb); border-color: transparent; }
    .legend {
      display: flex;
      gap: 12px;
      padding: 6px 16px;
      background: var(--background-color-default, #161b22);
      border-bottom: 1px solid var(--border-color-default, #30363d);
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      cursor: pointer;
      opacity: 1;
      transition: opacity 0.2s;
      user-select: none;
    }
    .legend-item.hidden { opacity: 0.35; }
    .legend-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    .graph-container {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    svg { width: 100%; height: 100%; }
    .node { cursor: pointer; }
    .node circle { transition: stroke-width 0.2s, r 0.2s; }
    .node:hover circle { stroke-width: 3px; }
    .node text {
      font-size: 10px;
      fill: var(--text-color-default, #e6edf3);
      pointer-events: none;
      text-anchor: middle;
    }
    .link { stroke-opacity: 0.4; fill: none; }
    .link.addresses { stroke: #e67e22; }
    .link.implements { stroke: #8e44ad; }
    .detail-panel {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 320px;
      max-height: calc(100% - 16px);
      overflow-y: auto;
      background: var(--background-color-default, #161b22);
      border: 1px solid var(--border-color-default, #30363d);
      border-radius: 8px;
      padding: 16px;
      display: none;
      z-index: 10;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .detail-panel.active { display: block; }
    .detail-panel h2 { font-size: 14px; margin-bottom: 4px; }
    .detail-panel .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .detail-panel .desc {
      font-size: 13px;
      color: var(--text-color-muted, #8b949e);
      line-height: 1.5;
      margin-top: 8px;
    }
    .detail-panel .connections {
      margin-top: 12px;
      font-size: 12px;
    }
    .detail-panel .connections h3 { font-size: 12px; margin-bottom: 4px; color: var(--text-color-muted, #8b949e); }
    .detail-panel .conn-item {
      padding: 4px 8px;
      margin: 2px 0;
      border-radius: 4px;
      background: rgba(255,255,255,0.05);
      cursor: pointer;
    }
    .detail-panel .conn-item:hover { background: rgba(255,255,255,0.1); }
    .close-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      background: none;
      border: none;
      color: var(--text-color-muted, #8b949e);
      cursor: pointer;
      font-size: 18px;
    }
    .highlighted circle { filter: drop-shadow(0 0 6px rgba(255,255,255,0.5)); }
    .dimmed { opacity: 0.15; }
    .mode-btns { display: flex; gap: 4px; }
    .mode-btn {
      padding: 3px 10px;
      border: 1px solid var(--border-color-default, #30363d);
      border-radius: 4px;
      background: transparent;
      color: var(--text-color-default, #e6edf3);
      font-size: 12px;
      cursor: pointer;
    }
    .mode-btn.active { background: var(--color-focus-outline, #1f6feb); border-color: transparent; }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>${escapeHtml(title)}</h1>
    <span class="stats" id="stats"></span>
    <div class="mode-btns">
      <button class="mode-btn ${analysisMode === 'all' ? 'active' : ''}" data-mode="all">All</button>
      <button class="mode-btn ${analysisMode === 'customer-problem' ? 'active' : ''}" data-mode="customer-problem">Problem Focus</button>
      <button class="mode-btn ${analysisMode === 'implementation' ? 'active' : ''}" data-mode="implementation">Implementation</button>
    </div>
    <input class="search-box" type="text" placeholder="Search nodes..." id="search"/>
  </div>
  <div class="legend" id="legend"></div>
  <div class="graph-container" id="graph-container">
    <svg id="graph-svg"></svg>
    <div class="detail-panel" id="detail-panel">
      <button class="close-btn" id="close-panel">&times;</button>
      <div id="panel-content"></div>
    </div>
  </div>

  <script>
  (function() {
    const graphData = ${graphJSON};
    const nodeColors = ${JSON.stringify(NODE_COLORS)};
    const nodeLabels = ${JSON.stringify(NODE_LABELS)};
    let currentMode = "${analysisMode}";
    let hiddenTypes = new Set();
    let searchTerm = "";
    let selectedNode = ${selectedNodeId ? `"${selectedNodeId}"` : 'null'};

    // Stats
    const stats = document.getElementById("stats");
    stats.textContent = graphData.nodes.length + " nodes, " + graphData.links.length + " links";

    // Legend
    const legend = document.getElementById("legend");
    for (const [type, label] of Object.entries(nodeLabels)) {
      const count = graphData.nodes.filter(n => n.type === type).length;
      if (count === 0) continue;
      const item = document.createElement("div");
      item.className = "legend-item";
      item.dataset.type = type;
      item.innerHTML = '<span class="legend-dot" style="background:' + nodeColors[type].fill + '"></span>' + label + ' (' + count + ')';
      item.addEventListener("click", () => {
        if (hiddenTypes.has(type)) hiddenTypes.delete(type); else hiddenTypes.add(type);
        item.classList.toggle("hidden");
        updateVisibility();
      });
      legend.appendChild(item);
    }

    // Mode buttons
    document.querySelectorAll(".mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentMode = btn.dataset.mode;
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

    // Build simulation
    const links = graphData.links.map(d => ({...d}));
    const nodes = graphData.nodes.map(d => ({...d}));

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));

    // Links
    const linkElements = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("class", d => "link " + d.type)
      .attr("stroke-width", 1.5);

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

    nodeElements.append("circle")
      .attr("r", d => 8 + (d.complexity || 1) * 2)
      .attr("fill", d => nodeColors[d.type]?.fill || "#999")
      .attr("stroke", d => nodeColors[d.type]?.stroke || "#666")
      .attr("stroke-width", 2);

    nodeElements.append("text")
      .attr("dy", d => (8 + (d.complexity || 1) * 2) + 14)
      .text(d => d.id);

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
      const connected = getConnections(node);
      let html = '<span class="badge" style="background:' + colors.fill + ';color:' + colors.text + '">' + node.id + ' &middot; ' + nodeLabels[node.type] + '</span>';
      html += '<h2>' + escapeHtml(node.label) + '</h2>';
      html += '<p class="desc">' + escapeHtml(node.data?.description || '') + '</p>';
      if (connected.length > 0) {
        html += '<div class="connections"><h3>Connected (' + connected.length + ')</h3>';
        for (const c of connected) {
          html += '<div class="conn-item" data-id="' + c.id + '">' + c.id + ': ' + escapeHtml(c.label) + '</div>';
        }
        html += '</div>';
      }
      document.getElementById("panel-content").innerHTML = html;
      document.querySelectorAll(".conn-item").forEach(el => {
        el.addEventListener("click", () => {
          const target = nodes.find(n => n.id === el.dataset.id);
          if (target) { selectedNode = target.id; showDetail(target); updateVisibility(); }
        });
      });
    }

    function hideDetail() { panel.classList.remove("active"); }

    function getConnections(node) {
      const connected = new Set();
      for (const link of links) {
        const src = typeof link.source === 'object' ? link.source.id : link.source;
        const tgt = typeof link.target === 'object' ? link.target.id : link.target;
        if (src === node.id) connected.add(tgt);
        if (tgt === node.id) connected.add(src);
      }
      return nodes.filter(n => connected.has(n.id));
    }

    function getVisibleTypes() {
      if (currentMode === "customer-problem") return new Set(["problem", "need"]);
      if (currentMode === "implementation") return new Set(["need", "fr", "nfr"]);
      return new Set(["problem", "need", "fr", "nfr"]);
    }

    function updateVisibility() {
      const visibleTypes = getVisibleTypes();
      const connectedIds = new Set();
      if (selectedNode) {
        connectedIds.add(selectedNode);
        for (const link of links) {
          const src = typeof link.source === 'object' ? link.source.id : link.source;
          const tgt = typeof link.target === 'object' ? link.target.id : link.target;
          if (src === selectedNode) connectedIds.add(tgt);
          if (tgt === selectedNode) connectedIds.add(src);
        }
      }

      nodeElements.each(function(d) {
        const el = d3.select(this);
        const typeVisible = visibleTypes.has(d.type) && !hiddenTypes.has(d.type);
        const matchesSearch = !searchTerm || d.id.toLowerCase().includes(searchTerm) || d.label.toLowerCase().includes(searchTerm);
        const isConnected = !selectedNode || connectedIds.has(d.id);
        
        el.style("display", typeVisible ? null : "none");
        el.classed("highlighted", matchesSearch && searchTerm.length > 0);
        el.classed("dimmed", selectedNode && !isConnected);
      });

      linkElements.each(function(d) {
        const el = d3.select(this);
        const src = typeof d.source === 'object' ? d.source : nodes.find(n => n.id === d.source);
        const tgt = typeof d.target === 'object' ? d.target : nodes.find(n => n.id === d.target);
        const srcVisible = src && visibleTypes.has(src.type) && !hiddenTypes.has(src.type);
        const tgtVisible = tgt && visibleTypes.has(tgt.type) && !hiddenTypes.has(tgt.type);
        const isConnected = !selectedNode || (connectedIds.has(src?.id) && connectedIds.has(tgt?.id));
        
        el.style("display", srcVisible && tgtVisible ? null : "none");
        el.classed("dimmed", selectedNode && !isConnected);
      });
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

    // Notify parent of state changes via custom events
    window.srsNavigator = {
      getState: () => ({ selectedNode, currentMode, searchTerm, hiddenTypes: [...hiddenTypes] }),
      selectNode: (id) => {
        const node = nodes.find(n => n.id === id);
        if (node) { selectedNode = id; showDetail(node); updateVisibility(); }
      },
      setMode: (mode) => {
        currentMode = mode;
        document.querySelectorAll(".mode-btn").forEach(b => {
          b.classList.toggle("active", b.dataset.mode === mode);
        });
        updateVisibility();
      }
    };
  })();
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
