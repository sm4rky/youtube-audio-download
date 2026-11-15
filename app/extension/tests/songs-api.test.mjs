import assert from 'node:assert/strict';
import { test } from 'node:test';
import axios from 'axios';
import { QueryClient, QueryObserver, isCancelledError } from '@tanstack/react-query';
import { apiClient } from '../src/api/api-client.ts';
import { searchSongs } from '../src/api/songs.api.ts';
import { queryClient } from '../src/app/query-client.ts';
import { songSearchOptions } from '../src/queries/songs.queries.ts';
import { createSongSearchStore } from '../src/stores/song-search.store.ts';

const song = {
  geniusId: 1,
  title: 'Song',
  artistName: 'Artist',
  primaryArtists: [{ geniusId: 10, name: 'Artist' }],
  featuredArtists: [],
  year: null,
  coverUrl: null,
  geniusUrl: null,
};

function mockTransport(t, respond, options = {}) {
  const { env, timeout, baseURL } = apiClient.defaults;
  const requests = [];
  // Exercise Axios's real fetch adapter, interceptors, JSON parser and timeout.
  // No HTTP request leaves this process.
  apiClient.defaults.env = {
    ...env,
    fetch: async (request, init) => {
      requests.push(request);
      return respond(request, init);
    },
  };
  Object.assign(apiClient.defaults, {
    baseURL: 'http://localhost:3001/api/v1',
    ...options,
  });
  t.after(() => Object.assign(apiClient.defaults, { env, timeout, baseURL }));
  return requests;
}

function createTestQueryClient(t) {
  const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  t.after(async () => {
    await client.cancelQueries();
    // Let cancelled fetches finish scheduling GC before clearing their timers.
    await new Promise((resolve) => setImmediate(resolve));
    client.clear();
  });
  return client;
}

function pendingUntilAbort(request) {
  return new Promise((_, reject) => {
    if (request.signal.aborted) reject(request.signal.reason);
    else request.signal.addEventListener('abort', () => reject(request.signal.reason), { once: true });
  });
}

test('API preserves supplied input and shared Axios encodes the query once', async (t) => {
  const query = '  So\u0301ng   Đừng hỏi em & + #? / (Official Video)  ';
  const requests = mockTransport(t, () => Response.json({ query, items: [song] }), {
    baseURL: 'https://api.example.com/api/v1/',
  });
  const result = await searchSongs(query);
  const request = requests[0];
  const url = new URL(request.url);
  assert.equal(url.origin + url.pathname, 'https://api.example.com/api/v1/songs/search');
  assert.deepEqual([...url.searchParams], [['q', query]]);
  assert.equal(request.headers.get('accept'), 'application/json');
  assert.equal(request.headers.has('authorization'), false);
  assert.equal(request.headers.has('cookie'), false);
  assert.equal(request.credentials, 'omit');
  assert.equal(request.redirect, 'error');
  assert.deepEqual(result, { query, items: [song] });
  assert.equal(requests.length, 1);
});

test('HTTP failures retain native Axios status and error information', async (t) => {
  for (const status of [400, 401, 429, 500, 502, 503]) {
    await t.test(String(status), async (t) => {
      const requests = mockTransport(t, () => Response.json({ message: 'private upstream body' }, { status }));
      await assert.rejects(searchSongs('Song'), (error) => {
        assert.equal(axios.isAxiosError(error), true);
        assert.equal(error.response.status, status);
        return true;
      });
      assert.equal(requests.length, 1);
    });
  }
});

