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

Seen on streams with Super Chats, gifts, memberships and a fundraiser (all handled, see `parse.ts`):
`liveChatPaidMessageRenderer`, `liveChatMembershipItemRenderer`, `giftMessageViewModel` (Jewels gifts;
no channel id), `liveChatDonationAnnouncementRenderer`, `liveChatPlaceholderItemRenderer` (an empty
slot; kept so a later item with the same id lands in place), `addLiveChatTickerItemAction` (the ticker,
left native; its items carry the full renderer in `showItemEndpoint.showLiveChatItemEndpoint.renderer`).

Handled from YouTube's schema but not seen live yet: `liveChatPaidStickerRenderer`,
`liveChatSponsorshipsGiftPurchaseAnnouncementRenderer`,
`liveChatSponsorshipsGiftRedemptionAnnouncementRenderer`. Also handled and verified:
`liveChatModeChangeMessageRenderer`, `liveChatAutoModMessageRenderer` (see "AutoMod"). Other known
actions:
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
  `title: "#2"`, `customBackgroundColor`/`customFontColor` as ARGB ints. Replies to a Super Chat use
  the same field for the "@name" chip: `iconName: MESSAGE`, `iconTrailing: true`, and an `onTap`
  that opens the reply thread.

### Super Chat likes, replies and hearts (entity store)
The renderer only holds keys; the values arrive as `frameworkUpdates.entityBatchUpdate.mutations`
next to the actions (`get_live_chat`, `ytInitialData`, and `live_chat_action` responses), each
`{ entityKey, type: ENTITY_MUTATION_TYPE_REPLACE | …_DELETE, payload: { <entityType>: {...} } }`.
Keys appear both URL-encoded (`…%3D`) and not, so compare them decoded.
| renderer field | entity |
|---|---|
| `pdgLikeButton.pdgLikeViewModel.likeCountEntityKey` | `likeCountEntity { likeCountIfLiked, likeCountIfIndifferent }` |
| `pdgLikeButton.pdgLikeViewModel.engagementStateKey` | `engagementToolbarStateEntityPayload { likeState: TOOLBAR_LIKE_STATE_LIKED / _INDIFFERENT }` |
| `replyButton.pdgReplyButtonViewModel.replyCountEntityKey` | `replyCountEntity { replyCount }` |
| `creatorHeartButton.creatorHeartViewModel.engagementStateKey` | `engagementToolbarStateEntityPayload { heartState: TOOLBAR_HEART_STATE_HEARTED / _UNHEARTED }` |

- Like / Unlike are `liveChatActionEndpoint` commands in the toggle button's default / toggled
  `buttonViewModel.onTap`. Running them (as a `serviceEndpoint`, see "Running native menu items")
  works. The response is only `responseContext`, so the new like state shows up on the next load,
  not right away (verified: like, reload shows LIKED; unlike, reload shows INDIFFERENT). Running the
  command this way doesn't update YouTube's own entity store, so its reply dialog shows the old state
  until a reload.
- Reply is a `showEngagementPanelEndpoint` (`PAreply_thread`, `PANEL_POPUP_TYPE_DIALOG`); running it
  the same way opens YouTube's reply thread dialog, where replies are read and posted.
- YouTube's own Like / Reply icons are blank (`imageName: ""`); we draw thumb-up / bubble icons.

### @-suggestions in the chat input
The input's suggestion box (`tp-yt-iron-dropdown#dropdown` in yt-live-chat-text-input-field-renderer,
shared with :emoji suggestions; rows are `yt-live-chat-text-input-field-suggestion[active]`) shows
after three characters (`@ab`). Its names come from `yt-live-chat-participants-manager`:
`onChatMessage_(actions)` handles each poll's `yt-live-chat-actions` and keeps text / paid message
authors from the last 5 minutes (`PARTICIPANT_TIME_USEC_`), at most 100, matched by prefix
(`getAuthorsFromPrefix`). It never sees the initial history, so the bridge feeds that in the same
way. Picking a name types plain `@name ` text. The input's newer mention popup
(`mentionParticipantsManager`, `insertMention` chips) has no data source on viewer pages.
Mention chips aren't worth inserting ourselves (tested on a test stream): `insertMention(handle)`
adds a `<b class="mention" data-mention-handle>` chip that the input sends as a mention segment,
but the message comes back as plain text runs (`"@name"`, `" rest"`), looks the same in chat, and
the mentioned account got no notification. So our Mention menu item types plain `@name ` text,
like YouTube's suggestions.
The selected row uses the hover color, barely different from the panel; our document CSS darkens it.

