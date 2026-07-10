import { z } from 'zod';
import type { BlueskyClient } from '../../api/client.js';
import type { Flags } from '../args.js';
import { confirm } from '../confirm.js';
import { json, line } from '../render.js';

export const post = async (client: BlueskyClient, args: string[], flags: Flags): Promise<void> => {
  const text = z.string().min(1, 'post requires <text>').max(300).parse(args.join(' ') || undefined);
  const replyTo = flags.replyTo ? z.string().min(1).parse(flags.replyTo) : undefined;
  const url = flags.url ? z.string().url().parse(flags.url) : undefined;

  await client.makeRequest('com.atproto.server.getSession', {});
  const handle = client.getHandle();

  if (!(await confirm(`Will post as @${handle}:\n\n  ${text}\n`, flags.yes))) {
    line('Aborted.');
    return;
  }

  let reply: { root: { uri: string; cid: string }; parent: { uri: string; cid: string } } | undefined;
  if (replyTo) {
    const { thread } = await client.getPostThread(replyTo, 0);
    const parent = thread.post;
    const root = parent.record?.reply?.root ?? { uri: replyTo, cid: parent.cid };
    reply = { root: { uri: root.uri, cid: root.cid }, parent: { uri: replyTo, cid: parent.cid } };
  }

  let embed: Record<string, unknown> | undefined;
  if (url) {
    embed = { $type: 'app.bsky.embed.external', external: await client.fetchUrlMeta(url) };
  }

  const res = await client.createPost(text, reply, embed);
  if (flags.json) return json(res);
  line(`Post created.\nURI: ${res.uri}\nCID: ${res.cid}`);
};

export const del = async (client: BlueskyClient, args: string[], flags: Flags): Promise<void> => {
  const uri = z.string().min(1, 'delete requires <at-uri>').parse(args[0]);
  if (!(await confirm(`Will delete ${uri}`, flags.yes))) {
    line('Aborted.');
    return;
  }
  await client.deleteRecord(uri);
  if (flags.json) return json({ ok: true, uri });
  line(`Post deleted: ${uri}`);
};

export const repost = async (client: BlueskyClient, args: string[], flags: Flags): Promise<void> => {
  const uri = z.string().min(1, 'repost requires <at-uri>').parse(args[0]);
  let cid = args[1];
  if (!cid) {
    const { thread } = await client.getPostThread(uri, 0);
    cid = thread.post.cid;
  }
  if (!(await confirm(`Will repost ${uri}`, flags.yes))) {
    line('Aborted.');
    return;
  }
  const res = await client.repost(uri, cid);
  if (flags.json) return json(res);
  line(`Reposted.\nURI: ${res.uri}\nCID: ${res.cid}`);
};
