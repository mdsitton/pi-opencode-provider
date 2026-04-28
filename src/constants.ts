/**
 * Shared constants — URLs, endpoints, provider IDs, model sets,
 * and conservative fallback defaults.
 *
 * Keep the model-ID sets in sync with the official docs:
 *   https://opencode.ai/docs/zen/
 *   https://opencode.ai/docs/go/
 */

import type { Modality } from "./types.js";

/** Default OpenAI-compatible configuration for chat-completion models. */
export const OAI_COMPAT = {
	supportsDeveloperRole: false,
	supportsReasoningEffort: false,
	maxTokensField: "max_tokens" as const,
};

/** Provider ID registered with pi for the Zen tier (matches built-in so we replace it). */
export const ZEN_PROVIDER_ID = "opencode";
/** Provider ID registered with pi for the Go tier. */
export const GO_PROVIDER_ID = "opencode-go";
/** Pseudo-OAuth token lifetime (essentially infinite). */
export const PSEUDO_OAUTH_EXPIRY_MS = 1000 * 60 * 60 * 24 * 365 * 100;

/** Base URL for Zen OpenAI-compatible and Responses endpoints. */
export const ZEN_V1_BASE_URL = "https://opencode.ai/zen/v1";
/** Base URL for Zen Anthropic Messages endpoints. */
export const ZEN_ANTHROPIC_BASE_URL = "https://opencode.ai/zen";
/** Base URL for Go OpenAI-compatible endpoints. */
export const GO_V1_BASE_URL = "https://opencode.ai/zen/go/v1";

/** Official /models endpoint for Zen. */
export const ZEN_MODELS_ENDPOINT = `${ZEN_V1_BASE_URL}/models`;
/** Official /models endpoint for Go. */
export const GO_MODELS_ENDPOINT = `${GO_V1_BASE_URL}/models`;
/** models.dev aggregated metadata endpoint. */
export const MODELS_DEV_ENDPOINT = "https://models.dev/api.json";

/** Maps Zen/Go tiers to their models.dev provider keys. */
export const MODELS_DEV_PROVIDER_ID_BY_KIND = {
	zen: "opencode",
	go: "opencode-go",
} as const;

/** Fallback context window when models.dev metadata is unavailable. */
export const DEFAULT_CONTEXT_WINDOW = 128_000;
/** Fallback max output tokens when models.dev metadata is unavailable. */
export const DEFAULT_MAX_TOKENS = 16_384;
/** Fallback input modalities when models.dev metadata is unavailable. */
export const DEFAULT_MODEL_INPUT: readonly Modality[] = ["text"];

/** Models that use the OpenAI Responses API. */
export const ZEN_RESPONSES_MODEL_IDS = new Set([
	"gpt-5.5",
	"gpt-5.5-pro",
	"gpt-5.4",
	"gpt-5.4-pro",
	"gpt-5.4-mini",
	"gpt-5.4-nano",
	"gpt-5.3-codex",
	"gpt-5.3-codex-spark",
	"gpt-5.2",
	"gpt-5.2-codex",
	"gpt-5.1",
	"gpt-5.1-codex",
	"gpt-5.1-codex-max",
	"gpt-5.1-codex-mini",
	"gpt-5",
	"gpt-5-codex",
	"gpt-5-nano",
]);

/** Models that use the Anthropic Messages API. */
export const ZEN_ANTHROPIC_MODEL_IDS = new Set([
	"claude-opus-4-7",
	"claude-opus-4-6",
	"claude-opus-4-5",
	"claude-opus-4-1",
	"claude-sonnet-4-6",
	"claude-sonnet-4-5",
	"claude-sonnet-4",
	"claude-haiku-4-5",
	"claude-3-5-haiku",
]);

/** Models that use the Google Generative AI endpoints. */
export const ZEN_GOOGLE_MODEL_IDS = new Set(["gemini-3.1-pro", "gemini-3-flash"]);
