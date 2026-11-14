import type { ChatPayload } from '../protocol';
import type { ChatAction } from '../youtube/types';
import type { ChatItem } from './model';
import { parseItem, parseText } from './parse';

/** Items kept while following the bottom of the chat. */
const MAX_ITEMS = 400;
/** Hard cap while the user has scrolled up to read. */
const MAX_ITEMS_HOLDING = 2000;

export class ChatStore {
  items = $state.raw<ChatItem[]>([]);
  viewerName = $state.raw<string | undefined>(undefined);
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
  }

  /** Trim back down once the user returns to the bottom. */
  trim(): void {
    if (this.items.length > MAX_ITEMS) this.items = this.items.slice(-MAX_ITEMS);
  }
}

function applyAction(items: ChatItem[], action: ChatAction): void {
  if (action.addChatItemAction) {
    const item = parseItem(action.addChatItemAction.item);
    if (item && !items.some((i) => i.id === item.id)) items.push(item);
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
      if (item.kind === 'text' && item.author.channelId === channelId) items.splice(i, 1);
    }
    return;
  }
  if (action.markChatItemAsDeletedAction) {
    const { targetItemId, deletedStateMessage } = action.markChatItemAsDeletedAction;
    const index = items.findIndex((i) => i.id === targetItemId);
    const item = items[index];
    if (item?.kind === 'text') items[index] = { ...item, deleted: deletedMessage(deletedStateMessage) };
    return;
  }
  if (action.markChatItemsByAuthorAsDeletedAction) {
    const { externalChannelId, deletedStateMessage } = action.markChatItemsByAuthorAsDeletedAction;
    const deleted = deletedMessage(deletedStateMessage);
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      if (item.kind === 'text' && item.author.channelId === externalChannelId) items[i] = { ...item, deleted };
    }
  }
  // Banners, tickers, polls, etc. are rendered by YouTube's native UI, which we keep.
}

function deletedMessage(text: Parameters<typeof parseText>[0]) {
  const segments = parseText(text);
  return segments.length ? segments : parseText({ simpleText: '[message deleted]' });
}
