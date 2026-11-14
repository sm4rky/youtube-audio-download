import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  normalizeTitleToQuery,
  validateManualQuery,
  searchQueryLength,
} from '../src/lib/song-title-normalizer.ts';
import { createSongSearchStore, useSongSearchStore } from '../src/stores/song-search.store.ts';
import { YouTubeClientError } from '../src/lib/chrome-tabs.ts';

const examples = [
  [
    'K/DA - WATCH ME ft. Sophie Powers, Mimi Webb (Official Lyric Video)',
    'K/DA - WATCH ME ft. Sophie Powers, Mimi Webb',
  ],
  [
    'SƠN TÙNG M-TP - HÃY TRAO CHO ANH ft. Snoop Dogg (Official Music Video) [4K]',
    'SƠN TÙNG M-TP - HÃY TRAO CHO ANH ft. Snoop Dogg',
  ],
  ["TAEYEON 태연 'INVU' MV", "TAEYEON 태연 'INVU'"],
  [
    'Queen - Radio Ga Ga (Live at Wembley) [4K]',
    'Queen - Radio Ga Ga (Live at Wembley)',
  ],
  [
    "The 1975 - It's Not Living (If It's Not With You) [Official Video]",
    "The 1975 - It's Not Living (If It's Not With You)",
  ],
  ['How I Built My First PC in 2026', 'How I Built My First PC in 2026'],
];
for (const [title, expected] of examples) {
  test(`automatic query for ${title}`, () =>
    assert.equal(normalizeTitleToQuery(title), expected));
}

test('normalization preserves versions, features, punctuation and unknown bracketed text', () => {
  for (const title of [
    'Artist feat. Guest - Song (Acoustic)',
    'Artist ft. Guest / Song (Remix)',
    'Artist - Song (Live at Wembley)',
    'Artist - Song [Unclassified]',
    'Artist - Song MV',
    'Artist - Official Music Video',
    'Song (Official Music Video remix)',
    'Song [Official Video) ',
    'Artist - [Official Video] Song',
  ])
    assert.equal(normalizeTitleToQuery(title), title.trim());
});

test('only terminal complete labels are removed, including multiple labels and separators', () => {
  assert.equal(
    normalizeTitleToQuery('Artist - Song ｜ Official MV'),
    'Artist - Song',
  );
  assert.equal(
    normalizeTitleToQuery('Artist - Song [Official Audio] (Lyric Video) [4K]'),
    'Artist - Song',
  );
  assert.equal(
    normalizeTitleToQuery('Artist - Song | (Official Video) [4K]'),
    'Artist - Song',
  );
  assert.equal(normalizeTitleToQuery("Artist 'Song' MV [4K]"), "Artist 'Song'");
});

test('NFC and whitespace normalization preserve the original language and case', () => {
  const title = '  SO\u031BN\tTU\u0300NG  -\n  Bài Hát [4K] ';
  assert.equal(normalizeTitleToQuery(title), 'SƠN TÙNG - Bài Hát');
});

test('empty titles stay empty and removing all labels falls back to the whitespace-normalized title', () => {
  for (const title of ['', ' \t\n\u00a0 '])
    assert.equal(normalizeTitleToQuery(title), '');
  assert.equal(
    normalizeTitleToQuery('  (Official Audio)   [4K] '),
    '(Official Audio) [4K]',
  );
});

test('long automatic queries fit the API limit at word or Unicode grapheme boundaries', () => {
  const result = normalizeTitleToQuery('Hello Song '.repeat(30));
  assert.ok(searchQueryLength(result) <= 200);
  assert.ok(result.endsWith('Hello') || result.endsWith('Song'));
  assert.equal(normalizeTitleToQuery('한'.repeat(201)), '한'.repeat(200));
  assert.equal(normalizeTitleToQuery('😀'.repeat(201)), '😀'.repeat(200));
  const family = '👨‍👩‍👧‍👦';
  const families = normalizeTitleToQuery(family.repeat(60));
  assert.ok(searchQueryLength(families) <= 200);
  assert.equal(families, family.repeat(families.length / family.length));
  assert.ok(normalizeTitleToQuery('A' + '\u0301'.repeat(300)).length > 0);
});

test('manual queries are only trimmed, retaining internal whitespace, suffixes and decomposed Unicode', () => {
  const input = '  So\u0301ng   ft. Someone (Official Video) [4K]  ';
  assert.equal(validateManualQuery(input), input.trim());
  assert.throws(() => validateManualQuery('  '), /1 and 200/);
  assert.throws(() => validateManualQuery('a'.repeat(201)), /1 and 200/);
  assert.equal(validateManualQuery('😀'.repeat(200)), '😀'.repeat(200));
  assert.equal(searchQueryLength('❤️'.repeat(200)), 200);
});

const snapshot = {
  ok: true,
  snapshot: {
    videoId: 'video',
    title: 'Artist - Song (Official Video)',
    currentTimeMs: 0,
    durationMs: null,
    paused: true,
    playbackRate: 1,
  },
};

function fixture(source = snapshot) {
  return createSongSearchStore({
    getActiveTabId: async () => 42,
    getSnapshot: async () => source,
  });
}

