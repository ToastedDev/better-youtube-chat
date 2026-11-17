import { describe, expect, test } from 'vitest';
import type { ChatAction } from '../youtube/types';
import { ChatStore } from './store.svelte';
import automod from './fixtures/automod.json';
import automodShown from './fixtures/automod-shown.json';
import markDeleted from './fixtures/mark-deleted.json';
import memberNew from './fixtures/member-new.json';
import paidSticker from './fixtures/paid-sticker.json';
import placeholder from './fixtures/placeholder.json';
import removeItem from './fixtures/remove-item.json';
import textEmoji from './fixtures/text-emoji.json';

/** A copy of a fixture's action with a fresh id (and optionally another author). */
function withId(fixture: unknown, id: string, channelId?: string): ChatAction {
  const action = structuredClone(fixture) as ChatAction;
  const add = action.addChatItemAction!;
  delete add.clientId;
  const renderer = Object.values(add.item)[0] as { id: string; authorExternalChannelId?: string };
  renderer.id = id;
  if (channelId) renderer.authorExternalChannelId = channelId;
  return action;
}

const ids = (store: ChatStore) => store.items.map((i) => i.id);

describe('live chat', () => {
  test('adds items in order and ignores duplicates', () => {
    const store = new ChatStore();
    store.apply({ reset: true, actions: [withId(textEmoji, 'a'), withId(memberNew, 'b')] });
    store.apply({ reset: false, actions: [withId(textEmoji, 'a'), withId(paidSticker, 'c')] });
    expect(ids(store)).toEqual(['a', 'b', 'c']);
  });

  test('reset replaces the list', () => {
    const store = new ChatStore();
    store.apply({ reset: true, actions: [withId(textEmoji, 'a')] });
    store.apply({ reset: true, actions: [withId(textEmoji, 'b')] });
    expect(ids(store)).toEqual(['b']);
  });

  test('the sent message replaces its local copy in place', () => {
    const store = new ChatStore();
    store.apply({ reset: true, actions: [withId(textEmoji, 'local-1'), withId(textEmoji, 'other')] });
    const real = withId(textEmoji, 'real-1');
    real.addChatItemAction!.clientId = 'local-1';
    store.apply({ reset: false, actions: [real] });
    expect(ids(store)).toEqual(['real-1', 'other']);
  });

  test('a failed send is marked', () => {
    const store = new ChatStore();
    store.apply({ reset: true, actions: [withId(textEmoji, 'local-1')] });
    store.apply({ reset: false, actions: [{ bytcSendFailedAction: { targetItemId: 'local-1' } }] });
    expect(store.items[0]).toMatchObject({ kind: 'text', sendFailed: true });
  });

  test('deleted, removed and per-author actions', () => {
    const store = new ChatStore();
    store.apply({
      reset: true,
      actions: [withId(textEmoji, 'a', 'UC_x'), withId(textEmoji, 'b', 'UC_y'), withId(textEmoji, 'c', 'UC_x')],
    });
    store.apply({
      reset: false,
      actions: [{ markChatItemAsDeletedAction: { targetItemId: 'b', deletedStateMessage: { simpleText: '[message retracted]' } } }],
    });
    expect(store.items[1]).toMatchObject({ deleted: { text: '[message retracted]' } });

    store.apply({ reset: false, actions: [{ removeChatItemByAuthorAction: { externalChannelId: 'UC_x' } }] });
    expect(ids(store)).toEqual(['b']);

    store.apply({ reset: false, actions: [{ removeChatItemAction: { targetItemId: 'b' } }] });
    expect(ids(store)).toEqual([]);
  });

  test('a placeholder is filled in place', () => {
    const store = new ChatStore();
    store.apply({
      reset: true,
      actions: [
        { addChatItemAction: { item: { liveChatPlaceholderItemRenderer: { id: 'slot' } } } },
        withId(textEmoji, 'after'),
      ],
    });
    store.apply({ reset: false, actions: [withId(paidSticker, 'slot')] });
    expect(store.items.map((i) => i.kind)).toEqual(['sticker', 'text']);
  });
});

describe('moderation actions (real samples)', () => {
  test('AutoMod: Show replaces the held message with the public one', () => {
    const store = new ChatStore();
    store.apply({ reset: true, actions: [automod as ChatAction, withId(textEmoji, 'after')] });
    expect(store.items[0]).toMatchObject({ id: 'item-1', kind: 'automod' });

    store.apply({ reset: false, actions: [automodShown as ChatAction] });
    expect(store.items[0]).toMatchObject({ id: 'item-1', kind: 'text' });
    expect(ids(store)).toEqual(['item-1', 'after']);
  });

  test('a retracted message', () => {
    const store = new ChatStore();
    store.apply({ reset: true, actions: [withId(textEmoji, 'item-4')] });
    store.apply({ reset: false, actions: [markDeleted as ChatAction] });
    expect(store.items[0]).toMatchObject({ deleted: { text: '[message retracted]' } });
  });

  test('a removed message', () => {
    const store = new ChatStore();
    store.apply({ reset: true, actions: [withId(textEmoji, 'item-5'), withId(textEmoji, 'other')] });
    store.apply({ reset: false, actions: [removeItem as ChatAction] });
    expect(ids(store)).toEqual(['other']);
  });

  test('a placeholder slot is filled when its item arrives', () => {
    const store = new ChatStore();
    store.apply({ reset: true, actions: [placeholder as ChatAction, withId(textEmoji, 'after')] });
    store.apply({ reset: false, actions: [withId(paidSticker, 'item-6')] });
    expect(store.items.map((i) => [i.id, i.kind])).toEqual([
      ['item-6', 'sticker'],
      ['after', 'text'],
    ]);
  });
});

describe('chat replay', () => {
  const at = (ms: number, ...actions: ChatAction[]): ChatAction => ({
    replayChatItemAction: { actions, videoOffsetTimeMsec: String(ms) },
  });

  test('shows the actions at or before the video time', () => {
    const store = new ChatStore();
    store.apply({
      reset: true,
      actions: [at(1000, withId(textEmoji, 'a')), at(5000, withId(memberNew, 'b')), at(9000, withId(paidSticker, 'c'))],
    });
    expect(ids(store)).toEqual([]);

    store.setVideoTime(5);
    expect(ids(store)).toEqual(['a', 'b']);

    store.setVideoTime(9.5);
    expect(ids(store)).toEqual(['a', 'b', 'c']);

    // Seeking back hides what's after the new time.
    store.setVideoTime(2);
    expect(ids(store)).toEqual(['a']);
  });

  test('overlapping chunks add each action once', () => {
    const store = new ChatStore();
    store.apply({ reset: true, actions: [at(1000, withId(textEmoji, 'a')), at(2000, withId(textEmoji, 'b'))] });
    store.apply({ reset: false, actions: [at(2000, withId(textEmoji, 'b')), at(3000, withId(textEmoji, 'c'))] });
    store.setVideoTime(10);
    expect(ids(store)).toEqual(['a', 'b', 'c']);
  });
});
