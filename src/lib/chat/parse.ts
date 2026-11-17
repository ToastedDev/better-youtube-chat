import type {
  AuthorBadge,
  AuthorFields,
  ChatItemRenderer,
  CreatorHeartViewModel,
  FormattedText,
  ImageSources,
  InlineActionButton,
  InnertubeCommand,
  LiveChatAutoModMessageRenderer,
  LiveChatMembershipItemRenderer,
  LiveChatPaidMessageRenderer,
  LiveChatPaidStickerRenderer,
  LiveChatSponsorshipsGiftPurchaseAnnouncementRenderer,
  LiveChatTextMessageRenderer,
  LowerBumper,
  NavigationEndpoint,
  PdgLikeViewModel,
  PdgReplyButtonViewModel,
  Thumbnails,
} from '../youtube/types';
import type {
  Author,
  AutoModChatItem,
  Badge,
  Bumper,
  ChatItem,
  Chip,
  CreatorHeart,
  DeletedState,
  GiftChatItem,
  LikeButton,
  MembershipChatItem,
  PaidChatItem,
  QuickAction,
  ReplyButton,
  Segment,
  StickerChatItem,
  TextChatItem,
} from './model';

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
    // OWNER has no visible icon (the name chip shows it) but still counts for the role.
    else if (r.icon?.iconType) badges.push({ kind: 'icon', icon: r.icon.iconType, label });
  }
  return badges;
}

/** Largest image of a view model `sources` list. */
function bestSource(image?: ImageSources): string | undefined {
  const list = image?.sources;
  if (!list?.length) return undefined;
  const url = list.reduce((a, b) => ((b.width ?? 0) > (a.width ?? 0) ? b : a)).url;
  return url.startsWith('//') ? `https:${url}` : url;
}

function parseAuthor(r: Omit<AuthorFields, 'authorExternalChannelId'>, channelId: string): Author {
  const badges = parseBadges(r.authorBadges);
  const iconTypes = new Set(badges.flatMap((b) => (b.kind === 'icon' ? [b.icon] : [])));
  return {
    name: textOf(r.authorName),
    channelId,
    photo: bestThumbnail(r.authorPhoto),
    badges,
    isOwner: iconTypes.has('OWNER'),
    isModerator: iconTypes.has('MODERATOR'),
    isVerified: iconTypes.has('VERIFIED'),
    isMember: badges.some((b) => b.kind === 'image'),
  };
}

/** The parts every authored item shares. */
function authored(r: AuthorFields & { id: string; timestampUsec: string; timestampText?: FormattedText }) {
  return {
    id: r.id,
    timestampUsec: r.timestampUsec,
    // Chat replay: every authored item carries its video time, not just text messages.
    timestampText: textOf(r.timestampText) || undefined,
    author: parseAuthor(r, r.authorExternalChannelId),
    menuParams: r.contextMenuEndpoint?.liveChatItemContextMenuEndpoint?.params,
    ...moderation(r.inlineActionButtons),
  };
}

/** Quick actions, and whether the viewer can moderate the item at all. */
function moderation(buttons?: InlineActionButton[]): { canModerate: boolean; quickActions: QuickAction[] } {
  const quickActions: QuickAction[] = [];
  for (const b of buttons ?? []) {
    const r = b.buttonRenderer;
    const command = r?.serviceEndpoint;
    if (!command) continue;
    quickActions.push({ label: r.tooltip ?? r.accessibility?.label ?? '', icon: r.icon?.iconType, command });
  }
  return { canModerate: !!buttons?.length, quickActions };
}

function parseTextMessage(r: LiveChatTextMessageRenderer): TextChatItem {
  const chips: Chip[] = [];
  for (const button of r.beforeContentButtons ?? []) {
    const vm = button.buttonViewModel;
    if (!vm?.title) continue;
    chips.push({
      label: vm.title,
      icon: vm.iconName,
      iconTrailing: vm.iconTrailing || undefined,
      background: argbToCss(vm.customBackgroundColor),
      color: argbToCss(vm.customFontColor),
      command: vm.onTap?.innertubeCommand,
    });
  }
  return {
    kind: 'text',
    ...authored(r),
    message: parseText(r.message),
    chips,
    deleted: r.deletedStateMessage ? deletedState(r.deletedStateMessage, r.showOriginalContentMessage) : undefined,
  };
}

export function deletedState(text?: FormattedText, showOriginal?: FormattedText): DeletedState {
  // YouTube renders this as plain text (the bold moderator name isn't bold or highlighted).
  return { text: textOf(text) || '[message deleted]', showOriginalLabel: textOf(showOriginal) || undefined };
}

