/** Normalized chat model rendered by the UI. */

export type Segment =
  | { type: 'text'; text: string; bold?: boolean; italic?: boolean; href?: string }
  | { type: 'emoji'; src: string; alt: string; label: string; custom: boolean };

export type Badge =
  | { kind: 'image'; src: string; label: string }
  | { kind: 'icon'; icon: string; label: string };

/** Pills shown before the message, e.g. the viewer leaderboard rank ("👑 #2"). */
export interface Chip {
  label: string;
  icon?: string;
  background?: string;
  color?: string;
}

export interface Author {
  name: string;
  channelId: string;
  photo?: string;
  badges: Badge[];
  isOwner: boolean;
  isModerator: boolean;
  isMember: boolean;
  isVerified: boolean;
}

export interface TextChatItem {
  kind: 'text';
  id: string;
  timestampUsec: string;
  author: Author;
  message: Segment[];
  chips: Chip[];
  menuParams?: string;
  /** Set when a moderator deleted/retracted the message, e.g. "[message retracted]". */
  deleted?: Segment[];
}

export interface EngagementChatItem {
  kind: 'engagement';
  id: string;
  message: Segment[];
}

export type ChatItem = TextChatItem | EngagementChatItem;

/** Where to open the context menu. */
export interface MenuTarget {
  item: TextChatItem;
  /** Viewport point the menu is anchored to. */
  x: number;
  y: number;
  /** Anchor the menu's right edge to `x` (opening from the ⋮ button). */
  alignRight?: boolean;
  /** Y to flip above when there's no room below (top of the ⋮ button). */
  flipY?: number;
}