test('Zustand owns client state only and never calls the backend', async (t) => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests += 1;
    throw new Error('Unexpected backend request');
  });
  const store = fixture();
  assert.equal(store.getState().sourceStatus, 'idle');
  assert.equal(useSongSearchStore.getState().sourceStatus, 'idle');
  await store.getState().initialize();
  assert.equal(store.getState().title, snapshot.snapshot.title);
  assert.equal(store.getState().automaticQuery, 'Artist - Song');
  assert.equal(store.getState().query, 'Artist - Song');
  store.getState().submit('  Manual   [Official Video]  ');
  assert.equal(store.getState().query, 'Manual   [Official Video]');
  for (const key of ['items', 'searchStatus', 'searchError', 'retry']) {
    assert.equal(key in store.getState(), false);
  }
  assert.equal(requests, 0);
});

test('manual input validation preserves the last valid query and automatic query', async () => {
  const store = fixture();
  await store.getState().initialize();
  const manual = '  So\u0301ng   ft. Guest (Official Video)  ';
  store.getState().submit(manual);
  assert.equal(store.getState().query, manual.trim());
  for (const input of [' ', 'a'.repeat(201)]) {
    store.getState().submit(input);
    assert.ok(store.getState().validationError);
    assert.equal(store.getState().query, manual.trim());
  }
  store.getState().submit('Valid');
  assert.equal(store.getState().validationError, null);
  assert.equal(store.getState().automaticQuery, 'Artist - Song');
});

test('Zustand subscribers unsubscribe and actions survive source resets', async () => {
  const store = fixture();
  const initialize = store.getState().initialize;
  const changes = [];
  const unsubscribe = store.subscribe((state) => changes.push(state.sourceStatus));
  await initialize();
  assert.deepEqual(changes, ['loading', 'ready']);
  unsubscribe();
  await initialize();
  assert.equal(changes.length, 2);
  assert.equal(store.getState().initialize, initialize);
});

test('missing title, identity or player never produces a submitted query', async () => {
  for (const source of [
    { ...snapshot, snapshot: { ...snapshot.snapshot, title: ' ' } },
    { ...snapshot, snapshot: { ...snapshot.snapshot, videoId: null } },
    { ok: false, error: { code: 'PLAYER_UNAVAILABLE', message: 'Unavailable' } },
  ]) {
    const store = fixture(source);
    await store.getState().initialize();
    assert.notEqual(store.getState().sourceStatus, 'ready');
    assert.equal(store.getState().query, '');
    assert.ok(store.getState().sourceError);
  }
});

test('typed source errors are preserved and explicit reinitialization can recover', async () => {
  for (const code of ['CONTENT_UNAVAILABLE', 'INVALID_RESPONSE', 'TAB_UNAVAILABLE', 'UNSUPPORTED_TAB']) {
    let available = false;
    const store = createSongSearchStore({
      getActiveTabId: async () => {
        if (!available) throw new YouTubeClientError(code, 'Reload and retry.');
        return 42;
      },
      getSnapshot: async () => snapshot,
    });
    await store.getState().initialize();
    assert.equal(store.getState().sourceStatus, code === 'UNSUPPORTED_TAB' ? 'unsupported' : 'unavailable');
    assert.ok(store.getState().sourceError);
    available = true;
    await store.getState().initialize();
    assert.equal(store.getState().sourceStatus, 'ready');
    assert.equal(store.getState().sourceError, null);
  }
});

test('late source reads cannot overwrite a newer initialization', async () => {
  let finish;
  let reads = 0;
  const store = createSongSearchStore({
    getActiveTabId: async () => 42,
    getSnapshot: async () => ++reads === 1
      ? new Promise((resolve) => { finish = resolve; })
      : { ...snapshot, snapshot: { ...snapshot.snapshot, title: 'Newest' } },
  });
  const old = store.getState().initialize();
  while (!finish) await new Promise((resolve) => setImmediate(resolve));
  await store.getState().initialize();
  finish(snapshot);
  await old;
  assert.equal(store.getState().title, 'Newest');
  assert.equal(store.getState().query, 'Newest');
});

test('dispose suppresses pending Chrome reads and reinitialization remains possible', async () => {
  let finish;
  let reads = 0;
  const store = createSongSearchStore({
    getActiveTabId: async () => 42,
    getSnapshot: async () => ++reads === 1
      ? new Promise((resolve) => { finish = resolve; })
      : snapshot,
  });
  const pending = store.getState().initialize();
  while (!finish) await new Promise((resolve) => setImmediate(resolve));
  store.getState().dispose();
  const before = store.getState();
  finish(snapshot);
  await pending;
  assert.equal(store.getState(), before);
  await store.getState().initialize();
  assert.equal(store.getState().sourceStatus, 'ready');
});

test('configuration limits backend access to the environment API origin', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../dist/manifest.json', import.meta.url), 'utf8'),
  );
  assert.equal(manifest.host_permissions.length, 1);
  assert.match(manifest.host_permissions[0], /^https?:\/\/[^*]+\/\*$/);
  assert.equal(
    manifest.host_permissions[0],
    new URL(process.env.VITE_API_BASE_URL?.trim() || 'http://localhost:3001/api/v1').origin + '/*',
  );
});
