import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { z, ZodError } from 'zod';
import type { BlueskyClient } from '../api/client.js';
import { formatPost, formatProfile } from './format.js';

const feedSchema = z.object({
  actor: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

const profileSchema = z.object({
  actor: z.string().min(1),
});

export const getUserFeedDefinition = {
  name: 'get_user_feed',
  description: 'Get posts from a specific user\'s feed by handle or DID.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      actor: { type: 'string', description: 'User handle (e.g. alice.bsky.social) or DID' },
      limit: { type: 'number', description: 'Number of posts (1-100, default 20)' },
      cursor: { type: 'string', description: 'Pagination cursor' },
    },
    required: ['actor'],
  },
};

export const getUserFeedHandler = async (client: BlueskyClient, args: Record<string, unknown>) => {
  try {
    const { actor, limit, cursor } = feedSchema.parse(args);
    const res = await client.getAuthorFeed(actor, limit, cursor);

    const lines = res.feed.map((item, i) => `[${i + 1}] ${formatPost(item.post)}`);
    if (res.cursor) lines.push(`\n--- cursor: ${res.cursor} ---`);

    return { content: [{ type: 'text' as const, text: lines.join('\n\n') || 'No posts found.' }] };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid params: ${error.message}`);
    }
    throw new McpError(ErrorCode.InternalError, `Failed to get user feed: ${error}`);
  }
};

export const getProfileDefinition = {
  name: 'get_profile',
  description: 'Get a user\'s profile information by handle or DID.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      actor: { type: 'string', description: 'User handle or DID' },
    },
    required: ['actor'],
  },
};

export const getProfileHandler = async (client: BlueskyClient, args: Record<string, unknown>) => {
  try {
    const { actor } = profileSchema.parse(args);
    const profile = await client.getProfile(actor);
    return { content: [{ type: 'text' as const, text: formatProfile(profile) }] };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid params: ${error.message}`);
    }
    throw new McpError(ErrorCode.InternalError, `Failed to get profile: ${error}`);
  }
};
