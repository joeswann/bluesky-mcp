import { createInterface } from 'node:readline';

export const confirm = async (prompt: string, yes: boolean): Promise<boolean> => {
  if (yes) return true;

  if (!process.stdin.isTTY) {
    throw new Error('Refusing to perform a write: stdin is not a TTY. Pass --yes to confirm non-interactively.');
  }

  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await new Promise<string>((resolve) => {
      rl.question(`${prompt} [y/N] `, resolve);
    });
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
};
