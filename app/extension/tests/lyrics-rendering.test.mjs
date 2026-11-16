import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { parseSyncedLyrics } from '../src/lib/synced-lyrics.ts';

test('lyrics media rendering', async (t) => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  t.after(() => server.close());
  const { SongMedia } = await server.ssrLoadModule('/src/components/song-media.tsx');
  const { SyncedLyrics } = await server.ssrLoadModule('/src/components/synced-lyrics.tsx');

  for (const input of [null, '', '   ', '[00:01]\n[00:05]', '[ar:Artist]']) {
    await t.test(`artwork only for unusable synced lyrics ${String(input).length}`, () => {
      const html = renderToStaticMarkup(createElement(SongMedia, {
        title: 'Song', coverUrl: null, lines: parseSyncedLyrics(input), currentTimeMs: 0,
      }));
      assert.equal(html.includes('data-slot="carousel"'), false);
      assert.equal(html.includes('Show synced lyrics'), false);
      assert.equal(html.includes('lucide-music'), true);
    });
  }

  await t.test('valid synced text renders lyrics then artwork, default first dot, and no arrow buttons', () => {
    const html = renderToStaticMarkup(createElement(SongMedia, {
      title: 'Song', coverUrl: 'https://example.com/cover.jpg',
      lines: parseSyncedLyrics('[00:01] First\n[00:02] Second'), currentTimeMs: 1000,
    }));
    assert.equal((html.match(/data-slot="carousel-item"/g) ?? []).length, 2);
    assert.ok(html.indexOf('aria-label="Synced lyrics"') < html.indexOf('aria-label="Cover artwork"'));
    assert.match(html, /aria-label="Show synced lyrics" aria-current="true"/);
    assert.equal(html.includes('carousel-previous'), false);
    assert.equal(html.includes('carousel-next'), false);
    assert.equal(html.includes('[00:01]'), false);
  });

  await t.test('the visual window stays bounded for long lyrics', () => {
    const lines = Array.from({ length: 500 }, (_, index) => ({ id: String(index), timeMs: index * 1000, text: 'Line ' + index }));
    const html = renderToStaticMarkup(createElement(SyncedLyrics, { lines, currentTimeMs: 250000 }));
    assert.equal((html.match(/<p /g) ?? []).length, 7);
    assert.match(html, /aria-current="true"[^>]*>[\s\S]*?Line 250/);
    assert.equal(html.includes('Line 246<'), false);
    assert.equal(html.includes('Line 254<'), false);
  });

  await t.test('an empty timed line has a blank active interval instead of highlighting the previous text', () => {
    const html = renderToStaticMarkup(createElement(SyncedLyrics, {
      lines: parseSyncedLyrics('[00:01] First\n[00:02]\n[00:04] Next'), currentTimeMs: 3000,
    }));
    assert.match(html, /aria-current="true" aria-label="Instrumental break"[^>]*><span[^>]*><\/span>/);
  });
});
