// Extension: srs-navigator
// Problem-Based SRS Navigator - Interactive graph visualization for software
// requirements specifications structured using the Problem-Based SRS methodology.
// Also provides Problem-Based SRS methodology skills as tools.

import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { joinSession, createCanvas, CanvasError } from "@github/copilot-sdk/extension";

import { parseSpecificationData, buildGraphData, convertJSONToSpecificationData } from "./lib/parser.mjs";
import { validateSpecificationJSON, validateReferenceIntegrity } from "./lib/validation.mjs";
import { renderGraphHtml } from "./lib/renderer.mjs";
import { DEMO_SPEC } from "./lib/demo-spec.mjs";
import { backgroundSync } from "./lib/skills-sync.mjs";
import { compileAndSave, compileSpecFromFolder } from "./lib/spec-compiler.mjs";

// Skills directory path
const __dirname = dirname(fileURLToPath(import.meta.url));
const skillsDir = resolve(__dirname, "skills");

// Derive workspace root from extension location:
// Project extension: <workspace>/.github/extensions/srs-navigator/ → 3 levels up
// User extension: ~/.copilot/extensions/srs-navigator/ → fall back to process.cwd()
const isProjectExtension = __dirname.includes(".github");
const derivedWorkspacePath = isProjectExtension ? resolve(__dirname, "..", "..", "..") : null;

// Skill definitions for tool registration
const SKILLS = [
    {
        name: "business_context",
        file: "business-context.md",
        description: "Step 0: Establish structured business context and project principles before problem discovery. Use when starting requirements engineering to capture project identity, business principles, stakeholders, domain boundaries, and success criteria.",
    },
    {
        name: "customer_problems",
        file: "customer-problems.md",
        description: "Step 1: Identify and document Customer Problems (CP) from business context. Use when stakeholders describe solutions instead of problems, or when starting requirements engineering.",
    },
    {
        name: "software_glance",
        file: "software-glance.md",
        description: "Step 2: Create the first abstract representation of a software solution from Customer Problems. Use after identifying CPs to design high-level system boundaries and components.",
    },
    {
        name: "customer_needs",
        file: "customer-needs.md",
        description: "Step 3: Specify Customer Needs (CN) that define WHAT outcomes software must provide to solve Customer Problems. Use after Software Glance to translate problems into needs.",
    },
    {
        name: "software_vision",
        file: "software-vision.md",
        description: "Step 4: Transform Software Glance and Customer Needs into a detailed Software Vision with positioning, stakeholders, features, and architecture.",
    },
    {
        name: "functional_requirements",
        file: "functional-requirements.md",
        description: "Step 5: Generate Functional Requirements (FR) and Non-Functional Requirements (NFR) from Customer Needs and Software Vision. Creates individual requirement files with traceability.",
    },
    {
        name: "complexity_analysis",
        file: "complexity-analysis.md",
        description: "Optional: Analyze specification quality using Axiomatic Design principles. Evaluates independence, completeness, and information content of requirements.",
    },
    {
        name: "problem_based_srs",
        file: "problem-based-srs.md",
        description: "Complete Problem-Based SRS methodology orchestrator. Use when you need to perform full requirements engineering from business problems to functional requirements with traceability.",
    },
    {
        name: "zigzag_validator",
        file: "zigzag-validator.md",
        description: "Validate traceability and consistency across Customer Problems, Customer Needs, and Functional Requirements domains. Use to check completeness and identify gaps.",
    },
];

// Build tools array from skill definitions
function buildSkillTools() {
    return SKILLS.map((skill) => ({
        name: skill.name,
        description: skill.description,
        parameters: {
            type: "object",
            properties: {
                context: {
                    type: "string",
                    description: "Optional: existing artifacts or business context to provide as input for this methodology step.",
                },
            },
        },
        handler: async (args) => {
            const skillPath = resolve(skillsDir, skill.file);
            const content = await readFile(skillPath, "utf-8");
            let result = content;
            if (args.context) {
                result += `\n\n---\n\n## User-Provided Context\n\n${args.context}`;
            }
            return result;
        },
    }));
}

// Per-instance state: server + loaded graph data
const instances = new Map();

