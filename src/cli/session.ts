import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Session } from '../api/types.js';

type CachedSession = Session & { identifier: string };

const cachePath = join(homedir(), '.config', 'bluesky-cli', 'session.json');

export const readSession = (identifier: string): Session | null => {
  try {
    const raw = readFileSync(cachePath, 'utf8');
    const cached = JSON.parse(raw) as CachedSession;
    if (cached.identifier !== identifier) return null;
    if (!cached.accessJwt || !cached.refreshJwt || !cached.did) return null;
    return { did: cached.did, handle: cached.handle, accessJwt: cached.accessJwt, refreshJwt: cached.refreshJwt };
  } catch {
    return null;
  }
};

export const writeSession = (identifier: string, session: Session): void => {
  const cached: CachedSession = { ...session, identifier };
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(cached), { mode: 0o600 });
  chmodSync(cachePath, 0o600);
};

export const deleteSession = (): boolean => {
  try {
    rmSync(cachePath);
    return true;
  } catch {
    return false;
  }
};
