export const json = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

export const line = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

export const renderList = <T>(
  items: T[],
  formatter: (item: T, i: number) => string,
  cursor: string | undefined,
  empty: string,
  sep = '\n\n',
): void => {
  if (items.length === 0) {
    line(empty);
    return;
  }
  const parts = items.map((item, i) => `[${i + 1}] ${formatter(item, i)}`);
  if (cursor) parts.push(`\n--- cursor: ${cursor} ---`);
  line(parts.join(sep));
};
