#!/usr/bin/env node
// Runnable wrapper around lib/skill-sync.mjs. Downloads the bundled methodology
// skill markdown files from the upstream Problem-Based-SRS repository using the
// real network fetch and writes them into the local skills/ directory.
//
// Usage:
//   node scripts/sync-skills.mjs            # sync all bundled skills
//   node scripts/sync-skills.mjs --ref dev  # sync from a non-default upstream ref
//
// Exit code is 0 when every skill synced, 1 when one or more skills failed so
// CI can surface (but a release workflow may choose to treat it as non-fatal).

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { syncSkills, SKILL_SOURCE } from "../lib/skill-sync.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillsDir = resolve(__dirname, "..", "skills");

// The canonical list of bundled skill files (kept in sync with extension.mjs).
const FILES = [
  "business-context.md",
  "customer-problems.md",
  "software-glance.md",
  "customer-needs.md",
  "software-vision.md",
  "functional-requirements.md",
  "complexity-analysis.md",
  "problem-based-srs.md",
  "zigzag-validator.md",
];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--ref") out.ref = argv[++i];
    if (argv[i] === "--owner") out.owner = argv[++i];
    if (argv[i] === "--repo") out.repo = argv[++i];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = { ...SKILL_SOURCE, ...args };

  console.log(
    `Syncing ${FILES.length} skills from ${source.owner}/${source.repo}@${source.ref} ...`
  );

  const result = await syncSkills({
    files: FILES,
    skillsDir,
    source,
    writeFileImpl: writeFile,
  });

  for (const file of result.updated) console.log(`  updated  ${file}`);
  for (const { file, error } of result.failed) console.error(`  FAILED   ${file}: ${error}`);

  console.log(
    `Done: ${result.updated.length} updated, ${result.failed.length} failed (ref ${result.ref}).`
  );

  process.exit(result.failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("sync-skills crashed:", err);
  process.exit(1);
});
