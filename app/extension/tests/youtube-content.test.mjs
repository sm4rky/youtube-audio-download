import { YouTubeClientError } from '../src/errors/youtube-client.error.ts';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import {
  isPopupToContentMessage,
  isYouTubeContentResponse,
  YOUTUBE_MESSAGE,
} from '../src/lib/youtube-messages.ts';
import {
  getActiveYouTubeTab,
  sendYouTubeMessage,
} from '../src/lib/youtube-client.ts';

const content = readFileSync(
  new URL('../dist/content.js', import.meta.url),
  'utf8',
);

function fixture() {
  class Video {
    currentTime = 12.3456;
    duration = 120;
    paused = false;
    playbackRate = 1.25;
    playFailure = false;

    pause() {
      this.paused = true;
    }
    play() {
      if (this.playFailure)
        return Promise.reject(new Error('Browser blocked play'));
      this.paused = false;
      return Promise.resolve();
    }
  }
  const state = {
    video: new Video(),
    heading: '  WATCH ME (Official) [Live Remix] / Tiếng Việt / 한국어  ',
    metaTitle: 'Metadata title',
    href: 'https://www.youtube.com/watch?v=first&t=90&list=example',
    listeners: [],
  };
  const window = {
    location: {
      get href() {
        return state.href;
      },
    },
  };
  const document = {
    title: 'Fallback title - YouTube',
    querySelector(selector) {
      if (selector.includes('video')) return state.video;
      if (selector.includes('h1'))
        return state.heading === null ? null : { textContent: state.heading };
      if (selector.startsWith('meta'))
        return { getAttribute: () => state.metaTitle };
      return null;
    },
  };
  const chrome = {
    runtime: {
      id: 'fixture-extension',
      onMessage: {
        addListener(listener) {
          state.listeners.push(listener);
        },
      },
    },
  };
  const unexpectedLog = () => {
    throw new Error('Unexpected content-script logging');
  };
  runInNewContext(content, {
    window,
    document,
    chrome,
    HTMLVideoElement: Video,
    URL,
    console: { log: unexpectedLog, table: unexpectedLog, error: unexpectedLog },
  });
  function dispatch(message, sender = { id: 'fixture-extension' }) {
    let response;
    let resolve;
    const promise = new Promise((callback) => {
      resolve = callback;
    });
    const keepOpen = state.listeners[0](message, sender, (value) => {
      response = structuredClone(value);
      resolve(response);
    });
    return {
      keepOpen,
      promise,
      get response() {
        return response;
      },
    };
  }
  return { state, dispatch, Video, window, document };
}

test('the build contains the popup and all manifest-referenced content scripts', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../dist/manifest.json', import.meta.url), 'utf8'),
  );
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['tabs', 'storage']);
  assert.deepEqual(manifest.content_scripts[0].matches, [
    'https://www.youtube.com/*',
  ]);
  for (const file of [
    manifest.action.default_popup,
    ...manifest.content_scripts.flatMap((entry) => entry.js),
  ]) {
    assert.ok(existsSync(new URL('../dist/' + file, import.meta.url)), file);
  }
});

test('snapshot replies synchronously, preserves title and reports integer milliseconds', () => {
  const { state, dispatch, window } = fixture();
  const result = dispatch({ type: YOUTUBE_MESSAGE.GET_SNAPSHOT });
  assert.equal(result.keepOpen, false);
  assert.deepEqual(result.response, {
    ok: true,
    snapshot: {
      videoId: 'first',
      title: state.heading.trim(),
      currentTimeMs: 12346,
      durationMs: 120000,
      paused: false,
      playbackRate: 1.25,
    },
  });
  assert.equal(isYouTubeContentResponse(result.response), true);
  assert.deepEqual(Object.keys(window), ['location']);
});

test('navigation and unrelated URL parameters are read afresh on every snapshot', () => {
  const { state, dispatch } = fixture();
  state.href = 'https://www.youtube.com/watch?v=first&t=15&list=changed';
  assert.equal(
    dispatch({ type: YOUTUBE_MESSAGE.GET_SNAPSHOT }).response.snapshot.videoId,
    'first',
  );
  state.href = 'https://www.youtube.com/watch?v=second';
  state.heading = 'Bài mới (Acoustic)';
  const snapshot = dispatch({ type: YOUTUBE_MESSAGE.GET_SNAPSHOT }).response
    .snapshot;
  assert.equal(snapshot.videoId, 'second');
  assert.equal(snapshot.title, state.heading);
});

