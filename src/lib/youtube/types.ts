/**
 * Loose typings for the parts of YouTube's innertube live chat payloads that we use.
 * Shapes were taken from real `get_live_chat` responses (see RESEARCH.md).
 */

export interface Thumbnail {
  url: string;
  width?: number;
  height?: number;
}

export interface Thumbnails {
  thumbnails: Thumbnail[];
}

export interface NavigationEndpoint {
  commandMetadata?: { webCommandMetadata?: { url?: string } };
  urlEndpoint?: { url: string };
  watchEndpoint?: { videoId: string };
  browseEndpoint?: { browseId: string };
}

export interface TextRun {
  text: string;
  bold?: boolean;
  italics?: boolean;
  navigationEndpoint?: NavigationEndpoint;
}

export interface YtEmoji {
  emojiId: string;
  shortcuts?: string[];
  searchTerms?: string[];
  isCustomEmoji?: boolean;
  image: Thumbnails & { accessibility?: { accessibilityData?: { label?: string } } };
}

export interface EmojiRun {
  emoji: YtEmoji;
}

export type Run = TextRun | EmojiRun;

export interface FormattedText {
  runs?: Run[];
  simpleText?: string;
}

export interface AuthorBadge {
  liveChatAuthorBadgeRenderer?: {
    customThumbnail?: Thumbnails;
    icon?: { iconType: string };
    tooltip?: string;
  };
}

export interface ButtonViewModel {
  iconName?: string;
  title?: string;
  accessibilityText?: string;
  /** ARGB packed into an unsigned 32-bit int. */
  customBackgroundColor?: number;
  customFontColor?: number;
  iconTrailing?: boolean;
  onTap?: { innertubeCommand?: InnertubeCommand };
}

export interface LiveChatTextMessageRenderer extends AuthorFields {
  id: string;
  timestampUsec: string;
  /** Chat replay: the video time it was sent at, e.g. "1:23:45" ("-5:35" before the stream began). */
  timestampText?: FormattedText;
  message?: FormattedText;
  beforeContentButtons?: { buttonViewModel?: ButtonViewModel }[];
  /** Set when the message arrives already deleted or hidden (e.g. a held message a moderator hid). */
  deletedStateMessage?: FormattedText;
  showOriginalContentMessage?: FormattedText;
}

export interface ButtonRenderer {
  text?: FormattedText;
  icon?: { iconType: string };
  tooltip?: string;
  navigationEndpoint?: NavigationEndpoint;
  serviceEndpoint?: InnertubeCommand;
}

/**
 * Moderators only: a message AutoMod held for review, with Show / Hide buttons. Either choice
 * replaces it (`replaceChatItemAction`) with the plain message, shown or marked hidden.
 */
export interface LiveChatAutoModMessageRenderer {
  id: string;
  timestampUsec: string;
  autoModeratedItem?: ChatItemRenderer;
  /** "This message is held for review." */
  headerText?: FormattedText;
  /** The warning icon; its `navigationEndpoint` opens YouTube's explanation dialog. */
  infoDialogButton?: { buttonRenderer?: ButtonRenderer };
  moderationButtons?: { buttonRenderer?: ButtonRenderer }[];
  authorExternalChannelId?: string;
  inlineActionButtons?: unknown[];
}

/** "Slow mode is on", "@channel turned on subscribers-only mode", and the matching "off" messages. */
export interface LiveChatModeChangeMessageRenderer {
  id: string;
  timestampUsec?: string;
  icon?: { iconType: string };
  text?: FormattedText;
  subtext?: FormattedText;
}

export interface LiveChatViewerEngagementMessageRenderer {
  id: string;
  timestampUsec?: string;
  message?: FormattedText;
  icon?: { iconType: string };
  actionButton?: { buttonRenderer?: ButtonRenderer };
}

/** Author fields most chat item renderers share. */
export interface AuthorFields {
  authorName?: FormattedText;
  authorPhoto?: Thumbnails;
  authorExternalChannelId: string;
  authorBadges?: AuthorBadge[];
  contextMenuEndpoint?: { liveChatItemContextMenuEndpoint?: { params: string } };
  /** Present when the viewer can moderate (Remove / timeout / hide quick actions). */
  inlineActionButtons?: unknown[];
}