test('network failures remain transport errors rather than empty results', async (t) => {
  mockTransport(t, () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(searchSongs('Song'), (error) => axios.isAxiosError(error) && error.code === 'ERR_NETWORK');
});

test('strict Axios JSON parsing rejects malformed JSON and HTML bodies', async (t) => {
  for (const response of [
    new Response('{', { headers: { 'content-type': 'application/json' } }),
    new Response('<html>Not JSON</html>', { headers: { 'content-type': 'text/html' } }),
  ]) {
    await t.test(response.headers.get('content-type'), async (t) => {
      mockTransport(t, () => response);
      await assert.rejects(searchSongs('Song'),
        (error) => axios.isAxiosError(error) && error.code === 'ERR_BAD_RESPONSE');
    });
  }
});

test('valid search responses are parsed independently of their JSON media type', async (t) => {
  const body = { query: 'Song', items: [song], additionalField: 'preserved' };
  for (const contentType of ['application/json', 'application/vnd.audiomint+json', 'text/html']) {
    await t.test(contentType, async (t) => {
      mockTransport(t, () => new Response(JSON.stringify(body), {
        headers: { 'content-type': contentType },
      }));
      assert.deepEqual(await searchSongs('Song'), { query: 'Song', items: [song] });
    });
  }
});

test('search response validation preserves Unicode, nullable fields and result order', async (t) => {
  const first = {
    ...song,
    title: '  So\u0301ng 한국어 Español  ',
    artistName: 'Nghệ sĩ',
    primaryArtists: [{ geniusId: 10, name: '  Nghệ sĩ  ' }],
    featuredArtists: [{ geniusId: 11, name: 'Guest' }],
    year: 2026,
    coverUrl: 'https://images.genius.com/cover.png',
    geniusUrl: 'https://genius.com/song-lyrics',
  };
  const body = { query: 'So\u0301ng', items: [first, { ...song, geniusId: 2 }] };
  mockTransport(t, () => Response.json(body));
  assert.deepEqual(await searchSongs('Song'), body);
});

test('malformed search responses fail at the API boundary with a safe error', async (t) => {
  const invalidBodies = [
    null, [], {}, { query: 1, items: [] }, { query: 'Song', items: null },
    { query: 'Song', items: [null] },
    ...[
      { geniusId: 0 }, { geniusId: -1 }, { geniusId: 1.5 },
      { geniusId: Number.MAX_SAFE_INTEGER + 1 }, { geniusId: '1' },
      { title: ' ' }, { artistName: '' }, { primaryArtists: null },
      { primaryArtists: [{ geniusId: 10, name: ' ' }] },
      { featuredArtists: [{ geniusId: '11', name: 'Guest' }] },
      { year: 0 }, { year: 10000 }, { year: 2026.5 },
      { coverUrl: undefined }, { geniusUrl: 1 },
    ].map((patch) => ({ query: 'Song', items: [{ ...song, ...patch }] })),
  ];
  for (const body of invalidBodies) {
    await t.test(JSON.stringify(body), async (t) => {
      mockTransport(t, () => Response.json(body));
      await assert.rejects(searchSongs('Song'), (error) => {
        assert.equal(error.name, 'Error');
        assert.equal(error.message, 'The backend returned an invalid song search response.');
        assert.equal('issues' in error, false);
        assert.equal('cause' in error, false);
        return true;
      });
    });
  }
});

test('invalid response data never enters the successful query cache', async (t) => {
  const requests = mockTransport(t, () => Response.json({ query: 'Song', items: null }));
  const client = createTestQueryClient(t);
  const options = songSearchOptions('Song');
  await assert.rejects(client.fetchQuery(options), /invalid song search response/);
  assert.equal(client.getQueryData(options.queryKey), undefined);
  assert.equal(client.getQueryState(options.queryKey).status, 'error');
  assert.equal(requests.length, 1);
});

test('Axios timeout aborts a pending request', async (t) => {
  const requests = mockTransport(t, pendingUntilAbort, { timeout: 20 });
  await assert.rejects(searchSongs('Song'), (error) => axios.isAxiosError(error) && error.code === 'ETIMEDOUT');
  assert.equal(requests[0].signal.aborted, true);
});

test('Axios timeout also covers reading a response body after headers arrive', async (t) => {
  const requests = mockTransport(t, (request) => new Response(new ReadableStream({
    start(controller) {
      request.signal.addEventListener('abort', () => controller.error(request.signal.reason), { once: true });
    },
  }), { headers: { 'content-type': 'application/json' } }), { timeout: 20 });
  await assert.rejects(searchSongs('Song'), (error) => axios.isAxiosError(error) && error.code === 'ETIMEDOUT');
  assert.equal(requests[0].signal.aborted, true);
});

test('caller cancellation is preserved instead of being reported as network failure', async (t) => {
  const requests = mockTransport(t, pendingUntilAbort);
  const controller = new AbortController();
  const pending = searchSongs('Song', controller.signal);
  while (!requests.length) await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, (error) => axios.isCancel(error));
  assert.equal(requests[0].signal.aborted, true);
});

test('query keys use the exact trimmed query and disabled options reject invalid inputs', () => {
  const query = 'So\u0301ng   [Official Video]';
  assert.deepEqual(songSearchOptions(` ${query} `).queryKey, ['songs', 'search', query]);
  assert.equal(songSearchOptions(query).enabled, true);
  assert.equal(songSearchOptions(' ').enabled, false);
  assert.equal(songSearchOptions('a'.repeat(201)).enabled, false);
});

test('empty/invalid queries stay disabled when observed and send no HTTP requests', async (t) => {
  const requests = mockTransport(t, () => { throw new Error('Unexpected HTTP'); });
  const client = createTestQueryClient(t);
  for (const input of ['', 'a'.repeat(201)]) {
    const observer = new QueryObserver(client, songSearchOptions(input));
    const unsubscribe = observer.subscribe(() => {});
    assert.equal(observer.getCurrentResult().fetchStatus, 'idle');
    unsubscribe();
  }
  // Imperative fetchQuery ignores enabled, so queryFn guards its API call.
  await assert.rejects(client.fetchQuery(songSearchOptions(' ')), /1 and 200/);
  assert.equal(requests.length, 0);
});