test('missing ID and non-watch pages have null identity', () => {
  const { state, dispatch } = fixture();
  for (const href of [
    'https://www.youtube.com/',
    'https://www.youtube.com/watch',
    'https://www.youtube.com/watch?v=',
  ]) {
    state.href = href;
    assert.equal(
      dispatch({ type: YOUTUBE_MESSAGE.GET_SNAPSHOT }).response.snapshot
        .videoId,
      null,
    );
  }
});

test('snapshot falls back through raw title sources without normalizing text', () => {
  const { state, document, dispatch } = fixture();
  state.heading = null;
  state.metaTitle = '  Unchanged [Official LIVE]  ';
  assert.equal(
    dispatch({ type: YOUTUBE_MESSAGE.GET_SNAPSHOT }).response.snapshot.title,
    state.metaTitle.trim(),
  );
  state.metaTitle = '';
  assert.equal(
    dispatch({ type: YOUTUBE_MESSAGE.GET_SNAPSHOT }).response.snapshot.title,
    document.title,
  );
});

test('unknown duration and invalid initial time/rate normalize to safe JSON values', () => {
  const { state, dispatch } = fixture();
  for (const duration of [NaN, Infinity, -1]) {
    state.video.duration = duration;
    state.video.currentTime = NaN;
    state.video.playbackRate = NaN;
    const snapshot = dispatch({ type: YOUTUBE_MESSAGE.GET_SNAPSHOT }).response
      .snapshot;
    assert.equal(snapshot.durationMs, null);
    assert.equal(snapshot.currentTimeMs, 0);
    assert.equal(snapshot.playbackRate, 1);
    assert.equal(isYouTubeContentResponse({ ok: true, snapshot }), true);
  }
});

test('missing player is recoverable and each request reacquires the current video', () => {
  const { state, dispatch, Video } = fixture();
  state.video = null;
  assert.equal(
    dispatch({ type: YOUTUBE_MESSAGE.GET_SNAPSHOT }).response.error.code,
    'PLAYER_UNAVAILABLE',
  );
  state.video = new Video();
  state.video.currentTime = 45;
  assert.equal(
    dispatch({ type: YOUTUBE_MESSAGE.GET_SNAPSHOT }).response.snapshot
      .currentTimeMs,
    45000,
  );
  const previous = state.video;
  state.video = new Video();
  dispatch({ type: YOUTUBE_MESSAGE.PAUSE });
  assert.equal(state.video.paused, true);
  assert.equal(previous.paused, false);
  assert.equal(state.listeners.length, 1);
});

test('seek-to uses milliseconds and replies with the actual player position', () => {
  const { state, dispatch } = fixture();
  let actualTime = 0;
  Object.defineProperty(state.video, 'currentTime', {
    get: () => actualTime,
    set: (time) => {
      actualTime = Math.floor(time);
    },
  });
  const result = dispatch({ type: YOUTUBE_MESSAGE.SEEK_TO, timeMs: 30500 });
  assert.equal(result.keepOpen, false);
  assert.equal(state.video.currentTime, 30);
  assert.equal(result.response.snapshot.currentTimeMs, 30000);
});

test('seek-to rejects targets past duration and accepts the end boundary', () => {
  const { state, dispatch } = fixture();
  const before = state.video.currentTime;
  assert.equal(
    dispatch({ type: YOUTUBE_MESSAGE.SEEK_TO, timeMs: 120001 }).response.error
      .code,
    'INVALID_SEEK',
  );
  assert.equal(state.video.currentTime, before);
  assert.equal(
    dispatch({ type: YOUTUBE_MESSAGE.SEEK_TO, timeMs: 120000 }).response
      .snapshot.currentTimeMs,
    120000,
  );
});

