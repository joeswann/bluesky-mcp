import { type Config } from '../config/index.js';
import type { AtUri, FeedViewPost, Notification, PostView, ProfileView, Session, ThreadViewPost } from './types.js';

export class BlueskyClient {
  private config: Config;
  private accessJwt: string | null = null;
  private refreshJwt: string | null = null;
  private did: string | null = null;
  private handle: string | null = null;

  constructor(config: Config) {
    this.config = config;
  }

  private async createSession(): Promise<void> {
    const url = `${this.config.BLUESKY_PDS_URL}/xrpc/com.atproto.server.createSession`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: this.config.BLUESKY_IDENTIFIER,
        password: this.config.BLUESKY_APP_PASSWORD,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to create session: ${res.status} ${body}`);
    }

    const session = (await res.json()) as Session;
    this.accessJwt = session.accessJwt;
    this.refreshJwt = session.refreshJwt;
    this.did = session.did;
    this.handle = session.handle;
  }

  private async refreshSessionToken(): Promise<void> {
    if (!this.refreshJwt) {
      await this.createSession();
      return;
    }

    const url = `${this.config.BLUESKY_PDS_URL}/xrpc/com.atproto.server.refreshSession`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.refreshJwt}` },
    });

    if (!res.ok) {
      await this.createSession();
      return;
    }

    const session = (await res.json()) as Session;
    this.accessJwt = session.accessJwt;
    this.refreshJwt = session.refreshJwt;
    this.did = session.did;
    this.handle = session.handle;
  }

  private async ensureSession(): Promise<void> {
    if (!this.accessJwt) {
      await this.createSession();
    }
  }

  async makeRequest<T>(nsid: string, params?: Record<string, unknown>, method: 'GET' | 'POST' = 'GET'): Promise<T> {
    await this.ensureSession();

    const doRequest = async (): Promise<Response> => {
      let url = `${this.config.BLUESKY_PDS_URL}/xrpc/${nsid}`;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.accessJwt}`,
      };

      if (method === 'GET' && params) {
        const searchParams = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined && v !== null) {
            searchParams.set(k, String(v));
          }
        }
        const qs = searchParams.toString();
        if (qs) url += `?${qs}`;
        return fetch(url, { method, headers });
      }

      if (method === 'POST') {
        headers['Content-Type'] = 'application/json';
        return fetch(url, {
          method,
          headers,
          body: params ? JSON.stringify(params) : undefined,
        });
      }

      return fetch(url, { method, headers });
    };

    let res = await doRequest();

    if (res.status === 401) {
      await this.refreshSessionToken();
      res = await doRequest();
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`XRPC ${nsid} failed: ${res.status} ${body}`);
    }

    return (await res.json()) as T;
  }

  getDid(): string {
    if (!this.did) throw new Error('No active session');
    return this.did;
  }

  getHandle(): string {
    if (!this.handle) throw new Error('No active session');
    return this.handle;
  }

  // Profile
  async getProfile(actor: string): Promise<ProfileView> {
    return this.makeRequest<ProfileView>('app.bsky.actor.getProfile', { actor });
  }

  // Timeline
  async getTimeline(limit = 20, cursor?: string): Promise<{ feed: FeedViewPost[]; cursor?: string }> {
    return this.makeRequest('app.bsky.feed.getTimeline', { limit, cursor });
  }

  // Author feed
  async getAuthorFeed(actor: string, limit = 20, cursor?: string): Promise<{ feed: FeedViewPost[]; cursor?: string }> {
    return this.makeRequest('app.bsky.feed.getAuthorFeed', { actor, limit, cursor });
  }

  // Thread
  async getPostThread(uri: string, depth = 6): Promise<{ thread: ThreadViewPost }> {
    return this.makeRequest('app.bsky.feed.getPostThread', { uri, depth });
  }

  // Create post
  async createPost(text: string, reply?: { root: { uri: string; cid: string }; parent: { uri: string; cid: string } }): Promise<{ uri: string; cid: string }> {
    await this.ensureSession();
    const record: Record<string, unknown> = {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: new Date().toISOString(),
    };
    if (reply) record.reply = reply;

    return this.makeRequest('com.atproto.repo.createRecord', {
      repo: this.did!,
      collection: 'app.bsky.feed.post',
      record,
    }, 'POST');
  }

  // Delete record
  async deleteRecord(uri: string): Promise<void> {
    const { repo, collection, rkey } = parseAtUri(uri);
    await this.makeRequest('com.atproto.repo.deleteRecord', { repo, collection, rkey }, 'POST');
  }

  // Repost
  async repost(uri: string, cid: string): Promise<{ uri: string; cid: string }> {
    await this.ensureSession();
    return this.makeRequest('com.atproto.repo.createRecord', {
      repo: this.did!,
      collection: 'app.bsky.feed.repost',
      record: {
        $type: 'app.bsky.feed.repost',
        subject: { uri, cid },
        createdAt: new Date().toISOString(),
      },
    }, 'POST');
  }

  // Search posts
  async searchPosts(q: string, limit = 25, sort: 'top' | 'latest' = 'top', cursor?: string): Promise<{ posts: PostView[]; cursor?: string }> {
    return this.makeRequest('app.bsky.feed.searchPosts', { q, limit, sort, cursor });
  }

  // Search actors
  async searchActors(q: string, limit = 10): Promise<{ actors: ProfileView[] }> {
    return this.makeRequest('app.bsky.actor.searchActors', { q, limit });
  }

  // Notifications
  async listNotifications(limit = 30, cursor?: string): Promise<{ notifications: Notification[]; cursor?: string }> {
    return this.makeRequest('app.bsky.notification.listNotifications', { limit, cursor });
  }

  // Like
  async likePost(uri: string, cid: string): Promise<{ uri: string; cid: string }> {
    await this.ensureSession();
    return this.makeRequest('com.atproto.repo.createRecord', {
      repo: this.did!,
      collection: 'app.bsky.feed.like',
      record: {
        $type: 'app.bsky.feed.like',
        subject: { uri, cid },
        createdAt: new Date().toISOString(),
      },
    }, 'POST');
  }

  // Unlike
  async unlikePost(rkey: string): Promise<void> {
    await this.ensureSession();
    await this.makeRequest('com.atproto.repo.deleteRecord', {
      repo: this.did!,
      collection: 'app.bsky.feed.like',
      rkey,
    }, 'POST');
  }

  // Follow
  async followUser(did: string): Promise<{ uri: string; cid: string }> {
    await this.ensureSession();
    return this.makeRequest('com.atproto.repo.createRecord', {
      repo: this.did!,
      collection: 'app.bsky.graph.follow',
      record: {
        $type: 'app.bsky.graph.follow',
        subject: did,
        createdAt: new Date().toISOString(),
      },
    }, 'POST');
  }

  // Unfollow
  async unfollowUser(rkey: string): Promise<void> {
    await this.ensureSession();
    await this.makeRequest('com.atproto.repo.deleteRecord', {
      repo: this.did!,
      collection: 'app.bsky.graph.follow',
      rkey,
    }, 'POST');
  }

  // Followers
  async getFollowers(actor: string, limit = 50, cursor?: string): Promise<{ followers: ProfileView[]; cursor?: string; subject: ProfileView }> {
    return this.makeRequest('app.bsky.graph.getFollowers', { actor, limit, cursor });
  }

  // Follows
  async getFollows(actor: string, limit = 50, cursor?: string): Promise<{ follows: ProfileView[]; cursor?: string; subject: ProfileView }> {
    return this.makeRequest('app.bsky.graph.getFollows', { actor, limit, cursor });
  }
}

export const parseAtUri = (uri: string): AtUri => {
  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!match) throw new Error(`Invalid AT URI: ${uri}`);
  return { repo: match[1], collection: match[2], rkey: match[3] };
};