// Pending action queues per instance (browser → agent communication)
const pendingActions = new Map();

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
 * If no JSON exists but markdown artifacts do, compile them into JSON first.
 * Returns { graphData, specName, filePath } or null if no .spec folder or valid spec.
 */
async function loadFromSpecFolder(workspacePath) {
    if (!workspacePath) return null;
    const specDir = join(workspacePath, ".spec");
    try {
        const files = await readdir(specDir);
        const jsonFiles = files.filter(f => f.endsWith(".json")).sort();

        // Try existing JSON files first
        for (const file of jsonFiles) {
            try {
                const filePath = join(specDir, file);
                const content = await readFile(filePath, "utf-8");
                const json = JSON.parse(content);
                const validation = validateSpecificationJSON(json);
                if (!validation.success) continue;
                const specData = convertJSONToSpecificationData(validation.data);
                const graphData = buildGraphData(specData);
                if (!graphData.nodes.length) continue;
                return { graphData, specData, specName: validation.data.name, filePath };
            } catch {
                // Skip invalid files, try next
            }
        }

        // No valid JSON found — try compiling from markdown artifacts
        const compiledPath = await compileAndSave(specDir);
        if (compiledPath) {
            try {
                const content = await readFile(compiledPath, "utf-8");
                const json = JSON.parse(content);
                const validation = validateSpecificationJSON(json);
                if (validation.success) {
                    const specData = convertJSONToSpecificationData(validation.data);
                    const graphData = buildGraphData(specData);
                    if (graphData.nodes.length) {
                        return { graphData, specData, specName: validation.data.name, filePath: compiledPath };
                    }
                }
            } catch {
                // Compilation produced invalid output
            }
        }
    } catch {
        // .spec folder doesn't exist or can't be read
    }
    return null;
}

