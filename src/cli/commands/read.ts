import { z } from 'zod';
import type { BlueskyClient } from '../../api/client.js';
import type { Notification } from '../../api/types.js';
import { formatPost, formatProfile, formatThread } from '../../tools/format.js';
import type { Flags } from '../args.js';
import { json, line, renderList } from '../render.js';

const limit = (def: number, max = 100) => z.number().int().min(1).max(max).default(def);

export const whoami = async (client: BlueskyClient, _args: string[], flags: Flags): Promise<void> => {
  await client.makeRequest('com.atproto.server.getSession', {});
  const profile = await client.getProfile(client.getDid());
  if (flags.json) return json(profile);
  line([
    `Handle: @${profile.handle}`,
    `DID: ${profile.did}`,
    profile.displayName ? `Display Name: ${profile.displayName}` : null,
    profile.description ? `Bio: ${profile.description}` : null,
    `Followers: ${profile.followersCount ?? 0}`,
    `Following: ${profile.followsCount ?? 0}`,
    `Posts: ${profile.postsCount ?? 0}`,
  ].filter(Boolean).join('\n'));
};

export const timeline = async (client: BlueskyClient, _args: string[], flags: Flags): Promise<void> => {
  const n = limit(20).parse(flags.limit);
  const res = await client.getTimeline(n, flags.cursor);
  if (flags.json) return json(res);
  renderList(res.feed, (item) => {
    const prefix = item.reason?.$type === 'app.bsky.feed.defs#reasonRepost' ? `Reposted by @${item.reason.by.handle}\n` : '';
    return `${prefix}${formatPost(item.post)}`;
  }, res.cursor, 'Timeline is empty.');
};

export const feed = async (client: BlueskyClient, args: string[], flags: Flags): Promise<void> => {
  const actor = z.string().min(1, 'feed requires <handle|did>').parse(args[0]);
  const n = limit(20).parse(flags.limit);
  const res = await client.getAuthorFeed(actor, n, flags.cursor);
  if (flags.json) return json(res);
  renderList(res.feed, (item) => formatPost(item.post), res.cursor, 'No posts found.');
};

export const profile = async (client: BlueskyClient, args: string[], flags: Flags): Promise<void> => {
  const actor = z.string().min(1, 'profile requires <handle|did>').parse(args[0]);
  const res = await client.getProfile(actor);
  if (flags.json) return json(res);
  line(formatProfile(res));
};

export const thread = async (client: BlueskyClient, args: string[], flags: Flags): Promise<void> => {
  const uri = z.string().min(1, 'thread requires <at-uri>').parse(args[0]);
  const depth = z.number().int().min(0).max(10).default(6).parse(flags.depth);
  const res = await client.getPostThread(uri, depth);
  if (flags.json) return json(res);
  line(formatThread(res.thread));
};

export const search = async (client: BlueskyClient, args: string[], flags: Flags): Promise<void> => {
  const query = z.string().min(1, 'search requires <query>').parse(args.join(' ') || undefined);
  const n = limit(25).parse(flags.limit);
  const sort = z.enum(['top', 'latest']).default('top').parse(flags.sort);
  const res = await client.searchPosts(query, n, sort, flags.cursor);
  if (flags.json) return json(res);
  renderList(res.posts, (post) => formatPost(post), res.cursor, 'No posts found.');
};

export const searchUsers = async (client: BlueskyClient, args: string[], flags: Flags): Promise<void> => {
  const query = z.string().min(1, 'search-users requires <query>').parse(args.join(' ') || undefined);
  const n = limit(10, 25).parse(flags.limit);
  const res = await client.searchActors(query, n);
  if (flags.json) return json(res);
  renderList(res.actors, (actor) => formatProfile(actor), undefined, 'No users found.');
};

const reasonLabels: Record<string, string> = {
  like: 'liked your post', repost: 'reposted your post', follow: 'followed you',
  mention: 'mentioned you', reply: 'replied to you', quote: 'quoted your post',
  'starterpack-joined': 'joined via your starter pack',
};

export const notifications = async (client: BlueskyClient, _args: string[], flags: Flags): Promise<void> => {
  const n = limit(30).parse(flags.limit);
  const res = await client.listNotifications(n, flags.cursor);
  if (flags.json) return json(res);
  const unread = res.notifications.filter((x) => !x.isRead).length;
  const fmt = (x: Notification, i: number) => {
    const action = reasonLabels[x.reason] ?? x.reason;
    const read = x.isRead ? '' : ' [UNREAD]';
    const subject = x.reasonSubject ? `\n  Re: ${x.reasonSubject}` : '';
    return `[${i + 1}]${read} @${x.author.handle} ${action} — ${new Date(x.indexedAt).toLocaleString()}${subject}`;
  };
  const lines = res.notifications.map(fmt);
  if (res.cursor) lines.push(`\n--- cursor: ${res.cursor} ---`);
  line(`Notifications (${unread} unread)\n${'─'.repeat(40)}\n${lines.join('\n') || 'No notifications.'}`);
};

export const followers = async (client: BlueskyClient, args: string[], flags: Flags): Promise<void> => {
  const actor = z.string().min(1, 'followers requires <handle|did>').parse(args[0]);
  const n = limit(50).parse(flags.limit);
  const res = await client.getFollowers(actor, n, flags.cursor);
  if (flags.json) return json(res);
  line(`Followers of @${res.subject.handle}\n${'─'.repeat(40)}`);
  renderList(res.followers, (f) => formatProfile(f), res.cursor, 'No followers.');
};

export const follows = async (client: BlueskyClient, args: string[], flags: Flags): Promise<void> => {
  const actor = z.string().min(1, 'follows requires <handle|did>').parse(args[0]);
  const n = limit(50).parse(flags.limit);
  const res = await client.getFollows(actor, n, flags.cursor);
  if (flags.json) return json(res);
  line(`@${res.subject.handle} follows\n${'─'.repeat(40)}`);
  renderList(res.follows, (f) => formatProfile(f), res.cursor, 'Not following anyone.');
};
