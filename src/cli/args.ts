import { parseArgs } from 'node:util';

export type Flags = {
  limit?: number;
  json: boolean;
  yes: boolean;
  sort?: string;
  cursor?: string;
  depth?: number;
  replyTo?: string;
  url?: string;
};

type Parsed = { positionals: string[]; flags: Flags };

const toNumber = (v: string | undefined): number | undefined => {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Expected a number, got: ${v}`);
  return n;
};

export const parse = (argv: string[]): Parsed => {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      limit: { type: 'string' },
      json: { type: 'boolean', default: false },
      yes: { type: 'boolean', short: 'y', default: false },
      sort: { type: 'string' },
      cursor: { type: 'string' },
      depth: { type: 'string' },
      'reply-to': { type: 'string' },
      url: { type: 'string' },
    },
  });

  return {
    positionals,
    flags: {
      limit: toNumber(values.limit as string | undefined),
      json: values.json as boolean,
      yes: values.yes as boolean,
      sort: values.sort as string | undefined,
      cursor: values.cursor as string | undefined,
      depth: toNumber(values.depth as string | undefined),
      replyTo: values['reply-to'] as string | undefined,
      url: values.url as string | undefined,
    },
  };
};