function parseAutoMod(r: LiveChatAutoModMessageRenderer): AutoModChatItem | null {
  const inner = r.autoModeratedItem?.liveChatTextMessageRenderer;
  if (!inner) return null;
  const info = r.infoDialogButton?.buttonRenderer;
  const actions: AutoModChatItem['actions'] = [];
  for (const b of r.moderationButtons ?? []) {
    const label = textOf(b.buttonRenderer?.text);
    const command = b.buttonRenderer?.serviceEndpoint;
    if (label && command) actions.push({ label, command });
  }
  const message = parseTextMessage(inner);
  return {
    ...message,
    kind: 'automod',
    id: r.id,
    // The moderation quick actions sit on the outer renderer.
    ...(r.inlineActionButtons?.length ? moderation(r.inlineActionButtons) : {}),
    header: parseText(r.headerText),
    info: info?.navigationEndpoint
      ? { label: info.tooltip ?? 'More information', command: info.navigationEndpoint as InnertubeCommand }
      : undefined,
    actions,
  };
}

function parsePaidMessage(r: LiveChatPaidMessageRenderer): PaidChatItem {
  return {
    kind: 'paid',
    ...authored(r),
    message: parseText(r.message),
    amount: textOf(r.purchaseAmountText),
    v2: !!r.isV2Style,
    colors: {
      header: argbToCss(r.headerBackgroundColor),
      headerText: argbToCss(r.headerTextColor),
      body: argbToCss(r.bodyBackgroundColor),
      bodyText: argbToCss(r.bodyTextColor),
      authorName: argbToCss(r.authorNameTextColor),
    },
    like: parseLikeButton(r.pdgLikeButton?.pdgLikeViewModel),
    reply: parseReplyButton(r.replyButton?.pdgReplyButtonViewModel),
    heart: parseCreatorHeart(r.creatorHeartButton?.creatorHeartViewModel),
    overlay: bestThumbnail(r.headerOverlayImage),
    bumper: parseBumper(r.lowerBumper),
  };
}

function parseCreatorHeart(vm?: CreatorHeartViewModel): CreatorHeart | undefined {
  if (!vm?.engagementStateKey) return undefined;
  return { stateKey: vm.engagementStateKey, thumbnail: bestSource(vm.creatorThumbnail), label: vm.heartedHoverText };
}

function parseLikeButton(vm?: PdgLikeViewModel): LikeButton | undefined {
  const toggle = vm?.toggleButton?.toggleButtonViewModel;
  const off = toggle?.defaultButtonViewModel?.buttonViewModel;
  const on = toggle?.toggledButtonViewModel?.buttonViewModel;
  const like = off?.onTap?.innertubeCommand;
  const unlike = on?.onTap?.innertubeCommand;
  if (!vm?.likeCountEntityKey || !like || !unlike) return undefined;
  return {
    countKey: vm.likeCountEntityKey,
    stateKey: vm.engagementStateKey,
    placeholder: vm.likeCountPlaceholder?.content ?? 'Like',
    like,
    unlike,
    background: argbToCss(off.customBackgroundColor),
    color: argbToCss(off.customFontColor),
  };
}

function parseReplyButton(vm?: PdgReplyButtonViewModel): ReplyButton | undefined {
  const button = vm?.replyButton?.buttonViewModel;
  const command = button?.onTap?.innertubeCommand;
  if (!vm?.replyCountEntityKey || !command) return undefined;
  return {
    countKey: vm.replyCountEntityKey,
    placeholder: vm.replyCountPlaceholder?.content ?? 'Reply',
    command,
    background: argbToCss(button.customBackgroundColor),
    color: argbToCss(button.customFontColor),
  };
}

function parsePaidSticker(r: LiveChatPaidStickerRenderer): StickerChatItem {
  const label = r.sticker?.accessibility?.accessibilityData?.label ?? '';
  return {
    kind: 'sticker',
    ...authored(r),
    // Copying a sticker gives its description, e.g. "Cat dancing with a heart".
    message: label ? [{ type: 'text', text: label }] : [],
    amount: textOf(r.purchaseAmountText),
    sticker: {
      src: bestThumbnail(r.sticker) ?? '',
      label,
      width: r.stickerDisplayWidth ?? 72,
      height: r.stickerDisplayHeight ?? 72,
    },
    v2: !!r.isV2Style,
    colors: {
      background: argbToCss(r.backgroundColor),
      amount: argbToCss(r.moneyChipTextColor),
      authorName: argbToCss(r.authorNameTextColor),
    },
    overlay: bestThumbnail(r.headerOverlayImage),
    bumper: parseBumper(r.lowerBumper),
  };
}

