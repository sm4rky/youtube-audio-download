# YouTube Audio API

NestJS 11 + Fastify backend for the AudioMint Chrome extension. This service will search Genius and return song metadata. Audio extraction, tagging, and downloads run in the user's browser; this backend does not store or process audio.

## Requirements and setup

Use Node.js 20 or newer (verified with Node.js 24.14.0) and npm. The API and extension have independent package manifests and lockfiles.

From the repository root:

```powershell
cd api
npm ci
# Only create this file if it does not already exist:
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run start:dev
```

Keep an existing `.env` unchanged. Nest loads `api/.env` relative to the application module, independently of the shell's working directory. Environment variables provided by the host take precedence.

## Configuration

See `.env.example` for defaults:

- `NODE_ENV=development`
- `HOST=127.0.0.1` (set explicitly when a deployment needs another bind address)
- `PORT=3001` (integer from 1 to 65535)
- `CORS_ORIGINS=http://localhost:5173` (comma-separated, explicit origins; whitespace and empty entries are removed)
- `GENIUS_ACCESS_TOKEN=` (server-side access token; required only for song search, not startup or health)
- `GENIUS_TIMEOUT_MS=8000` (integer from 1 to 30000; aborts the request including response-body consumption)

Do not put tokens in source code, logs, or frontend `VITE_*` variables. `.env` files are ignored by Git; `.env.example` is safe to commit and must contain no real secrets.

CORS has no wildcard or credentials enabled. Add the extension's exact `chrome-extension://<extension-id>` origin when needed. CORS controls browser access; it is not authentication or abuse protection.

## Endpoints

- `GET http://127.0.0.1:3001/api/v1/health` returns HTTP 200 and `{"status":"ok","service":"youtube-audio-api"}`. This is a local liveness check, without Genius or other external requests.
- `GET /api/v1/songs/search?q=Adele%20Hello` searches the official Genius API. `q` must be a string of 1–200 characters after trimming. Extra query parameters and repeated `q` values are rejected.

Search returns the trimmed `query` and `items`, each containing `geniusId`, `title`, `artistName` (the singular primary artist, retained for compatibility), `year`, `primaryArtists`, `featuredArtists`, `coverUrl`, and `geniusUrl`. Artist lists contain `{ geniusId, name }`, retain upstream order, and skip invalid or duplicate IDs. If the primary artist list is unavailable, the singular primary artist is used when its ID and name are valid; unavailable lists otherwise return `[]`. The year comes only from `release_date_components.year` (integer 1–9999), or is `null` when unavailable. These optional fields are consumed when present in search results; no additional detail requests are made. Optional URLs may be null. Artwork prefers the song image, then its thumbnail, then the header image. Only valid song hits are returned, in upstream order, with duplicate IDs removed. Empty results return HTTP 200 with `items: []`. No song-detail requests, lyrics, albums, or automatic matching are included.

The Genius client uses Node's built-in fetch, a fixed `https://api.genius.com/search` endpoint, URLSearchParams, and server-side Bearer authentication. It validates the envelope and required item fields at runtime and performs no automatic retries. API reference: https://docs.genius.com/ (the documentation site returned HTTP 403 during implementation; live verification is reported separately).

Upstream failures return a safe `{ statusCode, code, message }` object:

- HTTP 503: `GENIUS_NOT_CONFIGURED`, `GENIUS_AUTH_FAILED` (upstream 401/403), or `GENIUS_RATE_LIMITED` (upstream 429).
- HTTP 504: `GENIUS_TIMEOUT`.
- HTTP 502: `GENIUS_UPSTREAM_ERROR` (network, unexpected HTTP status, invalid JSON or envelope).

Invalid query input uses the existing ValidationPipe HTTP 400 response. Upstream failures never become an empty search result, and no raw upstream body or authentication headers are returned or logged.

Requests use a global ValidationPipe with transformation, whitelisting, and rejection of extra properties. Feature endpoints must declare DTO classes and validation decorators to use this validation.

## Commands

```sh
npm run start:dev
npm run build
npm run start:prod
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

`start:prod` requires a successful build first. `lint` includes `--fix`; for a read-only check, use `npx eslint "{src,apps,libs,test}/**/*.ts"`.

The e2e suite uses Fastify injection and the same prefix, CORS, and validation configuration as bootstrap. It does not open a TCP port or require a Genius token.

GeniusService unit tests mock fetch at the upstream HTTP boundary, including cancellation during response-body reading. Songs e2e tests override GeniusService to verify routing, validation, and response mapping. Automated tests never call Genius or use a real token.

## Next feature

Song details and Redis caching/rate limiting can be considered in a later task. Keep the Genius access token on this server. No database, queue, local helper, or server-side audio pipeline is required by the current architecture.

