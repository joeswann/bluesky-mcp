import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { z, ZodError } from 'zod';
import type { BlueskyClient } from '../api/client.js';
import { formatThread } from './format.js';

const threadSchema = z.object({
  uri: z.string().min(1),
  depth: z.number().int().min(0).max(10).default(6),
});

const createSchema = z.object({
  text: z.string().min(1).max(300),
  reply_to: z.string().optional(),
  url: z.string().url().optional(),
});

const deleteSchema = z.object({
  uri: z.string().min(1),
});

const repostSchema = z.object({
  uri: z.string().min(1),
  cid: z.string().min(1),
});

export const getPostThreadDefinition = {
  name: 'get_post_thread',
  description: 'Get a post and its thread (replies and parent context).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      uri: { type: 'string', description: 'AT URI of the post (at://did/app.bsky.feed.post/rkey)' },
      depth: { type: 'number', description: 'Reply depth (0-10, default 6)' },
    },
    required: ['uri'],
  },
};

export const getPostThreadHandler = async (client: BlueskyClient, args: Record<string, unknown>) => {
  try {
    const { uri, depth } = threadSchema.parse(args);
    const res = await client.getPostThread(uri, depth);
    const text = formatThread(res.thread);
    return { content: [{ type: 'text' as const, text }] };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid params: ${error.message}`);
    }
    throw new McpError(ErrorCode.InternalError, `Failed to get thread: ${error}`);
  }
};

export const createPostDefinition = {
  name: 'create_post',
  description: 'Create a new post on Bluesky. Supports link card embeds (external URL with auto-fetched title/description/thumbnail) and auto-detected URL facets for clickable links in text.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      text: { type: 'string', description: 'Post text (max 300 chars). URLs in text are auto-detected and made clickable.' },
      reply_to: { type: 'string', description: 'AT URI of post to reply to (optional)' },
      url: { type: 'string', description: 'URL to attach as a link card embed with auto-fetched metadata (optional)' },
    },
    required: ['text'],
  },
};

export const createPostHandler = async (client: BlueskyClient, args: Record<string, unknown>) => {
  try {
    const { text, reply_to, url } = createSchema.parse(args);

    let reply: { root: { uri: string; cid: string }; parent: { uri: string; cid: string } } | undefined;

    if (reply_to) {
      const threadRes = await client.getPostThread(reply_to, 0);
      const parentPost = threadRes.thread.post;

      let rootUri = reply_to;
      let rootCid = parentPost.cid;

      if (parentPost.record?.reply?.root) {
        rootUri = parentPost.record.reply.root.uri;
        rootCid = parentPost.record.reply.root.cid;
      }

      reply = {
        root: { uri: rootUri, cid: rootCid },
        parent: { uri: reply_to, cid: parentPost.cid },
      };
    }

    let embed: Record<string, unknown> | undefined;
    if (url) {
      const meta = await client.fetchUrlMeta(url);
      embed = {
        $type: 'app.bsky.embed.external',
        external: meta,
      };
    }

    const result = await client.createPost(text, reply, embed);
    return {
      content: [{
        type: 'text' as const,
        text: `Post created.\nURI: ${result.uri}\nCID: ${result.cid}`,
      }],
    };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid params: ${error.message}`);
    }
    throw new McpError(ErrorCode.InternalError, `Failed to create post: ${error}`);
  }
};

export const deletePostDefinition = {
  name: 'delete_post',
  description: 'Delete a post by its AT URI.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      uri: { type: 'string', description: 'AT URI of the post to delete' },
    },
    required: ['uri'],
  },
};

export const deletePostHandler = async (client: BlueskyClient, args: Record<string, unknown>) => {
  try {
    const { uri } = deleteSchema.parse(args);
    await client.deleteRecord(uri);
    return { content: [{ type: 'text' as const, text: `Post deleted: ${uri}` }] };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid params: ${error.message}`);
    }
    throw new McpError(ErrorCode.InternalError, `Failed to delete post: ${error}`);
  }
};

export const repostDefinition = {
  name: 'repost',
  description: 'Repost an existing post.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      uri: { type: 'string', description: 'AT URI of the post to repost' },
      cid: { type: 'string', description: 'CID of the post to repost' },
    },
    required: ['uri', 'cid'],
  },
};

export const repostHandler = async (client: BlueskyClient, args: Record<string, unknown>) => {
  try {
    const { uri, cid } = repostSchema.parse(args);
    const result = await client.repost(uri, cid);
    return {
      content: [{
        type: 'text' as const,
        text: `Reposted.\nURI: ${result.uri}\nCID: ${result.cid}`,
      }],
    };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid params: ${error.message}`);
    }
    throw new McpError(ErrorCode.InternalError, `Failed to repost: ${error}`);
  }
};
