# Bluesky MCP Server

An MCP (Model Context Protocol) server for the Bluesky social network (ATProto). Enables Claude Desktop, Claude Code, and other MCP clients to browse timelines, manage posts, search, and interact with users on Bluesky.

## Features

- **Timeline & Feeds**: Browse home timeline and user feeds
- **Post Management**: Create, delete, repost, like, and unlike posts
- **Search**: Full-text search for posts and users
- **Social Graph**: Follow/unfollow users, view followers and follows
- **Notifications**: Read Bluesky notifications
- **Profiles**: View user profiles and post threads

## Installation

### From Source

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BLUESKY_IDENTIFIER` | Yes | — | Your Bluesky handle or DID |
| `BLUESKY_APP_PASSWORD` | Yes | — | App password (not your account password) |
| `BLUESKY_PDS_URL` | No | `https://bsky.social` | Custom PDS endpoint |

Create a `.env` file or set these in your shell environment.

To generate an app password: Bluesky Settings > Advanced > App Passwords.

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bluesky": {
      "command": "node",
      "args": ["/path/to/bluesky-mcp/build/index.js"],
      "env": {
        "BLUESKY_IDENTIFIER": "your.handle.bsky.social",
        "BLUESKY_APP_PASSWORD": "your-app-password"
      }
    }
  }
}
```

## Usage with Claude Code

```bash
claude mcp add bluesky -- node /path/to/bluesky-mcp/build/index.js
```

## Available Tools

| Tool | Description |
|------|-------------|
| `whoami` | Get authenticated user info |
| `timeline` | Browse home timeline |
| `get_user_feed` | Get a specific user's posts |
| `get_profile` | View a user's profile |
| `get_post_thread` | View a post and its replies |
| `create_post` | Create a new post |
| `delete_post` | Delete a post |
| `repost` | Repost a post |
| `like_post` | Like a post |
| `unlike_post` | Unlike a post |
| `search_posts` | Search for posts |
| `search_users` | Search for users |
| `get_notifications` | View notifications |
| `follow_user` | Follow a user |
| `unfollow_user` | Unfollow a user |
| `get_followers` | List a user's followers |
| `get_follows` | List who a user follows |

## Development

- `npm run dev` — Watch mode with TypeScript compilation
- `npm run build` — Build the project
- `npm start` — Start the built server

## License

MIT
