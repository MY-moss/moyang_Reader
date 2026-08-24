export type QuickOpenCandidate = {
  path: string;
  name: string;
  relativePath?: string;
  kind?: string;
  isRecent?: boolean;
};

const DEFAULT_RESULT_LIMIT = 60;

function normalize(value: string): string {
  return value
    .replace(/[\\/]+/g, "/")
    .trim()
    .toLocaleLowerCase();
}

function subsequenceScore(value: string, query: string): number | null {
  let cursor = 0;
  let firstMatch = -1;
  let gaps = 0;

  for (const character of query) {
    const match = value.indexOf(character, cursor);
    if (match < 0) return null;
    if (firstMatch < 0) firstMatch = match;
    gaps += Math.max(0, match - cursor);
    cursor = match + 1;
  }

  return 280 - firstMatch - gaps;
}

function fieldScore(field: string, token: string): number | null {
  if (!field) return null;
  if (field === token) return 1_000;
  if (field.startsWith(token)) return 820 - Math.min(field.length - token.length, 120);

  const contained = field.indexOf(token);
  if (contained >= 0) return 660 - Math.min(contained, 120);

  return subsequenceScore(field, token);
}

function candidateScore(candidate: QuickOpenCandidate, tokens: string[]): number | null {
  const fields = [normalize(candidate.name), normalize(candidate.relativePath ?? ""), normalize(candidate.path)];
  let score = candidate.isRecent ? 35 : 0;

  for (const token of tokens) {
    const tokenScore = Math.max(...fields.map((field) => fieldScore(field, token)).filter((value) => value !== null));
    if (!Number.isFinite(tokenScore)) return null;
    score += tokenScore;
  }

  return score;
}

function candidateKey(path: string): string {
  return normalize(path);
}

export function rankQuickOpenItems(
  candidates: QuickOpenCandidate[],
  query: string,
  limit = DEFAULT_RESULT_LIMIT,
): QuickOpenCandidate[] {
  const unique = new Map<string, QuickOpenCandidate>();
  for (const candidate of candidates) {
    const key = candidateKey(candidate.path);
    if (!key) continue;

    const existing = unique.get(key);
    if (existing) {
      unique.set(key, { ...existing, isRecent: existing.isRecent || candidate.isRecent });
    } else {
      unique.set(key, candidate);
    }
  }

  const items = [...unique.values()];
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return items.slice(0, Math.max(0, limit));

  return items
    .map((candidate, index) => ({ candidate, score: candidateScore(candidate, tokens), index }))
    .filter((item): item is { candidate: QuickOpenCandidate; score: number; index: number } => item.score !== null)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, Math.max(0, limit))
    .map((item) => item.candidate);
}