const session = await joinSession({
    tools: buildSkillTools(),
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
                        entry.isLanding = false;

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
                },
                {
                    name: "pending_actions",
                    description: "Retrieve and consume pending actions queued from the canvas UI. When an engineer clicks an action button on a node (e.g., +CN, +FR, +NFR, decompose), the action is queued here with the skill name and context. The agent should invoke the corresponding skill tool with the provided context. Returns the queue and clears it.",
                    handler: async (ctx) => {
                        const queue = pendingActions.get(ctx.instanceId) || [];
                        // Clear the queue after retrieval
                        pendingActions.set(ctx.instanceId, []);

                        if (queue.length === 0) {
                            return { actions: [], message: "No pending actions" };
                        }

                        // Enrich each action with skill instructions
                        const enriched = await Promise.all(queue.map(async (action) => {
                            let skillContent = "";
                            try {
                                const skillFile = SKILLS.find(s => s.name === action.skill)?.file;
                                if (skillFile) {
                                    skillContent = await readFile(resolve(skillsDir, skillFile), "utf-8");
                                }
                            } catch { /* skill file read failure is non-fatal */ }

                            return {
                                ...action,
                                instruction: `Use the "${action.skill}" methodology skill to process this action. Context:\n\n${action.context}`,
                                skillContent,
                            };
                        }));

                        return {
                            actions: enriched,
                            message: `${enriched.length} action(s) ready. For each action, invoke the specified skill tool with the provided context.`,
                        };
                    }
                },
                {
                    name: "learn",
                    description: "Trigger the Problem-Based SRS methodology to scan the project and generate a specification. This is the primary onboarding action for projects without an existing spec.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            context: {
                                type: "string",
                                description: "Optional additional context about the project to help guide spec generation."
                            }
                        }
                    },
                    handler: async (ctx) => {
                        const entry = instances.get(ctx.instanceId);
                        if (!entry) throw new CanvasError("not_open", "Canvas instance not found");

                        const skillPath = resolve(skillsDir, "problem-based-srs.md");
                        const skillContent = await readFile(skillPath, "utf-8");

                        let result = skillContent;
                        if (ctx.input?.context) {
                            result += `\n\n---\n\n## User-Provided Context\n\n${ctx.input.context}`;
                        }

                        return {
                            instruction: "Use the `problem_based_srs` tool to run the full methodology. After generating the .spec/ markdown artifacts AND the JSON file, you MUST use the `load_specification` canvas action with the ABSOLUTE filePath to the JSON file to display the graph in the navigator. The graph will NOT auto-refresh without this explicit action.",
                            skillContent: result,
                            message: "Learn action triggered. Run the problem_based_srs methodology and load the result into the canvas."
                        };
                    }
                },
                {
                    name: "compile_spec",
                    description: "Compile .spec/ markdown artifacts into a JSON specification file and load the result into the graph. Use after the problem_based_srs methodology has generated markdown files but no JSON exists yet.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            specDir: {
                                type: "string",
                                description: "Optional path to the .spec directory. Defaults to .spec/ in the workspace root."
                            }
                        }
                    },
                    handler: async (ctx) => {
                        const entry = instances.get(ctx.instanceId);
                        if (!entry) throw new CanvasError("not_open", "Canvas instance not found");

                        const workspacePath = derivedWorkspacePath || session.workspacePath || process.env.COPILOT_WORKSPACE_PATH || process.cwd();
                        const specDir = ctx.input?.specDir || join(workspacePath, ".spec");

                        const filePath = await compileAndSave(specDir);
                        if (!filePath) {
                            throw new CanvasError("compile_failed", "Could not compile specification from .spec/ folder. Ensure at least customer problems (01-customer-problems.md) or customer needs (03-customer-needs.md) exist.");
                        }

                        // Load the compiled JSON into the graph
                        const content = await readFile(filePath, "utf-8");
                        const json = JSON.parse(content);
                        const result = loadAndBuildGraph(json);

                        const html = renderGraphHtml(result.graphData, { title: result.specName, isDemo: false });
                        entry.graphData = result.graphData;
                        entry.specName = result.specName;
                        entry.html = html;
                        entry.isLanding = false;

                        return {
                            specName: result.specName,
                            filePath,
                            nodeCount: result.graphData.nodes.length,
                            linkCount: result.graphData.links.length,
                            summary: summarizeGraph(result.graphData),
                            message: `Compiled and loaded specification from ${filePath}`
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
                    // Priority: derivedWorkspacePath (project ext) > ctx.host > env vars > session cwd (unreliable)
                    const workspacePath = derivedWorkspacePath || ctx.host?.workspacePath || process.env.COPILOT_WORKSPACE_PATH || "";
                    let fromFolder = null;
                    if (workspacePath) {
                        try {
                            fromFolder = await loadFromSpecFolder(workspacePath);
                        } catch (e) {
                            // Log error but don't crash — show landing page instead
                            try { session.log(`[srs-nav] loadFromSpecFolder error: ${e.message}`); } catch {}
                        }
                    }
                    if (fromFolder) {
                        graphData = fromFolder.graphData;
                        specName = fromFolder.specName;
                    } else {
                        // No spec found — show landing overlay on top of demo graph
                        const demoResult = loadAndBuildGraph(DEMO_SPEC);
                        const landingHtml = renderGraphHtml(demoResult.graphData, {
                            title: demoResult.specName,
                            isDemo: true,
                            showLanding: true
                        });
                        const workspacePathResolved = derivedWorkspacePath || ctx.host?.workspacePath || process.env.COPILOT_WORKSPACE_PATH || "";

                        const server = createServer((req, res) => {
                            const inst = instances.get(ctx.instanceId);

                            if (req.url === "/api/check-spec" && req.method === "GET") {
                                // Polling endpoint: check if spec was loaded via action OR appeared in .spec/
                                (async () => {
                                    try {
                                        // If load_specification already loaded a spec, signal reload
                                        if (inst && !inst.isLanding) {
                                            res.setHeader("Content-Type", "application/json");
                                            res.end(JSON.stringify({ found: true, specName: inst.specName }));
                                            return;
                                        }
                                        const result = workspacePathResolved ? await loadFromSpecFolder(workspacePathResolved) : null;
                                        if (result) {
                                            // Spec found — switch to graph view
                                            const html = renderGraphHtml(result.graphData, { title: result.specName, isDemo: false });
                                            inst.graphData = result.graphData;
                                            inst.specName = result.specName;
                                            inst.html = html;
                                            inst.isLanding = false;
                                            res.setHeader("Content-Type", "application/json");
                                            res.end(JSON.stringify({ found: true, specName: result.specName }));
                                        } else {
                                            res.setHeader("Content-Type", "application/json");
                                            res.end(JSON.stringify({ found: false }));
                                        }
                                    } catch {
                                        res.setHeader("Content-Type", "application/json");
                                        res.end(JSON.stringify({ found: false }));
                                    }
                                })();
                                return;
                            }

                            if (req.url === "/api/landing-action" && req.method === "POST") {
                                let body = "";
                                req.on("data", (chunk) => { body += chunk; });
                                req.on("end", async () => {
                                    try {
                                        const { action } = JSON.parse(body);

                                        if (action === "demo") {
                                            // Load demo spec and switch to graph view
                                            const result = loadAndBuildGraph(DEMO_SPEC);
                                            const html = renderGraphHtml(result.graphData, { title: result.specName, isDemo: true });
                                            inst.graphData = result.graphData;
                                            inst.specName = result.specName;
                                            inst.html = html;
                                            inst.isLanding = false;
                                            res.setHeader("Content-Type", "application/json");
                                            res.end(JSON.stringify({ ok: true, reload: true }));
                                        } else if (action === "learn") {
                                            // Send learn prompt to agent session
                                            const prompt = [
                                                "## SRS Navigator: Learn & Create Specification",
                                                "",
                                                "The user wants to create a Problem-Based SRS specification for their project.",
                                                "Use the `problem_based_srs` tool to run the full methodology.",
                                                "Scan the workspace for existing code, README, and documentation to provide context.",
                                                "",
                                                "**IMPORTANT:** After generating all the .spec/ markdown artifacts (customer problems, needs, requirements),",
                                                "you MUST also generate a consolidated JSON specification file at `.spec/<project-name>.json`",
                                                "following this structure:",
                                                "```json",
                                                '{',
                                                '  "name": "Project Name",',
                                                '  "version": "1.0",',
                                                '  "problems": [{ "id": "CP-1", "title": "...", "description": "..." }],',
                                                '  "needs": [{ "id": "CN-1", "title": "...", "description": "...", "problemIds": ["CP-1"] }],',
                                                '  "functionalRequirements": [{ "id": "FR-1", "title": "...", "description": "...", "needIds": ["CN-1"] }],',
                                                '  "nonFunctionalRequirements": [{ "id": "NFR-1", "title": "...", "description": "...", "needIds": ["CN-1"] }]',
                                                '}',
                                                "```",
                                                "",
                                                "**CRITICAL - Display the graph:** After creating the JSON file, you MUST use the `load_specification` canvas action",
                                                "with the ABSOLUTE file path to the JSON file (e.g., filePath: \"/full/path/to/.spec/project-name.json\").",
                                                "This will load the specification into the SRS Navigator graph and display it to the user.",
                                                "Do NOT skip this step — the graph will not auto-refresh without it.",
                                            ].join("\n");
                                            await session.send({ prompt });
                                            res.setHeader("Content-Type", "application/json");
                                            res.end(JSON.stringify({ ok: true, sent: true }));
                                        } else if (action === "load") {
                                            // Send load prompt to agent session
                                            const prompt = [
                                                "## SRS Navigator: Load Specification",
                                                "",
                                                "The user wants to load an existing specification file.",
                                                "Look for .spec/*.json files in the workspace, or ask the user which file to load.",
                                                "Then use the `load_specification` canvas action to display it.",
                                            ].join("\n");
                                            await session.send({ prompt });
                                            res.setHeader("Content-Type", "application/json");
                                            res.end(JSON.stringify({ ok: true, sent: true }));
                                        } else {
                                            res.statusCode = 400;
                                            res.setHeader("Content-Type", "application/json");
                                            res.end(JSON.stringify({ ok: false, error: "Unknown action" }));
                                        }
                                    } catch (e) {
                                        res.statusCode = 500;
                                        res.setHeader("Content-Type", "application/json");
                                        res.end(JSON.stringify({ ok: false, error: e.message }));
                                    }
                                });
                                return;
                            }

                            if (req.url === "/api/state") {
                                res.setHeader("Content-Type", "application/json");
                                res.end(JSON.stringify({
                                    specName: inst?.specName || null,
                                    nodeCount: inst?.graphData?.nodes?.length || 0,
                                    linkCount: inst?.graphData?.links?.length || 0,
                                    isLanding: inst?.isLanding || false,
                                }));
                                return;
                            }

                            res.setHeader("Content-Type", "text/html; charset=utf-8");
                            res.end(inst?.html || landingHtml);
                        });

                        await new Promise((r) => server.listen(0, "127.0.0.1", r));
                        const url = `http://127.0.0.1:${server.address().port}/`;

                        instances.set(ctx.instanceId, { server, url, html: landingHtml, graphData: demoResult.graphData, specName: demoResult.specName, isLanding: true });

                        // Trigger background skills sync (non-blocking)
                        backgroundSync(skillsDir, (msg) => session.log(msg)).catch(() => {});

                        return { title: "SRS Navigator", url };
                    }
                }

                const html = renderGraphHtml(graphData, {
                    title: specName,
                    analysisMode: input.analysisMode || "all",
                    isDemo
                });

                const server = createServer((req, res) => {
                    const inst = instances.get(ctx.instanceId);

                    if (req.url === "/api/invoke-skill" && req.method === "POST") {
                        let body = "";
                        req.on("data", (chunk) => { body += chunk; });
                        req.on("end", async () => {
                            try {
                                const action = JSON.parse(body);
                                const actionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

                                // Read the skill file for context
                                let skillContent = "";
                                try {
                                    const skillDef = SKILLS.find(s => s.name === action.skill);
                                    if (skillDef) {
                                        skillContent = await readFile(resolve(skillsDir, skillDef.file), "utf-8");
                                    }
                                } catch { /* non-fatal */ }

                                // Build the prompt for the agent
                                const prompt = [
                                    `## SRS Navigator Action: ${action.action}`,
                                    `**Skill:** ${action.skill}`,
                                    `**Node:** ${action.nodeId} (${action.nodeType}) — "${action.nodeLabel}"`,
                                    `**Context:** ${action.context}`,
                                    "",
                                    "Use the `" + action.skill + "` tool with the context above to process this request.",
                                    "After generating the result, use the `load_specification` canvas action to update the graph if the specification changes.",
                                ].join("\n");

                                // Send directly to the agent session
                                await session.send({ prompt });

                                // Also queue for reference
                                if (!pendingActions.has(ctx.instanceId)) {
                                    pendingActions.set(ctx.instanceId, []);
                                }
                                pendingActions.get(ctx.instanceId).push({
                                    id: actionId,
                                    timestamp: new Date().toISOString(),
                                    status: "sent",
                                    ...action,
                                });

                                res.setHeader("Content-Type", "application/json");
                                res.end(JSON.stringify({ ok: true, sent: true, actionId }));
                            } catch (e) {
                                const isJsonError = e instanceof SyntaxError;
                                res.statusCode = isJsonError ? 400 : 500;
                                res.setHeader("Content-Type", "application/json");
                                res.end(JSON.stringify({
                                    ok: false,
                                    error: isJsonError ? "Invalid JSON" : "Failed to send to agent",
                                    detail: e.message,
                                }));
                            }
                        });
                        return;
                    }

                    if (req.url === "/api/pending-actions") {
                        res.setHeader("Content-Type", "application/json");
                        const queue = pendingActions.get(ctx.instanceId) || [];
                        res.end(JSON.stringify({ actions: queue }));
                        return;
                    }

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

                // Trigger background skills sync (non-blocking)
                backgroundSync(skillsDir, (msg) => session.log(msg)).catch(() => {});

                return { title: `SRS: ${specName}`, url };
            },
            onClose: async (ctx) => {
                const entry = instances.get(ctx.instanceId);
                if (entry) {
                    instances.delete(ctx.instanceId);
                    pendingActions.delete(ctx.instanceId);
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

// Trigger background skills sync on extension startup
backgroundSync(skillsDir, (msg) => session.log(msg)).catch(() => {});
