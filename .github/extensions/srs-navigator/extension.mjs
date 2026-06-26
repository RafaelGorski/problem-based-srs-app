// Extension: srs-navigator
// Problem-Based SRS Navigator - Interactive graph visualization for software
// requirements specifications structured using the Problem-Based SRS methodology.

import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { joinSession, createCanvas, CanvasError } from "@github/copilot-sdk/extension";

import { parseSpecificationData, buildGraphData, convertJSONToSpecificationData } from "./lib/parser.mjs";
import { validateSpecificationJSON, validateReferenceIntegrity } from "./lib/validation.mjs";
import { renderGraphHtml } from "./lib/renderer.mjs";
import { DEMO_SPEC } from "./lib/demo-spec.mjs";

// Per-instance state: server + loaded graph data
const instances = new Map();

async function startServer(instanceId, graphData, specName) {
    const html = renderGraphHtml(graphData, { title: specName });

    const server = createServer((req, res) => {
        if (req.url === "/api/state") {
            res.setHeader("Content-Type", "application/json");
            const entry = instances.get(instanceId);
            res.end(JSON.stringify({
                specName: entry?.specName || specName,
                nodeCount: entry?.graphData?.nodes?.length || 0,
                linkCount: entry?.graphData?.links?.length || 0,
            }));
            return;
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(entry?.html || html);
    });

    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const port = server.address().port;
    return { server, url: `http://127.0.0.1:${port}/`, html };
}

function loadAndBuildGraph(specJSON) {
    const validation = validateSpecificationJSON(specJSON);
    if (!validation.success) {
        throw new CanvasError("invalid_spec", `Validation failed: ${validation.errors.join("; ")}`);
    }
    const specData = convertJSONToSpecificationData(validation.data);
    const graphData = buildGraphData(specData);
    if (!graphData.nodes.length) {
        throw new CanvasError("empty_spec", "No nodes could be created from the specification");
    }
    return { graphData, specData, specName: validation.data.name };
}

/**
 * Scan for .spec folder in the workspace and load the first valid JSON spec found.
 * Returns { graphData, specName, filePath } or null if no .spec folder or valid spec.
 */
async function loadFromSpecFolder(workspacePath) {
    if (!workspacePath) return null;
    const specDir = join(workspacePath, ".spec");
    try {
        const files = await readdir(specDir);
        const jsonFiles = files.filter(f => f.endsWith(".json")).sort();
        for (const file of jsonFiles) {
            try {
                const filePath = join(specDir, file);
                const content = await readFile(filePath, "utf-8");
                const json = JSON.parse(content);
                const result = loadAndBuildGraph(json);
                return { ...result, filePath };
            } catch {
                // Skip invalid files, try next
            }
        }
    } catch {
        // .spec folder doesn't exist or can't be read
    }
    return null;
}

const session = await joinSession({
    canvases: [
        createCanvas({
            id: "srs-navigator",
            displayName: "SRS Navigator",
            description: "Interactive force-directed graph visualization for Problem-Based SRS specifications. Opens a canvas showing relationships between customer problems, needs, and requirements.",
            inputSchema: {
                type: "object",
                properties: {
                    specification: {
                        type: "object",
                        description: "A Problem-Based SRS specification JSON object with name, version, problems, needs, functionalRequirements, and nonFunctionalRequirements arrays. If omitted, loads a demo CRM specification."
                    },
                    filePath: {
                        type: "string",
                        description: "Path to a specification JSON file to load. Takes precedence over inline specification."
                    },
                    analysisMode: {
                        type: "string",
                        enum: ["all", "customer-problem", "implementation"],
                        description: "Initial analysis mode: 'all' shows everything, 'customer-problem' shows problems+needs, 'implementation' shows needs+requirements."
                    }
                }
            },
            actions: [
                {
                    name: "load_specification",
                    description: "Load a new specification into the open canvas, replacing the current graph. Accepts JSON specification object or a file path.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            specification: { type: "object", description: "SRS specification JSON object" },
                            filePath: { type: "string", description: "Path to a specification JSON file" },
                            markdown: { type: "string", description: "Raw markdown specification text to parse" }
                        }
                    },
                    handler: async (ctx) => {
                        const entry = instances.get(ctx.instanceId);
                        if (!entry) throw new CanvasError("not_open", "Canvas instance not found");

                        let graphData, specName;

                        if (ctx.input?.filePath) {
                            const content = await readFile(ctx.input.filePath, "utf-8");
                            const json = JSON.parse(content);
                            const result = loadAndBuildGraph(json);
                            graphData = result.graphData;
                            specName = result.specName;
                        } else if (ctx.input?.specification) {
                            const result = loadAndBuildGraph(ctx.input.specification);
                            graphData = result.graphData;
                            specName = result.specName;
                        } else if (ctx.input?.markdown) {
                            const specData = parseSpecificationData(ctx.input.markdown);
                            graphData = buildGraphData(specData);
                            specName = "Parsed Specification";
                            if (!graphData.nodes.length) {
                                throw new CanvasError("empty_spec", "No nodes found in markdown");
                            }
                        } else {
                            throw new CanvasError("missing_input", "Provide specification, filePath, or markdown");
                        }

                        // Rebuild the server HTML
                        const html = renderGraphHtml(graphData, { title: specName, isDemo: false });
                        entry.graphData = graphData;
                        entry.specName = specName;
                        entry.html = html;

                        return {
                            specName,
                            nodeCount: graphData.nodes.length,
                            linkCount: graphData.links.length,
                            summary: summarizeGraph(graphData)
                        };
                    }
                },
                {
                    name: "validate_specification",
                    description: "Validate a specification JSON object or file, returning validation and reference integrity results.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            specification: { type: "object", description: "SRS specification JSON object" },
                            filePath: { type: "string", description: "Path to a specification JSON file" }
                        }
                    },
                    handler: async (ctx) => {
                        let spec;
                        if (ctx.input?.filePath) {
                            const content = await readFile(ctx.input.filePath, "utf-8");
                            spec = JSON.parse(content);
                        } else if (ctx.input?.specification) {
                            spec = ctx.input.specification;
                        } else {
                            throw new CanvasError("missing_input", "Provide specification or filePath");
                        }

                        const schemaResult = validateSpecificationJSON(spec);
                        if (!schemaResult.success) {
                            return { valid: false, schemaErrors: schemaResult.errors, referenceErrors: [] };
                        }

                        const refResult = validateReferenceIntegrity(schemaResult.data);
                        return {
                            valid: refResult.valid !== false,
                            schemaErrors: [],
                            referenceErrors: refResult.valid === false ? refResult.errors : [],
                            summary: {
                                problems: schemaResult.data.problems.length,
                                needs: schemaResult.data.needs.length,
                                functionalRequirements: schemaResult.data.functionalRequirements.length,
                                nonFunctionalRequirements: schemaResult.data.nonFunctionalRequirements.length
                            }
                        };
                    }
                },
                {
                    name: "inspect_node",
                    description: "Get detailed information about a specific node by ID, including its connections and traceability.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            nodeId: { type: "string", description: "The node ID to inspect (e.g., CP-1, CN-2, FR-3, NFR-1)" }
                        },
                        required: ["nodeId"]
                    },
                    handler: async (ctx) => {
                        const entry = instances.get(ctx.instanceId);
                        if (!entry) throw new CanvasError("not_open", "Canvas instance not found");

                        const nodeId = ctx.input.nodeId.toUpperCase();
                        const node = entry.graphData.nodes.find(n => n.id === nodeId);
                        if (!node) throw new CanvasError("not_found", `Node ${nodeId} not found`);

                        const inbound = entry.graphData.links
                            .filter(l => (typeof l.target === 'string' ? l.target : l.target.id) === nodeId)
                            .map(l => ({ from: typeof l.source === 'string' ? l.source : l.source.id, type: l.type }));
                        const outbound = entry.graphData.links
                            .filter(l => (typeof l.source === 'string' ? l.source : l.source.id) === nodeId)
                            .map(l => ({ to: typeof l.target === 'string' ? l.target : l.target.id, type: l.type }));

                        return {
                            id: node.id,
                            type: node.type,
                            label: node.label,
                            description: node.data?.description || "",
                            complexity: node.complexity,
                            connections: { inbound, outbound },
                            totalConnections: inbound.length + outbound.length
                        };
                    }
                },
                {
                    name: "get_summary",
                    description: "Get a summary of the currently loaded specification graph.",
                    handler: async (ctx) => {
                        const entry = instances.get(ctx.instanceId);
                        if (!entry) throw new CanvasError("not_open", "Canvas instance not found");
                        return {
                            specName: entry.specName,
                            ...summarizeGraph(entry.graphData)
                        };
                    }
                },
                {
                    name: "search_nodes",
                    description: "Search nodes by ID or label text.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "Search query to match against node IDs and labels" },
                            type: { type: "string", enum: ["problem", "need", "fr", "nfr"], description: "Optional: filter by node type" }
                        },
                        required: ["query"]
                    },
                    handler: async (ctx) => {
                        const entry = instances.get(ctx.instanceId);
                        if (!entry) throw new CanvasError("not_open", "Canvas instance not found");

                        const query = (ctx.input.query || "").toLowerCase();
                        let results = entry.graphData.nodes.filter(n =>
                            n.id.toLowerCase().includes(query) || n.label.toLowerCase().includes(query)
                        );
                        if (ctx.input.type) {
                            results = results.filter(n => n.type === ctx.input.type);
                        }

                        return {
                            count: results.length,
                            results: results.slice(0, 50).map(n => ({
                                id: n.id, type: n.type, label: n.label
                            }))
                        };
                    }
                }
            ],
            open: async (ctx) => {
                let entry = instances.get(ctx.instanceId);
                if (entry) {
                    return { title: `SRS: ${entry.specName}`, url: entry.url };
                }

                let graphData, specName;
                let isDemo = false;
                const input = ctx.input || {};

                if (input.filePath) {
                    const content = await readFile(input.filePath, "utf-8");
                    const json = JSON.parse(content);
                    const result = loadAndBuildGraph(json);
                    graphData = result.graphData;
                    specName = result.specName;
                } else if (input.specification) {
                    const result = loadAndBuildGraph(input.specification);
                    graphData = result.graphData;
                    specName = result.specName;
                } else {
                    // Try loading from .spec folder in the workspace first
                    const workspacePath = session.workspacePath || ctx.host?.workspacePath;
                    const fromFolder = await loadFromSpecFolder(workspacePath);
                    if (fromFolder) {
                        graphData = fromFolder.graphData;
                        specName = fromFolder.specName;
                    } else {
                        // Fall back to embedded demo specification
                        const result = loadAndBuildGraph(DEMO_SPEC);
                        graphData = result.graphData;
                        specName = result.specName;
                        isDemo = true;
                    }
                }

                const html = renderGraphHtml(graphData, {
                    title: specName,
                    analysisMode: input.analysisMode || "all",
                    isDemo
                });

                const server = createServer((req, res) => {
                    const inst = instances.get(ctx.instanceId);
                    if (req.url === "/api/state") {
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify({
                            specName: inst?.specName,
                            nodeCount: inst?.graphData?.nodes?.length || 0,
                            linkCount: inst?.graphData?.links?.length || 0,
                        }));
                        return;
                    }
                    res.setHeader("Content-Type", "text/html; charset=utf-8");
                    res.end(inst?.html || html);
                });

                await new Promise((r) => server.listen(0, "127.0.0.1", r));
                const url = `http://127.0.0.1:${server.address().port}/`;

                instances.set(ctx.instanceId, { server, url, html, graphData, specName });
                return { title: `SRS: ${specName}`, url };
            },
            onClose: async (ctx) => {
                const entry = instances.get(ctx.instanceId);
                if (entry) {
                    instances.delete(ctx.instanceId);
                    await new Promise((r) => entry.server.close(() => r()));
                }
            },
        }),
    ],
});

function summarizeGraph(graphData) {
    const types = { problem: 0, need: 0, fr: 0, nfr: 0 };
    for (const node of graphData.nodes) {
        if (types[node.type] !== undefined) types[node.type]++;
    }
    return {
        totalNodes: graphData.nodes.length,
        totalLinks: graphData.links.length,
        problems: types.problem,
        needs: types.need,
        functionalRequirements: types.fr,
        nonFunctionalRequirements: types.nfr
    };
}
