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
}

export interface LiveChatTextMessageRenderer {
  id: string;
  timestampUsec: string;
  message?: FormattedText;
  authorName?: FormattedText;
  authorPhoto?: Thumbnails;
  authorExternalChannelId: string;
  authorBadges?: AuthorBadge[];
  beforeContentButtons?: { buttonViewModel?: ButtonViewModel }[];
  contextMenuEndpoint?: { liveChatItemContextMenuEndpoint?: { params: string } };
}

export interface LiveChatViewerEngagementMessageRenderer {
  id: string;
  timestampUsec?: string;
  message?: FormattedText;
  icon?: { iconType: string };
}

export interface ChatItemRenderer {
  liveChatTextMessageRenderer?: LiveChatTextMessageRenderer;
  liveChatViewerEngagementMessageRenderer?: LiveChatViewerEngagementMessageRenderer;
  [renderer: string]: unknown;
}

export interface ChatAction {
  addChatItemAction?: { item: ChatItemRenderer };
  removeChatItemAction?: { targetItemId: string };
  markChatItemAsDeletedAction?: { targetItemId: string; deletedStateMessage?: FormattedText };
  markChatItemsByAuthorAsDeletedAction?: { externalChannelId: string; deletedStateMessage?: FormattedText };
  removeChatItemByAuthorAction?: { externalChannelId: string };
  replaceChatItemAction?: { targetItemId: string; replacementItem: ChatItemRenderer };
  [action: string]: unknown;
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
