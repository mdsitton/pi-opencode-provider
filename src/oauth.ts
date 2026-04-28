/**
 * Pseudo-OAuth helpers — treat a plain API key as an OAuth credential
 * so it slots into pi's subscription-based login flow.
 */

import type { Api, Model, OAuthCredentials, OAuthLoginCallbacks } from "@mariozechner/pi-ai";
import { PSEUDO_OAUTH_EXPIRY_MS } from "./constants.js";

/** Wrap a plain API key into an {@link OAuthCredentials} shape with a distant expiry. */
export function createPseudoOAuthCredentials(apiKey: string): OAuthCredentials {
	return {
		access: apiKey,
		refresh: apiKey,
		expires: Date.now() + PSEUDO_OAUTH_EXPIRY_MS,
	};
}

/** Extract and validate the API key stored inside pseudo-OAuth credentials. */
export function getPseudoOAuthApiKey(credentials: OAuthCredentials): string {
	if (typeof credentials.access !== "string" || credentials.access.trim().length === 0) {
		throw new Error("Stored OpenCode credentials are missing the API key. Please /login again.");
	}
	return credentials.access.trim();
}

/** Build an OAuth provider object that prompts for an API key instead of doing a real OAuth flow. */
export function createApiKeyBackedOAuthProvider(options: {
	displayName: string;
	promptLabel: string;
	modifyModels?: (models: Model<Api>[]) => Model<Api>[];
}) {
	return {
		name: options.displayName,

		async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
			const apiKey = (
				await callbacks.onPrompt({ message: `Paste your ${options.promptLabel} API key:` })
			).trim();
			if (!apiKey) {
				throw new Error("API key cannot be empty.");
			}
			return createPseudoOAuthCredentials(apiKey);
		},

		async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
			return createPseudoOAuthCredentials(getPseudoOAuthApiKey(credentials));
		},

		getApiKey(credentials: OAuthCredentials): string {
			return getPseudoOAuthApiKey(credentials);
		},

		...(options.modifyModels
			? {
					modifyModels(models: Model<Api>[], _credentials: OAuthCredentials) {
						return options.modifyModels!(models);
					},
				}
			: {}),
	};
}
