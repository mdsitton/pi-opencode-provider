/**
 * Model-configuration transformers — convert a resolved ModelDef into
 * the shape pi expects for each API family.
 */

import type { Modality, ModelDef } from "./types.js";
import { OAI_COMPAT } from "./constants.js";

/** Return per-model compat overrides (e.g. DeepSeek thinking format). */
export function getOpenAICompatForModel(modelId: string) {
	if (modelId.startsWith("deepseek-v4")) {
		return {
			...OAI_COMPAT,
			thinkingFormat: "deepseek" as const,
			requiresReasoningContentOnAssistantMessages: true,
		};
	}
	return OAI_COMPAT;
}

/** Build an `openai-completions` model config from a resolved {@link ModelDef}. */
export function toOpenAICompletionsModelConfig(m: ModelDef) {
	return {
		id: m.id,
		name: m.name,
		api: "openai-completions" as const,
		reasoning: m.reasoning,
		input: [...m.input] as Modality[],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: m.contextWindow,
		maxTokens: m.maxTokens,
		compat: getOpenAICompatForModel(m.id),
	};
}

/** Build an `openai-responses` model config from a resolved {@link ModelDef}. */
export function toOpenAIResponsesModelConfig(m: ModelDef) {
	return {
		id: m.id,
		name: m.name,
		api: "openai-responses" as const,
		reasoning: m.reasoning,
		input: [...m.input] as Modality[],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: m.contextWindow,
		maxTokens: m.maxTokens,
	};
}

/** Build a Google Gen AI or Anthropic Messages model config from a resolved {@link ModelDef}. */
export function toStandardModelConfig(
	m: ModelDef,
	api: "google-generative-ai" | "anthropic-messages",
) {
	return {
		id: m.id,
		name: m.name,
		api,
		reasoning: m.reasoning,
		input: [...m.input] as Modality[],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: m.contextWindow,
		maxTokens: m.maxTokens,
	};
}