/** Any innertube command, e.g. `{ liveChatActionEndpoint: {...} }`; run through YouTube's resolver. */
export type InnertubeCommand = Record<string, unknown>;

export interface ButtonWithCommand {
  buttonViewModel?: ButtonViewModel;
}

/** Super Chat Like button. The count lives in a `likeCountEntity` in `frameworkUpdates`. */
export interface PdgLikeViewModel {
  likeCountEntityKey?: string;
  engagementStateKey?: string;
  likeCountPlaceholder?: AttributedString;
  toggleButton?: {
    toggleButtonViewModel?: {
      defaultButtonViewModel?: ButtonWithCommand;
      toggledButtonViewModel?: ButtonWithCommand;
    };
  };
}

/** Super Chat Reply button. The count lives in a `replyCountEntity` in `frameworkUpdates`. */
export interface PdgReplyButtonViewModel {
  replyButton?: ButtonWithCommand;
  replyCountEntityKey?: string;
  replyCountPlaceholder?: AttributedString;
}

/** The creator's heart on a Super Chat; whether it's hearted is an `engagementToolbarStateEntityPayload`. */
export interface CreatorHeartViewModel {
  creatorThumbnail?: ImageSources;
  engagementStateKey?: string;
  /** E.g. "❤ by @channel". */
  heartedHoverText?: string;
}

/** Colors are ARGB packed into unsigned 32-bit ints. */
export interface LiveChatPaidMessageRenderer extends AuthorFields {
  id: string;
  timestampUsec: string;
  purchaseAmountText?: FormattedText;
  message?: FormattedText;
  headerBackgroundColor?: number;
  headerTextColor?: number;
  bodyBackgroundColor?: number;
  bodyTextColor?: number;
  authorNameTextColor?: number;
  isV2Style?: boolean;
  pdgLikeButton?: { pdgLikeViewModel?: PdgLikeViewModel };
  replyButton?: { pdgReplyButtonViewModel?: PdgReplyButtonViewModel };
  creatorHeartButton?: { creatorHeartViewModel?: CreatorHeartViewModel };
}

export interface LiveChatPaidStickerRenderer extends AuthorFields {
  id: string;
  timestampUsec: string;
  purchaseAmountText?: FormattedText;
  sticker?: Thumbnails & { accessibility?: { accessibilityData?: { label?: string } } };
  stickerDisplayWidth?: number;
  stickerDisplayHeight?: number;
  backgroundColor?: number;
  moneyChipBackgroundColor?: number;
  moneyChipTextColor?: number;
  authorNameTextColor?: number;
  isV2Style?: boolean;
}

export interface LiveChatMembershipItemRenderer extends AuthorFields {
  id: string;
  timestampUsec: string;
  /** Milestones: "Member for 6 months". */
  headerPrimaryText?: FormattedText;
  /** "Welcome to <level>!" for new members; the level name for milestones. */
  headerSubtext?: FormattedText;
  /** Milestone chat message. */
  message?: FormattedText;
}

export interface LiveChatSponsorshipsGiftPurchaseAnnouncementRenderer {
  id: string;
  timestampUsec: string;
  authorExternalChannelId: string;
  header?: {
    liveChatSponsorshipsHeaderRenderer?: Omit<AuthorFields, 'authorExternalChannelId'> & {
      primaryText?: FormattedText;
      image?: Thumbnails;
    };
  };
}

export interface LiveChatSponsorshipsGiftRedemptionAnnouncementRenderer extends AuthorFields {
  id: string;
  timestampUsec: string;
  message?: FormattedText;
}

export interface LiveChatDonationAnnouncementRenderer {
  id: string;
  timestampUsec?: string;
  text?: FormattedText;
  subtext?: FormattedText;
  authorPhoto?: Thumbnails;
}

/** Newer "view model" text: plain content plus style runs we don't need. */
export interface AttributedString {
  content?: string;
}

export interface ImageSources {
  sources?: { url: string; width?: number; height?: number }[];
}

