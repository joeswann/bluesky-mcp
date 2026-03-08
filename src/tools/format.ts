import type { PostView, ProfileView, ThreadViewPost } from '../api/types.js';

export const formatPost = (post: PostView): string => {
  const author = `@${post.author.handle}`;
  const name = post.author.displayName ? ` (${post.author.displayName})` : '';
  const text = post.record?.text ?? '';
  const ts = new Date(post.indexedAt).toLocaleString();
  const stats = [
    `♡ ${post.likeCount ?? 0}`,
    `⟲ ${post.repostCount ?? 0}`,
    `💬 ${post.replyCount ?? 0}`,
  ].join('  ');

  return `${author}${name} — ${ts}\n${text}\n${stats}\nURI: ${post.uri} | CID: ${post.cid}`;
};

export const formatProfile = (p: ProfileView): string => {
  const lines = [
    `@${p.handle}${p.displayName ? ` (${p.displayName})` : ''}`,
    `DID: ${p.did}`,
    p.description ? `Bio: ${p.description}` : null,
    `Followers: ${p.followersCount ?? 0} | Following: ${p.followsCount ?? 0} | Posts: ${p.postsCount ?? 0}`,
  ].filter(Boolean);
  return lines.join('\n');
};

export const formatThread = (thread: ThreadViewPost, depth = 0): string => {
  if (thread.$type !== 'app.bsky.feed.defs#threadViewPost') {
    return `[blocked or not found]`;
  }

  const indent = '  '.repeat(depth);
  const lines: string[] = [];

  if (thread.parent && thread.parent.$type === 'app.bsky.feed.defs#threadViewPost') {
    lines.push(formatThread(thread.parent, depth));
    lines.push('');
  }

  const post = thread.post;
  const author = `@${post.author.handle}`;
  const name = post.author.displayName ? ` (${post.author.displayName})` : '';
  const text = post.record?.text ?? '';
  const ts = new Date(post.indexedAt).toLocaleString();
  const stats = [
    `♡ ${post.likeCount ?? 0}`,
    `⟲ ${post.repostCount ?? 0}`,
    `💬 ${post.replyCount ?? 0}`,
  ].join('  ');

  lines.push(`${indent}${author}${name} — ${ts}`);
  for (const line of text.split('\n')) {
    lines.push(`${indent}${line}`);
  }
  lines.push(`${indent}${stats}`);
  lines.push(`${indent}URI: ${post.uri} | CID: ${post.cid}`);

  if (thread.replies?.length) {
    for (const reply of thread.replies) {
      lines.push('');
      lines.push(formatThread(reply, depth + 1));
    }
  }

  return lines.join('\n');
};
