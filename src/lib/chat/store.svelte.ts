import type { ChatPayload } from '../protocol';
import type { ChatAction, EntityMutation, FormattedText } from '../youtube/types';
import { isAuthored, type ChatItem, type DeletedState } from './model';
import { parseItem, textOf } from './parse';

/** Items kept while following the bottom of the chat. */
const MAX_ITEMS = 400;
/** Hard cap while the user has scrolled up to read. */
const MAX_ITEMS_HOLDING = 2000;
/** Entities kept before dropping the ones no item refers to any more. */
const MAX_ENTITIES = 1000;

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

  apply(payload: ChatPayload): void {
    if (payload.viewerName) this.viewerName = payload.viewerName;
    const next = payload.reset ? [] : this.items.slice();
    for (const action of payload.actions) applyAction(next, action);
    const max = this.holding ? MAX_ITEMS_HOLDING : MAX_ITEMS;
    if (next.length > max) next.splice(0, next.length - max);
    if (payload.reset || next.length !== this.items.length || next.some((item, i) => item !== this.items[i])) {
      this.items = next;
    }
    if (payload.entities?.length) this.applyEntities(payload.entities);
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
