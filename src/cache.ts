/**
 * Persistent cache for OpenCode model data at ~/.pi/opencode-provider/cache.json.
 *
 * Skips network on startup after the first fetch. Use the
 * `/pi-opencode-provider:fetch-models` command to refresh.
 */

import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ModelBuckets, ModelsDevResponse } from "./types.js";

const CACHE_DIR = join(homedir(), ".pi", "opencode-provider");
const CACHE_FILE = join(CACHE_DIR, "cache.json");

export interface ModelCache {
	/** Unix ms timestamp of when this cache was written. */
	cachedAt: number;
	/** Raw models.dev API response (or null on fetch failure). */
	modelsDev: ModelsDevResponse | null;
	/** Resolved Zen model buckets. */
	zenBuckets: ModelBuckets;
	/** Resolved Go model buckets. */
	goBuckets: ModelBuckets;
}

/** Read the on-disk model cache. Returns null when missing or corrupt. */
export function readModelCache(): ModelCache | null {
	try {
		if (!existsSync(CACHE_FILE)) return null;
		const raw = readFileSync(CACHE_FILE, "utf-8");
		const parsed = JSON.parse(raw) as ModelCache;

		// Basic structural validation
		if (
			!parsed ||
			typeof parsed.cachedAt !== "number" ||
			!parsed.zenBuckets ||
			!parsed.goBuckets
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

/** Write model data to the on-disk cache. */
export function writeModelCache(cache: ModelCache): void {
	mkdirSync(CACHE_DIR, { recursive: true });
	// Write atomically via temp file to avoid partial reads on crash
	const tmp = CACHE_FILE + ".tmp";
	writeFileSync(tmp, JSON.stringify(cache, null, 2), "utf-8");
	renameSync(tmp, CACHE_FILE);
}