test('TanStack Query deduplicates, caches ordered server results, and keeps Zustand clean', async (t) => {
  const requests = mockTransport(t, () => Response.json({ query: 'Song', items: [song, { ...song, geniusId: 2 }] }));
  const client = createTestQueryClient(t);
  const store = createSongSearchStore({
    getActiveTabId: async () => 42,
    getSnapshot: async () => { throw new Error('Not needed'); },
  });
  store.getState().submit(' Song ');
  const options = songSearchOptions(store.getState().query);
  const [first, second] = await Promise.all([client.fetchQuery(options), client.fetchQuery(options)]);
  assert.equal(requests.length, 1);
  assert.deepEqual(first.items.map((item) => item.geniusId), [1, 2]);
  assert.equal(first, second);
  assert.equal(await client.fetchQuery(options), first);
  assert.equal(requests.length, 1);
  assert.equal('items' in store.getState(), false);
  assert.equal('searchError' in store.getState(), false);
});

test('empty results never trigger fallback requests and errors require explicit refetch', async (t) => {
  let failing = true;
  const requests = mockTransport(t, () => failing
    ? new Response('', { status: 502 })
    : Response.json({ query: 'Song', items: [] }));
  const client = createTestQueryClient(t);
  const options = songSearchOptions('Song');
  await assert.rejects(client.fetchQuery(options), (error) => axios.isAxiosError(error) && error.response.status === 502);
  assert.equal(requests.length, 1);
  failing = false;
  assert.deepEqual(await client.fetchQuery(options), { query: 'Song', items: [] });
  assert.equal(requests.length, 2);
  assert.equal(client.getQueryState(options.queryKey).status, 'success');
});

test('separate query keys prevent late responses from replacing a newer search', async (t) => {
  let finish;
  mockTransport(t, (request) => new URL(request.url).searchParams.get('q') === 'Old'
    ? new Promise((resolve) => { finish = resolve; })
    : Response.json({ query: 'New', items: [{ ...song, title: 'Newest' }] }));
  const client = createTestQueryClient(t);
  const observer = new QueryObserver(client, songSearchOptions('Old'));
  const unsubscribe = observer.subscribe(() => {});
  while (!finish) await new Promise((resolve) => setImmediate(resolve));
  const latest = songSearchOptions('New');
  observer.setOptions(latest);
  await client.fetchQuery(latest);
  finish(Response.json({ query: 'Old', items: [{ ...song, title: 'Stale' }] }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(observer.getCurrentResult().data.items[0].title, 'Newest');
  unsubscribe();
});

test('query cancellation propagates through Axios to the HTTP request', async (t) => {
  const requests = mockTransport(t, pendingUntilAbort);
  const client = createTestQueryClient(t);
  const options = songSearchOptions('Song');
  const pending = client.fetchQuery(options);
  const rejected = assert.rejects(pending, (error) => isCancelledError(error));
  while (!requests.length) await new Promise((resolve) => setImmediate(resolve));
  await client.cancelQueries({ queryKey: options.queryKey });
  await rejected;
  assert.equal(requests[0].signal.aborted, true);
});

test('last query observer unmount aborts its request', async (t) => {
  const requests = mockTransport(t, pendingUntilAbort);
  const client = createTestQueryClient(t);
  const observer = new QueryObserver(client, songSearchOptions('Song'));
  const unsubscribe = observer.subscribe(() => {});
  while (!requests.length) await new Promise((resolve) => setImmediate(resolve));
  unsubscribe();
  assert.equal(requests[0].signal.aborted, true);
});

test('popup defaults prevent automatic retry, remount/focus/reconnect refetch and polling', async (t) => {
  const defaults = queryClient.getDefaultOptions().queries;
  for (const field of ['retry', 'refetchOnMount', 'refetchOnWindowFocus', 'refetchOnReconnect', 'refetchInterval']) {
    assert.equal(defaults[field], false);
  }
  assert.equal(defaults.staleTime, 300_000);
  assert.equal(defaults.gcTime, 86_400_000);
  const requests = mockTransport(t, () => Response.json({ query: 'Song', items: [] }));
  const client = createTestQueryClient(t);
  const options = { ...songSearchOptions('Song'), staleTime: 0 };
  await client.fetchQuery(options);
  const observer = new QueryObserver(client, options);
  const unsubscribe = observer.subscribe(() => {});
  client.getQueryCache().onFocus();
  client.getQueryCache().onOnline();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, 1);
  unsubscribe();
});
