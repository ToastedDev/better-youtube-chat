import { describe, expect, test } from 'vitest';
import type { ChatAction } from '../youtube/types';
import type { ChatItem } from './model';
import { argbToCss, parseItem, parseText, plainText } from './parse';
import giftPurchase from './fixtures/gift-purchase.json';
import giftRedemption from './fixtures/gift-redemption.json';
import memberMilestoneEmpty from './fixtures/member-milestone-empty.json';
import memberMilestone from './fixtures/member-milestone.json';
import memberNew from './fixtures/member-new.json';
import paidMessage from './fixtures/paid-message.json';
import paidSticker from './fixtures/paid-sticker.json';
import textEmoji from './fixtures/text-emoji.json';

/** Parses a fixture's `addChatItemAction` and checks it produced the expected kind. */
function parse<K extends ChatItem['kind']>(fixture: unknown, kind: K): Extract<ChatItem, { kind: K }> {
  const item = parseItem((fixture as ChatAction).addChatItemAction!.item);
  expect(item?.kind).toBe(kind);
  return item as Extract<ChatItem, { kind: K }>;
}

describe('text messages', () => {
  test('custom emoji and text', () => {
    const item = parse(textEmoji, 'text');
    expect(item.author).toMatchObject({ name: '@viewer1', channelId: 'UC_channel_1', isMember: true });
    expect(item.author.badges).toEqual([
      // The 32px image, not the 16px one.
      { kind: 'image', src: 'https://yt3.ggpht.com/placeholder-6', label: 'New member' },
    ]);
    expect(item.message).toHaveLength(3);
    expect(item.message[0]).toEqual({
      type: 'emoji',
      // The 48px image, not the 24px one.
      src: 'https://yt3.ggpht.com/placeholder-2',
      alt: ':_channel_emoji:',
      label: ':_channel_emoji:',
      custom: true,
    });
    expect(plainText(item.message)).toBe(':_channel_emoji::_channel_emoji:Example chat message');
    expect(item.menuParams).toBeTruthy();
  });

  test('replay video time', () => {
    expect(parse(textEmoji, 'text').timestampText).toBe('1:47:37');
  });
});

describe('Super Chats', () => {
  test('amount, colors and buttons', () => {
    const item = parse(paidMessage, 'paid');
    // YouTube puts a no-break space between the currency and the number.
    expect(item.amount).toBe('ARS 2,000.00');
    expect(plainText(item.message)).toBe('Example Super Chat message');
    expect(item.v2).toBe(true);
    expect(item.colors).toEqual({
      header: 'rgba(208, 0, 0, 1)',
      headerText: 'rgba(255, 255, 255, 1)',
      body: 'rgba(230, 33, 23, 1)',
      bodyText: 'rgba(255, 255, 255, 1)',
      authorName: 'rgba(255, 255, 255, 0.702)',
    });
    expect(item.reply?.placeholder).toBe('Reply');
    expect(item.reply?.command.showEngagementPanelEndpoint).toBeDefined();
    expect(item.timestampText).toBe('10:26');
  });
});

describe('Super Stickers', () => {
  test('sticker, amount and the 1st Super extras', () => {
    const item = parse(paidSticker, 'sticker');
    expect(item.amount).toBe('NT$1,490.00');
    expect(item.sticker).toMatchObject({ width: 144, height: 144 });
    expect(item.sticker.label).toMatch(/^Shiba dog wearing samurai armor/);
    // "Copy message" copies the sticker's description.
    expect(plainText(item.message)).toBe(item.sticker.label);
    expect(item.colors.background).toBe('rgba(233, 30, 99, 1)');
    expect(item.overlay).toBeTruthy();
    expect(item.bumper).toEqual({
      text: "Let's celebrate their 1st Super on a live stream",
      icon: 'CELEBRATION',
      iconColor: 'rgba(255, 0, 0, 1)',
    });
    expect(item.timestampText).toBe('1:49:36');
  });
});

describe('memberships', () => {
  test('new member', () => {
    const item = parse(memberNew, 'membership');
    expect(item.primary).toEqual([]);
    expect(plainText(item.subtext)).toBe('Welcome to Level One!');
    expect(item.message).toEqual([]);
    expect(item.timestampText).toBe('1:47:11');
  });

  test('milestone with a message', () => {
    const item = parse(memberMilestone, 'membership');
    expect(plainText(item.primary)).toBe('Member for 7 months');
    expect(plainText(item.subtext)).toBe('Level One');
    expect(plainText(item.message)).toBe('Example milestone message');
    expect(item.timestampText).toBe('1:19:37');
  });

  test('milestone without a message', () => {
    const item = parse(memberMilestoneEmpty, 'membership');
    expect(plainText(item.primary)).toBe('Member for 8 months');
    expect(item.message).toEqual([]);
  });

  test('gift purchase', () => {
    const item = parse(giftPurchase, 'membership');
    expect(item.author.name).toBe('@viewer3');
    expect(plainText(item.primary)).toBe('Sent 20 Example Channel gift memberships');
    expect(item.image).toBe('https://yt3.ggpht.com/placeholder-21');
    expect(item.message).toEqual([]);
  });

  test('gift redemption is a system line in the recipient’s name', () => {
    const item = parse(giftRedemption, 'text');
    expect(item.system).toBe(true);
    expect(item.author.name).toBe('@viewer6');
    expect(item.message).toEqual([
      { type: 'text', text: 'received a gift membership by ', italic: true },
      { type: 'text', text: '@viewer3', bold: true, italic: true },
    ]);
  });
});

describe('helpers', () => {
  test('argbToCss unpacks unsigned ARGB', () => {
    expect(argbToCss(0xffff0000)).toBe('rgba(255, 0, 0, 1)');
    expect(argbToCss(0x80000000)).toBe('rgba(0, 0, 0, 0.502)');
    expect(argbToCss(undefined)).toBeUndefined();
  });

  test('parseText resolves links and keeps formatting', () => {
    const segments = parseText({
      runs: [
        { text: 'see ' },
        { text: 'here', bold: true, navigationEndpoint: { urlEndpoint: { url: '/watch?v=abc' } } },
      ],
    });
    expect(segments).toEqual([
      { type: 'text', text: 'see ', bold: undefined, italic: undefined, href: undefined },
      { type: 'text', text: 'here', bold: true, italic: undefined, href: 'https://www.youtube.com/watch?v=abc' },
    ]);
  });

  test('unknown renderers are skipped', () => {
    expect(parseItem({ someFutureRenderer: {} })).toBeNull();
  });
});
