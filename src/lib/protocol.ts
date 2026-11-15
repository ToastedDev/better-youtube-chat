/**
 * Messages between the MAIN-world page bridge (which can see YouTube's JS objects and wraps
 * `fetch`) and the ISOLATED-world content script (which renders the Svelte UI).
 * Both live in the same `live_chat` frame, so they use `window.postMessage`.
 */
import type { ChatAction, EntityMutation, InnertubeCommand, RawMenuItem } from './youtube/types';

const CHANNEL_KEY = '__betterYtChat';

export interface ChatPayload {
  /** True for a full (re)load, e.g. first load or switching Top chat / Live chat. */
  reset: boolean;
  actions: ChatAction[];
  /** Entity store updates that came with the actions (like / reply counts). */
  entities?: EntityMutation[];
  viewerName?: string;
}

export interface RpcMap {
  getContextMenu: { args: { params: string }; result: RawMenuItem[] };
  runMenuItem: { args: { item: RawMenuItem }; result: null };
  navigate: { args: { url: string; browseId?: string }; result: null };
  /** Runs an innertube command (e.g. a Like toggle or "open reply thread") through YouTube's resolver. */
  runCommand: { args: { command: InnertubeCommand }; result: null };
}

export type RpcMethod = keyof RpcMap;

export type PageMessage =
  | { type: 'ready' }
  | { type: 'chat'; payload: ChatPayload }
  | { type: 'rpc-result'; id: number; ok: true; result: unknown }
  | { type: 'rpc-result'; id: number; ok: false; error: string };

export type ExtMessage =
  | { type: 'hello' }
  | { type: 'rpc'; id: number; method: RpcMethod; args: unknown };

type Side = 'page' | 'ext';
type MessageFrom<S extends Side> = S extends 'page' ? PageMessage : ExtMessage;

export function post<S extends Side>(from: S, msg: MessageFrom<S>): void {
  window.postMessage({ [CHANNEL_KEY]: from, msg }, location.origin);
}

export function listen<S extends Side>(from: S, handler: (msg: MessageFrom<S>) => void): () => void {
  const onMessage = (event: MessageEvent) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data as Record<string, unknown> | null;
    if (!data || typeof data !== 'object' || data[CHANNEL_KEY] !== from) return;
    handler(data.msg as MessageFrom<S>);
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}
