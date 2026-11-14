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
- `GENIUS_ACCESS_TOKEN=` supplies the server-side access token for Genius metadata and discovery requests. Startup and health work without it.
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

### Artist songs and album tracks

```http
GET /api/v1/artists/2358/songs?page=1&perPage=5&sort=popularity
GET /api/v1/artists/2358/songs?page=2&perPage=5&sort=popularity
GET /api/v1/albums/1776887/tracks?page=1&perPage=2
GET /api/v1/albums/1776887/tracks?page=2&perPage=2
```

The Weeknd's verified Genius artist ID is `2358`. The sample ID `1230` returned upstream HTTP 404. Album `1776887` is FIRESTARTER.

Both routes accept positive safe integer path IDs. `page` defaults to 1 and must be a positive safe integer. `perPage` defaults to 20 and must be an integer from 1 through 50. Decimal digit strings are accepted. Fractional, negative, empty, repeated, object-shaped and unsafe integer values return HTTP 400. Unknown query parameters return HTTP 400. Artist songs additionally accepts `sort=popularity` (default) or `sort=title`. Album tracks preserves upstream album order.

Artist songs returns this example structure. Song values below are illustrative.

```json
{
  "artistId": 2358,
  "sort": "popularity",
  "pagination": { "page": 1, "perPage": 5, "nextPage": 2, "hasMore": true },
  "items": [{
    "geniusId": 123456,
    "title": "Example Song",
    "artistName": "The Weeknd",
    "primaryArtists": [{ "geniusId": 2358, "name": "The Weeknd" }],
    "featuredArtists": [],
    "year": null,
    "coverUrl": null,
    "geniusUrl": null
  }]
}
```

Album tracks returns `albumId`, the same `pagination` object, and `items` containing `{ trackNumber, discNumber, song }`. Each `song` has exactly the summary fields shown above.

```json
{
  "albumId": 1776887,
  "pagination": { "page": 1, "perPage": 2, "nextPage": 2, "hasMore": true },
  "items": [{
    "trackNumber": 2,
    "discNumber": 1,
    "song": {
      "geniusId": 14141792,
      "title": "WATCH ME",
      "artistName": "K/DA",
      "primaryArtists": [{ "geniusId": 1626547, "name": "K/DA" }],
      "featuredArtists": [],
      "year": 2026,
      "coverUrl": null,
      "geniusUrl": null
    }
  }]
}
```

This abbreviated example illustrates the contract. Actual artist arrays and artwork come from the provider.

`trackNumber` maps to Genius `disc_track_number`, the position within its disc. `discNumber` maps to `disc_number`. Missing or invalid numbers become `null`. The upstream global `number` field is unused. A live multi-disc check on album `657430` confirmed global number 10 corresponds to disc 2, track 1. Repeated song IDs at distinct album positions remain in the response. Artist-song duplicate IDs keep the first valid occurrence. Invalid song records are skipped. Missing optional year/artwork/URL values become `null`, and missing artist arrays follow the existing search parser fallback rules.

Each request fetches one page from the authenticated Developer API at `https://api.genius.com/artists/{id}/songs` or `https://api.genius.com/albums/{id}/tracks`. Public `perPage` maps to upstream `per_page`. `nextPage` comes directly from validated `next_page`, and `hasMore` equals `nextPage !== null`. Missing, non-integer or non-forward pagination metadata is an upstream schema error. A shorter page can still have a next page. There are no total counts. Valid empty pages return HTTP 200 with `items: []`, `nextPage: null`, and `hasMore: false`.

Artist songs includes songs associated with that artist by Genius, including featured appearances. Coverage depends on Genius's catalog. These lists use their own parsers and reuse the validated song-summary parser and public summary mapper. They make no per-song detail, media or lyrics requests. Song detail continues to make its own single metadata request.

Invalid client input returns HTTP 400. Upstream 404 maps to HTTP 404 with `ARTIST_NOT_FOUND` or `ALBUM_NOT_FOUND`. Missing configuration and authentication errors use HTTP 503 with `GENIUS_NOT_CONFIGURED` and `GENIUS_AUTH_FAILED`. Rate limiting uses HTTP 503 `GENIUS_RATE_LIMITED`. Timeout uses HTTP 504 `GENIUS_TIMEOUT`. Network failures, other statuses, malformed JSON and invalid schemas use HTTP 502 `GENIUS_UPSTREAM_ERROR`. Errors retain `{ statusCode, code, message }`. The existing deadline covers headers and body consumption and aborts the request. Requests have no automatic retry.