### Timestamps for everyone
The chat header's ⋮ menu (`liveChatHeaderRenderer.overflowMenu.menuRenderer.items`, in
`ytInitialData`) only has "Timestamps" for moderators. It's a
`clientSideToggleMenuItemRenderer` (`menuItemIdentifier: "timestamp_toggle"`,
`command: { toggleLiveChatTimestampsEndpoint: {} }`) that never contacts the server: YouTube toggles
`hide-timestamps` on yt-live-chat-renderer and stores the choice in localStorage
(`yt-live-chat::show-timestamps`). The bridge adds the same item for everyone before YouTube renders
the header (before Reactions, where moderators have it). Verified as a viewer in the popout, the
watch page's embedded chat and a replay: the toggle works, persists across reloads, and YouTube's
own list and the pinned banner show timestamps too.

### Our on/off switch in the chat menu
Also a `clientSideToggleMenuItemRenderer` added to the header menu (first item), rendered as
`yt-live-chat-toggle-renderer` with a `tp-yt-paper-toggle-button`. YouTube keeps client-side switch
states itself by `menuItemIdentifier` and ignores `isToggled` for one it doesn't know (it renders
off and doesn't flip on tap). So the bridge sets the element's `isToggled` and the button's
`checked` when the header menu opens, flips the saved choice itself on a tap, and gives the item a
no-op command (`signalServiceEndpoint` with no actions).

### Pinned message banner
The banner stays native (`yt-live-chat-banner-manager` above the input), but our menu replaces
its own (verified on a test stream):
- `yt-live-chat-banner-renderer.data` is the `liveChatBannerRenderer`: `contents.liveChatTextMessageRenderer`
  is the message, without `contextMenuEndpoint`. The banner's ⋮ is
  `header.liveChatBannerHeaderRenderer.contextMenuButton.buttonRenderer.command.liveChatItemContextMenuEndpoint`,
  whose menu has Unpin message (icon `KEEP_OFF`) plus the message's usual items (e.g. Remove).
- The bridge catches `click` (on `#menu-button` or the author chip) and `contextmenu` in the
  capture phase, and sends the message with the header's params to the UI, which opens our menu.
  Other clicks on the banner (expand / collapse) and other banner types (polls, etc.) stay native,
  as does everything in compare mode.
- The banner collapses after `autoCollapseDelay` (7s) and expands on click; while it animates,
  a click can land on `#banner-container` instead of the name.

### Sending messages (optimistic)
YouTube shows a sent message before the server answers (verified on a test stream):
- On send, the input dispatches a `yt-action` named `yt-add-live-chat-text-message-from-template-action`
  with `args: [{ addLiveChatTextMessageFromTemplateAction: { template: { liveChatTextMessageRenderer:
  <viewer's authorName, authorPhoto, authorBadges, authorExternalChannelId> } } }, <input element>,
  { client_message_id, rich_message: { text_segments: [{ text } | { emoji_id }] } }]`. YouTube adds the
  message under `client_message_id`. The bridge listens for this in the capture phase and does the
  same. Custom emoji come from `yt-live-chat-renderer`'s `data.emojis`.
- About 1s later the `send_message` response has `addChatItemAction { item, clientId }` with the
  real message. YouTube swaps it in for the local copy, and the next poll's copy is a duplicate by id.
- On failure (e.g. a 400), YouTube keeps the message dimmed (`is-dimmed`: text at 25% opacity) with a
  red bar (`show-bar`, `--yt-live-chat-error-message-color`) and shows "Error, try again." under the
  input. We mark it with our own `bytcSendFailedAction` and draw the same.

### AutoMod (held for review)
Moderators get `addChatItemAction.item.liveChatAutoModMessageRenderer` (verified on a stream where
the viewer is a moderator):
- `autoModeratedItem.liveChatTextMessageRenderer` is the held message. `headerText` is "This
  message is held for review.". `moderationButtons[]` are Show / Hide `buttonRenderer`s with a
  `moderateLiveChatEndpoint` `serviceEndpoint`. The outer renderer carries the
  `inlineActionButtons`.
- `infoDialogButton` (WARNING icon) has a `navigationEndpoint.liveChatDialogEndpoint`. YouTube's
  command resolver ignores it; `yt-live-chat-renderer`'s `handleLiveChatDialogEndpoint(endpoint)`
  opens the dialog.
