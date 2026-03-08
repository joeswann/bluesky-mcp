import { config } from 'dotenv';
import { z } from 'zod';

const originalWrite = process.stdout.write;
process.stdout.write = () => true;
config();
process.stdout.write = originalWrite;

const configSchema = z.object({
  BLUESKY_IDENTIFIER: z.string().min(1, 'Bluesky identifier (handle or DID) is required'),
  BLUESKY_APP_PASSWORD: z.string().min(1, 'App password is required'),
  BLUESKY_PDS_URL: z.string().url().default('https://bsky.social'),
});

export type Config = z.infer<typeof configSchema>;

let cachedConfig: Config | null = null;

export const getConfig = (): Config => {
  if (cachedConfig) return cachedConfig;

  const result = configSchema.safeParse({
    BLUESKY_IDENTIFIER: process.env.BLUESKY_IDENTIFIER,
    BLUESKY_APP_PASSWORD: process.env.BLUESKY_APP_PASSWORD,
    BLUESKY_PDS_URL: process.env.BLUESKY_PDS_URL || 'https://bsky.social',
  });

  if (!result.success) {
    throw new Error(`Invalid configuration: ${result.error.message}`);
  }

  cachedConfig = result.data;
  return cachedConfig;
};
