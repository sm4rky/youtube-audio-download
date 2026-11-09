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
- `GENIUS_ACCESS_TOKEN=` (server-side access token; optional until Genius integration is implemented)

Do not put tokens in source code, logs, or frontend `VITE_*` variables. `.env` files are ignored by Git; `.env.example` is safe to commit and must contain no real secrets.

CORS has no wildcard or credentials enabled. Add the extension's exact `chrome-extension://<extension-id>` origin when needed. CORS controls browser access; it is not authentication or abuse protection.

## Endpoints

- `GET http://127.0.0.1:3001/api/v1/health` returns HTTP 200 and `{"status":"ok","service":"youtube-audio-api"}`. This is a local liveness check, without Genius or other external requests.
- `GET /api/v1` keeps the starter Hello World endpoint.

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

## Next feature

Implement the Genius integration and Songs API. Keep the Genius access token on this server. No database, queue, local helper, or server-side audio pipeline is required by the current architecture.

