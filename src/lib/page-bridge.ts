/**
 * Runs in the page's MAIN world inside the `live_chat` frame, before YouTube's own scripts.
 *
 * - Wraps `window.fetch` and forwards every `get_live_chat` response to the UI. YouTube keeps doing
 *   the polling, auth, continuation tokens and reconnects.
 * - Answers RPCs from the UI that need the page's JS context or the youtube.com origin.
 */
import { listen, post, type ChatPayload, type RpcMap, type RpcMethod } from './protocol';
import type { EntityMutation, LiveChatTextMessageRenderer, RawMenuItem } from './youtube/types';

/** Live chat polls, and the chunks of a past stream's chat replay (same response shape). */
const LIVE_CHAT_PATHS = new Set(['/youtubei/v1/live_chat/get_live_chat', '/youtubei/v1/live_chat/get_live_chat_replay']);
/**
 * Moderation calls and Super Chat likes answer with the resulting chat actions or entity updates;
 * apply them without waiting for the next poll.
 */
const ACTION_RESPONSE_PATHS = new Set(['/youtubei/v1/live_chat/moderate', '/youtubei/v1/live_chat/live_chat_action']);
/** Answers with the sent message as an `addChatItemAction` carrying the local copy's `clientId`. */
const SEND_MESSAGE_PATH = '/youtubei/v1/live_chat/send_message';


type AnyRecord = Record<string, any>;

