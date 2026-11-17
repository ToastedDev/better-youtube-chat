import { describe, expect, test } from 'vitest';
import type { ChatAction } from '../youtube/types';
import type { ChatItem } from './model';
import { argbToCss, parseItem, parseText, plainText } from './parse';
import automod from './fixtures/automod.json';
import donation from './fixtures/donation.json';
import engagementPoll from './fixtures/engagement-poll.json';
import engagementWelcome from './fixtures/engagement-welcome.json';
import giftPurchase from './fixtures/gift-purchase.json';
import giftRedemption from './fixtures/gift-redemption.json';
import memberMilestoneEmpty from './fixtures/member-milestone-empty.json';
import memberMilestone from './fixtures/member-milestone.json';
import jewelsGift from './fixtures/jewels-gift.json';
import memberNew from './fixtures/member-new.json';
import modeChange from './fixtures/mode-change.json';
import paidLike from './fixtures/paid-like.json';
import paidMessage from './fixtures/paid-message.json';
import paidSticker from './fixtures/paid-sticker.json';
import placeholder from './fixtures/placeholder.json';
import textCanModerate from './fixtures/text-can-moderate.json';
import textDeletedState from './fixtures/text-deleted-state.json';
import textEmoji from './fixtures/text-emoji.json';
import textModerator from './fixtures/text-moderator.json';
import textOwner from './fixtures/text-owner.json';
import textRankChip from './fixtures/text-rank-chip.json';
import textReplyChip from './fixtures/text-reply-chip.json';

/** Parses a fixture's added (or replacement) item and checks it produced the expected kind. */
function parse<K extends ChatItem['kind']>(fixture: unknown, kind: K): Extract<ChatItem, { kind: K }> {
  const action = fixture as ChatAction;
  const item = parseItem((action.addChatItemAction?.item ?? action.replaceChatItemAction?.replacementItem)!);
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

describe('badges and chips', () => {
  test('owner', () => {
    const item = parse(textOwner, 'text');
    expect(item.author).toMatchObject({ isOwner: true, isModerator: false });
    // The owner badge has no icon of its own (the name chip shows it) but still sets the role.
    expect(item.author.badges).toEqual([{ kind: 'icon', icon: 'OWNER', label: 'Owner' }]);
  });

  test('verified moderator', () => {
    const item = parse(textModerator, 'text');
    expect(item.author).toMatchObject({ isModerator: true, isVerified: true, isMember: false });
    expect(item.author.badges.map((b) => b.label)).toEqual(['Verified', 'Moderator']);
    expect(plainText(item.message)).toBe('@viewer7 Example message');
  });

  test('viewer leaderboard rank', () => {
    const item = parse(textRankChip, 'text');
    expect(item.chips).toEqual([
      expect.objectContaining({ label: '#3', icon: 'CROWN_FILLED', background: 'rgba(221, 152, 255, 1)' }),
    ]);
    expect(item.chips[0]!.command).toBeDefined();
  });

  test('Super Chat reply', () => {
    const item = parse(textReplyChip, 'text');
    // "@name 💬": the icon goes after the label.
    expect(item.chips).toEqual([
      expect.objectContaining({ label: '@viewer6', icon: 'MESSAGE', iconTrailing: true }),
    ]);
  });

  test('moderators can act on messages', () => {
    expect(parse(textCanModerate, 'text').canModerate).toBe(true);
    expect(parse(textEmoji, 'text').canModerate).toBe(false);
  });
});

describe('moderation', () => {
  test('AutoMod held message', () => {
    const item = parse(automod, 'automod');
    expect(item.author.name).toBe('@viewer1');
    expect(plainText(item.header)).toBe('This message is held for review.');
    expect(plainText(item.message)).toBe('Example message');
    expect(item.info?.label).toBe('More information');
    expect(item.info?.command.liveChatDialogEndpoint).toBeDefined();
    expect(item.actions.map((a) => a.label)).toEqual(['Show', 'Hide']);
    expect(item.actions.every((a) => a.command.moderateLiveChatEndpoint)).toBe(true);
    expect(item.canModerate).toBe(true);
  });

  test('AutoMod: Hide replaces the held message with a deleted one', () => {
    const item = parse(textDeletedState, 'text');
    expect(item.deleted).toEqual({
      text: 'Message automatically held for review, hidden by @viewer2.',
      showOriginalLabel: 'View deleted message',
    });
  });
});

describe('other items', () => {
  test('Jewels gift', () => {
    const item = parse(jewelsGift, 'gift');
    // YouTube pads the name with spaces.
    expect(item.authorName).toBe('@viewer3');
    expect(item.text).toBe('sent Go team!');
    expect(item.image).toBeTruthy();
    expect(item.imageLabel).toBe('@viewer3 sent a gift, Go team!');
  });

  test('fundraiser donation', () => {
    const item = parse(donation, 'donation');
    expect(plainText(item.text)).toBe('Anonymous donated $50.00');
    expect(plainText(item.subtext)).toBe('to Example Fundraiser');
  });

  test('welcome message with its Learn more link inline', () => {
    const item = parse(engagementWelcome, 'engagement');
    expect(item.icon).toBe('YOUTUBE_ROUND');
    expect(item.message.at(-1)).toEqual({
      type: 'text',
      text: 'Learn more',
      href: 'https://support.google.com/youtube/answer/2853856?hl=en#safe',
    });
  });

  test('poll results', () => {
    const item = parse(engagementPoll, 'engagement');
    expect(item.icon).toBe('POLL');
    expect(plainText(item.message)).toBe('Example poll\na (50%)\nb (50%)\nc (0%)\nd (0%)\n\nPoll complete: 2 votes');
  });

  test('chat mode change', () => {
    const item = parse(modeChange, 'mode-change');
    expect(plainText(item.text)).toBe('Slow mode is on');
    expect(plainText(item.subtext)).toBe('Send a message every 1 minute');
  });

  test('placeholder', () => {
    expect(parse(placeholder, 'placeholder')).toEqual({ kind: 'placeholder', id: 'item-6' });
  });

  test('Super Chat like, reply and heart', () => {
    const item = parse(paidLike, 'paid');
    expect(item.like).toMatchObject({ placeholder: 'Like' });
    expect(item.like?.like).toBeDefined();
    expect(item.like?.unlike).toBeDefined();
    expect(item.reply?.placeholder).toBe('Reply');
    expect(item.heart?.label).toBe('❤ by @viewer12');
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
