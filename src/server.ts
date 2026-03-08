import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { getConfig } from './config/index.js';
import { BlueskyClient } from './api/client.js';

import { definition as whoamiDef, handler as whoamiHandler } from './tools/whoami.js';
import { definition as timelineDef, handler as timelineHandler } from './tools/timeline.js';
import { getUserFeedDefinition, getUserFeedHandler, getProfileDefinition, getProfileHandler } from './tools/feed.js';
import {
  getPostThreadDefinition, getPostThreadHandler,
  createPostDefinition, createPostHandler,
  deletePostDefinition, deletePostHandler,
  repostDefinition, repostHandler,
} from './tools/posts.js';
import { searchPostsDefinition, searchPostsHandler, searchUsersDefinition, searchUsersHandler } from './tools/search.js';
import { definition as notifDef, handler as notifHandler } from './tools/notifications.js';
import {
  likePostDefinition, likePostHandler,
  unlikePostDefinition, unlikePostHandler,
  followUserDefinition, followUserHandler,
  unfollowUserDefinition, unfollowUserHandler,
  getFollowersDefinition, getFollowersHandler,
  getFollowsDefinition, getFollowsHandler,
} from './tools/social.js';

type ToolDef = { name: string; description: string; inputSchema: Record<string, unknown> };
type ToolHandler = (client: BlueskyClient, args: Record<string, unknown>) => Promise<{ content: Array<{ type: 'text'; text: string }> }>;

const tools: Array<[ToolDef, ToolHandler]> = [
  [whoamiDef, (c, _a) => whoamiHandler(c)],
  [timelineDef, timelineHandler],
  [getUserFeedDefinition, getUserFeedHandler],
  [getProfileDefinition, getProfileHandler],
  [getPostThreadDefinition, getPostThreadHandler],
  [createPostDefinition, createPostHandler],
  [deletePostDefinition, deletePostHandler],
  [repostDefinition, repostHandler],
  [searchPostsDefinition, searchPostsHandler],
  [searchUsersDefinition, searchUsersHandler],
  [notifDef, notifHandler],
  [likePostDefinition, likePostHandler],
  [unlikePostDefinition, unlikePostHandler],
  [followUserDefinition, followUserHandler],
  [unfollowUserDefinition, unfollowUserHandler],
  [getFollowersDefinition, getFollowersHandler],
  [getFollowsDefinition, getFollowsHandler],
];

const handlerMap = new Map<string, ToolHandler>();
for (const [def, handler] of tools) {
  handlerMap.set(def.name, handler);
}

export const createServer = async () => {
  const config = getConfig();
  const client = new BlueskyClient(config);

  const server = new Server(
    { name: 'bluesky-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(([def]) => def),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = handlerMap.get(name);

    if (!handler) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    return handler(client, args ?? {});
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  return server;
};
