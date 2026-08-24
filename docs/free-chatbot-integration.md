# free-chatbot Integration Notes

## Verified package interface

The public repository describes `free-chatbot` as an ESM Node.js package with `src/index.js` as its main entry point. The visible README documents version `1.0.2` and the following imports:

```ts
import {
  createPhindChat,
  createDuckDuckGoChat,
  createBlackboxChat,
} from "free-chatbot";
```

Each factory returns a chat client exposing an asynchronous `chat(prompt, options?)` method. The README documents context support for Phind and Blackbox, model selection for Phind and DuckDuckGo, and maximum token control for Blackbox. The adapter must use server-side ESM imports, normalize all provider responses, and shield browser clients from provider details.

The source entry point confirms that it exports exactly `createPhindChat`, `createDuckDuckGoChat`, and `createBlackboxChat`. The inspected Phind provider returns a plain accumulated string from its streamed `data:` events and throws on a non-success HTTP status. The Verbix adapter must therefore treat the upstream result as unstructured text and create its own validated structured result rather than assuming provider JSON.

## Product integration rules

The Verbix `free-chatbot` adapter will preserve original prompt text, serialize the prompt-improvement request through a stable server-side contract, use Phind/DuckDuckGo/Blackbox as a bounded fallback chain, impose application-level deadlines and rate limits, and return a clear unavailable-provider state when no upstream provider responds successfully. Upstream output will be parsed into a structured, editable agent-ready improvement; a text-only response will be handled as a safe fallback rather than treated as a malformed client response.

## Source

- https://github.com/muhiris/free-chatbot
