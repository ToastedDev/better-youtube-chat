/**
 * Runs in the page's MAIN world inside the `live_chat` frame, before YouTube's own scripts.
 *
 * - Wraps `window.fetch` and forwards every `get_live_chat` response to the UI. YouTube keeps doing
 *   the polling, auth, continuation tokens and reconnects.
 * - Answers RPCs from the UI that need the page's JS context or the youtube.com origin.
 */
import { listen, post, type ChatPayload, type RpcMap, type RpcMethod } from './protocol';
import type { RawMenuItem } from './youtube/types';

const LIVE_CHAT_PATH = '/youtubei/v1/live_chat/get_live_chat';

/** Native menu item element tags. Running an item through YouTube's own element reuses its
 *  confirm dialogs, report forms and moderation flows. */
const MENU_ITEM_TAGS: Record<string, string> = {
  menuServiceItemRenderer: 'ytd-menu-service-item-renderer',
  menuNavigationItemRenderer: 'ytd-menu-navigation-item-renderer',
};

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

  function handleResponse(json: AnyRecord) {
    if (devLog) {
      devLog.push(json);
      if (devLog.length > 300) devLog.shift();
    }
    const lcc = json?.continuationContents?.liveChatContinuation;
    if (!lcc) return;
    emit({
      reset: 'itemList' in lcc,
      actions: lcc.actions ?? [],
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
        const lcc = (value as AnyRecord)?.continuationContents?.liveChatContinuation;
        if (lcc?.actions?.length) {
          emit({ reset: true, actions: structuredClone(lcc.actions), viewerName: lcc.viewerName });
        }
      } catch (err) {
        console.error('[better-yt-chat] failed to read ytInitialData', err);
      }
    },
  });

  window.fetch = function (this: unknown, ...args: Parameters<typeof fetch>) {
    const promise = originalFetch.apply(this, args);
    try {
      if (isLiveChatRequest(args[0])) {
        promise
          .then((res) => res.clone().json())
          .then((json) => {
            try {
              handleResponse(json);
            } catch (err) {
              console.error('[better-yt-chat] failed to handle chat response', err);
            }
          }, () => {});
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
  };

  listen('ext', async (msg) => {
    if (msg.type === 'hello') {
      if (connected) return;
      connected = true;
      for (const payload of backlog) post('page', { type: 'chat', payload });
      backlog = [];
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

function isLiveChatRequest(input: RequestInfo | URL): boolean {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(url, location.href).pathname === LIVE_CHAT_PATH;
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

async function runNativeMenuItem(item: RawMenuItem): Promise<void> {
  const [kind, data] = Object.entries(item)[0] ?? [];
  const tag = kind && MENU_ITEM_TAGS[kind];
  if (!tag) throw new Error(`Unsupported menu item: ${kind}`);

  const app = document.querySelector('yt-live-chat-app');
  if (!app) throw new Error('yt-live-chat-app not found');
  if (!menuItemHost?.isConnected) {
    menuItemHost = document.createElement('div');
    menuItemHost.hidden = true;
    menuItemHost.dataset.betterYtChat = 'menu-item-host';
    // Inside yt-live-chat-app so the events the item fires (popups, service requests) reach the app.
    app.appendChild(menuItemHost);
  }

  const el = document.createElement(tag) as HTMLElement & AnyRecord;
  menuItemHost.replaceChildren(el);
  el.data = data;
  await new Promise((resolve) => setTimeout(resolve, 0));
  const controller = el.polymerController ?? el;
  if (typeof controller.onTap !== 'function') throw new Error(`${tag} has no onTap handler`);
  controller.onTap();
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
