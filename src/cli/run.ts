import { getConfig } from '../config/index.js';
import { BlueskyClient } from '../api/client.js';
import type { Flags } from './args.js';
import { parse } from './args.js';
import { line } from './render.js';
import { deleteSession, readSession, writeSession } from './session.js';
import * as read from './commands/read.js';
import * as posts from './commands/posts.js';
import * as social from './commands/social.js';

type Command = (client: BlueskyClient, args: string[], flags: Flags) => Promise<void>;

const commands: Record<string, Command> = {
  whoami: read.whoami,
  timeline: read.timeline,
  feed: read.feed,
  profile: read.profile,
  thread: read.thread,
  search: read.search,
  'search-users': read.searchUsers,
  notifications: read.notifications,
  followers: read.followers,
  follows: read.follows,
  post: posts.post,
  delete: posts.del,
  repost: posts.repost,
  like: social.like,
  unlike: social.unlike,
  follow: social.follow,
  unfollow: social.unfollow,
};

const help = (): void => {
  line('bluesky-cli — Bluesky from the command line\n');
  line('Read:');
  line('  whoami                       timeline [--limit] [--json]');
  line('  feed <actor> [--limit]       profile <actor>');
  line('  thread <at-uri> [--depth]    search <query> [--limit] [--sort top|latest]');
  line('  search-users <query>         notifications [--limit]');
  line('  followers <actor>            follows <actor>');
  line('\nWrite (require y/N confirm; --yes to bypass):');
  line('  post <text> [--reply-to <uri>] [--url <link>]');
  line('  delete <at-uri>              repost <at-uri> [<cid>]');
  line('  like <at-uri> [<cid>]        unlike <rkey>');
  line('  follow <did|@handle>         unfollow <rkey>');
  line('\nOther:');
  line('  logout                       help');
  line('\nGlobal flags: --json  --limit <n>  --cursor <c>  --yes/-y');
};

export const runCli = async (argv: string[]): Promise<void> => {
  const [name, ...rest] = argv;

  if (!name || name === 'help' || name === '--help' || name === '-h') {
    help();
    return;
  }

  if (name === 'logout') {
    line(deleteSession() ? 'Session cache cleared.' : 'No session cache to clear.');
    return;
  }

  const command = commands[name];
  if (!command) {
    line(`Unknown command: ${name}\n`);
    help();
    process.exitCode = 1;
    return;
  }

  const { positionals, flags } = parse(rest);
  const config = getConfig();
  const client = new BlueskyClient(config);
  client.onSession = (s) => writeSession(config.BLUESKY_IDENTIFIER, s);

  const cached = readSession(config.BLUESKY_IDENTIFIER);
  if (cached) client.hydrate(cached);

  await command(client, positionals, flags);
};
