# YouTube Audio API

NestJS 11 + Fastify metadata backend for the AudioMint Chrome extension. The backend calls the official Genius API and keeps its access token server-side. Audio extraction, MP3 conversion and tag writing belong to the extension. No database, audio jobs, queue or local helper is required.

## Setup

Use Node.js 20 or newer and npm (verified with Node.js 24.14.0). The API and extension have separate package manifests and lockfiles.

From the repository root:

```powershell
cd api
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run start:dev
```

Set a valid Genius access token in private `api/.env`. Do not overwrite an existing `.env`. The application loads this file relative to AppModule, independently of the working directory; host environment variables take precedence.

## Configuration

The supported settings in `.env.example` are:

- `NODE_ENV=development`
- `HOST=127.0.0.1`
- `PORT=3001`: integer from 1 to 65535.
- `CORS_ORIGINS=http://localhost:5173`: comma-separated explicit origins, trimmed with empty entries removed. Wildcards and credentials are not enabled.
- `GENIUS_ACCESS_TOKEN=`: server-side access token, required for search/detail but not startup or health.
- `GENIUS_TIMEOUT_MS=8000`: integer from 1 to 30000; aborts the upstream request, including response-body consumption.

HTML/lyrics configuration is no longer supported. Existing private `.env` files are left unchanged; old page/lyrics limit variables have no effect.

Never put tokens in source, logs, frontend `VITE_*` variables, or `.env.example`. Environment files are ignored by Git; the example is versioned and must contain no secrets. Previously exposed tokens must be revoked separately; removing a value does not revoke it or erase Git history.

Add the extension's explicit `chrome-extension://<extension-id>` origin when needed. CORS is a browser access policy, not authentication or abuse protection.

## Endpoints

All endpoints use GET and require no client Authorization header or request body. The default base URL is `http://127.0.0.1:3001/api/v1`.

### Health

`GET /api/v1/health` returns HTTP 200 with:

```json
{"status":"ok","service":"youtube-audio-api"}
```

It makes no external requests and works without a Genius token.

### Search

`GET /api/v1/songs/search?q=Adele%20Hello`

`q` must be a string of 1–200 characters after trimming. Missing/blank, repeated or oversized values and extra query parameters return HTTP 400. Unicode and terms such as live/remix/cover are preserved. The backend calls the fixed official `https://api.genius.com/search` endpoint using URLSearchParams and Bearer authentication. It currently exposes no pagination or result-limit parameter.

`SongSearchResponse` contains `query` and `items`. Each item contains:

- `geniusId`, `title`, `artistName`: the last field is the singular primary artist name.
- `primaryArtists`, `featuredArtists`: arrays of `{ geniusId, name }`.
- `year`: integer or null, from validated release date components.
- `coverUrl`, `geniusUrl`: URL strings or null.

Only valid song hits are kept, preserving upstream order and the first occurrence of each song ID. Invalid required item fields are skipped; malformed envelopes fail the request. Missing artist lists become empty arrays, with fallback to the singular primary artist when a valid ID is available. Artwork priority is song image, song thumbnail, header image, then null. Empty results return HTTP 200 with `items: []`. No extra detail requests are made per search result.

### Detail

`GET /api/v1/songs/:id`

The ID must be a digit string representing a positive safe integer. Signed, decimal, zero, mixed-character and overflowing IDs return HTTP 400 before upstream calls. The static search route is not captured by this route.

The backend makes exactly one request to `https://api.genius.com/songs/:id`. It checks the envelope, required fields and that the returned ID matches the request. `SongDetailResponse` is independent of the search contract and contains:

