# SMAC Extension

SMAC is a Chrome extension that adds an AI writing assistant directly into LinkedIn and X. It injects context-aware buttons into feed posts, profile pages, and message threads so you can generate polished comments, outreach messages, and replies without leaving the page.

SMAC supports two backend modes:

- Local mode with Ollama and any model you have already pulled
- Remote mode with an API key, model name, and HTTPS endpoint

The extension is designed for a professional workflow:

- It generates text only when you explicitly click a SMAC button
- It shows an intent picker before every generation
- It copies the final result to your clipboard instead of auto-posting
- It keeps local-mode data on your machine when using Ollama

## What SMAC Does

SMAC works in three page contexts:

| Context | Button | Output |
| --- | --- | --- |
| LinkedIn or X feed post | `SMAC It` | A professional comment for the selected post |
| LinkedIn or X profile page | `SMAC Profile` | A personalized outreach opener |
| LinkedIn or X message thread | `SMAC Reply` | A context-aware reply or conversation starter |

Each generation flow follows the same pattern:

1. SMAC detects the current page type.
2. It injects the appropriate button into the page.
3. You click the button and choose an intent in the modal.
4. SMAC captures the relevant page context.
5. It sends the prompt to either Ollama or a remote API.
6. The generated text is copied to your clipboard.

## Core Features

- LinkedIn and X support
- Post comments, profile outreach, and DM replies
- Intent-based generation for each context
- Local Ollama support with user-specified model names
- Remote API support for OpenAI-compatible endpoints and Gemini
- Post screenshot capture with text-only fallback if screenshot capture fails
- AES-GCM encrypted API key storage
- Clipboard-first workflow with no auto-posting
- Closed Shadow DOM intent modal to avoid host-page style bleed

## How It Works

### 1. Page Detection and Button Injection

The content script watches supported LinkedIn and X routes and injects buttons into the page:

- Feed pages receive one `SMAC It` button per post
- Profile pages receive a floating `SMAC Profile` button
- Message pages receive a floating `SMAC Reply` button

SMAC also handles SPA navigation, so moving between feed, profile, and messaging routes updates the injected UI without requiring a full page reload.

### 2. Context Capture

SMAC gathers different inputs based on where you use it:

- Post mode captures post text, author, hashtags, image alt text, and post coordinates for screenshot cropping
- Profile mode captures visible profile text such as name, headline, bio/about, experience, and recent posts
- Message mode builds a simplified conversation transcript from the visible thread

For post generation, the background worker attempts to capture a screenshot of the selected post. If screenshot capture fails, SMAC continues with text-only generation.

### 3. Intent Selection

Before generating text, SMAC opens a lightweight modal with context-specific intent options.

Examples:

- Post mode: congratulate, add insight, ask a thoughtful question, respectfully disagree
- Profile mode: connection request, collaborate, freelance pitch, shared interest
- Message mode: natural reply, formal reply, follow-up, meeting suggestion

If the message thread is empty, SMAC switches to new-conversation intents instead of reply intents.

### 4. AI Backend Selection

SMAC supports two backends:

- Local mode calls Ollama at `http://localhost:11434/api/generate`
- Remote mode calls an HTTPS endpoint using your encrypted API key

The selected backend is configured in the extension popup and stored in `chrome.storage.local`.

## Backend Modes

## Local Mode with Ollama

Local mode is ideal if you want maximum privacy and a local-only workflow.

### Requirements

- Ollama installed and available on your machine
- A pulled model, for example `gemma3:4b`, `llava-phi3:latest`, or `mistral:7b`
- Ollama started with `OLLAMA_ORIGINS="*"` so the Chrome extension can connect

### Start Ollama for SMAC

Use the included helper script:

```bash
./start-smac.sh
```

What the script does:

- Stops any existing `ollama serve` process
- Restarts Ollama on `127.0.0.1:11434`
- Sets `OLLAMA_ORIGINS="*"`
- Verifies the endpoint and CORS response

If the script succeeds, you should see a message confirming that Ollama is running and ready for SMAC.

### Pull a Model

Example:

```bash
ollama pull gemma3:4b
```

You can confirm your available local models with:

```bash
ollama list
```

### Configure Local Mode in the Popup

1. Open the SMAC extension popup.
2. Select the `Local` tab.
3. Confirm the Ollama status shows `Online`.
4. Enter the exact model name you pulled.
5. Click `Save Configuration`.
6. Toggle the extension to `Active`.

Important notes:

- The local model field is intentionally blank until you configure it
- SMAC will show an inline validation error if you try to save without a model name
- If you enter a model that is not installed, Ollama returns an actionable error

### Screenshot Support in Local Mode

When you use post mode, SMAC tries to attach a cropped screenshot of the selected post.

- If your local model supports vision, the image is included
- If your model does not support vision or screenshot capture fails, SMAC falls back to text-only generation

## Remote API Mode

Remote mode is ideal if you want to use OpenAI, Gemini, or another compatible hosted model provider.

### Requirements

- A valid API key
- A model name
- A full HTTPS endpoint

### Supported Remote Patterns

SMAC supports:

- OpenAI-compatible chat completion endpoints
- Gemini native `generateContent` endpoints

Example endpoints:

```text
https://api.openai.com/v1/chat/completions
https://generativelanguage.googleapis.com/v1beta
```

Example model names:

```text
gpt-4o
gpt-4o-mini
gemini-1.5-flash
gemini-1.5-pro
```

### Configure Remote Mode in the Popup

