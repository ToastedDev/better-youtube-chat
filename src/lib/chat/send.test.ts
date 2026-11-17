import { describe, expect, test } from 'vitest';
import type { ChatAction } from '../youtube/types';
import { wasSent } from './send';
import { ChatStore } from './store.svelte';
import timeoutResponse from './fixtures/send-timeout-response.json';
import textEmoji from './fixtures/text-emoji.json';

/** The local copy YouTube shows while sending, under the client message id. */
function localCopy(id: string): ChatAction {
  const action = structuredClone(textEmoji) as ChatAction;
  const add = action.addChatItemAction!;
  delete add.clientId;
  add.item.liveChatTextMessageRenderer!.id = id;
  return action;
}

describe('send_message responses', () => {
  test('a viewer in a timeout: refused, with a dim action for the copy', () => {
    expect(wasSent(timeoutResponse, 'client-1')).toBe(false);
    expect(timeoutResponse.actions).toEqual([{ dimChatItemAction: { clientAssignedId: 'client-1' } }]);
    // The time left on the timeout, and the error YouTube shows under the input.
    expect(Number(timeoutResponse.timeoutDurationUsec)).toBeGreaterThan(0);
    expect(timeoutResponse.errorMessage.liveChatTextActionsErrorMessageRenderer.errorText.runs[0]!.text).toMatch(
      /placed in timeout/,
    );
  });

  test('sent: the response has the real message for the copy', () => {
    const real = structuredClone(textEmoji) as ChatAction;
    real.addChatItemAction!.clientId = 'client-1';
    expect(wasSent({ actions: [real] }, 'client-1')).toBe(true);
    // The real message for some other copy doesn't count.
    expect(wasSent({ actions: [real] }, 'client-2')).toBe(false);
  });

  test('no response (the request failed)', () => {
    expect(wasSent(undefined, 'client-1')).toBe(false);
    expect(wasSent({}, 'client-1')).toBe(false);
  });

  test('the store dims the copy from the response’s own action', () => {
    const store = new ChatStore();
    store.apply({ reset: true, actions: [localCopy('other'), localCopy('client-1')] });
    store.apply({ reset: false, actions: timeoutResponse.actions as ChatAction[] });
    expect(store.items.map((i) => [i.id, i.kind === 'text' && !!i.sendFailed])).toEqual([
      ['other', false],
      ['client-1', true],
    ]);
  });
});
