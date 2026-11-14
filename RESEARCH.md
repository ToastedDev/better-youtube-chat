# Better YouTube Chat: research notes

Tested on 2026-11-14 against https://www.youtube.com/watch?v=0bhFagWP_W0 (live, logged-in account, Chrome).

## 1. Where the chat lives on the page

```
youtube.com/watch?v=…                      (SPA, Polymer "ytd-*" elements)
└─ ytd-watch-flexy
   └─ #chat-container
      └─ ytd-live-chat-frame#chat           (header/show-hide button, sizing)
         └─ iframe#chatframe  →  https://www.youtube.com/live_chat?continuation=…
            └─ yt-live-chat-app             (the actual chat UI, "yt-live-chat-*" elements)
```

- The chat iframe is **same-origin** (`www.youtube.com/live_chat`). A content script with
  `all_frames: true` matching `https://www.youtube.com/live_chat*` runs directly inside it.
- The same `/live_chat` page is used for the popout (`/live_chat?v=<id>`), and replays use
  `/live_chat_replay`. Running inside the iframe means one codepath covers inline,
  theater mode and popout, and YouTube keeps handling the frame's size and its show/hide button.
- **Verified:** setting `yt-live-chat-app { display:none }` and adding our own root element in the
  iframe works. YouTube keeps polling for new messages in the background, so data keeps arriving.

## 2. Getting the data

### Transport
- The iframe's `ytInitialData.continuationContents.liveChatContinuation` has the header, view
  selector (Top chat / Live chat), input panel, 164 custom + standard emojis, and the participants list.
  **It has no messages.**
- Messages come from `POST /youtubei/v1/live_chat/get_live_chat` (called with `fetch` and a
  `Request` object). The first response includes the history (about 75 actions). Later responses
  have only the new actions, or none.
- The continuation type is `invalidationContinuationData` (`timeoutMs: 3000`): a push signal
  (topic `chat~<videoId>`) tells YouTube when to fetch. That's why the request rate varies.

### Recommended approach: intercept, don't re-poll
Inject a **MAIN-world** script at `document_start` in the `live_chat` frame and wrap
`window.fetch` (and `XMLHttpRequest` as a fallback). Clone each `get_live_chat*` response
and forward its `actions` to our UI. YouTube then keeps doing auth, continuation tokens,
invalidation, Top chat/Live chat switching and reconnects. Verified working.

Also read `window.ytInitialData` once for header, emojis, input panel and so on.

Fallback, if we ever drop the native iframe: poll `get_live_chat` ourselves using
`ytcfg.data_` (`INNERTUBE_CONTEXT`, `INNERTUBE_CLIENT_VERSION`) and the continuation from
`ytInitialData`.

### Action types
Seen in this stream:
| action | notes |
|---|---|
| `addChatItemAction.item.liveChatTextMessageRenderer` | normal message |
| `addChatItemAction.item.liveChatViewerEngagementMessageRenderer` | "Welcome to live chat…" |
| `addBannerToLiveChatCommand.bannerRenderer.liveChatBannerRenderer` | pinned message ("Pinned by @chMDM") |
| `removeChatItemAction` | message removed by mod |

Not present in this stream, but part of the known YouTube schema. **Verify these against a stream with superchats:**
`liveChatPaidMessageRenderer` (superchat), `liveChatPaidStickerRenderer`,
`liveChatMembershipItemRenderer`, `liveChatSponsorshipsGiftPurchaseAnnouncementRenderer`,
`liveChatSponsorshipsGiftRedemptionAnnouncementRenderer`, `liveChatModeChangeMessageRenderer`,
`liveChatPlaceholderItemRenderer`, `addLiveChatTickerItemAction` (the ticker row of superchats/members),
`markChatItemAsDeletedAction`, `markChatItemsByAuthorAsDeletedAction`, `removeChatItemByAuthorAction`,
`replaceChatItemAction`, `removeBannerForLiveChatCommand`, `updateLiveChatPollAction`,
`showLiveChatTooltipCommand`, `closeLiveChatActionPanelAction`. For replays, actions are wrapped in
`replayChatItemAction { actions[], videoOffsetTimeMsec }`.

