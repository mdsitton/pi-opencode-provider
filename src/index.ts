/**
 * pi-opencode-provider — OpenCode Zen & Go provider for pi
 *
 * ## Setup
 * 1. Run `/login` in pi, choose "Use a subscription", and pick "OpenCode Zen" or "OpenCode Go"
 * 2. Paste your API key when prompted
 * 3. Run `/model` to select a model
 *
 * ## Providers
 * - **opencode** — All Zen models (Chat Completions, Responses, Anthropic Messages, Google Gen AI) — *replaces the built-in `opencode` provider*
 * - **opencode-go**  — All Go models (Chat Completions + Anthropic Messages) — *replaces the built-in `opencode-go` provider*
 *
 * ## Model discovery
 * The provider merges data from three sources:
 * - The official `/models` endpoints — authoritative for which models belong to each provider
 * - The official docs — authoritative for API transport mapping (chat, responses, google, anthropic)
 * - [models.dev](https://models.dev) — context window, output limit, reasoning, and modalities
 *
 * Missing metadata falls back to 128k context / 16k max tokens.
 *
 * ## Caching
 * Model data is fetched once on first load and cached at
 * `~/.pi/opencode-provider/cache.json`. Subsequent startups read from cache
 * without network calls. Run `/pi-opencode-provider:fetch-models` to refresh.
 *
 * ## Docs
 * - https://opencode.ai/docs/zen/
 * - https://opencode.ai/docs/go/
 *
 * If you notice a discrepancy between the docs and `/models` responses, please file an issue or PR!
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Api, Model } from "@earendil-works/pi-ai";

import {
	GO_ANTHROPIC_BASE_URL,
	GO_PROVIDER_ID,
	GO_V1_BASE_URL,
	MODELS_DEV_ENDPOINT,
	MODELS_DEV_PROVIDER_ID_BY_KIND,
	ZEN_ANTHROPIC_BASE_URL,
	ZEN_PROVIDER_ID,
	ZEN_V1_BASE_URL,
	ZEN_MODELS_ENDPOINT,
	GO_MODELS_ENDPOINT,
} from "./constants.js";
import {
	toOpenAICompletionsModelConfig,
	toOpenAIResponsesModelConfig,
	toStandardModelConfig,
} from "./config.js";
import {
	fetchModelsDevMetadata,
	loadProviderBuckets,
	resolveGoTransport,
	resolveZenTransport,
} from "./discovery.js";
import { createApiKeyBackedOAuthProvider } from "./oauth.js";
import { readModelCache, writeModelCache } from "./cache.js";
import type { ModelBuckets, ModelsDevResponse } from "./types.js";

// ---------------------------------------------------------------------------
// Shared fetch + register logic (used by both initial load and refresh cmd)
// ---------------------------------------------------------------------------

interface FetchedData {
	modelsDev: ModelsDevResponse | null;
	zenBuckets: ModelBuckets;
	goBuckets: ModelBuckets;
}

/** Fetch models.dev metadata and official /models endpoints, return bucketed data. */
async function fetchModelData(): Promise<FetchedData> {
	let modelsDev: ModelsDevResponse | null = null;
	try {
		modelsDev = await fetchModelsDevMetadata();
	} catch (error) {
		console.warn(
			`[pi-opencode] Failed to fetch models.dev metadata from ${MODELS_DEV_ENDPOINT}.`,
			error,
		);
	}

	const [zenBuckets, goBuckets] = await Promise.all([
		loadProviderBuckets({
			label: "OpenCode Zen",
			officialEndpoint: ZEN_MODELS_ENDPOINT,
			provider: modelsDev?.[MODELS_DEV_PROVIDER_ID_BY_KIND.zen],
			resolveTransport: (modelId) => resolveZenTransport(modelId),
		}),
		loadProviderBuckets({
			label: "OpenCode Go",
			officialEndpoint: GO_MODELS_ENDPOINT,
			provider: modelsDev?.[MODELS_DEV_PROVIDER_ID_BY_KIND.go],
			resolveTransport: (modelId) => resolveGoTransport(modelId),
		}),
	]);

	return { modelsDev, zenBuckets, goBuckets };
}

// ---------------------------------------------------------------------------
// Build flat model configs & register providers
// ---------------------------------------------------------------------------

/** Flatten Zen model buckets into the flat model-config array pi expects. */
function buildZenProviderModels(buckets: ModelBuckets) {
	return [
		...buckets.chat.map(toOpenAICompletionsModelConfig),
		...buckets.responses.map(toOpenAIResponsesModelConfig),
		...buckets.google.map((m) => toStandardModelConfig(m, "google-generative-ai")),
		...buckets.anthropic.map((m) => toStandardModelConfig(m, "anthropic-messages")),
	];
}

/** Flatten Go model buckets (chat + anthropic) into the flat model-config array pi expects. */
function buildGoProviderModels(buckets: ModelBuckets) {
	return [
		...buckets.chat.map(toOpenAICompletionsModelConfig),
		...buckets.anthropic.map((m) => toStandardModelConfig(m, "anthropic-messages")),
	];
}

