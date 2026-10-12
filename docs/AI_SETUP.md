# Optional live AI setup

The extension works without an account or API key in **Curated demo** mode. That mode selects from a small, prepared vocabulary set using sentence cues, the selected level and goal, and feedback rules. It makes no model call. Its conversation tab supplies clearly labelled fixed practice prompts; it does not assess a learner's reply. CEFR labels are provisional demonstration labels.

**Live AI** is an optional connection to a model provider you choose. No provider, model or paid account is preselected. The gateway implements the common Chat Completions HTTP shape (`/chat/completions`); it is not a promise that every provider or model supports that format. It requires a provider that accepts a `messages` array, `temperature`, `max_tokens`, and returns text in `choices[0].message.content`. Vocabulary selection also requests JSON output. Provider charges and retention policies depend on the account you configure.

## Start the gateway

Use Node.js 20 or newer. There are no additional gateway packages to install. In a terminal, change to this demo's folder, then set your chosen provider's details. Replace the example values; the example address is deliberately not a real service.

```sh
export LINGOSPROUT_BASE_URL="https://YOUR-PROVIDER.example/v1"
export LINGOSPROUT_MODEL="YOUR-MODEL-NAME"
```

Enter the key without placing its value in the command history. Run the next line, paste the key, then press Enter; input is hidden.

```sh
read -r -s LINGOSPROUT_API_KEY
export LINGOSPROUT_API_KEY
```

If using the Chrome extension, open `chrome://extensions`, find the unpacked LingoSprout extension, and copy its 32-letter ID. Set it as follows, then start the gateway:

```sh
export LINGOSPROUT_EXTENSION_ID="YOUR-32-LETTER-EXTENSION-ID"
node gateway/server.mjs
```

Keep this terminal open. The gateway listens on `http://127.0.0.1:8765`. Open `/health` at that address to see whether configuration is present. This checks configuration shape only; it does not call or authenticate with the provider. In the extension, select **Live AI** in Settings, then explicitly activate the current reading page. In the standalone preview, use its live-mode controls. The preview origin `http://127.0.0.1:8766` is explicitly allowed.

If the provider supports Chat Completions but does not accept `response_format`, restart with `LINGOSPROUT_JSON_MODE=off` in the environment. The model must still return the required JSON structure; output is validated in both gateway and client. Some models also use different token or sampling parameters and are not compatible without a gateway change. A rejected request produces a visible error; it never silently switches to prepared demo output.

Stop the gateway with Ctrl+C. Remove the key from the terminal environment when finished:

```sh
unset LINGOSPROUT_API_KEY
```

## What is sent and stored

- **Curated demo:** no model request. Reading selection and review rules run locally.
- **Live reading request:** up to 50 numbered sentences, no more than 20,000 characters in total; the language pair, provisional level, goal and replacement cap; and up to 100 compact records for that language pair containing words, senses and learning-feedback flags. The gateway forwards these to the configured provider. The client does not attach page URLs, browser history, stored page contexts, cookies or account credentials.
- **Live conversation request:** the last 12 user/assistant messages, each capped at 1,200 characters, plus the same minimal learning settings and vocabulary profile. Conversation contents therefore leave the browser in live mode.
- **Local learning data:** revealing a word records word/sense metadata without storing its page sentence or adding a review card. **Save word** stores the chosen sentence and contextual explanation locally. Known and reported-error flags suppress the same sense; recall ratings change review dates, not mastery status. Explicit demo seeds are labelled and do not overwrite existing records.
- **Gateway:** reads the provider key from its process environment. It does not write request bodies, page text or replies to files and does not log them. The hosted provider's handling is governed by that provider. The key is not saved in extension settings or returned to the browser.

The gateway binds only to loopback, validates the Host header, and permits exact browser origins rather than wildcard CORS. JSON requests require `X-LingoSprout-Client: v4`. Origin-less requests from the local extension service worker or a local command-line client are accepted with that header; this is a local development gateway, not a multi-user authenticated service. Do not expose its port through a tunnel or deploy it as a public backend. HTTP is used only on the local loopback hop; the configured model provider must use HTTPS.

## Checks and limits

From the demo folder:

```sh
node --test tests/core.test.js
```

The core tests exercise both bank senses; reveal/save separation; same-sense suppression; locked versus adaptive density; review scheduling; exact spans, overlaps, provisional-level ceilings and article caps; Slovak/Thai examples; profile minimisation; and gateway CORS, validation and error paths. Gateway tests use a local HTTP server and a fake provider; they do not send content or credentials to an external service and incur no model charges. A sandbox that prevents local network listeners will reject those HTTP tests until loopback networking is permitted.

This prototype uses a small curated lexicon and conservative selection rules. It does not perform a full named-entity or idiom analysis. The live path validates response structure and source spans, but that cannot establish semantic translation accuracy or calibrated CEFR difficulty. Review scheduling is a simple local rule, not a validated adaptive learning model. Provider connectivity, response quality, and Chrome's installed-extension permission flow must be checked with the chosen configuration before demonstrating live AI.