/** A Jewels gift ("sent Star"). */
export interface GiftMessageViewModel {
  id: string;
  text?: AttributedString;
  authorName?: AttributedString;
  authorAvatar?: { avatarViewModel?: { image?: ImageSources } };
  giftImage?: ImageSources;
  giftImageA11yLabel?: string;
}

export interface ChatItemRenderer {
  liveChatTextMessageRenderer?: LiveChatTextMessageRenderer;
  liveChatViewerEngagementMessageRenderer?: LiveChatViewerEngagementMessageRenderer;
  liveChatPaidMessageRenderer?: LiveChatPaidMessageRenderer;
  liveChatPaidStickerRenderer?: LiveChatPaidStickerRenderer;
  liveChatMembershipItemRenderer?: LiveChatMembershipItemRenderer;
  liveChatSponsorshipsGiftPurchaseAnnouncementRenderer?: LiveChatSponsorshipsGiftPurchaseAnnouncementRenderer;
  liveChatSponsorshipsGiftRedemptionAnnouncementRenderer?: LiveChatSponsorshipsGiftRedemptionAnnouncementRenderer;
  liveChatDonationAnnouncementRenderer?: LiveChatDonationAnnouncementRenderer;
  liveChatModeChangeMessageRenderer?: LiveChatModeChangeMessageRenderer;
  liveChatAutoModMessageRenderer?: LiveChatAutoModMessageRenderer;
  liveChatPlaceholderItemRenderer?: { id: string };
  giftMessageViewModel?: GiftMessageViewModel;
  [renderer: string]: unknown;
}

export interface ChatAction {
  addChatItemAction?: { item: ChatItemRenderer };
  removeChatItemAction?: { targetItemId: string };
  markChatItemAsDeletedAction?: {
    targetItemId: string;
    deletedStateMessage?: FormattedText;
    /** Moderators only: label of the toggle that reveals the original message. */
    showOriginalContentMessage?: FormattedText;
  };
  markChatItemsByAuthorAsDeletedAction?: {
    externalChannelId: string;
    deletedStateMessage?: FormattedText;
    showOriginalContentMessage?: FormattedText;
  };
  removeChatItemByAuthorAction?: { externalChannelId: string };
  replaceChatItemAction?: { targetItemId: string; replacementItem: ChatItemRenderer };
  /** Chat replay of a past stream: actions to run when the video reaches the offset. */
  replayChatItemAction?: { actions?: ChatAction[]; videoOffsetTimeMsec?: string };
  [action: string]: unknown;
}

/**
 * One change to YouTube's client-side entity store, sent next to the chat actions as
 * `frameworkUpdates.entityBatchUpdate.mutations`. Like and reply counts arrive this way.
 */
export interface EntityMutation {
  entityKey: string;
  type: 'ENTITY_MUTATION_TYPE_REPLACE' | 'ENTITY_MUTATION_TYPE_DELETE' | string;
  /** One key naming the entity type, e.g. `{ likeCountEntity: {...} }`. */
  payload?: Record<string, unknown>;
}

export interface LikeCountEntity {
  likeCountIfLiked?: AttributedString;
  likeCountIfIndifferent?: AttributedString;
  likeButtonA11yText?: AttributedString;
}

/** The viewer's like and the creator's heart, keyed by the buttons' `engagementStateKey`. */
export interface EngagementToolbarState {
  likeState?: 'TOOLBAR_LIKE_STATE_LIKED' | 'TOOLBAR_LIKE_STATE_INDIFFERENT' | string;
  heartState?: 'TOOLBAR_HEART_STATE_HEARTED' | 'TOOLBAR_HEART_STATE_UNHEARTED' | string;
}

export interface ReplyCountEntity {
  replyCount?: AttributedString;
  replyButtonAccessibilityText?: string;
}

/** Data for one entry of a native context menu, e.g. `menuServiceItemRenderer`. */
export interface MenuItemRendererData {
  text?: FormattedText;
  icon?: { iconType: string };
  isDisabled?: boolean;
  [key: string]: unknown;
}

/** One raw item of `get_item_context_menu`'s `menuRenderer.items`, e.g. `{ menuServiceItemRenderer: {...} }`. */
export type RawMenuItem = Record<string, MenuItemRendererData>;
