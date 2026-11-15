/**
 * Settings shared by the page bridge (MAIN world) and the UI (ISOLATED world). They live in the
 * youtube.com localStorage, which both worlds can read synchronously (the bridge needs the value
 * before YouTube renders the chat header), like YouTube's own `yt-live-chat::show-timestamps`.
 */

/** "true" when the viewer chose YouTube's own message list over ours. */
export const NATIVE_LIST_KEY = 'better-yt-chat::native-list';

export function readNativeList(): boolean {
  try {
    return localStorage.getItem(NATIVE_LIST_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeNativeList(native: boolean): void {
  try {
    if (native) localStorage.setItem(NATIVE_LIST_KEY, 'true');
    else localStorage.removeItem(NATIVE_LIST_KEY);
  } catch {
    // Storage blocked: the choice still applies to this page.
  }
}