### `liveChatTextMessageRenderer` shape (real sample)
```jsonc
{
  "id": "ChwKGkNQYnpwcjJ0aDVnREZkOFZkZ1lkbG1jZExB",
  "timestampUsec": "1794655702859851",
  "authorName": { "simpleText": "@shark0922-l1t" },
  "authorExternalChannelId": "UC9JWbfwnro6S2dZ0-DwMRqQ",      // ← "Go to channel"
  "authorPhoto": { "thumbnails": [{ "url": "https://yt4.ggpht.com/…=s32-…", "width": 32 }, { "…s64…" }] },
  "authorBadges": [{ "liveChatAuthorBadgeRenderer": {
      "customThumbnail": { "thumbnails": [/* member badge 16/32px */] },   // members: custom image
      "icon": { "iconType": "VERIFIED" | "MODERATOR" | "OWNER" },          // others: icon type
      "tooltip": "Member (6 months)" } }],
  "message": { "runs": [
      { "text": "hi" },
      { "emoji": { "emojiId": "✅", "shortcuts": [":check_mark_button:"], "isCustomEmoji": false,
                   "image": { "thumbnails": [...], "accessibility": {...} } } }
  ] },
  "contextMenuEndpoint": { "liveChatItemContextMenuEndpoint": { "params": "<base64>" } },
  "contextMenuAccessibility": { "accessibilityData": { "label": "Chat actions" } }
}
```
Run types seen were `text` and `emoji`. Links show up as `text` + `navigationEndpoint`, and
bold/italic as flags on the run.

## 3. Context menu

- The native menu is loaded per message when opened:
  `POST /youtubei/v1/live_chat/get_item_context_menu?params=<contextMenuEndpoint params>`.
- For a regular viewer (verified) it returns `menuRenderer.items`:
  - `menuServiceItemRenderer` "Report" → `getReportFormEndpoint` (`apiUrl: /youtubei/v1/flag/get_form`)
  - `menuNavigationItemRenderer` "Block" → `confirmDialogEndpoint` → (moderate endpoint)
  
  Mods/owners get more items (remove, timeout, hide user). These have the same shape and different endpoints.
- **Verified:** we can call it ourselves from the youtube.com origin and get 200 + the same items. Required headers:
  `authorization: SAPISIDHASH <ts>_<sha1(ts SAPISID origin)> SAPISID1PHASH … SAPISID3PHASH …`
  (built from the `SAPISID`, `__Secure-1PAPISID` and `__Secure-3PAPISID` cookies), `x-goog-authuser`,
  `x-origin`, `x-youtube-client-name`, `x-youtube-client-version`, body `{ context: ytcfg.INNERTUBE_CONTEXT }`.
  YouTube also gzips the request body (`content-encoding: gzip`), but plain JSON is accepted.
- Plan: render YouTube's items generically (text + icon + endpoint) and add our own items:
  **Go to channel** (`/channel/<authorExternalChannelId>`, works for everyone), Copy message,
  Copy username, @mention. A generic "execute endpoint" helper can run any item with
  `commandMetadata.webCommandMetadata.apiUrl`, plus its params, through the auth'd innertube fetch.
  Confirm dialogs are rendered from `confirmDialogRenderer` in our UI.
- Navigating: `window.top` is same-origin, so we can use the SPA router without a full reload.
  Post `yt-navigate` / call `document.querySelector('ytd-app').fire('yt-navigate', …)` in the top
  frame, or fall back to `top.location.href = …`.

## 4. Sending messages
The input panel is in `liveChatContinuation.actionPanel.liveChatMessageInputRenderer`
(`sendButton…sendLiveChatMessageEndpoint.params`). Send with `POST /youtubei/v1/live_chat/send_message`
`{ context, params, richMessage: { textSegments: [{ text }, { emojiId }] } }`. *Not yet tested.*
An easier first version is to keep YouTube's own input (`yt-live-chat-message-input-renderer`)
visible below our list.

