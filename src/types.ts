/** Shared types for the OpenCode provider. */

export type Modality = "text" | "image";
export type Transport = "chat" | "responses" | "google" | "anthropic";

export interface ModelDef {
	id: string;
	name: string;
	reasoning: boolean;
	input: readonly Modality[];
	contextWindow: number;
	maxTokens: number;
}

/** Buckets keyed by API transport. */
export type ModelBuckets = Record<Transport, ModelDef[]>;

export interface OpenCodeModelListEntry {
	id?: string;
	name?: string;
}

export interface OpenCodeModelListResponse {
	data?: OpenCodeModelListEntry[];
}

export interface ModelsDevLimit {
	context?: number;
	output?: number;
}

export interface ModelsDevModalities {
	input?: readonly string[];
}

export interface ModelsDevModelEntry {
	id?: string;
	name?: string;
	reasoning?: boolean;
	limit?: ModelsDevLimit;
	modalities?: ModelsDevModalities;
}

export interface ModelsDevProviderEntry {
	models?: Record<string, ModelsDevModelEntry>;
}

export type ModelsDevResponse = Record<string, ModelsDevProviderEntry>;
