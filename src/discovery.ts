/**
 * Model discovery — fetch official /models endpoints, merge with models.dev
 * metadata, resolve API transports, and bucket models by transport family.
 */

import type {
	ModelBuckets,
	ModelsDevModelEntry,
	ModelsDevProviderEntry,
	ModelsDevResponse,
	OpenCodeModelListEntry,
	OpenCodeModelListResponse,
	Transport,
	Modality,
} from "./types.js";
import {
	DEFAULT_CONTEXT_WINDOW,
	DEFAULT_MAX_TOKENS,
	DEFAULT_MODEL_INPUT,
	MODELS_DEV_ENDPOINT,
	ZEN_ANTHROPIC_MODEL_IDS,
	ZEN_GOOGLE_MODEL_IDS,
	ZEN_RESPONSES_MODEL_IDS,
} from "./constants.js";

/** Coerce a value to a positive finite number, or return undefined. */
export function normalizePositiveNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Filter an unknown array down to known modality strings (text, image). */
export function normalizeInput(input: unknown): readonly Modality[] | undefined {
	if (!Array.isArray(input)) return undefined;
	const normalized = input.filter((value): value is Modality => value === "text" || value === "image");
	return normalized.length > 0 ? normalized : undefined;
}

/** Create an empty set of model buckets keyed by API transport. */
export function emptyBuckets(): ModelBuckets {
	return {
		chat: [],
		responses: [],
		google: [],
		anthropic: [],
	};
}

/** Thin typed fetch wrapper with a 15 s timeout. */
export async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url, {
		headers: { Accept: "application/json" },
		signal: AbortSignal.timeout(15_000),
	});

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(`HTTP ${response.status}${body ? `: ${body}` : ""}`);
	}

	return (await response.json()) as T;
}

/** Fetch and validate the official /models response from an OpenCode endpoint. */
export async function fetchOfficialModelEntries(url: string): Promise<OpenCodeModelListEntry[]> {
	const payload = await fetchJson<OpenCodeModelListResponse>(url);
	if (!Array.isArray(payload.data)) {
		throw new Error("Unexpected /models response format");
	}
	return payload.data.filter(
		(entry) => typeof entry.id === "string" && entry.id.trim().length > 0,
	);
}

/** Fetch the aggregated models.dev metadata payload. */
export async function fetchModelsDevMetadata(): Promise<ModelsDevResponse> {
	const payload = await fetchJson<ModelsDevResponse>(MODELS_DEV_ENDPOINT);
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		throw new Error("Unexpected models.dev response format");
	}
	return payload;
}

/** Look up a model's metadata from the models.dev provider blob. */
export function getModelsDevModel(
	provider: ModelsDevProviderEntry | undefined,
	modelId: string,
): ModelsDevModelEntry | undefined {
	// Direct hit on key
	const direct = provider?.models?.[modelId];
	if (direct) return direct;

	// Fallback: scan by embedded id field
	if (!provider?.models) return undefined;
	for (const metadata of Object.values(provider.models)) {
		if (metadata.id === modelId) return metadata;
	}
	return undefined;
}

/** Merge an official /models entry with models.dev metadata into a {@link ModelDef}. */
export function resolveModelDef(
	entry: OpenCodeModelListEntry,
	metadata: ModelsDevModelEntry | undefined,
) {
	const id = entry.id?.trim();
	if (!id) return undefined;

	return {
		id,
		name: metadata?.name?.trim() || entry.name?.trim() || id,
		reasoning: metadata?.reasoning ?? false,
		input: normalizeInput(metadata?.modalities?.input) ?? DEFAULT_MODEL_INPUT,
		contextWindow: normalizePositiveNumber(metadata?.limit?.context) ?? DEFAULT_CONTEXT_WINDOW,
		maxTokens: normalizePositiveNumber(metadata?.limit?.output) ?? DEFAULT_MAX_TOKENS,
	};
}

/** Deduplicate official /models entries by trimmed id. */
export function uniqueOfficialEntries(entries: OpenCodeModelListEntry[]): OpenCodeModelListEntry[] {
	const seen = new Set<string>();
	const result: OpenCodeModelListEntry[] = [];

	for (const entry of entries) {
		const id = entry.id?.trim();
		if (!id || seen.has(id)) continue;
		seen.add(id);
		result.push({ ...entry, id });
	}
	return result;
}

/** Build synthetic /models entries from models.dev as a fallback. */
export function buildEntriesFromModelsDev(
	provider: ModelsDevProviderEntry | undefined,
): OpenCodeModelListEntry[] {
	if (!provider?.models) return [];
	return Object.entries(provider.models).map(([key, metadata]) => ({
		id: metadata.id?.trim() || key,
		name: metadata.name,
	}));
}

/** Resolve which API transport a Zen model uses (per official docs). */
export function resolveZenTransport(modelId: string): Transport {
	if (ZEN_RESPONSES_MODEL_IDS.has(modelId)) return "responses";
	if (ZEN_ANTHROPIC_MODEL_IDS.has(modelId)) return "anthropic";
	if (ZEN_GOOGLE_MODEL_IDS.has(modelId)) return "google";
	return "chat";
}

/** Go models all use the OpenAI-compatible chat bucket for better pi/tool-calling compat. */
export function resolveGoTransport(_modelId: string): Transport {
	return "chat";
}

/** Bucket resolved model defs by their API transport. */
export function buildModelBuckets(
	entries: OpenCodeModelListEntry[],
	provider: ModelsDevProviderEntry | undefined,
	resolveTransport: (modelId: string, metadata: ModelsDevModelEntry | undefined) => Transport,
): ModelBuckets {
	const buckets = emptyBuckets();

	for (const entry of uniqueOfficialEntries(entries)) {
		const id = entry.id!;
		const metadata = getModelsDevModel(provider, id);
		const model = resolveModelDef(entry, metadata);
		if (!model) continue;
		buckets[resolveTransport(id, metadata)].push(model);
	}

	return buckets;
}

/** Discover models for a provider tier: fetch official /models, merge metadata, bucket by transport. */
export async function loadProviderBuckets(options: {
	label: string;
	officialEndpoint: string;
	provider: ModelsDevProviderEntry | undefined;
	resolveTransport: (modelId: string, metadata: ModelsDevModelEntry | undefined) => Transport;
}): Promise<ModelBuckets> {
	let entries: OpenCodeModelListEntry[] = [];

	try {
		entries = await fetchOfficialModelEntries(options.officialEndpoint);
	} catch (error) {
		console.warn(
			`[pi-opencode] Failed to fetch ${options.label} models from ${options.officialEndpoint}; falling back to models.dev membership.`,
			error,
		);
	}

	if (entries.length === 0) {
		entries = buildEntriesFromModelsDev(options.provider);
	}

	return buildModelBuckets(entries, options.provider, options.resolveTransport);
}
