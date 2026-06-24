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

  it("uses the provided title", () => {
    const html = renderGraphHtml(sampleGraph, { title: "My Custom Title" });
    assert.ok(html.includes("My Custom Title"));
  });

  it("defaults title to SRS Navigator", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.includes("SRS Navigator"));
  });

  it("includes analysis mode buttons", () => {
    const html = renderGraphHtml(sampleGraph, { analysisMode: "customer-problem" });
    assert.ok(html.includes("Problem Focus"));
    assert.ok(html.includes("Implementation"));
    assert.ok(html.includes('data-mode="customer-problem"'));
  });

  it("marks the selected analysis mode as active", () => {
    const html = renderGraphHtml(sampleGraph, { analysisMode: "implementation" });
    // The implementation button should have "active" class
    assert.ok(html.includes('data-mode="implementation" class="mode-btn active"') || 
              html.includes('class="mode-btn active" data-mode="implementation"'));
  });

  it("includes search box", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.includes('id="search"'));
    assert.ok(html.includes('placeholder="Search nodes..."'));
  });

  it("includes detail panel structure", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.includes('id="detail-panel"'));
    assert.ok(html.includes('id="panel-content"'));
  });

  it("escapes HTML in title", () => {
    const html = renderGraphHtml(sampleGraph, { title: "<script>alert('xss')</script>" });
    assert.ok(!html.includes("<script>alert('xss')</script>"));
    assert.ok(html.includes("&lt;script&gt;"));
  });

  it("handles empty graph data", () => {
    const html = renderGraphHtml({ nodes: [], links: [] });
    assert.ok(html.startsWith("<!DOCTYPE html>"));
    assert.ok(html.includes("[]"));
  });

  it("includes node color configuration", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.includes("#e67e22")); // problem color
    assert.ok(html.includes("#2980b9")); // need color
    assert.ok(html.includes("#8e44ad")); // fr color
  });

  it("includes CSS theming variables", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.includes("--background-color-default"));
    assert.ok(html.includes("--text-color-default"));
    assert.ok(html.includes("--font-sans"));
  });

  it("includes window.srsNavigator API", () => {
    const html = renderGraphHtml(sampleGraph);
    assert.ok(html.includes("window.srsNavigator"));
    assert.ok(html.includes("getState"));
    assert.ok(html.includes("selectNode"));
    assert.ok(html.includes("setMode"));
  });
});
