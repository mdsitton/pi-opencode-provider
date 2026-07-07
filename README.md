# pi-opencode-provider

**Warning: I built this entire extension before realizing pi already has built-in OpenCode support. I am apparently blind. This extension is not strictly required.**

## So why does this exist?

The built-in OpenCode models are statically generated at pi build time from [models.dev](https://models.dev). When OpenCode adds a new model, you have to wait for a pi release to see it.

This extension does **runtime model discovery** instead:

1. On first load, fetches OpenCode's official `/models` endpoints directly
2. Merges metadata from `models.dev` (context windows, pricing, reasoning support)
3. Caches the result to `~/.pi/opencode-provider/cache.json` — **subsequent startups use the cache with zero network requests**
4. Registers the freshest model list with pi

New models show up without waiting for a pi release. Even if `models.dev` hasn't been updated yet, the extension fetches directly from OpenCode's API — new models are available immediately with best-effort default parameters (128k context, 16k max output).

To refresh the model list at any time, run `/pi-opencode-provider:fetch-models`.

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

Most Go models are exposed through the OpenAI-compatible chat completions API.
The MiniMax and Qwen Plus models, however, override to the Anthropic Messages
API (e.g. `qwen3.7-max`, `qwen3.7-plus`, `minimax-m3`) and are routed there
automatically, the same way Zen handles Claude models.

## Model discovery

### First load (cache miss)

The extension fetches model data from three sources in parallel:

1. Official `/models` endpoint for OpenCode Zen (`https://opencode.ai/zen/v1/models`)
2. Official `/models` endpoint for OpenCode Go (`https://opencode.ai/zen/go/v1/models`)
3. Metadata from `models.dev` (context windows, output limits, reasoning support)

The resolved model data is cached to `~/.pi/opencode-provider/cache.json` for subsequent startups.

### Subsequent startups (cache hit)

Model data is read directly from the local cache — **zero network requests** — making startup near-instant.

### Fallback

If an official `/models` endpoint is unavailable, the extension falls back to `models.dev` membership. If metadata is still missing, conservative defaults (128k context, 16k max tokens) are used.

### Manual refresh

Run the following command in pi at any time to re-fetch the latest model list from the network:

```
/pi-opencode-provider:fetch-models
```

This updates the on-disk cache and re-registers both providers immediately (no `/reload` needed). Run `/model` afterwards to pick a newly added model.

## Development

```bash
npm install
npm run typecheck
```

## License

MIT. See [LICENSE](./LICENSE).