## 5. CSP / Trusted Types
- `/live_chat` sends `require-trusted-types-for 'script'`, so plain `innerHTML` throws
  *"This document requires 'TrustedHTML' assignment"* (hit during testing).
- There is no `trusted-types` allowlist directive, so any policy name may be registered.
  **Svelte ≥ 5.x registers its own `svelte-trusted-html` policy** for template cloning, which means
  Svelte mounts fine directly in the YouTube document. Avoid `{@html}`.
- No `frame-src` restriction (an extension iframe would also have worked).

## 6. Chosen architecture (implemented)

```
live_chat iframe (youtube.com)
├─ page-bridge.content.ts: MAIN world, document_start
│    • wraps fetch → forwards get_live_chat payloads (buffers until the UI says hello)
│    • RPC: getContextMenu (innertube + SAPISIDHASH), runMenuItem, navigate
├─ chat.content/: ISOLATED world, document_idle
│    • WXT shadow-root UI appended to `yt-live-chat-renderer #item-list`
│    • CSS `#item-list:has(> better-yt-chat) > yt-live-chat-item-list-renderer { display:none }`
│    • Svelte app: message list + context menu (popover in the top layer)
└─ native YouTube UI kept: header (Top chat/Live chat), ticker, pinned banner, input panel
```

Native layout of the frame:
`yt-live-chat-renderer > #chat-messages > [yt-live-chat-header-renderer, #contents > [#ticker,
#chat > [#pinned-message, #item-list, …], yt-live-chat-banner-manager, #panel-pages (input)]]`.

### Theme
The `--yt-live-chat-*` CSS variables are defined in the frame and inherit into our shadow root:
`background-color`, `primary-text-color`, `secondary-text-color`, `moderator-color`, `sponsor-color`
(members), `author-chip-owner-background-color`/`text-color`, `deleted-message-color`,
`mention-background-color`/`text-color`, `vem-background-color`, `icon-button-color`, and more.
The `--yt-spec-*` variables are **not** defined there, and many internal ones have hashed names
(`--t7f4f2c6d…`), so they aren't stable. Dark mode is `<html dark>`, which we mirror onto the shadow
host as `:host([dark])` for the few colors without a variable (menu, links).

Measured native styles (light): row `padding: 4px 24px`, 14px Roboto; avatar 24px with 16px
right margin; author name weight 500, `#606060`; message line-height 20px. The native menu is
`ytd-menu-popup-renderer`: white, 12px radius, `box-shadow: 0 4px 32px rgba(0,0,0,.1)`, 36px items,
24px icons.

### Running native menu items
Creating `ytd-menu-service-item-renderer` / `ytd-menu-navigation-item-renderer` inside
`yt-live-chat-app`, setting `el.data = <item renderer>` and calling `el.polymerController.onTap()`
runs the item through YouTube's own code. Verified: "Report" opened YouTube's native
"Report message" dialog. Block, mod actions and confirm dialogs use the same path; this is untested
so far, because it means blocking someone for real.

### Go to channel
Every message has `authorExternalChannelId`. From the live_chat frame,
`top.document.querySelector('ytd-app').dispatchEvent(new CustomEvent('yt-navigate', {bubbles, composed,
detail: {endpoint: {commandMetadata: {webCommandMetadata: {url, webPageType: 'WEB_PAGE_TYPE_CHANNEL',
rootVe: 3611}}, browseEndpoint: {browseId}}}}))` does an in-app (SPA) navigation (verified). The
popout falls back to a new tab.

### Other payload fields seen
- `beforeContentButtons[].buttonViewModel` is the viewer leaderboard chip: `iconName: CROWN_FILLED`,
  `title: "#2"`, `customBackgroundColor`/`customFontColor` as ARGB ints.

## 7. Next steps
- Superchats / stickers / memberships / gifts: needs a stream that has them (capture with `__bytcLog`).
- Replays (`get_live_chat_replay`): actions must be scheduled by video time (`videoOffsetTimeMsec`).
- Settings (timestamps, font size, menu item toggles), keyboard shortcuts, and virtualization if needed.