test('seek-by clamps relative offsets at zero and the known duration', () => {
  const { dispatch } = fixture();
  assert.equal(
    dispatch({ type: YOUTUBE_MESSAGE.SEEK_BY, deltaMs: -30000 }).response
      .snapshot.currentTimeMs,
    0,
  );
  assert.equal(
    dispatch({ type: YOUTUBE_MESSAGE.SEEK_BY, deltaMs: 300000 }).response
      .snapshot.currentTimeMs,
    120000,
  );
});

test('seek remains possible while duration is unknown', () => {
  const { state, dispatch } = fixture();
  state.video.duration = Infinity;
  assert.equal(
    dispatch({ type: YOUTUBE_MESSAGE.SEEK_TO, timeMs: 30000 }).response.snapshot
      .currentTimeMs,
    30000,
  );
});

test('pause is synchronous and resume keeps the channel open until play resolves', async () => {
  const { dispatch } = fixture();
  const paused = dispatch({ type: YOUTUBE_MESSAGE.PAUSE });
  assert.equal(paused.keepOpen, false);
  assert.equal(paused.response.snapshot.paused, true);
  const resumed = dispatch({ type: YOUTUBE_MESSAGE.RESUME });
  assert.equal(resumed.keepOpen, true);
  assert.equal(resumed.response, undefined);
  assert.equal((await resumed.promise).snapshot.paused, false);
});

test('resume rejection becomes a typed error without leaking the original browser error', async () => {
  const { state, dispatch } = fixture();
  state.video.playFailure = true;
  const response = await dispatch({ type: YOUTUBE_MESSAGE.RESUME }).promise;
  assert.equal(response.ok, false);
  assert.equal(response.error.code, 'PLAYBACK_FAILED');
  assert.ok(!response.error.message.includes('Browser blocked'));
});

test('invalid command payloads are rejected before touching the player', () => {
  const { state, dispatch } = fixture();
  for (const message of [
    { type: YOUTUBE_MESSAGE.SEEK_TO, timeMs: -1 },
    { type: YOUTUBE_MESSAGE.SEEK_TO, timeMs: Infinity },
    { type: YOUTUBE_MESSAGE.SEEK_TO, timeMs: NaN },
    { type: YOUTUBE_MESSAGE.SEEK_TO, timeMs: '30000' },
    { type: YOUTUBE_MESSAGE.SEEK_BY, deltaMs: NaN },
    { type: YOUTUBE_MESSAGE.SEEK_BY },
    { type: 'youtube/unknown' },
  ]) {
    assert.equal(isPopupToContentMessage(message), false);
    assert.equal(dispatch(message).response.error.code, 'INVALID_COMMAND');
  }
  assert.equal(state.video.currentTime, 12.3456);
});

test('unrelated messages and other extension senders are ignored', () => {
  const { dispatch } = fixture();
  for (const message of [
    null,
    [],
    'youtube/get-snapshot',
    { type: 'other/request' },
  ]) {
    assert.equal(dispatch(message).response, undefined);
  }
  assert.equal(
    dispatch({ type: YOUTUBE_MESSAGE.PAUSE }, { id: 'other-extension' })
      .response,
    undefined,
  );
});

test('runtime response guards reject malformed snapshots and errors', () => {
  const { dispatch } = fixture();
  const snapshot = dispatch({ type: YOUTUBE_MESSAGE.GET_SNAPSHOT }).response
    .snapshot;
  for (const override of [
    { currentTimeMs: NaN },
    { currentTimeMs: 0.5 },
    { durationMs: Infinity },
    { paused: 'false' },
    { playbackRate: 0 },
  ]) {
    assert.equal(
      isYouTubeContentResponse({
        ok: true,
        snapshot: { ...snapshot, ...override },
      }),
      false,
    );
  }
  assert.equal(
    isYouTubeContentResponse({
      ok: false,
      error: { code: 'unknown', message: 'Error' },
    }),
    false,
  );
});

