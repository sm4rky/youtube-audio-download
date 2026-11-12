# YouTube Audio API

NestJS 11 + Fastify backend for the AudioMint Chrome extension. Genius provides song metadata and LRCLIB provides plain and synchronized lyrics through independent endpoints. The Genius access token stays server-side. Audio extraction, MP3 conversion and tag writing belong to the extension.

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
- `LRCLIB_TIMEOUT_MS=8000`, an integer from 1 to 30000, covers response headers and body consumption with request cancellation.
- `LRCLIB_CLIENT_NAME=AudioMint` and `LRCLIB_CLIENT_VERSION=0.1.0` identify the application.
- `LRCLIB_CLIENT_CONTACT=` accepts an HTTPS project/homepage URL or an email address. Supply the project's actual contact information to complete LRCLIB's requested client identification.

The User-Agent is `AudioMint v0.1.0 (contact)` when contact is configured. The default identifies the name/version while contact awaits a project-provided value. The fixed provider URL is `https://lrclib.net/api/search`. Anonymous reads work with client identification. The provider's client registration and rate-limit details are documented at [LRCLIB API reference](https://lrclib.net/docs.txt).

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

- `geniusId`, `title`, and `artistName` (the singular primary artist name).
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

Genius detail uses API metadata and returns `geniusUrl` for a future extension-driven page flow. Track/disc extraction belongs to a separate future task. The independent LRCLIB endpoint below supplies lyrics for the selected Genius song.

### LRCLIB lyrics search

`GET /api/v1/lyrics/search?title=Blinding%20Lights&artist=The%20Weeknd`

Required `title` and `artist`, and optional `album`, are trimmed strings of 1–200 characters. Optional `duration` is a finite positive decimal number in seconds, including fractional values. Empty supplied hints, arrays, objects, overflow/NaN/Infinity, negative/zero duration and additional query parameters return HTTP 400. Unicode is preserved.

```json
{
  "query": { "title": "Original Song", "artist": "Original Artist", "album": null, "duration": null },
  "lyrics": {
    "lrclibId": 123,
    "trackName": "Original Song",
    "artistName": "Original Artist",
    "albumName": "Original Album",
    "duration": 210,
    "instrumental": false,
    "plainLyrics": "[Verse]\nOriginal plain line\n",
    "syncedLyrics": "[00:12.50] Independent synchronized line\n"
  }
}
```

The example uses original fixture text. The endpoint returns exactly one selected record. A valid search without a suitable candidate returns HTTP 200 with the normalized `query` and `lyrics: null`. A matching record can independently have either, both or neither lyric field populated. Instrumental flags and lyric strings are preserved exactly. Optional upstream album/duration information maps to null when unavailable. The mapper returns both lyric fields from the same record.

Matching uses a stable sequence of comparisons with no weighted scoring. Candidate title and artist must equal the query after NFC normalization, lowercasing and whitespace normalization. Accents, punctuation and version words remain significant. Among eligible candidates, exact normalized album wins first, then closer known duration when supplied, then having both nonempty lyric strings. Remaining ties retain upstream order. A recording can match even with a large YouTube duration difference. Strict identity comparison can return null for punctuation differences, extra featured-artist credits or spelling variations.

Album and duration are soft local matching hints. The one upstream search sends `track_name` and `artist_name`, allowing records with incomplete/different album metadata to remain eligible. Duration is used for local ranking. v1 search already contains the two lyric strings. There is one provider request per lyrics search.

Runtime parsing checks the response array, positive safe IDs, required title/artist, boolean instrumental, optional finite positive duration, and string-or-null lyric fields. Malformed records are skipped and duplicate IDs retain their first valid occurrence. A malformed top-level response is an upstream error. Lyrics content, headings, annotations, whitespace and original LRC text are preserved for frontend editing.

LRCLIB errors use the existing `{ statusCode, code, message }` convention. HTTP 429 maps to HTTP 503 `LRCLIB_RATE_LIMITED`, timeout maps to HTTP 504 `LRCLIB_TIMEOUT`, and network/unexpected HTTP/invalid JSON or envelope errors map to HTTP 502 `LRCLIB_UPSTREAM_ERROR`. Valid Retry-After from upstream 429/503 is exposed as optional `retryAfterSeconds`, including conversion from an HTTP date. Clients should wait at least this interval before retrying. Each call makes a single attempt. Content-Type is checked before JSON parsing, and logs contain safe error codes/statuses.

LyricsSearch uses LRCLIB independently of Genius and operates without a configured Genius token. Genius detail continues to use its own API flow. Plain and synchronized lyrics remain independent source strings for future frontend editing and export.

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
curl --get "http://127.0.0.1:3001/api/v1/lyrics/search" --data-urlencode "title=Blinding Lights" --data-urlencode "artist=The Weeknd"
curl --get "http://127.0.0.1:3001/api/v1/lyrics/search" --data-urlencode "title=Blinding Lights" --data-urlencode "artist=The Weeknd" --data-urlencode "album=After Hours" --data-urlencode "duration=200"
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

LRCLIB provider tests mock fetch, including body-read timeout, rate limits, Retry-After and schema failures. Lyrics matcher tests document identity, album, duration, availability and source-order priorities. Lyrics e2e tests use Fastify, common bootstrap configuration and mocked upstream HTTP. They also verify that lyric retrieval avoids Genius requests and that Genius detail avoids LRCLIB calls.

A separate live smoke test through a temporary local backend returned HTTP 200 for title `Blinding Lights`, artist `The Weeknd`, album `After Hours`, selecting LRCLIB record `5512759` with duration 203 seconds. Both lyric fields were present. Only metadata and string lengths were logged. The request used the application name/version header while project contact remained unconfigured. This single observation verifies that flow for the tested query at that time.

## Code organization

- `genius/types/`: independent validated search/detail types and small artist/album entities.
- `genius/parsers/`: separate pure search/detail parsers and small shared field/envelope validators. Raw network JSON remains unknown until validated.
- `genius/genius.service.ts`: official API requests, server authentication, timeout, error handling and parser selection.
- `lrclib/types/`, `lrclib/parsers/`, `lrclib.service.ts`, `lrclib.module.ts` follow the provider structure for validated LRCLIB data and HTTP requests.
- `lyrics/dto/`, `lyrics/types/`, `lyrics/matchers/`, `lyrics/mappers/` own query validation, public contracts, pure selection and mapping. LyricsService orchestrates the LRCLIB search and LyricsController exposes the route.
- `upstream-validation.ts` contains the three shared object/string/ID guards used at provider boundaries.
- `songs/types/`: independent extension-facing search/detail contracts.
- `songs/mappers/`: pure conversion from validated Genius data to project contracts.
- `songs/songs.service.ts`: orchestration only; no page downloading or enrichment.
- `songs/songs.controller.ts`: routes and DTO-based input validation.
- `health/`, `config/`, `configure-app.ts`, `main.ts`: liveness, environment validation and Fastify bootstrap.

## Remaining boundaries

Redis, cache, request coalescing and internal rate limiting remain future tasks. LRCLIB's external quotas apply to each request and require clients to honor returned retry timing. Frontend lyric editing, playback synchronization, timestamp/LRC editing and MP3 USLT/SYLT export are future extension tasks. This endpoint supplies the independent source strings needed by those flows.
