# Better YouTube Chat

A Chrome extension (Svelte 5 + [WXT](https://wxt.dev)) that replaces the message list of YouTube live chat
with a custom one. YouTube's own header, ticker, pinned message and input box stay as they are.

- Looks like YouTube's chat and follows its light/dark theme (uses YouTube's own CSS variables).
- Context menu on ⋮, right-click (Shift+right-click for the browser menu) or clicking a name:
  - **Go to channel**, for everyone (Ctrl/middle-click opens in a new tab)
  - **Mention**: inserts `@name` into the chat input
  - **Copy message**
  - YouTube's own items (Report, Block, and moderator actions), run through YouTube's own UI
- Handles deleted/retracted messages, the viewer leaderboard chips and mention highlighting.
- Not yet: superchats, stickers, memberships, gifts (YouTube's ticker still shows them).

## Develop

```sh
pnpm install
pnpm dev      # builds to .output/chrome-mv3-dev and rebuilds on change
```

Load it once in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
choose `.output/chrome-mv3-dev`. Reload the YouTube tab after the extension reloads.

```sh
pnpm check    # svelte-check / TypeScript
pnpm build    # production build in .output/chrome-mv3
```

### Comparing with YouTube's own list
Press **Alt+Shift+N** in the chat to switch between our list and YouTube's native one (it keeps
rendering hidden behind ours). Page CSS can't do this, because the shadow root's
`:host { all: initial !important }` wins over it. While hidden, YouTube's list may hold back *new*
messages, so compare the existing ones.

### Capturing fixtures
In dev builds the page bridge keeps the last 300 raw `get_live_chat` responses. In DevTools, switch
the console's context to the `live_chat` frame and run `copy(JSON.stringify(__bytcLog))`.

## How it works
See [RESEARCH.md](./RESEARCH.md).

- `src/entrypoints/page-bridge.content.ts`: MAIN world, `document_start`, in the `live_chat` frame.
  It wraps `fetch` to forward `get_live_chat` responses, and serves RPCs that need the page itself:
  loading a message's context menu (`get_item_context_menu`), running a native menu item through
  YouTube's own `ytd-menu-*-item-renderer` element, and in-app navigation of the top frame.
- `src/entrypoints/chat.content/`: ISOLATED world. It mounts the Svelte app in a shadow root inside
  `#item-list` and hides YouTube's `yt-live-chat-item-list-renderer`. That list comes back if our UI is removed.
- `src/lib/chat/`: payload parsing, the normalized model and the store.