1. Open the SMAC extension popup.
2. Select the `Remote` tab.
3. Enter your API key.
4. Enter the HTTPS endpoint.
5. Enter the model name.
6. Click `Save Configuration`.
7. Toggle the extension to `Active`.

Important notes:

- Non-HTTPS endpoints are rejected before the call is made
- API keys are encrypted before being stored
- The saved API key is hidden after save
- You can remove the saved key at any time with `Clear Key`

### Remote Data Flow

When using remote mode, the content required for generation is sent to the configured provider. In post mode, that can include a base64 screenshot if capture succeeds.

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Extension

```bash
npm run build
```

### 3. Load the Extension in Chrome

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select the `dist` folder generated by the build

### 4. Reload After Code Changes

When you change extension code:

1. Run `npm run build`
2. Go back to `chrome://extensions`
3. Click reload on the SMAC extension card
4. Fully close and reopen LinkedIn or X tabs when testing content-script behavior

## Using the Extension

## Generate a Comment from a Post

1. Navigate to a supported LinkedIn or X feed or post page.
2. Click `SMAC It` on a visible post.
3. Choose an intent from the modal.
4. Wait for generation to complete.
5. Paste the copied comment where you want to use it.

## Generate an Outreach Message from a Profile

1. Open a LinkedIn profile or supported X profile page.
2. Click `SMAC Profile`.
3. Choose an outreach intent.
4. Paste the generated message from your clipboard.

## Generate a Reply in Messages

1. Open a supported LinkedIn or X message thread.
2. Click `SMAC Reply`.
3. Choose a reply style.
4. Paste the copied message into the thread.

If the thread is empty, SMAC switches to opener intents instead of reply intents.

## Security and Privacy

SMAC includes a few important safeguards:

- Remote API keys are stored encrypted with AES-GCM
- Keys are decrypted in memory only when needed for the request
- Keys are never intentionally exposed in the UI after saving
- Post screenshots are used in memory and are not persisted to storage
- The intent modal uses closed Shadow DOM
- Local mode keeps generation on your machine through Ollama

Important distinction:

- Local mode keeps content local to your machine
- Remote mode sends generation content to the API endpoint you configured

## Permissions

The extension requests the following Chrome permissions:

| Permission | Why it is needed |
| --- | --- |
| `storage` | Save activation state, backend settings, model names, and encrypted API key |
| `clipboardWrite` | Copy generated text directly to your clipboard |
| `tabs` | Capture the visible tab for post screenshot support |

## Project Structure

| Path | Purpose |
| --- | --- |
| `src/background/index.js` | Background service worker and generation orchestration |
| `src/background/backends/ollama.js` | Local Ollama backend integration |
| `src/background/backends/remote.js` | Remote API integration |
| `src/background/crypto.js` | API key encryption and decryption |
| `src/background/screenshot.js` | Visible-tab capture and cropping |
| `src/content/index.js` | Page detection, SPA handling, and button injection |
| `src/content/modal.js` | Intent selection modal |
| `src/content/modes/post.js` | Post-mode extraction and generation trigger |
| `src/content/modes/profile.js` | Profile-mode extraction and generation trigger |
| `src/content/modes/message.js` | Message-mode extraction and generation trigger |
| `src/utils/dom.js` | Platform selectors and route detection helpers |
| `src/App.tsx` | Extension popup UI |
| `start-smac.sh` | Ollama startup helper for local mode |

## Development

Available scripts:

```bash
npm run build
npm run lint
npm run dev
npm run preview
```

Recommended workflow during development:

1. Make changes.
2. Run `npm run lint`.
3. Run `npm run build`.
4. Reload the extension in Chrome.
5. Reopen test tabs for LinkedIn or X when validating content-script behavior.

## Troubleshooting

## No SMAC Buttons Appear

Check the following:

- The extension is toggled to `Active`
- You are on a supported LinkedIn or X route
- The extension was reloaded after the latest build
- The page was fully reopened after the reload

## Ollama Shows Offline

Run:

```bash
./start-smac.sh
```

Then reopen the popup and confirm the status changes to `Online`.

## Ollama Returns a Model Error

Confirm that:

- The model name in the popup exactly matches the output of `ollama list`
- The model is already pulled locally

If needed:

```bash
ollama pull your-model-name
```

## Remote API Call Fails

Double-check:

- The endpoint uses `https://`
- The API key is valid
- The model name is correct for that provider
- Your account has quota and access to that model

## Clipboard Copy Works but the Response Looks Weak

This usually means one of the following:

- The visible page content is sparse or not fully loaded
- The current selectors do not match the latest site DOM
- The chosen model is too small for the task
- The thread or profile page does not provide enough context

## Selector Drift on LinkedIn or X

These platforms change their DOM regularly. If button injection or text capture stops working:

1. Inspect the live page DOM in DevTools
2. Compare the current selectors with `src/utils/dom.js`
3. Update the fallback selector lists
4. Rebuild and reload the extension

## Product Boundaries

SMAC intentionally does not:

- Auto-submit comments or messages
- Auto-fill message boxes by default
- Support Instagram, Facebook, Threads, or other platforms
- Fine-tune or train models
- Sync settings across devices

## Summary

SMAC is built for a practical writing workflow inside LinkedIn and X:

- Use Ollama for a local-first setup
- Use remote APIs when you need hosted models
- Generate comments, outreach, and replies from the page you are already viewing
- Keep the human in the loop by reviewing and pasting every generated result yourself
