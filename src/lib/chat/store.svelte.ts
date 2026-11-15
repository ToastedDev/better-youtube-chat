import type { ChatPayload } from '../protocol';
import type { ChatAction, EntityMutation, FormattedText } from '../youtube/types';
import { isAuthored, type ChatItem, type DeletedState } from './model';
import { parseItem, textOf } from './parse';
import { ReplayTimeline } from './replay';

/** Items kept while following the bottom of the chat. */
const MAX_ITEMS = 400;
/** Hard cap while the user has scrolled up to read. */
const MAX_ITEMS_HOLDING = 2000;
/** Entities kept before dropping the ones no item refers to any more. */
const MAX_ENTITIES = 1000;

/** Chat replay: going back more than this, or forward more than `SEEK_FORWARD_MS`, is a seek. */
const SEEK_BACK_MS = 500;
const SEEK_FORWARD_MS = 30_000;
/** Chat replay: how much of the timeline to keep around the current time (see `ReplayTimeline.prune`). */
const REPLAY_WINDOW_MS = 5 * 60_000;
const REPLAY_PRUNE_AT = 3000;

/** An entity store value, e.g. `{ likeCountEntity: {...} }`. */
export type Entity = Record<string, unknown>;

export class ChatStore {
  items = $state.raw<ChatItem[]>([]);
  viewerName = $state.raw<string | undefined>(undefined);
  /**
   * YouTube's entity store values by key (like and reply counts). Replaced as a whole on change,
   * so reading one entity re-renders with any update.
   */
  entities = $state.raw<Record<string, Entity>>({});
  /** True while the user is scrolled up; we don't trim then, so the view doesn't jump. */
  holding = false;

  /** Set once replay actions arrive: this frame replays a past stream's chat. */
  #replay: ReplayTimeline | null = null;
  /** The video time (ms) the list currently shows, from the watch page's progress messages. */
  #videoTimeMs: number | null = null;
  /**
   * After a seek YouTube shows only the window it fetched for the new time (which can start a few
   * minutes back, e.g. with a Super Chat still in the ticker), not what was loaded before. Nothing
   * at or before this offset is shown.
   */
  #floorMs = -Infinity;
  /** Offset ranges of recent seek windows (and the initial one), newest last. */
  #seekWindows: { minMs: number; maxMs: number }[] = [];

