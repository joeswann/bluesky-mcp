import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { z, ZodError } from 'zod';
import type { BlueskyClient } from '../api/client.js';
import { formatPost } from './format.js';

const schema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const definition = {
  name: 'get_timeline',
  description: 'Get the authenticated user\'s home timeline feed.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      limit: { type: 'number', description: 'Number of posts to return (1-100, default 20)' },
      cursor: { type: 'string', description: 'Pagination cursor from previous response' },
    },
    required: [],
  },
};

export const handler = async (client: BlueskyClient, args: Record<string, unknown>) => {
  try {
    const { limit, cursor } = schema.parse(args);
    const res = await client.getTimeline(limit, cursor);

    const lines = res.feed.map((item, i) => {
      let prefix = '';
      if (item.reason?.$type === 'app.bsky.feed.defs#reasonRepost') {
        prefix = `Reposted by @${item.reason.by.handle}\n`;
      }
      return `[${i + 1}] ${prefix}${formatPost(item.post)}`;
    });

    if (res.cursor) lines.push(`\n--- cursor: ${res.cursor} ---`);

    return { content: [{ type: 'text' as const, text: lines.join('\n\n') || 'Timeline is empty.' }] };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid params: ${error.message}`);
    }
    throw new McpError(ErrorCode.InternalError, `Failed to get timeline: ${error}`);
  }
};