- Show / Hide: the `live_chat/moderate` response has a `replaceChatItemAction`, and the next
  `get_live_chat` repeats it. Show replaces the item with the plain message. Hide replaces it with
  a text message that has `deletedStateMessage` ("Message automatically held for review, hidden by
  @mod.") and `showOriginalContentMessage` ("View deleted message"). Messages hidden earlier arrive
  in that form in the initial history too.
- Native look (light): a 4px bar on the left (the deleted-message bar color); header row 12px/18px
  with a 40px round icon button; the message at 50% opacity, italic; 40px tonal buttons
  (`rgba(0,0,0,.05)`, 20px radius, 14px/500) with an 8px gap, 64px from the left.

### Chat replay (past streams)
The chat frame is `/live_chat_replay?continuation=…` (our `live_chat*` match covers it). Verified on
a 4h40m VOD:
- `ytInitialData.continuationContents.liveChatContinuation` has `isReplay` and a first chunk. Every
  action is a `replayChatItemAction { actions[], videoOffsetTimeMsec }`.
- More chunks come from `get_live_chat_replay` (same response shape), about every 5s of playback.
  Chunks overlap, so dedupe by item id.
- The watch page posts `{ "yt-player-video-progress": seconds }` into the chat frame about 4 times a
  second, and once on load even when paused. YouTube shows the actions whose offset is at or before
  that time.
- Each response offers two continuations, `liveChatReplayContinuationData` (next chunk) and
  `playerSeekContinuationData`. After a seek YouTube requests with the seek token and gets a window
  around the new time (about 70s before to 100s after; it can also start further back with a Super
  Chat that's still in the ticker). YouTube then shows only that window up to the current time. The
  request is a `Request` with a **gzipped** JSON body (`DecompressionStream('gzip')`), and comparing
  its `continuation` with the seek tokens seen so far is how the bridge flags seek responses.
- Messages carry `timestampText` (video time, e.g. "1:58:17", negative before the stream began).
- **No popout for replays; YouTube doesn't support it.** The replay chat's ⋮ menu only has "Send
  feedback". `/live_chat?is_popout=1&v=<id>` says "Chat is disabled for this live stream" once the
  stream is over, and `/live_chat_replay?is_popout=1&v=<id>` says "Something went wrong". The replay
  frame is opened with a `continuation` token from the watch page, not a video id, and outside the
  watch page nothing posts the video time anyway.

Implementation: `ReplayTimeline` (`src/lib/chat/replay.ts`) keeps the actions sorted by offset and
pruned to a window around the current time. The store applies the newly reached actions as the
video plays, and rebuilds the list from the timeline on a seek, a seek response, or a chunk landing
before the current time. Compared with YouTube's own list after playing, seeking forward, seeking
back into loaded chat and seeking far back: same items, same order.

### Stickers, milestones and gifted memberships
Compared with YouTube's list on chat replays (the actions inside `replayChatItemAction` are the same
as live, field for field, apart from replay's `timestampText`):
- **Every authored item** carries `timestampText` in a replay, not just text messages. Membership,
  Super Chat, sticker and redemption items also have a hidden `#timestamp` that YouTube's Timestamps
  toggle shows in `--yt-live-chat-tertiary-text-color` (gift purchases have none). We don't draw
  timestamps on cards yet.
- **Super Sticker:** card `padding: 8px 8px 8px 16px`, items aligned to the top; 32px avatar with a
  16px gap; name 14px/500 and amount 15px/18px/500 centered on a 40px line; the sticker at the right
  edge. A viewer's **1st Super** adds `headerOverlayImage` (a 146px sparkle animation over the card's
  top-right corner) and `lowerBumper.liveChatItemBumperViewModel` (a note under the card: 8px gap,
  `padding: 12px 16px`, 4px radius, `rgba(0,0,0,.1)`, 12px/18px, with a 24px `CELEBRATION` icon in
  the bumper's `imageColor`).
- **Gift purchase:** the 104×104 picture fills the card's right edge; 40px avatar with an 8px gap;
  name 14px/20px/500 at 70% white; "Sent N … gift memberships" 14px/18px at weight 400 (the runs say
  bold, YouTube doesn't draw it).
- **Milestones** (with and without a message; the empty one has `empty: true`) and **new members**
  already matched.
- Our theme sampler copied the member name color from the first `.member` author chip in YouTube's
  list. On a sticker card that chip is white, which turned every member name white, so it now only
  samples text messages.

## 7. Next steps
- Timestamps on cards (see above); Super Chats (`liveChatPaidMessageRenderer`) may carry the 1st
  Super overlay and bumper too, unverified.
- Settings (timestamps, font size, menu item toggles), keyboard shortcuts, and virtualization if needed.
