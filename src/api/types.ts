export type Session = {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
};

export type ProfileView = {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  indexedAt?: string;
  labels?: Array<{ val: string }>;
};

export type PostRecord = {
  $type: string;
  text: string;
  createdAt: string;
  reply?: {
    root: { uri: string; cid: string };
    parent: { uri: string; cid: string };
  };
  embed?: unknown;
  facets?: unknown[];
  langs?: string[];
};

export type PostView = {
  uri: string;
  cid: string;
  author: ProfileView;
  record: PostRecord;
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  quoteCount?: number;
  indexedAt: string;
  viewer?: {
    like?: string;
    repost?: string;
  };
  labels?: Array<{ val: string }>;
};

export type FeedViewPost = {
  post: PostView;
  reply?: {
    root: PostView;
    parent: PostView;
  };
  reason?: {
    $type: string;
    by: ProfileView;
    indexedAt: string;
  };
};

export type ThreadViewPost = {
  $type: string;
  post: PostView;
  parent?: ThreadViewPost;
  replies?: ThreadViewPost[];
};

export type Notification = {
  uri: string;
  cid: string;
  author: ProfileView;
  reason: 'like' | 'repost' | 'follow' | 'mention' | 'reply' | 'quote' | 'starterpack-joined';
  reasonSubject?: string;
  record: Record<string, unknown>;
  isRead: boolean;
  indexedAt: string;
};

export type AtUri = {
  repo: string;
  collection: string;
  rkey: string;
};