Upstream verification used Node.js native fetch with the private server token. Artist popularity/title sorting, the 50-item limit (51 returned 422), different pages, empty pages and nonexistent IDs were checked. Developer album tracks returned JSON, nested songs and `next_page` for FIRESTARTER across pages 1 and 2. The website-host comparison returned HTTP 403 HTML with challenge markers on both pages. Production discovery uses the Developer API host exclusively. The official documentation site was inaccessible during verification. The maintained client references distinguish the two API hosts and describe artist sorting/pagination. [Artist API reference](https://lyricsgenius.readthedocs.io/en/master/reference/api.html#lyricsgenius.API.artist_songs), [website API reference](https://lyricsgenius.readthedocs.io/en/stable/reference/public_api.html#lyricsgenius.PublicAPI.album_tracks).

The album route on the Developer API was verified live. Its long-term documentation/support status could not be confirmed from the inaccessible official documentation. Automated tests mock all external HTTP requests. Local live smoke tests are performed separately.

The new domain modules live in `src/artists` and `src/albums`, with controllers, services, mappers and response types. Artist sorting extends the shared pagination DTO. Shared ID and pagination DTOs live in `src/common/http`, pagination contracts in `src/common/pagination`, provider list parsers/types in `src/genius`, and public song summaries in `src/songs`. Search uses `GeniusSongSummary` and `SongSummary` directly. Controllers convert validated DTOs into `ArtistSongsCriteria` or `PaginationCriteria`; application services and mappers consume those plain types. Discovery methods are named `listSongs()` and `listTracks()`.

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

The Search parser keeps valid song hits and removes duplicate IDs, preserving upstream order and the first valid occurrence of each song ID. Artist Songs follows the same parser rule. Album Tracks preserves repeated song positions. Search mapping converts the validated list directly. Invalid required item fields are skipped; malformed envelopes fail the request. Missing artist lists become empty arrays, with fallback to the singular primary artist when a valid ID is available. Artwork priority is song image, song thumbnail, header image, then null. Empty results return HTTP 200 with `items: []`. No extra detail requests are made per search result.

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
- HTTP 502 `GENIUS_UPSTREAM_ERROR`: network failure, unexpected HTTP status, invalid response content type, invalid JSON/envelope, invalid required detail data, or mismatched detail ID.

Both providers validate HTTP status and content type, read JSON as `unknown`, and validate provider schemas with their parsers. LRCLIB requires `application/json` or a `+json` media type. Genius also accepts `text/html` because a live Developer API response returned valid JSON with that header. This exception still requires successful JSON parsing and the endpoint-specific schema. Actual HTML/challenge bodies, invalid JSON, missing/unsupported media types and invalid schemas fail with the existing upstream error codes. No automatic retries are performed. Redirects are rejected instead of forwarding the token to another host. Logs contain only safe error codes/statuses, never tokens, raw upstream bodies or authentication headers. Upstream errors are not converted into empty search results.

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
npm run typecheck
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

TypeScript uses full `strict` mode and `noFallthroughCasesInSwitch`. `npm run typecheck` covers source and tests without emitting files. `npm run lint` checks files, while `npm run lint:fix` and `npm run format` write files. Production startup uses `npm run start:prod` after building. The backend and e2e tests use Fastify directly through `FastifyAdapter` and `inject()`. Express and Supertest dependencies have been removed.

Automated tests never call Genius or need a real token. GeniusService tests mock fetch at the HTTP boundary, including timeout while reading the body. Pure parsers validate endpoint-specific responses. E2e tests use Fastify and configure-app.ts, verify route validation and response mapping, and assert that detail makes no additional HTTP requests beyond the mocked API service.

LRCLIB provider tests mock fetch, including body-read timeout, rate limits, Retry-After and schema failures. Lyrics matcher tests document identity, album, duration, availability and source-order priorities. Lyrics e2e tests use Fastify, common bootstrap configuration and mocked upstream HTTP. They also verify that lyric retrieval avoids Genius requests and that Genius detail avoids LRCLIB calls.

A separate live smoke test through a temporary local backend returned HTTP 200 for title `Blinding Lights`, artist `The Weeknd`, album `After Hours`, selecting LRCLIB record `5512759` with duration 203 seconds. Both lyric fields were present. Only metadata and string lengths were logged. The request used the application name/version header while project contact remained unconfigured. This single observation verifies that flow for the tested query at that time.

## Imports

The backend maps `@/*` to `./src/*` in `tsconfig.json`. Use `@/` for imports across domain modules and shared code, and relative paths within the same module. E2e tests import backend source through `@/`. Both Jest configurations map this prefix to the source directory.

The installed Nest CLI rewrites these aliases to relative imports for `nest build` and `nest start --watch`, including declarations. Production startup uses the emitted JavaScript through `npm run start:prod`. Run backend scripts from `api/`. The `typecheck` script uses TypeScript without emitting files.

## Code organization

- `genius/types/` contains validated song summaries, independent detail and list contracts, and small artist/album entities.
- `genius/parsers/` contains separate pure endpoint parsers, a shared song-summary parser and field/envelope validators. Raw network JSON remains unknown until validated.
- `genius/genius.service.ts`: official API requests, server authentication, timeout, error handling and parser selection.
- `lrclib/types/`, `lrclib/parsers/`, `lrclib.service.ts`, `lrclib.module.ts` follow the provider structure for validated LRCLIB data and HTTP requests.
- `lyrics/dto/`, `lyrics/types/`, `lyrics/matchers/`, `lyrics/mappers/` own query validation, public contracts, pure selection and mapping. LyricsService orchestrates the LRCLIB search and LyricsController exposes the route.
- `common/http/` contains the shared Genius ID and pagination transport DTOs.
- `common/pagination/pagination.ts` contains the plain `PaginationCriteria` and public `Pagination` contracts.
- `common/upstream/upstream-validation.ts` contains the shared object/string/ID guards used at provider boundaries.
- `artists/types/artist-songs-criteria.ts` defines the application criteria for artist discovery.
- `albums/types/album-tracks-response.ts` exports public `AlbumTrack` and `AlbumTracksResponse` interfaces.
- `songs/types/`: independent extension-facing search/detail contracts.
- `songs/mappers/`: pure conversion from validated Genius data to project contracts.
- `songs/songs.service.ts`: orchestration of metadata search and detail.
- `songs/songs.controller.ts`: routes and DTO-based input validation.
- `health/`, `config/`, `configure-app.ts`, `main.ts`: liveness, environment validation and Fastify bootstrap.

Root `AGENTS.md` records repository structure, architecture boundaries, naming/type conventions, testing commands and Git authorization expectations.

## Remaining boundaries

Redis, cache, request coalescing and internal rate limiting remain future tasks. LRCLIB's external quotas apply to each request and require clients to honor returned retry timing. Frontend lyric editing, playback synchronization, timestamp/LRC editing and MP3 USLT/SYLT export are future extension tasks. This endpoint supplies the independent source strings needed by those flows.
