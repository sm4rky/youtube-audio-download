export const SEARCH_QUERY_MAX_LENGTH = 200;

// Match the API's character count, including Unicode presentation sequences.
export function searchQueryLength(value: string): number {
  const presentations =
    value.match(/[^\uFE0F\uFE0E][\uFE0F\uFE0E]/gu)?.length ?? 0;
  return Array.from(value).length - presentations;
}

const videoLabel =
  '(?:Official (?:Music Video|Lyrics? Video|Video|Audio|MV)|Lyrics? Video|4K|8K|HD|720p|1080p|2160p)';
const bracketedLabel = new RegExp(
  `(?:\\s*[|｜]\\s*)?(?:\\(${videoLabel}\\)|\\[${videoLabel}\\])$`,
  'iu',
);
const separatedLabel = new RegExp(`\\s*[|｜]\\s*${videoLabel}$`, 'iu');
const quotedMv = /(?:^|\s)(?:'[^']+'|"[^"]+"|‘[^’]+’|“[^”]+”)\s+MV$/iu;

function shortenQuery(query: string): string {
  if (searchQueryLength(query) <= SEARCH_QUERY_MAX_LENGTH) return query;
  let result = '';
  let length = 0;
  for (const { segment } of new Intl.Segmenter(undefined, {
    granularity: 'grapheme',
  }).segment(query)) {
    const segmentLength = searchQueryLength(segment);
    if (length + segmentLength > SEARCH_QUERY_MAX_LENGTH) break;
    result += segment;
    length += segmentLength;
  }
  // An unusually large combining sequence can itself exceed the API limit.
  if (!result)
    result = Array.from(query).slice(0, SEARCH_QUERY_MAX_LENGTH).join('');
  const boundary = result.lastIndexOf(' ');
  return (boundary > 0 ? result.slice(0, boundary) : result).trimEnd();
}

export function normalizeTitleToQuery(title: string): string {
  const original = title.normalize('NFC').replace(/\s+/gu, ' ').trim();
  let query = original;
  let previous: string;
  do {
    previous = query;
    query = query
      .replace(bracketedLabel, '')
      .replace(separatedLabel, '')
      .trimEnd();
    if (quotedMv.test(query)) query = query.replace(/\s+MV$/iu, '').trimEnd();
  } while (query !== previous);
  return shortenQuery(query || original);
}

export function validateManualQuery(value: string): string {
  const query = value.trim();
  const length = searchQueryLength(query);
  if (length < 1 || length > SEARCH_QUERY_MAX_LENGTH) {
    throw new Error(
      `Enter a query between 1 and ${SEARCH_QUERY_MAX_LENGTH} characters.`,
    );
  }
  return query;
}
