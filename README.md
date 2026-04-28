# pi-opencode-provider

`pi-opencode-provider` is a [pi](https://github.com/mariozechner/pi-coding-agent) extension that adds [OpenCode Zen](https://opencode.ai/docs/zen/) and [OpenCode Go](https://opencode.ai/docs/go/) as providers.

It registers two providers automatically:

- `opencode-zen`
- `opencode-go`

## What this extension does

- Adds OpenCode Zen and OpenCode Go to pi's provider list
- Discovers available models from OpenCode's official `/models` endpoints at startup
- Enriches model metadata with data from [models.dev](https://models.dev)
- Routes Zen models to the correct API transport automatically
- Uses pi's subscription login flow to store your OpenCode API key

## Requirements

- pi installed and working

## Installation

```bash
pi install pi-opencode-provider
```

After installation, the providers are available in pi the next time the extension is loaded.

## OpenCode account and API key setup

Before logging in from pi, create or copy an API key from your OpenCode account.

### OpenCode Zen

1. Sign in at [https://opencode.ai/auth](https://opencode.ai/auth)
2. Add your billing details
3. Copy your OpenCode Zen API key

Reference: [OpenCode Zen documentation](https://opencode.ai/docs/zen/)

### OpenCode Go

1. Sign in at [https://opencode.ai/auth](https://opencode.ai/auth)
2. Subscribe to OpenCode Go
3. Copy your OpenCode Go API key

Reference: [OpenCode Go documentation](https://opencode.ai/docs/go/)

## Configure pi

1. Run `/login`
2. Choose **Use a subscription**
3. Select **OpenCode Zen** or **OpenCode Go**
4. Paste your API key when prompted
5. Run `/model` and choose a model

You can run `/login` again at any time to replace the stored key or switch providers.

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

1. Fetches the official model list from OpenCode
2. Merges in metadata from `models.dev`
3. Registers the resolved models with pi

If the OpenCode model endpoint is unavailable, the extension falls back to `models.dev`. If metadata is still unavailable, conservative defaults are used.

## Development

```bash
npm install
npm run typecheck
```

## License

MIT. See [LICENSE](./LICENSE).
