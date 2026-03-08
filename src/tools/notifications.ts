import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { z, ZodError } from 'zod';
import type { BlueskyClient } from '../api/client.js';
import type { Notification } from '../api/types.js';

const schema = z.object({
  limit: z.number().int().min(1).max(100).default(30),
  cursor: z.string().optional(),
});

export const definition = {
  name: 'get_notifications',
  description: 'Get the authenticated user\'s notifications (likes, reposts, follows, mentions, replies).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      limit: { type: 'number', description: 'Number of notifications (1-100, default 30)' },
      cursor: { type: 'string', description: 'Pagination cursor' },
    },
    required: [],
  },
};

const reasonLabels: Record<string, string> = {
  like: 'liked your post',
  repost: 'reposted your post',
  follow: 'followed you',
  mention: 'mentioned you',
  reply: 'replied to you',
  quote: 'quoted your post',
  'starterpack-joined': 'joined via your starter pack',
};

const formatNotification = (n: Notification, i: number): string => {
  const action = reasonLabels[n.reason] ?? n.reason;
  const author = `@${n.author.handle}`;
  const ts = new Date(n.indexedAt).toLocaleString();
  const read = n.isRead ? '' : ' [UNREAD]';
  const subject = n.reasonSubject ? `\n  Re: ${n.reasonSubject}` : '';
  return `[${i + 1}]${read} ${author} ${action} — ${ts}${subject}`;
};

export const handler = async (client: BlueskyClient, args: Record<string, unknown>) => {
  try {
    const { limit, cursor } = schema.parse(args);
    const res = await client.listNotifications(limit, cursor);

    const grouped: Record<string, Notification[]> = {};
    for (const n of res.notifications) {
      const key = n.reason;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(n);
    }

    const lines = res.notifications.map((n, i) => formatNotification(n, i));
    if (res.cursor) lines.push(`\n--- cursor: ${res.cursor} ---`);

    const unread = res.notifications.filter(n => !n.isRead).length;
    const header = `Notifications (${unread} unread)\n${'─'.repeat(40)}`;

    return { content: [{ type: 'text' as const, text: `${header}\n${lines.join('\n') || 'No notifications.'}` }] };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid params: ${error.message}`);
    }
    throw new McpError(ErrorCode.InternalError, `Failed to get notifications: ${error}`);
  }
};
