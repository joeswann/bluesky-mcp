import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { BlueskyClient } from '../api/client.js';

export const definition = {
  name: 'whoami',
  description: 'Get the authenticated user\'s profile information including handle, DID, display name, and account stats.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
};

export const handler = async (client: BlueskyClient) => {
  try {
    await client.makeRequest('com.atproto.server.getSession', {});
    const did = client.getDid();
    const profile = await client.getProfile(did);

    const lines = [
      `Handle: @${profile.handle}`,
      `DID: ${profile.did}`,
      profile.displayName ? `Display Name: ${profile.displayName}` : null,
      profile.description ? `Bio: ${profile.description}` : null,
      `Followers: ${profile.followersCount ?? 0}`,
      `Following: ${profile.followsCount ?? 0}`,
      `Posts: ${profile.postsCount ?? 0}`,
    ].filter(Boolean);

    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  } catch (error) {
    throw new McpError(ErrorCode.InternalError, `Failed to get profile: ${error}`);
  }
};
