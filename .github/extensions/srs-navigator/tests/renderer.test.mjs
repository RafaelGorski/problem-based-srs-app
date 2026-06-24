// Unit tests for the HTML renderer
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderGraphHtml } from "../lib/renderer.mjs";

describe("renderGraphHtml", () => {
  const sampleGraph = {
    nodes: [
      { id: "CP-1", type: "problem", label: "Test Problem", data: { description: "Desc" }, complexity: 1 },
      { id: "CN-1", type: "need", label: "Test Need", data: { description: "Need desc" }, complexity: 2 }
    ],
    links: [
      { source: "CP-1", target: "CN-1", type: "addresses" }
    ]
  };

  it("returns valid HTML string", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.startsWith("<!DOCTYPE html>"));
    assert.ok(html.includes("</html>"));
  });

  it("includes D3.js script", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.includes("d3.v7.min.js"));
  });

  it("includes the graph data as JSON", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.includes('"CP-1"'));
    assert.ok(html.includes('"CN-1"'));
    assert.ok(html.includes('"addresses"'));
  });

  it("uses the provided title in spec button", () => {
    const html = renderGraphHtml(sampleGraph, { title: "My Custom Title" });
    assert.ok(html.includes("Specification: My Custom Title"));
  });

  it("defaults title to SRS Navigator", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.includes("Specification: SRS Navigator"));
  });

  it("includes analysis mode buttons", () => {
    const html = renderGraphHtml(sampleGraph, { analysisMode: "customer-problem" });
    assert.ok(html.includes("Problem Focus"));
    assert.ok(html.includes("Implementation"));
    assert.ok(html.includes('data-mode="customer-problem"'));
  });

  it("marks the selected analysis mode as active", () => {
    const html = renderGraphHtml(sampleGraph, { analysisMode: "implementation" });
    assert.ok(html.includes('data-mode="implementation">Implementation</button>'));
    // The implementation button should have "active" class
    assert.ok(html.includes('class="btn active" data-mode="implementation"'));
  });

  it("includes search input with placeholder", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.includes('id="search"'));
    assert.ok(html.includes('placeholder="Search requirements..."'));
  });

  it("includes detail panel structure", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.includes('id="detail-panel"'));
    assert.ok(html.includes('id="panel-content"'));
    assert.ok(html.includes("detail-header"));
  });

  it("escapes HTML in title", () => {
    const html = renderGraphHtml(sampleGraph, { title: "<script>alert('xss')</script>" });
    assert.ok(!html.includes("<script>alert('xss')</script>"));
    assert.ok(html.includes("&lt;script&gt;"));
  });

  it("handles empty graph data", () => {
    const html = renderGraphHtml({ nodes: [], links: [] });
    assert.ok(html.startsWith("<!DOCTYPE html>"));
  });

  it("includes oklch node color configuration", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.includes("oklch(0.65 0.19 50)")); // problem color
    assert.ok(html.includes("oklch(0.60 0.15 200)")); // need color
    assert.ok(html.includes("oklch(0.55 0.18 265)")); // fr color
  });

  it("includes CSS custom properties for theming", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.includes("--background"));
    assert.ok(html.includes("--foreground"));
    assert.ok(html.includes("--node-problem"));
    assert.ok(html.includes("--border"));
  });

  it("includes window.srsNavigator API", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.includes("window.srsNavigator"));
    assert.ok(html.includes("getState"));
    assert.ok(html.includes("selectNode"));
    assert.ok(html.includes("setMode"));
  });

  it("includes zoom controls", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.includes('id="zoom-in"'));
    assert.ok(html.includes('id="zoom-out"'));
    assert.ok(html.includes('id="zoom-reset"'));
  });

  it("includes Problem-Based SRS title and badge", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.includes("Problem-Based SRS"));
    assert.ok(html.includes('id="problem-badge"'));
  });

  it("includes Space Grotesk and JetBrains Mono fonts", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.includes("Space+Grotesk"));
    assert.ok(html.includes("JetBrains+Mono"));
  });

  it("includes gradient SVG background", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.includes("radial-gradient"));
    assert.ok(html.includes("linear-gradient"));
  });

  it("uses dashed stroke for links", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.includes("stroke-dasharray: 5,5"));
  });

  it("includes hull polygon for selection", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.includes("hull-group"));
    assert.ok(html.includes("polygonHull"));
  });
});
