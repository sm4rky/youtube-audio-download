# AudioMint extension foundation

React, TypeScript and Vite popup with a Manifest V3 YouTube content script. The popup entry is currently empty. The player bridge and messaging client can be used by later popup work.

## Build and checks

Run from app/extension with Node.js 24.14 or newer.

~~~sh
npm ci
npm run build
npm run lint
npm test
~~~

The build typechecks source with strict mode, builds the popup, then bundles public/content.js with vite.content.config.ts into a self-contained classic IIFE at dist/content.js. The second build preserves popup output and avoids copying public assets again. The installed extension uses the completed dist directory. Public source files and the Vite dev server are development inputs.

Tests use Node's built-in test runner. They execute the built content script in a VM with mocked Chrome and video APIs, and validate source message guards and the asynchronous client. They cover snapshot units, commands, invalid input, unknown duration, navigation, player replacement, channel lifetime and response validation. These are automated mocks. Unpacked Chrome and actual YouTube playback require separate manual verification.

## Files

~~~text
public/content.js                   Thin production entry
public/manifest.json                MV3 popup and YouTube matches
src/types/youtube.ts                Snapshot, bridge, command and response contracts
src/lib/youtube/player-bridge.ts    Player primitives
src/lib/youtube/messages.ts         Message constants and runtime guards
src/lib/youtube/client.ts           Active-tab lookup and async messaging
src/content/youtube.ts              Production runtime listener
vite.content.config.ts              Classic content-script bundle
tests/youtube-content.test.mjs       Focused built-artifact and client tests
~~~

## Manifest access

The sole permission is tabs. The client reads the active tab URL to validate that it is a supported YouTube watch page. Static content scripts match https://www.youtube.com/* so the listener is also present after YouTube navigates from its home page to a watch page through SPA routing. Only the top frame is targeted by client messages. The content script runs at document_idle.

## Player contract

YouTubeVideoSnapshot contains videoId (string or null), title, currentTimeMs, durationMs (number or null), paused and playbackRate. Times in snapshots are integer milliseconds. Unknown or non-finite duration becomes null. The title is trimmed and preserved as observed, preferring the watch-page heading, then page title metadata, then document.title.

The bridge provides getSnapshot(), seekTo(timeMs), seekBy(deltaMs), pause() and resume(). Only resume() returns a Promise because it awaits video.play(). Every operation resolves the video element again, and snapshots read the current URL and DOM. An unrelated URL query change preserves the v identity. Missing v or a non-watch URL produces null identity. A missing player produces PLAYER_UNAVAILABLE and can recover on the next request after it mounts.

seekTo requires a finite, non-negative target within duration when known. seekBy accepts a finite signed offset and clamps to zero and known duration, preserving the previous helper behavior. Successful replies read the actual player state after the command.

## Messages

Use YOUTUBE_MESSAGE constants with the following JSON payloads.

~~~json
{ "type": "youtube/get-snapshot" }
{ "type": "youtube/seek-to", "timeMs": 30000 }
{ "type": "youtube/seek-by", "deltaMs": -10000 }
{ "type": "youtube/pause" }
{ "type": "youtube/resume" }
~~~

Replies are either { ok: true, snapshot } or { ok: false, error: { code, message } }. Error codes are PLAYER_UNAVAILABLE, INVALID_COMMAND, INVALID_SEEK and PLAYBACK_FAILED. Unrelated messages and other extension senders are ignored. Snapshot, seek and pause reply synchronously. Resume returns true from the Chrome listener and replies after playback resolves or rejects.

getActiveYouTubeTabId() and sendYouTubeMessage(tabId, message) are asynchronous. The client validates both outgoing commands and incoming replies. Tab closure, navigation and unavailable content scripts reject the messaging Promise for the future popup caller to handle.

## Manual verification status

Unpacked Chrome and actual YouTube playback verification are pending. The completed dist build is the extension package for that verification.

This milestone exposes on-demand player primitives through request/response messaging. Popup UI and playback-event subscriptions can build on that boundary in the next frontend step.
