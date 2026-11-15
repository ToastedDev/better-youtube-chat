# Better YouTube Chat

A Chrome extension (Svelte 5 + [WXT](https://wxt.dev)) that replaces the message list of YouTube live chat
with a custom one. YouTube's own header, ticker, pinned message and input box stay as they are.

- Looks like YouTube's chat and follows its light/dark theme (uses YouTube's own CSS variables).
- Context menu on ⋮, right-click (Shift+right-click for the browser menu) or clicking a name, in the
  list and on the pinned message:
  - **Go to channel**, for everyone (Ctrl/middle-click opens in a new tab)
  - **Mention**: inserts `@name` into the chat input
  - **Copy message**
  - YouTube's own items (Report, Block, and moderator actions), run through YouTube's own UI
- Handles deleted/retracted messages, the viewer leaderboard chips and mention highlighting.
- Your own messages show up as soon as you send them, like YouTube.
- The chat menu's **Timestamps** toggle for everyone, not only moderators.
- A **Better YouTube Chat** switch at the top of the chat menu (⋮ in the chat header) goes back to
  YouTube's own message list and remembers the choice. Alt+Shift+N does the same.
- For moderators: messages AutoMod held for review, with YouTube's Show / Hide buttons.
- Super Chats, Super Stickers, new members, milestones, gifted memberships, Jewels gifts and
  fundraiser donations. YouTube's ticker, banners and gift animations stay native.
- Super Chat Like / Reply buttons with live counts. Reply (and the "@name" chip on replies) opens
  YouTube's own reply thread dialog.
- Chat replay on past streams, in sync with the video (including seeks); timestamps show the video
  time.

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
Turn off **Better YouTube Chat** in the chat menu, or press **Alt+Shift+N**, to switch between our
list and YouTube's native one (it keeps rendering hidden behind ours, so switching is instant). The
choice is saved in localStorage (`better-yt-chat::native-list`). Page CSS can't do this, because the shadow root's
`:host { all: initial !important }` wins over it. While hidden, YouTube's list may hold back *new*
messages, so compare the existing ones.

### Capturing fixtures
In dev builds the page bridge keeps the initial history (marked `initial: true`) and the last 300 raw
`get_live_chat` responses. In DevTools, switch the console's context to the `live_chat` frame and run
`copy(JSON.stringify(__bytcLog))`.

To try item types a stream doesn't have, feed made-up actions to the UI from the same console:
`__bytcInject([{ addChatItemAction: { item: { liveChatPaidStickerRenderer: {...} } } }])`.

## How it works
See [RESEARCH.md](./RESEARCH.md).

- `src/entrypoints/page-bridge.content.ts`: MAIN world, `document_start`, in the `live_chat` frame.
  It wraps `fetch` to forward `get_live_chat` responses, and serves RPCs that need the page itself:
  loading a message's context menu (`get_item_context_menu`), running a native menu item through
  YouTube's own `ytd-menu-*-item-renderer` element, and in-app navigation of the top frame.
- `src/entrypoints/chat.content/`: ISOLATED world. It mounts the Svelte app in a shadow root inside
  `#item-list` and hides YouTube's `yt-live-chat-item-list-renderer`. That list comes back if our UI is removed.
- `src/lib/chat/`: payload parsing, the normalized model and the store.