function parseBumper(raw?: LowerBumper): Bumper | undefined {
  const content = raw?.liveChatItemBumperViewModel?.content?.bumperUserEduContentViewModel;
  const text = content?.text?.content;
  if (!text) return undefined;
  const icon = content.image?.sources?.[0]?.clientResource;
  return { text, icon: icon?.imageName, iconColor: argbToCss(icon?.imageColor) };
}

function parseMembership(r: LiveChatMembershipItemRenderer): MembershipChatItem {
  return {
    kind: 'membership',
    ...authored(r),
    message: parseText(r.message),
    primary: parseText(r.headerPrimaryText),
    subtext: parseText(r.headerSubtext),
  };
}

function parseGiftPurchase(r: LiveChatSponsorshipsGiftPurchaseAnnouncementRenderer): MembershipChatItem | null {
  const header = r.header?.liveChatSponsorshipsHeaderRenderer;
  if (!header) return null;
  return {
    kind: 'membership',
    id: r.id,
    timestampUsec: r.timestampUsec,
    author: parseAuthor(header, r.authorExternalChannelId),
    menuParams: header.contextMenuEndpoint?.liveChatItemContextMenuEndpoint?.params,
    ...moderation(header.inlineActionButtons),
    message: [],
    primary: parseText(header.primaryText),
    subtext: [],
    image: bestThumbnail(header.image),
  };
}

function parseGift(r: NonNullable<ChatItemRenderer['giftMessageViewModel']>): GiftChatItem {
  return {
    kind: 'gift',
    id: r.id,
    authorName: r.authorName?.content?.trim() ?? '',
    photo: bestSource(r.authorAvatar?.avatarViewModel?.image),
    text: r.text?.content ?? '',
    image: bestSource(r.giftImage),
    imageLabel: r.giftImageA11yLabel,
  };
}

const unknownRenderers = new Set<string>();

export function parseItem(item: ChatItemRenderer): ChatItem | null {
  if (item.liveChatTextMessageRenderer) return parseTextMessage(item.liveChatTextMessageRenderer);
  if (item.liveChatAutoModMessageRenderer) return parseAutoMod(item.liveChatAutoModMessageRenderer);
  if (item.liveChatPaidMessageRenderer) return parsePaidMessage(item.liveChatPaidMessageRenderer);
  if (item.liveChatPaidStickerRenderer) return parsePaidSticker(item.liveChatPaidStickerRenderer);
  if (item.liveChatMembershipItemRenderer) return parseMembership(item.liveChatMembershipItemRenderer);
  if (item.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer) {
    return parseGiftPurchase(item.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer);
  }
  if (item.liveChatSponsorshipsGiftRedemptionAnnouncementRenderer) {
    // "received a gift membership by @x": a chat line in the recipient's name.
    const r = item.liveChatSponsorshipsGiftRedemptionAnnouncementRenderer;
    return { kind: 'text', ...authored(r), message: parseText(r.message), chips: [], system: true };
  }
  if (item.giftMessageViewModel) return parseGift(item.giftMessageViewModel);
  if (item.liveChatDonationAnnouncementRenderer) {
    const r = item.liveChatDonationAnnouncementRenderer;
    return {
      kind: 'donation',
      id: r.id,
      photo: bestThumbnail(r.authorPhoto),
      text: parseText(r.text),
      subtext: parseText(r.subtext),
    };
  }
  if (item.liveChatPlaceholderItemRenderer) return { kind: 'placeholder', id: item.liveChatPlaceholderItemRenderer.id };
  if (item.liveChatViewerEngagementMessageRenderer) {
    const r = item.liveChatViewerEngagementMessageRenderer;
    const message = parseText(r.message);
    // "Learn more" arrives as a separate button; YouTube shows it inline after the text.
    const button = r.actionButton?.buttonRenderer;
    const label = textOf(button?.text);
    const href = endpointUrl(button?.navigationEndpoint);
    if (label && href) message.push({ type: 'text', text: ' ' }, { type: 'text', text: label, href });
    return { kind: 'engagement', id: r.id, message, icon: r.icon?.iconType };
  }
  if (item.liveChatModeChangeMessageRenderer) {
    const r = item.liveChatModeChangeMessageRenderer;
    return { kind: 'mode-change', id: r.id, text: parseText(r.text), subtext: parseText(r.subtext) };
  }
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
