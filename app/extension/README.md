# AudioMint extension foundation

React, TypeScript and Vite popup with a Manifest V3 YouTube content script. The popup restores its session, validates the active YouTube video, and searches Genius through the backend. A shared layout hosts the loading and search results screens. Result rows provide hover, focus and pressed feedback.

## Build and checks

Run from app/extension with Node.js 24.14 or newer.

~~~sh
npm ci
npm run build
npm run typecheck
npm run lint
npm test
~~~

The build typechecks source with strict mode, builds the popup, then bundles src/content/youtube.ts with vite.content.config.ts into a self-contained classic IIFE at dist/content.js. The second build preserves popup output and avoids copying public assets again. The installed extension uses the completed dist directory. The Vite dev server serves the popup during development.

Tests use Node's built-in test runner. They execute the built content script in a VM with mocked Chrome and video APIs, and validate source message guards and the asynchronous client. They cover snapshot units, commands, invalid input, unknown duration, navigation, player replacement, channel lifetime and response validation. These are automated mocks. Unpacked Chrome and actual YouTube playback require separate manual verification.

## Files

~~~text
public/manifest.json                   MV3 popup and YouTube matches
src/types/youtube.ts                   Snapshot, bridge, command and response contracts
src/types/song.ts                      Search response types inferred from Zod
src/types/song-search.ts               Store state, actions and injected dependencies
src/lib/song-title-normalizer.ts       Pure title normalization and manual validation
src/stores/song-search.store.ts        Video identity and source/query context
src/stores/navigation.store.ts         Persisted loading/search-results view
src/storage/session-storage.ts         Chrome session-storage adapter
src/storage/query-cache-persister.ts   Official TanStack async cache persistence
src/api/api-client.ts                  Shared Axios transport and defaults
src/api/songs.api.ts                   Search API function and response validation
src/schemas/songs.schema.ts            Runtime schemas for the backend search contract
src/queries/songs.queries.ts           Search query key/options
src/app/query-client.ts                Popup QueryClient and query defaults
src/app/App.tsx                        Bootstrap, video validation and persistence provider
src/app/view-resolver.tsx              Query-driven loading/results transition
src/screens/search-results-screen.tsx  Manual search, result list and request states
src/screens/error-screen.tsx           Dedicated source/search error presentation
src/components/song-result.tsx         Artwork, metadata and row interaction feedback
src/content/youtube-player-bridge.ts   Player primitives
src/lib/youtube-messages.ts            Message constants and runtime guards
src/lib/chrome-tabs.ts                 Active-tab lookup and async messaging
src/content/youtube.ts                 Content-script entry and runtime listener
vite.content.config.ts                 Classic content-script bundle
tests/youtube-content.test.mjs         Built-artifact and bridge/client tests
tests/song-search.test.mjs             Normalization and client-state store tests
tests/songs-api.test.mjs               Axios and server-state integration tests
tests/popup-persistence.test.mjs       Reopen, identity, cache filtering and storage failure tests
~~~

## Search foundation

VITE_API_BASE_URL defaults to http://localhost:3001/api/v1 and can be set in the extension environment before building. The base already includes /api/v1. Vite validates the URL at build/dev startup and supplies the normalized value to Axios directly through import.meta.env.VITE_API_BASE_URL; the same URL determines the generated manifest permission. searchSongs(query, signal) calls /songs/search using the shared Axios instance and encodes q through Axios params. The backend owns the Genius token.

The shared Axios instance uses the fetch adapter, a 15-second timeout that includes reading the response body, omitted credentials, rejected redirects and strict JSON parsing. Axios HTTP, network, timeout, malformed JSON and cancellation errors propagate directly to TanStack Query. No custom ApiError or response interceptor is installed. UI code can translate errors into user-facing messages when a UI is implemented; raw Axios errors can contain request config and response bodies and should not be logged wholesale.