/** Point provider models to the correct base URL (Anthropic Messages vs everything else). */
function rewriteProviderModelBaseUrls(
	models: Model<Api>[],
	providerId: string,
	defaultBaseUrl: string,
	anthropicBaseUrl: string,
) {
	return models.map((model) => {
		if (model.provider !== providerId) return model;
		return {
			...model,
			baseUrl: model.api === "anthropic-messages" ? anthropicBaseUrl : defaultBaseUrl,
		};
	});
}

/** Register (or re-register) both providers with pi using cached or freshly-fetched data. */
function registerProviders(pi: ExtensionAPI, data: FetchedData) {
	const { zenBuckets, goBuckets } = data;

	// If OPENCODE_API_KEY is set via env var (the built-in approach) and we
	// have Anthropic models that need a different base URL, nudge the user to
	// run /login so the OAuth modifyModels hook rewrites them correctly.
	if (zenBuckets.anthropic.length > 0 && process.env.OPENCODE_API_KEY) {
		console.warn(
			`[pi-opencode] OPENCODE_API_KEY detected with ${zenBuckets.anthropic.length} Anthropic model(s) ` +
			`that need a different base URL. Run /login and select "OpenCode Zen" ` +
			`to store your API key for full Anthropic model support.`,
		);
	}
	if (goBuckets.anthropic.length > 0 && process.env.OPENCODE_API_KEY) {
		console.warn(
			`[pi-opencode] OPENCODE_API_KEY detected with ${goBuckets.anthropic.length} Anthropic model(s) ` +
			`that need a different base URL. Run /login and select "OpenCode Go" ` +
			`to store your API key for full Anthropic model support.`,
		);
	}

	// Register Zen (replaces built-in `opencode` provider models)
	pi.registerProvider(ZEN_PROVIDER_ID, {
		baseUrl: ZEN_V1_BASE_URL,
		models: buildZenProviderModels(zenBuckets),
		oauth: createApiKeyBackedOAuthProvider({
			displayName: "OpenCode Zen",
			promptLabel: "OpenCode Zen",
			modifyModels: (models) =>
				rewriteProviderModelBaseUrls(models, ZEN_PROVIDER_ID, ZEN_V1_BASE_URL, ZEN_ANTHROPIC_BASE_URL),
		}),
	});

	// Register Go
	pi.registerProvider(GO_PROVIDER_ID, {
		baseUrl: GO_V1_BASE_URL,
		models: buildGoProviderModels(goBuckets),
		oauth: createApiKeyBackedOAuthProvider({
			displayName: "OpenCode Go",
			promptLabel: "OpenCode Go",
			modifyModels: (models) =>
				rewriteProviderModelBaseUrls(models, GO_PROVIDER_ID, GO_V1_BASE_URL, GO_ANTHROPIC_BASE_URL),
		}),
	});
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

/**
 * pi extension entry point.
 *
 * On first load: fetches models.dev metadata and official /models endpoints,
 * caches the result, and registers both providers.
 *
 * On subsequent loads: reads from the on-disk cache to skip network calls.
 *
 * Run `/pi-opencode-provider:fetch-models` at any time to re-fetch and update
 * the provider model lists.
 */
export default async function (pi: ExtensionAPI) {
	// --- 1. Load model data (cache first, network fallback) ---
	const cached = readModelCache();

	if (cached) {
		console.log(
			`[pi-opencode] Using cached model data from ${new Date(cached.cachedAt).toISOString()}. ` +
			`Run /pi-opencode-provider:fetch-models to refresh.`,
		);
		registerProviders(pi, {
			modelsDev: cached.modelsDev,
			zenBuckets: cached.zenBuckets,
			goBuckets: cached.goBuckets,
		});
	} else {
		console.log("[pi-opencode] No cache found; fetching model data from network…");
		const data = await fetchModelData();
		writeModelCache({
			cachedAt: Date.now(),
			modelsDev: data.modelsDev,
			zenBuckets: data.zenBuckets,
			goBuckets: data.goBuckets,
		});
		registerProviders(pi, data);
	}

	// --- 2. Register /pi-opencode-provider:fetch-models command ---
	pi.registerCommand("pi-opencode-provider:fetch-models", {
		description: "Re-fetch OpenCode model list from network and update providers",

		async handler(_args, ctx) {
			ctx.ui.notify("Fetching OpenCode models…", "info");

			try {
				const data = await fetchModelData();

				writeModelCache({
					cachedAt: Date.now(),
					modelsDev: data.modelsDev,
					zenBuckets: data.zenBuckets,
					goBuckets: data.goBuckets,
				});

				registerProviders(pi, data);

				ctx.ui.notify(
					`OpenCode models updated (${data.zenBuckets.chat.length + data.zenBuckets.responses.length + data.zenBuckets.google.length + data.zenBuckets.anthropic.length} Zen, ${data.goBuckets.chat.length + data.goBuckets.anthropic.length} Go). Use /model to select.`,
					"info",
				);
			} catch (error) {
				ctx.ui.notify(`Failed to update OpenCode models: ${error}`, "error");
			}
		},
	});
}