- `geniusId`, `title`, `artistName`, `primaryArtists`, `featuredArtists`.
- `year`: date-component year, falling back to a calendar-validated full ISO `release_date`; null if unavailable.
- `album`: `{ geniusId, title }` from API `album.id/name`, or null for missing/invalid album data.
- `coverUrl`: validated album cover, then song image, song thumbnail, header image, or null. Images are never downloaded.
- `geniusUrl`: the song page URL, or null. The extension can use this to open the song page in a future user-driven flow; no embed script is returned or executed.
- `media`: YouTube-only entries `{ provider: "youtube", type: string | null, url: string, start: number | null }`. URLs must use HTTPS on explicitly allowed YouTube/youtu.be hosts without credentials or non-default ports. Exact duplicates are removed in source order. Missing/invalid media yields `[]`; missing/invalid type or start yields null. These are Genius-linked videos, not a guarantee of the same audio version as the user's source.

The backend does not fetch HTML, extract lyrics, parse embedded page state, or enrich track/disc numbers. The former track/disc fields and lyrics endpoint have been removed, rather than returning placeholder nulls or errors for an unsupported feature. Lyrics and page-derived metadata are planned for the extension and are not implemented there by this backend task.

## Errors

Input validation uses the global ValidationPipe and returns HTTP 400. Genius failures return safe `{ statusCode, code, message }` responses:

- HTTP 404 `SONG_NOT_FOUND`: upstream detail returned 404.
- HTTP 503 `GENIUS_NOT_CONFIGURED`: missing server token.
- HTTP 503 `GENIUS_AUTH_FAILED`: upstream 401/403.
- HTTP 503 `GENIUS_RATE_LIMITED`: upstream 429.
- HTTP 504 `GENIUS_TIMEOUT`.
- HTTP 502 `GENIUS_UPSTREAM_ERROR`: network failure, unexpected HTTP status, invalid JSON/envelope, invalid required detail data, or mismatched detail ID.

No automatic retries are performed. Redirects are rejected instead of forwarding the token to another host. Logs contain only safe error codes/statuses, never tokens, raw upstream bodies or authentication headers. Upstream errors are not converted into empty search results.

## Try in Postman or curl

Start the API, select GET and No Auth in Postman, and use an ID from search:

```sh
curl "http://127.0.0.1:3001/api/v1/health"
curl "http://127.0.0.1:3001/api/v1/songs/search?q=WATCH%20ME"
curl "http://127.0.0.1:3001/api/v1/songs/14141792"
```

Do not send your Genius token in these client requests. The example ID was verified against Genius during development; availability and metadata can change upstream.

## Checks

```sh
npm run build
npm run start:prod
npm test -- --runInBand
npm run test:e2e -- --runInBand
npx eslint "{src,apps,libs,test}/**/*.ts"
```

Build before running `start:prod`. The existing `npm run lint` includes `--fix`; the direct ESLint command above is read-only. `npm run format` also writes files.

Automated tests never call Genius or need a real token. GeniusService tests mock fetch at the HTTP boundary, including timeout while reading the body. Pure parsers validate endpoint-specific responses. E2e tests use Fastify and configure-app.ts, verify route validation and response mapping, and assert that detail makes no additional HTTP requests beyond the mocked API service.

## Code organization

- `genius/types/`: independent validated search/detail types and small artist/album entities.
- `genius/parsers/`: separate pure search/detail parsers and small shared field/envelope validators. Raw network JSON remains unknown until validated.
- `genius/genius.service.ts`: official API requests, server authentication, timeout, error handling and parser selection.
- `songs/types/`: independent extension-facing search/detail contracts.
- `songs/mappers/`: pure conversion from validated Genius data to project contracts.
- `songs/songs.service.ts`: orchestration only; no page downloading or enrichment.
- `songs/songs.controller.ts`: routes and DTO-based input validation.
- `health/`, `config/`, `configure-app.ts`, `main.ts`: liveness, environment validation and Fastify bootstrap.

## Remaining boundaries

Redis, cache, request coalescing and rate limiting are not implemented. The shared-token backend is not ready for unrestricted public traffic. The next step is an extension flow that opens the Genius page and verifies user-driven page reading; no browser-side lyrics capability is claimed by this backend cleanup.
