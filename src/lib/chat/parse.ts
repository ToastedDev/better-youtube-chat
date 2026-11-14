import type {
  AuthorBadge,
  ChatItemRenderer,
  FormattedText,
  LiveChatTextMessageRenderer,
  NavigationEndpoint,
  Thumbnails,
} from '../youtube/types';
import type { Badge, ChatItem, Chip, Segment, TextChatItem } from './model';

/** Largest thumbnail (crisp on HiDPI). */
export function bestThumbnail(thumbs?: Thumbnails): string | undefined {
  const list = thumbs?.thumbnails;
  if (!list?.length) return undefined;
  return list.reduce((a, b) => ((b.width ?? 0) > (a.width ?? 0) ? b : a)).url;
}

function endpointUrl(endpoint?: NavigationEndpoint): string | undefined {
  const raw = endpoint?.urlEndpoint?.url ?? endpoint?.commandMetadata?.webCommandMetadata?.url;
  if (!raw) return undefined;
  try {
    return new URL(raw, 'https://www.youtube.com').href;
  } catch {
    return undefined;
  }
}

export function parseText(text?: FormattedText): Segment[] {
  if (!text) return [];
  if (text.simpleText != null) return [{ type: 'text', text: text.simpleText }];
  const out: Segment[] = [];
  for (const run of text.runs ?? []) {
    if ('emoji' in run) {
      const { emoji } = run;
      const shortcut = emoji.shortcuts?.[0];
      const label = emoji.image.accessibility?.accessibilityData?.label ?? shortcut ?? emoji.emojiId;
      out.push({
        type: 'emoji',
        src: bestThumbnail(emoji.image) ?? '',
        // Unicode emoji copy as the character itself; custom ones as their :shortcut:.
        alt: emoji.isCustomEmoji ? (shortcut ?? label) : emoji.emojiId,
        label: shortcut ?? label,
        custom: !!emoji.isCustomEmoji,
      });
    } else {
      out.push({
        type: 'text',
        text: run.text,
        bold: run.bold || undefined,
        italic: run.italics || undefined,
        href: endpointUrl(run.navigationEndpoint),
      });
    }
  }
  return out;
}

export function plainText(segments: Segment[]): string {
  return segments.map((s) => (s.type === 'text' ? s.text : s.alt)).join('');
}

export function textOf(text?: FormattedText): string {
  return plainText(parseText(text));
}

/** YouTube packs colors as unsigned ARGB ints. */
export function argbToCss(argb?: number): string | undefined {
  if (argb == null) return undefined;
  const a = (argb >>> 24) & 0xff;
  const r = (argb >>> 16) & 0xff;
  const g = (argb >>> 8) & 0xff;
  const b = argb & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${+(a / 255).toFixed(3)})`;
}

function parseBadges(raw: AuthorBadge[] = []): Badge[] {
  const badges: Badge[] = [];
  for (const b of raw) {
    const r = b.liveChatAuthorBadgeRenderer;
    if (!r) continue;
    const label = r.tooltip ?? '';
    const src = bestThumbnail(r.customThumbnail);
    if (src) badges.push({ kind: 'image', src, label });
    else if (r.icon?.iconType) badges.push({ kind: 'icon', icon: r.icon.iconType, label });
  }
  return badges;
}

function parseTextMessage(r: LiveChatTextMessageRenderer): TextChatItem {
  const badges = parseBadges(r.authorBadges);
  const iconTypes = new Set(badges.flatMap((b) => (b.kind === 'icon' ? [b.icon] : [])));
  const chips: Chip[] = [];
  for (const button of r.beforeContentButtons ?? []) {
    const vm = button.buttonViewModel;
    if (!vm?.title) continue;
    chips.push({
      label: vm.title,
      icon: vm.iconName,
      background: argbToCss(vm.customBackgroundColor),
      color: argbToCss(vm.customFontColor),
    });
  }
  return {
    kind: 'text',
    id: r.id,
    timestampUsec: r.timestampUsec,
    author: {
      name: textOf(r.authorName),
      channelId: r.authorExternalChannelId,
      photo: bestThumbnail(r.authorPhoto),
      badges,
      isOwner: iconTypes.has('OWNER'),
      isModerator: iconTypes.has('MODERATOR'),
      isVerified: iconTypes.has('VERIFIED'),
      isMember: badges.some((b) => b.kind === 'image'),
    },
    message: parseText(r.message),
    chips,
    menuParams: r.contextMenuEndpoint?.liveChatItemContextMenuEndpoint?.params,
  };
}

const unknownRenderers = new Set<string>();

export function parseItem(item: ChatItemRenderer): ChatItem | null {
  if (item.liveChatTextMessageRenderer) return parseTextMessage(item.liveChatTextMessageRenderer);
  if (item.liveChatViewerEngagementMessageRenderer) {
    const r = item.liveChatViewerEngagementMessageRenderer;
    return { kind: 'engagement', id: r.id, message: parseText(r.message) };
  }
  // Superchats, memberships, stickers, etc. are not handled yet.
  if (import.meta.env.DEV) {
    for (const key of Object.keys(item)) {
      if (!unknownRenderers.has(key)) {
        unknownRenderers.add(key);
        console.debug('[better-yt-chat] unhandled chat item renderer', key, item[key]);
      }
    }
  }
  return null;
}
