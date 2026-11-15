import { getContext, setContext } from 'svelte';
import type { PageBridge } from './bridge';
import type { ChatStore } from './chat/store.svelte';

/** What deeply nested components need without threading props through every list item. */
export interface AppContext {
  readonly store: ChatStore;
  readonly bridge: PageBridge;
}

const KEY = Symbol('better-yt-chat');

export function setAppContext(context: AppContext): void {
  setContext(KEY, context);
}

export function getAppContext(): AppContext {
  return getContext<AppContext>(KEY);
}
