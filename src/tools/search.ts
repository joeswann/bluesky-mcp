import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { z, ZodError } from 'zod';
import type { BlueskyClient } from '../api/client.js';
import { formatPost, formatProfile } from './format.js';

const searchPostsSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(25),
  sort: z.enum(['top', 'latest']).default('top'),
  cursor: z.string().optional(),
});

const searchUsersSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(25).default(10),
});

export const searchPostsDefinition = {
  name: 'search_posts',
  description: 'Search for posts on Bluesky by keyword or phrase.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Search query' },
      limit: { type: 'number', description: 'Number of results (1-100, default 25)' },
      sort: { type: 'string', enum: ['top', 'latest'], description: 'Sort order (default: top)' },
      cursor: { type: 'string', description: 'Pagination cursor' },
    },
    required: ['query'],
  },
};

export const searchPostsHandler = async (client: BlueskyClient, args: Record<string, unknown>) => {
  try {
    const { query, limit, sort, cursor } = searchPostsSchema.parse(args);
    const res = await client.searchPosts(query, limit, sort, cursor);

    const lines = res.posts.map((post, i) => `[${i + 1}] ${formatPost(post)}`);
    if (res.cursor) lines.push(`\n--- cursor: ${res.cursor} ---`);

    return { content: [{ type: 'text' as const, text: lines.join('\n\n') || 'No posts found.' }] };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid params: ${error.message}`);
    }
    throw new McpError(ErrorCode.InternalError, `Failed to search posts: ${error}`);
  }
};

export const searchUsersDefinition = {
  name: 'search_users',
  description: 'Search for users on Bluesky by name or handle.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Search query' },
      limit: { type: 'number', description: 'Number of results (1-25, default 10)' },
    },
    required: ['query'],
  },
};

export const searchUsersHandler = async (client: BlueskyClient, args: Record<string, unknown>) => {
  try {
    const { query, limit } = searchUsersSchema.parse(args);
    const res = await client.searchActors(query, limit);

    const lines = res.actors.map((actor, i) => `[${i + 1}] ${formatProfile(actor)}`);

    return { content: [{ type: 'text' as const, text: lines.join('\n\n') || 'No users found.' }] };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid params: ${error.message}`);
    }
    throw new McpError(ErrorCode.InternalError, `Failed to search users: ${error}`);
  }
};
