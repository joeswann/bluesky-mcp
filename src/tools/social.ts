import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { z, ZodError } from 'zod';
import type { BlueskyClient } from '../api/client.js';
import { parseAtUri } from '../api/client.js';
import { formatProfile } from './format.js';

const likeSchema = z.object({ uri: z.string().min(1), cid: z.string().min(1) });
const unlikeSchema = z.object({ rkey: z.string().min(1) });
const followSchema = z.object({ did: z.string().min(1) });
const unfollowSchema = z.object({ rkey: z.string().min(1) });
const listSchema = z.object({
  actor: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

// Like
export const likePostDefinition = {
  name: 'like_post',
  description: 'Like a post. Returns the rkey needed to unlike later.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      uri: { type: 'string', description: 'AT URI of the post' },
      cid: { type: 'string', description: 'CID of the post' },
    },
    required: ['uri', 'cid'],
  },
};

export const likePostHandler = async (client: BlueskyClient, args: Record<string, unknown>) => {
  try {
    const { uri, cid } = likeSchema.parse(args);
    const result = await client.likePost(uri, cid);
    const { rkey } = parseAtUri(result.uri);
    return { content: [{ type: 'text' as const, text: `Liked.\nLike URI: ${result.uri}\nRkey: ${rkey}` }] };
  } catch (error) {
    if (error instanceof ZodError) throw new McpError(ErrorCode.InvalidParams, `Invalid params: ${error.message}`);
    throw new McpError(ErrorCode.InternalError, `Failed to like post: ${error}`);
  }
};

// Unlike
export const unlikePostDefinition = {
  name: 'unlike_post',
  description: 'Remove a like from a post using the like record rkey.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      rkey: { type: 'string', description: 'Rkey of the like record to delete' },
    },
    required: ['rkey'],
  },
};

export const unlikePostHandler = async (client: BlueskyClient, args: Record<string, unknown>) => {
  try {
    const { rkey } = unlikeSchema.parse(args);
    await client.unlikePost(rkey);
    return { content: [{ type: 'text' as const, text: `Unliked (rkey: ${rkey}).` }] };
  } catch (error) {
    if (error instanceof ZodError) throw new McpError(ErrorCode.InvalidParams, `Invalid params: ${error.message}`);
    throw new McpError(ErrorCode.InternalError, `Failed to unlike post: ${error}`);
  }
};

// Follow
export const followUserDefinition = {
  name: 'follow_user',
  description: 'Follow a user by DID. Returns the rkey needed to unfollow later.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      did: { type: 'string', description: 'DID of the user to follow' },
    },
    required: ['did'],
  },
};

export const followUserHandler = async (client: BlueskyClient, args: Record<string, unknown>) => {
  try {
    const { did } = followSchema.parse(args);
    const result = await client.followUser(did);
    const { rkey } = parseAtUri(result.uri);
    return { content: [{ type: 'text' as const, text: `Followed.\nFollow URI: ${result.uri}\nRkey: ${rkey}` }] };
  } catch (error) {
    if (error instanceof ZodError) throw new McpError(ErrorCode.InvalidParams, `Invalid params: ${error.message}`);
    throw new McpError(ErrorCode.InternalError, `Failed to follow user: ${error}`);
  }
};

// Unfollow
export const unfollowUserDefinition = {
  name: 'unfollow_user',
  description: 'Unfollow a user using the follow record rkey.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      rkey: { type: 'string', description: 'Rkey of the follow record to delete' },
    },
    required: ['rkey'],
  },
};

export const unfollowUserHandler = async (client: BlueskyClient, args: Record<string, unknown>) => {
  try {
    const { rkey } = unfollowSchema.parse(args);
    await client.unfollowUser(rkey);
    return { content: [{ type: 'text' as const, text: `Unfollowed (rkey: ${rkey}).` }] };
  } catch (error) {
    if (error instanceof ZodError) throw new McpError(ErrorCode.InvalidParams, `Invalid params: ${error.message}`);
    throw new McpError(ErrorCode.InternalError, `Failed to unfollow user: ${error}`);
  }
};

// Get followers
export const getFollowersDefinition = {
  name: 'get_followers',
  description: 'Get a user\'s followers list.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      actor: { type: 'string', description: 'User handle or DID' },
      limit: { type: 'number', description: 'Number of results (1-100, default 50)' },
      cursor: { type: 'string', description: 'Pagination cursor' },
    },
    required: ['actor'],
  },
};

export const getFollowersHandler = async (client: BlueskyClient, args: Record<string, unknown>) => {
  try {
    const { actor, limit, cursor } = listSchema.parse(args);
    const res = await client.getFollowers(actor, limit, cursor);

    const header = `Followers of @${res.subject.handle}`;
    const lines = res.followers.map((f, i) => `[${i + 1}] ${formatProfile(f)}`);
    if (res.cursor) lines.push(`\n--- cursor: ${res.cursor} ---`);

    return { content: [{ type: 'text' as const, text: `${header}\n${'─'.repeat(40)}\n${lines.join('\n\n') || 'No followers.'}` }] };
  } catch (error) {
    if (error instanceof ZodError) throw new McpError(ErrorCode.InvalidParams, `Invalid params: ${error.message}`);
    throw new McpError(ErrorCode.InternalError, `Failed to get followers: ${error}`);
  }
};

// Get follows
export const getFollowsDefinition = {
  name: 'get_follows',
  description: 'Get a list of users that a user follows.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      actor: { type: 'string', description: 'User handle or DID' },
      limit: { type: 'number', description: 'Number of results (1-100, default 50)' },
      cursor: { type: 'string', description: 'Pagination cursor' },
    },
    required: ['actor'],
  },
};

export const getFollowsHandler = async (client: BlueskyClient, args: Record<string, unknown>) => {
  try {
    const { actor, limit, cursor } = listSchema.parse(args);
    const res = await client.getFollows(actor, limit, cursor);

    const header = `@${res.subject.handle} follows`;
    const lines = res.follows.map((f, i) => `[${i + 1}] ${formatProfile(f)}`);
    if (res.cursor) lines.push(`\n--- cursor: ${res.cursor} ---`);

    return { content: [{ type: 'text' as const, text: `${header}\n${'─'.repeat(40)}\n${lines.join('\n\n') || 'Not following anyone.'}` }] };
  } catch (error) {
    if (error instanceof ZodError) throw new McpError(ErrorCode.InvalidParams, `Invalid params: ${error.message}`);
    throw new McpError(ErrorCode.InternalError, `Failed to get follows: ${error}`);
  }
};