export function installPageBridge(): void {
  const w = window as unknown as AnyRecord;
  if (w.__betterYtChatBridge) return;
  w.__betterYtChatBridge = true;

  const originalFetch = window.fetch;
  let connected = false;
  let backlog: ChatPayload[] = [];
  // Dev builds keep raw responses around: run `copy(JSON.stringify(__bytcLog))` in the
  // live_chat frame's console to save fixtures.
  const devLog: unknown[] | undefined = import.meta.env.DEV ? (w.__bytcLog = []) : undefined;

  function emit(payload: ChatPayload) {
    if (connected) {
      post('page', { type: 'chat', payload });
      return;
    }
    if (payload.reset) backlog = [];
    backlog.push(payload);
  }

  // Dev builds: `__bytcInject([{ addChatItemAction: { item: {...} } }])` feeds made-up actions to
  // the UI, for item types a stream doesn't happen to have.
  if (devLog) w.__bytcInject = (actions: ChatPayload['actions']) => emit({ reset: false, actions: structuredClone(actions) });

  function logResponse(json: unknown) {
    if (!devLog) return;
    devLog.push(json);
    if (devLog.length > 300) devLog.shift();
  }

  // Chat replay: each response offers a token for the next chunk and one for seeking
  // (`playerSeekContinuationData`). A request with a seek token is YouTube refetching around a new
  // video time, and it shows only that window afterwards; flag those responses so we do the same.
  const seekTokens = new Set<string>();
  function rememberSeekTokens(lcc: AnyRecord) {
    for (const c of lcc?.continuations ?? []) {
      const token = c?.playerSeekContinuationData?.continuation;
      if (typeof token === 'string') seekTokens.add(token);
    }
    if (seekTokens.size > 200) seekTokens.delete(seekTokens.values().next().value!);
  }

  function handleResponse(json: AnyRecord, request?: AnyRecord) {
    logResponse(devLog ? { ...json, request } : json);
    const lcc = json?.continuationContents?.liveChatContinuation;
    if (!lcc) return;
    const token = request?.continuation;
    const seek = typeof token === 'string' && seekTokens.has(token);
    rememberSeekTokens(lcc);
    emit({
      reset: 'itemList' in lcc,
      seek: seek || undefined,
      actions: lcc.actions ?? [],
      entities: entityMutations(json),
      viewerName: typeof lcc.viewerName === 'string' ? lcc.viewerName : undefined,
    });
  }

  // The initial history is embedded in the page as `window.ytInitialData = {...}`, and YouTube
  // strips the actions once it has rendered them. Capture them as they are assigned.
  let initialData: unknown;
  Object.defineProperty(window, 'ytInitialData', {
    configurable: true,
    enumerable: true,
    get: () => initialData,
    set(value) {
      initialData = value;
      try {
        // The embedded chat frame uses `continuationContents.liveChatContinuation`; the popout
        // (`/live_chat?is_popout=1&v=…`) uses `contents.liveChatRenderer`. Same shape inside.
        const data = value as AnyRecord;
        const lcc = data?.continuationContents?.liveChatContinuation ?? data?.contents?.liveChatRenderer;
        rememberSeekTokens(lcc);
        if (lcc?.actions?.length) {
          const actions = structuredClone(lcc.actions);
          const entities = structuredClone(entityMutations(data));
          logResponse({ initial: true, continuationContents: { liveChatContinuation: { actions } }, entities });
          emit({ reset: true, actions, entities, viewerName: lcc.viewerName });
        }
      } catch (err) {
        console.error('[better-yt-chat] failed to read ytInitialData', err);
      }
    },
  });

  // Sending a message: YouTube shows it right away, built from a template with the viewer's author
  // fields, under its client message id. The send_message response then has the real message with
  // that id as `clientId`, which the store swaps in. Do the same.
  const pendingSends: string[] = [];
  document.addEventListener(
    'yt-action',
    (event) => {
      try {
        const detail = (event as CustomEvent).detail as AnyRecord | undefined;
        if (detail?.actionName !== 'yt-add-live-chat-text-message-from-template-action') return;
        const local = localMessage(detail.args);
        if (!local) return;
        pendingSends.push(local.clientId);
        emit({ reset: false, actions: [{ addChatItemAction: { item: { liveChatTextMessageRenderer: local.renderer } } }] });
      } catch (err) {
        console.error('[better-yt-chat] failed to show the sent message', err);
      }
    },
    true,
  );

  /**
   * A send finished. If the response doesn't replace the local copy, the send failed: YouTube keeps
   * the message, dimmed with a red bar, and shows "Error, try again." under the input.
   */
  function settleSend(json: AnyRecord | undefined) {
    const clientId = pendingSends.shift();
    if (json) handleActionResponse(json);
    if (clientId && !JSON.stringify(json?.actions ?? []).includes(clientId)) {
      emit({ reset: false, actions: [{ bytcSendFailedAction: { targetItemId: clientId } }] });
    }
  }

  function handleActionResponse(json: AnyRecord) {
    logResponse(json);
    const actions = Array.isArray(json?.actions) ? json.actions : [];
    const entities = entityMutations(json);
    if (actions.length || entities?.length) emit({ reset: false, actions, entities });
  }

  window.fetch = function (this: unknown, ...args: Parameters<typeof fetch>) {
    let path = '';
    let request: Promise<AnyRecord | undefined> | undefined;
    try {
      path = requestPath(args[0]);
      // Read the body before fetch consumes it: the continuation token says whether it's a seek.
      if (LIVE_CHAT_PATHS.has(path)) request = requestBody(args);
    } catch {
      // Never break YouTube's own requests.
    }
    const promise = originalFetch.apply(this, args);
    try {
      if (path === SEND_MESSAGE_PATH) {
        promise
          .then((res) => res.clone().json())
          .then(settleSend, () => settleSend(undefined))
          .catch((err) => console.error('[better-yt-chat] failed to handle send_message', err));
      }
      const handler =
        LIVE_CHAT_PATHS.has(path) ? handleResponse : ACTION_RESPONSE_PATHS.has(path) ? handleActionResponse : null;
      if (handler) {
        Promise.all([promise.then((res) => res.clone().json()), request])
          .then(([json, body]) => {
            try {
              handler(json, body);
            } catch (err) {
              console.error('[better-yt-chat] failed to handle chat response', err);
            }
          })
          .catch(() => {});
      }
    } catch {
      // Never break YouTube's own requests.
    }
    return promise;
  } as typeof fetch;

  const handlers: { [M in RpcMethod]: (args: RpcMap[M]['args']) => Promise<RpcMap[M]['result']> } = {
    getContextMenu: ({ params }) => fetchContextMenu(originalFetch, params),
    runMenuItem: async ({ item }) => {
      await runNativeMenuItem(item);
      return null;
    },
    navigate: async ({ url, browseId }) => {
      navigateTop(url, browseId);
      return null;
    },
    runCommand: async ({ command }) => {
      // The resolver ignores chat dialogs (e.g. AutoMod's "held for review" explanation);
      // yt-live-chat-renderer shows them itself.
      if (command.liveChatDialogEndpoint) {
        const chat = document.querySelector('yt-live-chat-renderer') as (HTMLElement & AnyRecord) | null;
        const controller = chat?.polymerController ?? chat;
        if (typeof controller?.handleLiveChatDialogEndpoint !== 'function') {
          throw new Error('yt-live-chat-renderer has no handleLiveChatDialogEndpoint');
        }
        controller.handleLiveChatDialogEndpoint(command.liveChatDialogEndpoint);
        return null;
      }
      await tapServiceItem({ serviceEndpoint: command });
      return null;
    },
  };

  // Chat replay: the watch page posts `{ 'yt-player-video-progress': seconds }` into this frame a
  // few times a second (and once on load, even when paused). Listening here, from document_start,
  // means the UI gets the time even if it loads after that first message.
  let lastProgress: number | undefined;
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin) return;
    const seconds = (event.data as AnyRecord | null)?.['yt-player-video-progress'];
    if (typeof seconds !== 'number' || seconds === lastProgress) return;
    lastProgress = seconds;
    if (connected) post('page', { type: 'progress', seconds });
  });

  listen('ext', async (msg) => {
    if (msg.type === 'hello') {
      if (connected) return;
      connected = true;
      for (const payload of backlog) post('page', { type: 'chat', payload });
      backlog = [];
      if (lastProgress !== undefined) post('page', { type: 'progress', seconds: lastProgress });
      return;
    }
    if (msg.type === 'rpc') {
      try {
        const handler = handlers[msg.method] as (args: unknown) => Promise<unknown>;
        if (!handler) throw new Error(`Unknown RPC method: ${msg.method}`);
        post('page', { type: 'rpc-result', id: msg.id, ok: true, result: await handler(msg.args) });
      } catch (err) {
        post('page', { type: 'rpc-result', id: msg.id, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
  });

  post('page', { type: 'ready' });
}

/**
 * The local copy of a message being sent, from the `yt-add-live-chat-text-message-from-template-action`
 * args: `[{ addLiveChatTextMessageFromTemplateAction: { template } }, inputElement,
 * { client_message_id, rich_message: { text_segments } }]`.
 */
function localMessage(args: unknown): { clientId: string; renderer: LiveChatTextMessageRenderer } | undefined {
  const [action, , params] = Array.isArray(args) ? (args as AnyRecord[]) : [];
  const template = action?.addLiveChatTextMessageFromTemplateAction?.template?.liveChatTextMessageRenderer;
  const clientId = params?.client_message_id;
  const segments = params?.rich_message?.text_segments;
  if (!template || typeof clientId !== 'string' || !Array.isArray(segments)) return undefined;
  // Custom emoji are sent by id only; the chat's emoji list has their images.
  const chat = document.querySelector('yt-live-chat-renderer') as AnyRecord | null;
  const emojis: AnyRecord[] = (chat?.data ?? chat?.polymerController?.data)?.emojis ?? [];
  const runs = segments.flatMap((segment: AnyRecord): AnyRecord[] => {
    if (typeof segment?.text === 'string') return [{ text: segment.text }];
    const emoji = segment?.emoji_id && emojis.find((e) => e?.emojiId === segment.emoji_id);
    return emoji ? [{ emoji: structuredClone(emoji) }] : [];
  });
  return {
    clientId,
    renderer: {
      ...structuredClone(template),
      id: clientId,
      timestampUsec: String(Date.now() * 1000),
      message: { runs },
    },
  };
}

function entityMutations(json: AnyRecord | undefined): EntityMutation[] | undefined {
  const mutations = json?.frameworkUpdates?.entityBatchUpdate?.mutations;
  return Array.isArray(mutations) && mutations.length ? mutations : undefined;
}

/** The JSON body of an innertube request, whether it's passed as a `Request` or as `init.body`. */
async function requestBody([input, init]: Parameters<typeof fetch>): Promise<AnyRecord | undefined> {
  try {
    const body = init?.body;
    let bytes: ArrayBuffer | undefined;
    if (typeof body === 'string') return JSON.parse(body);
    // Blobs, buffers etc. can be read again; a stream can't, so leave those alone.
    if (body != null && !(body instanceof ReadableStream)) bytes = await new Response(body).arrayBuffer();
    else if (input instanceof Request) bytes = await input.clone().arrayBuffer();
    if (!bytes?.byteLength) return undefined;
    // YouTube gzips some request bodies (e.g. chat replay).
    const head = new Uint8Array(bytes, 0, 2);
    const stream =
      head[0] === 0x1f && head[1] === 0x8b
        ? new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
        : new Blob([bytes]).stream();
    return JSON.parse(await new Response(stream).text());
  } catch (err) {
    if (import.meta.env.DEV) {
      const kind = input instanceof Request ? 'Request' : typeof input;
      console.debug('[better-yt-chat] could not read request body', kind, init?.body, err);
    }
    return undefined;
  }
}

function requestPath(input: RequestInfo | URL): string {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(url, location.href).pathname;
}

function ytcfg(key: string): any {
  const cfg = (window as unknown as AnyRecord).ytcfg;
  return cfg?.get?.(key) ?? cfg?.data_?.[key];
}

function getCookie(name: string): string | undefined {
  for (const part of document.cookie.split('; ')) {
    const eq = part.indexOf('=');
    if (part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return undefined;
}

async function sha1Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The `SAPISIDHASH …` authorization header YouTube's web client sends when signed in. */
async function authorizationHeader(origin: string): Promise<string | undefined> {
  const ts = Math.floor(Date.now() / 1000);
  const schemes: [cookie: string, scheme: string][] = [
    ['SAPISID', 'SAPISIDHASH'],
    ['__Secure-1PAPISID', 'SAPISID1PHASH'],
    ['__Secure-3PAPISID', 'SAPISID3PHASH'],
  ];
  const parts: string[] = [];
  for (const [cookie, scheme] of schemes) {
    const value = getCookie(cookie);
    if (value) parts.push(`${scheme} ${ts}_${await sha1Hex(`${ts} ${value} ${origin}`)}`);
  }
  return parts.length ? parts.join(' ') : undefined;
}

async function innertubeHeaders(): Promise<Record<string, string>> {
  const origin = location.origin;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-origin': origin,
    'x-youtube-client-name': String(ytcfg('INNERTUBE_CONTEXT_CLIENT_NAME') ?? 1),
    'x-youtube-client-version': String(ytcfg('INNERTUBE_CLIENT_VERSION') ?? ''),
    'x-goog-authuser': String(ytcfg('SESSION_INDEX') ?? 0),
  };
  const visitor = ytcfg('VISITOR_DATA');
  if (visitor) headers['x-goog-visitor-id'] = visitor;
  const pageId = ytcfg('DELEGATED_SESSION_ID');
  if (pageId) headers['x-goog-pageid'] = pageId;
  const auth = await authorizationHeader(origin);
  if (auth) headers.authorization = auth;
  return headers;
}

async function fetchContextMenu(fetchImpl: typeof fetch, params: string): Promise<RawMenuItem[]> {
  const url = `/youtubei/v1/live_chat/get_item_context_menu?params=${encodeURIComponent(params)}&prettyPrint=false`;
  const res = await fetchImpl(url, {
    method: 'POST',
    credentials: 'include',
    headers: await innertubeHeaders(),
    body: JSON.stringify({ context: ytcfg('INNERTUBE_CONTEXT') }),
  });
  if (!res.ok) throw new Error(`get_item_context_menu failed: ${res.status}`);
  const json = await res.json();
  return json?.liveChatItemContextMenuSupportedRenderers?.menuRenderer?.items ?? [];
}

let menuItemHost: HTMLElement | undefined;

/** A hidden container inside yt-live-chat-app, so events we fire (popups, service requests) reach the app. */
function getMenuItemHost(): HTMLElement {
  const app = document.querySelector('yt-live-chat-app');
  if (!app) throw new Error('yt-live-chat-app not found');
  if (!menuItemHost?.isConnected) {
    menuItemHost = document.createElement('div');
    menuItemHost.hidden = true;
    menuItemHost.dataset.betterYtChat = 'menu-item-host';
    app.appendChild(menuItemHost);
  }
  return menuItemHost;
}

/**
 * Runs a native context menu item through YouTube's own code, which reuses its confirm dialogs,
 * report forms and moderation flows.
 */
async function runNativeMenuItem(item: RawMenuItem): Promise<void> {
  const [kind, data] = Object.entries(item)[0] ?? [];
  if (!kind || !data) throw new Error('Empty menu item');
  if (kind === 'menuServiceItemRenderer') return tapServiceItem(data);
  if (kind === 'menuNavigationItemRenderer') return runNavigationEndpoint(data);
  throw new Error(`Unsupported menu item: ${kind}`);
}

/** `ytd-menu-service-item-renderer.onTap` resolves the item's endpoint with YouTube's command resolver. */
async function tapServiceItem(data: AnyRecord): Promise<void> {
  const el = document.createElement('ytd-menu-service-item-renderer') as HTMLElement & AnyRecord;
  getMenuItemHost().replaceChildren(el);
  el.data = data;
  await new Promise((resolve) => setTimeout(resolve, 0));
  const controller = el.polymerController ?? el;
  if (typeof controller.onTap !== 'function') throw new Error('ytd-menu-service-item-renderer has no onTap handler');
  controller.onTap();
}

/**
 * `ytd-menu-navigation-item-renderer` has no `onTap`; it reacts to real clicks on a link it only
 * renders for some endpoints. Handle the endpoint types it carries directly instead.
 */
async function runNavigationEndpoint(data: AnyRecord): Promise<void> {
  const endpoint: AnyRecord = data.navigationEndpoint ?? {};

  // e.g. Block: open YouTube's own confirm dialog; its confirm button sends the request.
  const dialog = endpoint.confirmDialogEndpoint?.content;
  if (dialog) {
    const source = getMenuItemHost();
    source.dispatchEvent(
      new CustomEvent('yt-action', {
        bubbles: true,
        composed: true,
        detail: {
          actionName: 'yt-open-popup-action',
          args: [{ openPopupAction: { popup: dialog, popupType: 'DIALOG' } }, source],
          optionalAction: false,
          returnValue: [],
        },
      }),
    );
    return;
  }

  const url = endpoint.urlEndpoint?.url ?? endpoint.commandMetadata?.webCommandMetadata?.url;
  if (url) {
    if (endpoint.urlEndpoint?.target === 'TARGET_NEW_WINDOW') {
      window.open(new URL(url, location.origin).href, '_blank', 'noopener');
    } else {
      navigateTop(url, endpoint.browseEndpoint?.browseId);
    }
    return;
  }

  // Anything else: let YouTube's command resolver handle it as a service endpoint.
  return tapServiceItem({ ...data, serviceEndpoint: endpoint });
}

function navigateTop(url: string, browseId?: string): void {
  try {
    const topApp = browseId ? window.top?.document.querySelector('ytd-app') : null;
    if (topApp) {
      // In-app (SPA) navigation on the watch page, same as clicking a channel link.
      topApp.dispatchEvent(
        new CustomEvent('yt-navigate', {
          bubbles: true,
          composed: true,
          detail: {
            endpoint: {
              commandMetadata: { webCommandMetadata: { url, webPageType: 'WEB_PAGE_TYPE_CHANNEL', rootVe: 3611 } },
              browseEndpoint: { browseId },
            },
          },
        }),
      );
      return;
    }
  } catch {
    // Cross-origin top frame (e.g. embedded chat): fall through.
  }
  // Popout chat or no ytd-app: open a new tab instead of replacing the chat.
  window.open(new URL(url, location.origin).href, '_blank', 'noopener');
}
