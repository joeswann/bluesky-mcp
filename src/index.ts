#!/usr/bin/env node
import { createServer } from './server.js';
import { runCli } from './cli/run.js';

const main = async (): Promise<void> => {
  const [first, ...rest] = process.argv.slice(2);
  if (first === '--mcp') {
    await createServer();
    return;
  }
  await runCli(first ? [first, ...rest] : []);
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