Search responses are read as unknown and validated with Zod at the API boundary. The schemas match the current backend contract for GET /api/v1/songs/search, including nested primary/featured artists and nullable year/artwork/Genius URL fields. SongArtist, SongSummary and SongSearchResponse are inferred from these schemas in types/song.ts. Schema validation preserves text and result order, accepts empty results and ignores unknown additional fields. Malformed data throws an Error with a fixed message before TanStack Query can cache it as successful data. Raw Zod issues and payloads are excluded from the error exposed to consumers. Axios transport errors continue to propagate directly.

songSearchOptions(query) defines the existing search query with key ['songs', 'search', trimmedQuery]. All request-affecting search input is included in the key. Trimming does not remove internal whitespace, change case, normalize Unicode or strip video labels. Invalid/empty query options are disabled; queryFn also validates imperative query calls because fetchQuery does not honor enabled. API functions forward supplied input without normalization or validation; input rules belong to the caller/store/query flow. The query function passes TanStack Query's AbortSignal to Axios. Results, loading, backend errors and retry/refetch belong exclusively to TanStack Query. Changing the key isolates old results from the current query; unmounting the last observer cancels an in-flight request whose signal is consumed. A future UI retries through the query's refetch(), not a Zustand HTTP action.

App first hydrates the Zustand navigation and search context, then reads a fresh snapshot from the active YouTube tab. A different video ID resets the main view and automatic query. Only after this check does PersistQueryClientProvider restore the server cache. Its versioned buster includes the confirmed video ID, so cached results for another video cannot be restored even if the normalized query is identical. A loading screen is shown during bootstrap and restoration. A failed source read offers an explicit retry and cannot enable backend search.

Query keys remain ['songs', 'search', trimmedQuery]. Search success and empty results transition to the search-results view; a submitted manual query stays on that screen while loading. Source failures and completed search errors render a dedicated ErrorScreen with its own heading, description and retry action. Loading copy appears only during loading. Error presentation is derived from request/source state and adds no persisted navigation view. Retry uses the same query. The list preserves API order, shows artwork with a fallback, and displays year when available. The current search summary contract has no album field, so the list does not invent album metadata or issue detail requests. Per user direction, there is no Back button on Search Results. Settings keeps its existing visual interaction without adding a settings screen.

A single QueryClient is provided by PersistQueryClientProvider inside App. staleTime remains 5 minutes; inactive gcTime and persistence maxAge are both 24 hours. Retry, refetchOnMount, refetchOnWindowFocus, refetchOnReconnect and polling remain disabled. The official async-storage persister writes only successful song-search queries, excludes mutations/unrelated cache entries, and uses throttleTime 0 to avoid a delayed save after the popup closes. Invalid/expired/busted caches are discarded by TanStack persistence. Query restore completes before query observers fetch. Cached results are reused after reopen without a required new request.

useSongSearchStore owns videoId, title, automaticQuery and submitted query. initialize() preserves the last manual query only for the same video. submit(value) applies the existing manual validation. Request data/loading/errors remain in TanStack Query. Source reads use a generation check to ignore late responses after cleanup. The navigation store persists only its view. Saved client contexts are validated before merging; store actions and transient source/validation errors are excluded from storage.

Automatic queries use NFC, collapsed whitespace and trimming. Known terminal video labels are removed as complete parenthesized, bracketed or vertical-bar suffixes. The allowlist contains Official Music Video, Official Lyric Video, Official Lyrics Video, Official Video, Official Audio, Official MV, Lyric Video, Lyrics Video, 4K, 8K, HD, 720p, 1080p and 2160p. Consecutive suffixes are removed. Bare MV is removed only after a quoted title. Featured artists, acoustic/remix/live version labels and unknown bracket text are preserved. Removing everything falls back to the whitespace-normalized title. Long queries are shortened to the API limit, preferring word and grapheme boundaries while preserving Unicode code points. Manual queries are trimmed and validated against the API's 1-200 character limit without automatic normalization.

## Frontend architecture decisions

