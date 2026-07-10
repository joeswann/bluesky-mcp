import { z } from 'zod';
import type { BlueskyClient } from '../../api/client.js';
import { parseAtUri } from '../../api/client.js';
import type { Flags } from '../args.js';
import { confirm } from '../confirm.js';
import { json, line } from '../render.js';

export const like = async (client: BlueskyClient, args: string[], flags: Flags): Promise<void> => {
  const uri = z.string().min(1, 'like requires <at-uri>').parse(args[0]);
  let cid = args[1];
  if (!cid) {
    const { thread } = await client.getPostThread(uri, 0);
    cid = thread.post.cid;
  }
  if (!(await confirm(`Will like ${uri}`, flags.yes))) return line('Aborted.');
  const res = await client.likePost(uri, cid);
  const { rkey } = parseAtUri(res.uri);
  if (flags.json) return json({ ...res, rkey });
  line(`Liked.\nLike URI: ${res.uri}\nRkey: ${rkey}`);
};

export const unlike = async (client: BlueskyClient, args: string[], flags: Flags): Promise<void> => {
  const rkey = z.string().min(1, 'unlike requires <rkey>').parse(args[0]);
  if (!(await confirm(`Will unlike (rkey: ${rkey})`, flags.yes))) return line('Aborted.');
  await client.unlikePost(rkey);
  if (flags.json) return json({ ok: true, rkey });
  line(`Unliked (rkey: ${rkey}).`);
};

export const follow = async (client: BlueskyClient, args: string[], flags: Flags): Promise<void> => {
  const target = z.string().min(1, 'follow requires <did|@handle>').parse(args[0]);
  const did = target.startsWith('did:') ? target : (await client.getProfile(target)).did;
  if (!(await confirm(`Will follow ${did}`, flags.yes))) return line('Aborted.');
  const res = await client.followUser(did);
  const { rkey } = parseAtUri(res.uri);
  if (flags.json) return json({ ...res, rkey });
  line(`Followed.\nFollow URI: ${res.uri}\nRkey: ${rkey}`);
};

export const unfollow = async (client: BlueskyClient, args: string[], flags: Flags): Promise<void> => {
  const rkey = z.string().min(1, 'unfollow requires <rkey>').parse(args[0]);
  if (!(await confirm(`Will unfollow (rkey: ${rkey})`, flags.yes))) return line('Aborted.');
  await client.unfollowUser(rkey);
  if (flags.json) return json({ ok: true, rkey });
  line(`Unfollowed (rkey: ${rkey}).`);
};