test('popup client queries the active watch tab and sends a typed request to its top frame', async (t) => {
  const originalChrome = globalThis.chrome;
  t.after(() => {
    if (originalChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = originalChrome;
  });
  const { dispatch } = fixture();
  const requests = [];
  globalThis.chrome = {
    tabs: {
      async query(options) {
        assert.deepEqual(options, { active: true, currentWindow: true });
        return [{ id: 42, url: 'https://www.youtube.com/watch?v=first' }];
      },
      async sendMessage(tabId, message, options) {
        requests.push({ tabId, message, options });
        return dispatch(message).response;
      },
    },
  };
  const { tabId } = await getActiveYouTubeTab();
  const response = await sendYouTubeMessage(tabId, {
    type: YOUTUBE_MESSAGE.GET_SNAPSHOT,
  });
  assert.equal(response.snapshot.videoId, 'first');
  assert.deepEqual(requests, [
    {
      tabId: 42,
      message: { type: YOUTUBE_MESSAGE.GET_SNAPSHOT },
      options: { frameId: 0 },
    },
  ]);
});

test('popup client rejects unsupported tabs, invalid replies and disconnected content scripts', async (t) => {
  const originalChrome = globalThis.chrome;
  t.after(() => {
    if (originalChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = originalChrome;
  });
  globalThis.chrome = {
    tabs: {
      async query() {
        return [{ id: 42, url: 'https://www.youtube.com/' }];
      },
      async sendMessage() {
        return {};
      },
    },
  };
  await assert.rejects(
    getActiveYouTubeTab(),
    /Not a supported YouTube video/,
  );
  await assert.rejects(
    sendYouTubeMessage(42, { type: YOUTUBE_MESSAGE.GET_SNAPSHOT }),
    { code: 'INVALID_RESPONSE' },
  );
  globalThis.chrome.tabs.sendMessage = async () => {
    throw new Error('Tab closed');
  };
  await assert.rejects(
    sendYouTubeMessage(42, { type: YOUTUBE_MESSAGE.GET_SNAPSHOT }),
    { code: 'CONTENT_UNAVAILABLE' },
  );
  await assert.rejects(
    sendYouTubeMessage(-1, { type: YOUTUBE_MESSAGE.GET_SNAPSHOT }),
    /Invalid YouTube request/,
  );
});

test('client distinguishes a missing receiver from an incompatible old response and preserves the cause', async (t) => {
  const originalChrome = globalThis.chrome;
  t.after(() => {
    if (originalChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = originalChrome;
  });
  const cause = new Error(
    'Could not establish connection. Receiving end does not exist.',
  );
  globalThis.chrome = {
    tabs: {
      async sendMessage() {
        throw cause;
      },
      async query() {
        throw new Error('Cannot access tab');
      },
    },
  };
  await assert.rejects(
    sendYouTubeMessage(42, { type: YOUTUBE_MESSAGE.GET_SNAPSHOT }),
    (error) => {
      assert.ok(error instanceof YouTubeClientError);
      assert.equal(error.code, 'CONTENT_UNAVAILABLE');
      assert.equal(error.cause, cause);
      assert.match(error.message, /Reload this YouTube tab/);
      return true;
    },
  );
  globalThis.chrome.tabs.sendMessage = async () => ({
    currentTime: 3,
    title: 'Old helper response',
  });
  await assert.rejects(
    sendYouTubeMessage(42, { type: YOUTUBE_MESSAGE.GET_SNAPSHOT }),
    { code: 'INVALID_RESPONSE' },
  );
  await assert.rejects(getActiveYouTubeTab(), { code: 'TAB_UNAVAILABLE' });
});

test('snapshot refuses stale canonical metadata during SPA navigation and recovers when metadata catches up', () => {
  const { state, dispatch, document } = fixture();
  const querySelector = document.querySelector.bind(document);
  let canonical = 'https://www.youtube.com/watch?v=first';
  document.querySelector = (selector) => selector === 'link[rel="canonical"]' ? { getAttribute: () => canonical } : querySelector(selector);
  state.href = 'https://www.youtube.com/watch?v=second';
  assert.equal(dispatch({ type: YOUTUBE_MESSAGE.GET_SNAPSHOT }).response.ok, false);
  canonical = state.href; state.heading = 'Second video title';
  const response = dispatch({ type: YOUTUBE_MESSAGE.GET_SNAPSHOT }).response;
  assert.equal(response.ok, true); assert.equal(response.snapshot.videoId, 'second'); assert.equal(response.snapshot.title, 'Second video title');
});
