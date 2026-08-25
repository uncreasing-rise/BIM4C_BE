export function normalizeText(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const printable = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  }).join('');
  return printable.replace(/\s+/g, ' ').trim();
}
export function normalizeEmail(value: unknown): unknown { return typeof value === 'string' ? value.trim().toLowerCase() : value; }
