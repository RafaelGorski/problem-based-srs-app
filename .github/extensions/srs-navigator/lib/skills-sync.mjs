// Skills auto-sync module
// Checks the Problem-Based-SRS repo for newer skill versions and updates local copies.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { get as httpsGet } from "node:https";

const REPO_OWNER = "RafaelGorski";
const REPO_NAME = "Problem-Based-SRS";
const SKILLS_PATH = "skills";
const BRANCH = "main";
const SYNC_STATE_FILE = ".sync-state.json";

// Minimum interval between sync checks (1 hour)
const MIN_SYNC_INTERVAL_MS = 60 * 60 * 1000;

const SKILL_FILES = [
    { dir: "business-context", file: "SKILL.md", local: "business-context.md" },
    { dir: "customer-problems", file: "SKILL.md", local: "customer-problems.md" },
    { dir: "software-glance", file: "SKILL.md", local: "software-glance.md" },
    { dir: "customer-needs", file: "SKILL.md", local: "customer-needs.md" },
    { dir: "software-vision", file: "SKILL.md", local: "software-vision.md" },
    { dir: "functional-requirements", file: "SKILL.md", local: "functional-requirements.md" },
    { dir: "complexity-analysis", file: "SKILL.md", local: "complexity-analysis.md" },
    { dir: "problem-based-srs", file: "SKILL.md", local: "problem-based-srs.md" },
    { dir: "zigzag-validator", file: "SKILL.md", local: "zigzag-validator.md" },
];

function httpsRequest(url) {
    return new Promise((resolve, reject) => {
        const req = httpsGet(url, {
            headers: { "User-Agent": "srs-navigator-extension/1.0" }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                httpsRequest(res.headers.location).then(resolve, reject);
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                res.resume();
                return;
            }
            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
            res.on("error", reject);
        });
        req.on("error", reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error("Timeout")); });
    });
}

async function readSyncState(skillsDir) {
    try {
        const content = await readFile(resolve(skillsDir, SYNC_STATE_FILE), "utf-8");
        return JSON.parse(content);
    } catch {
        return { lastSha: null, lastSyncAt: null };
    }
}

async function writeSyncState(skillsDir, state) {
    await writeFile(
        resolve(skillsDir, SYNC_STATE_FILE),
        JSON.stringify(state, null, 2),
        "utf-8"
    );
}

/**
 * Check if the remote repo has a newer commit on the skills directory.
 * Returns { hasUpdate: true, latestSha } or { hasUpdate: false }.
 */
async function checkForUpdates(lastSha) {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits?path=${SKILLS_PATH}&sha=${BRANCH}&per_page=1`;
    const response = await httpsRequest(url);
    const commits = JSON.parse(response);
    if (!Array.isArray(commits) || commits.length === 0) {
        return { hasUpdate: false };
    }
    const latestSha = commits[0].sha;
    if (latestSha === lastSha) {
        return { hasUpdate: false };
    }
    return { hasUpdate: true, latestSha };
}

/**
 * Download a single skill file from the repo.
 */
async function downloadSkill(skillDef, ref) {
    const url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${ref}/${SKILLS_PATH}/${skillDef.dir}/${skillDef.file}`;
    return httpsRequest(url);
}

/**
 * Perform the sync: download all skill files from the latest commit.
 */
async function syncSkills(skillsDir, latestSha, logger) {
    let updated = 0;
    let failed = 0;

    for (const skill of SKILL_FILES) {
        try {
            const content = await downloadSkill(skill, latestSha);
            const localPath = resolve(skillsDir, skill.local);
            await writeFile(localPath, content, "utf-8");
            updated++;
        } catch (err) {
            failed++;
            if (logger) logger(`[skills-sync] Failed to update ${skill.local}: ${err.message}`);
        }
    }

    return { updated, failed };
}

/**
 * Main entry point: run a background sync check.
 * - Respects minimum interval between checks
 * - Non-blocking, safe to call fire-and-forget
 * - Returns a summary object or null if skipped
 */
export async function backgroundSync(skillsDir, logger) {
    try {
        const state = await readSyncState(skillsDir);

        // Throttle: skip if checked recently
        if (state.lastSyncAt) {
            const elapsed = Date.now() - new Date(state.lastSyncAt).getTime();
            if (elapsed < MIN_SYNC_INTERVAL_MS) {
                if (logger) logger(`[skills-sync] Skipped — last sync was ${Math.round(elapsed / 60000)}m ago (min interval: 60m)`);
                return null;
            }
        }

        if (logger) logger("[skills-sync] Checking for skill updates...");

        const { hasUpdate, latestSha } = await checkForUpdates(state.lastSha);

        if (!hasUpdate) {
            // Update timestamp even if no changes, to throttle future checks
            await writeSyncState(skillsDir, { ...state, lastSyncAt: new Date().toISOString() });
            if (logger) logger("[skills-sync] Skills are up to date.");
            return { status: "up_to_date" };
        }

        if (logger) logger(`[skills-sync] New version found (${latestSha.slice(0, 7)}). Updating skills...`);

        const { updated, failed } = await syncSkills(skillsDir, latestSha, logger);

        const newState = {
            lastSha: latestSha,
            lastSyncAt: new Date().toISOString(),
            lastUpdateResult: { updated, failed, timestamp: new Date().toISOString() }
        };
        await writeSyncState(skillsDir, newState);

        if (logger) logger(`[skills-sync] Done: ${updated} updated, ${failed} failed.`);
        return { status: "updated", updated, failed, sha: latestSha };
    } catch (err) {
        if (logger) logger(`[skills-sync] Error: ${err.message}`);
        return { status: "error", error: err.message };
    }
}