  apply(payload: ChatPayload): void {
    if (payload.viewerName) this.viewerName = payload.viewerName;
    if (this.#replay || payload.actions.some((a) => a.replayChatItemAction)) this.#applyReplay(payload);
    else this.#update(payload.actions, payload.reset);
    if (payload.entities?.length) this.applyEntities(payload.entities);
  }

  /** Chat replay: the video played to, or was seeked to, `seconds`. */
  setVideoTime(seconds: number): void {
    const ms = Math.round(seconds * 1000);
    const prev = this.#videoTimeMs;
    this.#videoTimeMs = ms;
    const timeline = this.#replay;
    if (!timeline) return;
    if (prev === null || ms < prev - SEEK_BACK_MS || ms - prev > SEEK_FORWARD_MS) {
      // A seek: start from the seek window around the new time if it's already here (it can
      // arrive before the progress message), or show nothing until it arrives.
      if (prev !== null) {
        const window = this.#seekWindows.findLast((w) => w.minMs <= ms && ms <= w.maxMs);
        this.#floorMs = window ? window.minMs - 1 : ms;
      }
      this.#rebuild();
    } else if (ms > prev) {
      const actions = timeline.between(prev, ms);
      if (actions.length) this.#update(actions, false);
    }
    if (timeline.size > REPLAY_PRUNE_AT) timeline.prune(ms, MAX_ITEMS_HOLDING, REPLAY_WINDOW_MS);
  }

  #applyReplay(payload: ChatPayload): void {
    const timeline = (this.#replay ??= new ReplayTimeline());
    if (payload.reset) {
      timeline.clear();
      this.#seekWindows = [];
    }
    const { earliestNew, range } = timeline.add(payload.actions);
    const newWindow = (payload.reset || payload.seek) && range;
    if (newWindow) {
      this.#seekWindows.push(range);
      if (this.#seekWindows.length > 20) this.#seekWindows.shift();
      this.#floorMs = range.minMs - 1;
    }
    if (this.#videoTimeMs === null) {
      if (payload.reset) this.items = [];
      return;
    }
    // A new window, or new actions at or before the current time, belong above what's shown, so
    // rebuild rather than append.
    if (payload.reset || newWindow || (earliestNew !== undefined && earliestNew <= this.#videoTimeMs)) {
      this.#rebuild();
    }
  }

  /** Chat replay: show the end of the timeline up to the current video time. */
  #rebuild(): void {
    if (!this.#replay || this.#videoTimeMs === null) return;
    this.#update(this.#replay.lastUpTo(this.#videoTimeMs, MAX_ITEMS, this.#floorMs), true);
  }

  #update(actions: ChatAction[], reset: boolean): void {
    const next = reset ? [] : this.items.slice();
    for (const action of actions) applyAction(next, action);
    const max = this.holding ? MAX_ITEMS_HOLDING : MAX_ITEMS;
    if (next.length > max) next.splice(0, next.length - max);
    if (reset || next.length !== this.items.length || next.some((item, i) => item !== this.items[i])) {
      this.items = next;
    }
  }

  entity(key: string | undefined): Entity | undefined {
    return key ? this.entities[normalizeKey(key)] : undefined;
  }

  private applyEntities(mutations: EntityMutation[]): void {
    let next = { ...this.entities };
    for (const m of mutations) {
      const key = normalizeKey(m.entityKey);
      if (m.type === 'ENTITY_MUTATION_TYPE_DELETE') delete next[key];
      else if (m.payload) next[key] = m.payload;
    }
    if (Object.keys(next).length > MAX_ENTITIES) {
      const used = new Set<string>();
      for (const item of this.items) {
        if (item.kind !== 'paid') continue;
        for (const key of [item.like?.countKey, item.like?.stateKey, item.reply?.countKey, item.heart?.stateKey]) {
          if (key) used.add(normalizeKey(key));
        }
      }
      next = Object.fromEntries(Object.entries(next).filter(([key]) => used.has(key)));
    }
    this.entities = next;
  }

  /** Trim back down once the user returns to the bottom. */
  trim(): void {
    if (this.items.length > MAX_ITEMS) this.items = this.items.slice(-MAX_ITEMS);
  }
}

function applyAction(items: ChatItem[], action: ChatAction): void {
  if (action.addChatItemAction) {
    const item = parseItem(action.addChatItemAction.item);
    if (!item) return;
    const index = items.findIndex((i) => i.id === item.id);
    if (index === -1) items.push(item);
    // A slot YouTube reserved earlier: fill it in place.
    else if (items[index]!.kind === 'placeholder') items[index] = item;
    return;
  }
  if (action.replaceChatItemAction) {
    const { targetItemId, replacementItem } = action.replaceChatItemAction;
    const index = items.findIndex((i) => i.id === targetItemId);
    const item = parseItem(replacementItem);
    if (index !== -1) {
      if (item) items[index] = item;
      else items.splice(index, 1);
    }
    return;
  }
  if (action.removeChatItemAction) {
    const index = items.findIndex((i) => i.id === action.removeChatItemAction!.targetItemId);
    if (index !== -1) items.splice(index, 1);
    return;
  }
  if (action.removeChatItemByAuthorAction) {
    const channelId = action.removeChatItemByAuthorAction.externalChannelId;
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i]!;
      if (isAuthored(item) && item.author.channelId === channelId) items.splice(i, 1);
    }
    return;
  }
  if (action.markChatItemAsDeletedAction) {
    const { targetItemId, deletedStateMessage, showOriginalContentMessage } = action.markChatItemAsDeletedAction;
    const index = items.findIndex((i) => i.id === targetItemId);
    const item = items[index];
    if (item && isAuthored(item)) items[index] = { ...item, deleted: deletedState(deletedStateMessage, showOriginalContentMessage) };
    return;
  }
  if (action.markChatItemsByAuthorAsDeletedAction) {
    const { externalChannelId, deletedStateMessage, showOriginalContentMessage } =
      action.markChatItemsByAuthorAsDeletedAction;
    const deleted = deletedState(deletedStateMessage, showOriginalContentMessage);
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      if (isAuthored(item) && item.author.channelId === externalChannelId) items[i] = { ...item, deleted };
    }
  }
  // Banners, tickers, polls, etc. are rendered by YouTube's native UI, which we keep.
}

/** Keys show up both URL-encoded (`…%3D`) and not, depending on where they come from. */
function normalizeKey(key: string): string {
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

function deletedState(text?: FormattedText, showOriginal?: FormattedText): DeletedState {
  // YouTube renders this as plain text (the bold moderator name isn't bold or highlighted).
  return { text: textOf(text) || '[message deleted]', showOriginalLabel: textOf(showOriginal) || undefined };
}
