# pi-opencode-provider

**Warning: I built this entire extension before realizing pi already has built-in OpenCode support. I am apparently blind. This extension is not strictly required.**

## So why does this exist?

The built-in OpenCode models are statically generated at pi build time from [models.dev](https://models.dev). When OpenCode adds a new model, you have to wait for a pi release to see it.

This extension does **runtime model discovery** instead:

1. Fetches OpenCode's official `/models` endpoints directly at startup
2. Merges metadata from `models.dev` (context windows, pricing, reasoning support)
3. Registers the freshest model list with pi

New models show up without waiting for a pi release. Even if `models.dev` hasn't been updated yet, the extension fetches directly from OpenCode's API — new models are available immediately with best-effort default parameters (128k context, 16k max output).

## Providers

This extension registers two providers that replace the built-in ones:

- `opencode` — replaces the built-in `opencode` (OpenCode Zen)
- `opencode-go` — replaces the built-in `opencode-go` (OpenCode Go)

## Installation

```bash
pi install pi-opencode-provider
```

## Configure pi

Run `/login`, choose **Use a subscription**, select **OpenCode Zen** or **OpenCode Go**, and paste your API key when prompted. Then run `/model` to pick a model.

### Migrating from the built-in providers

If you previously used OpenCode with pi's built-in support (via `OPENCODE_API_KEY` env var or `auth.json`), **you still need to run `/login` at least once.** The extension registers an OAuth-based provider that rewrites per-model base URLs for Anthropic models — this only takes effect once your API key is stored through the `/login` flow.

## Provider behavior

### OpenCode Zen

Zen models are mapped automatically to the correct backend API:

- OpenAI Chat Completions
- OpenAI Responses
- Anthropic Messages
- Google Generative AI

### OpenCode Go

Go models are exposed through the OpenAI-compatible chat completions API.

## Model discovery

On startup, the extension:

1. Fetches the official model list from OpenCode's `/models` endpoint
2. Merges in metadata from `models.dev`
3. Registers the resolved models with pi, replacing the built-in ones

If the OpenCode model endpoint is unavailable, the extension falls back to `models.dev`. If metadata is still unavailable, conservative defaults (128k context, 16k max tokens) are used.

## Development

```bash
npm install
npm run typecheck
```

## License

MIT. See [LICENSE](./LICENSE).