The baseline is React + TypeScript + Vite, the existing Tailwind/shadcn UI foundation, Axios for HTTP, TanStack Query for server state, Zustand for client/application state, Zod for backend response validation and Node's built-in test runner. Existing Chrome messaging runtime guards remain in place; this change does not redesign the player bridge or add dependencies for tests.

- api: one shared Axios instance and concrete API functions that validate unknown backend responses against Zod schemas. Native Axios transport errors propagate directly.
- queries: stable query keys and query options for implemented frontend requests. Only song search is connected in this foundation; no future detail/lyrics/discovery API modules are created.
- stores: navigation view, video/source/query context and input validation. Server results and request states belong to TanStack Query.
- content: YouTube DOM access, playback and content-side Chrome message handling.
- lib: popup-side tab access, shared Chrome message guards and pure title normalization.
- schemas: runtime definitions of backend responses.
- types: shared contracts grouped by domain, with song response types inferred from schemas. File names use kebab-case, React components use PascalCase and hooks start with use.
- app: popup bootstrap, one QueryClient, persistence provider and view resolver. PopupLayout owns the shared Header and content region. Loading-to-results transitions use restrained motion with reduced-motion support.

Zustand uses persist middleware with chrome.storage.session, while server responses use the official TanStack persistence packages through the same extension-specific adapter. The manifest now requests storage permission. Reload the unpacked extension after building to apply that permission. Navigation, search context and cache have distinct versioned keys. Session storage survives closing the popup and is cleared when Chrome ends the extension/browser session. It does not provide long-term preferences storage or cross-context reactive synchronization. Storage failures degrade to memory, so reopen persistence cannot be guaranteed while storage is unavailable or full.

On reopen, hydrate the client context first and verify the active watch URL's video ID. For the same video, reuse the saved title and submitted query without requiring another content-script snapshot. Restore the TanStack cache before displaying the screen; hydration keeps the shared layout visible rather than displaying the search loading screen. Temporary tab/bridge failures preserve saved context for retry. A confirmed different video resets that context and invalidates the previous video's cache. Manual queries retain their submitted text after trimming; unsubmitted input remains local to the results screen. A missing/expired cache requires a new search.

Before implementing forms/editing, persistence, conversion, download or tagging, agree on their dependencies and ownership. Do not mirror server responses into Zustand; a separately editable user draft is a concrete application-state reason to derive new state from an API result.

References: [Axios](https://axios-http.com/docs/instance), [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview), [Zustand](https://github.com/pmndrs/zustand#readme).

## Manifest access

The tabs permission supports active-tab URL validation. At build time Vite generates host_permissions for only the configured backend origin, including its port. Rebuild and reload the unpacked extension when that origin changes. The client reads the active tab URL to validate that it is a supported YouTube watch page. Static content scripts match https://www.youtube.com/* so the listener is also present after YouTube navigates from its home page to a watch page through SPA routing. Only the top frame is targeted by client messages. The content script runs at document_idle.

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

getActiveYouTubeTabId() and sendYouTubeMessage(tabId, message) are asynchronous. The client validates both outgoing commands and incoming replies. Tab closure, navigation and unavailable content scripts reject the messaging Promise. Typed client errors distinguish active-tab access, a missing content-script receiver and an incompatible response. The client-state store exposes those bridge failures through its sourceError state. After building and reloading AudioMint in chrome://extensions, reload existing YouTube tabs so they receive the current content script.

## Verification status

Automated tests mock Chrome and HTTP. Persistence tests cover new store/client instances, same/different video identity, exact manual query, legacy context compatibility, cache expiry/busters, success-only filtering and storage failure fallback. A headless Chrome smoke test exercised the actual React app with a fake Chrome session-storage boundary and intercepted backend responses across fresh page contexts. It verified one initial request, cache/manual query restore without another request, different-video invalidation, manual validation, empty/error/retry states and a scrollable 360x600 results layout. This is not a live unpacked-extension test on YouTube. Live YouTube bridge and real backend persistence should be checked separately in the unpacked extension.
