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
 * - **opencode-go**  — All Go models (Chat Completions) — *replaces the built-in `opencode-go` provider*
 *
 * ## Model discovery
 * The provider merges data from three sources:
 * - The official `/models` endpoints — authoritative for which models belong to each provider
 * - The official docs — authoritative for API transport mapping (chat, responses, google, anthropic)
 * - [models.dev](https://models.dev) — context window, output limit, reasoning, and modalities
 *
 * Missing metadata falls back to 128k context / 16k max tokens.
 *
 * ## Docs
 * - https://opencode.ai/docs/zen/
 * - https://opencode.ai/docs/go/
 *
 * If you notice a discrepancy between the docs and `/models` responses, please file an issue or PR!
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { Api, Model } from "@mariozechner/pi-ai";

import {
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
import type { ModelBuckets } from "./types.js";

/** Flatten Zen model buckets into the flat model-config array pi expects. */
function buildZenProviderModels(buckets: ModelBuckets) {
	return [
		...buckets.chat.map(toOpenAICompletionsModelConfig),
		...buckets.responses.map(toOpenAIResponsesModelConfig),
		...buckets.google.map((m) => toStandardModelConfig(m, "google-generative-ai")),
		...buckets.anthropic.map((m) => toStandardModelConfig(m, "anthropic-messages")),
	];
}

/** Flatten Go model buckets (chat-only) into the flat model-config array pi expects. */
function buildGoProviderModels(buckets: ModelBuckets) {
	return buckets.chat.map(toOpenAICompletionsModelConfig);
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

/**
 * pi extension entry point.
 *
 * Pre-fetches models.dev metadata once, discovers Zen and Go models in
 * parallel, then registers both providers with pi.
 */
export default async function (pi: ExtensionAPI) {
	// Pre-fetch models.dev metadata once for both providers
	let modelsDev;
	try {
		modelsDev = await fetchModelsDevMetadata();
	} catch (error) {
		console.warn(`[pi-opencode] Failed to fetch models.dev metadata from ${MODELS_DEV_ENDPOINT}.`, error);
	}

	// Discover Zen and Go models in parallel
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
		}),
	});
}
