# AudioMint development

## Repository

- `api/` contains the NestJS 11 backend with Fastify.
- `app/extension/` contains the React, TypeScript and Vite Chrome extension.
- Each application owns its package manifest and lockfile. Run commands from its directory.

## Backend architecture

- Genius supplies metadata and discovery. LRCLIB supplies plain and synced lyrics.
- Controllers own routes, transport DTOs and conversion to application criteria. Services and mappers consume plain application types.
- Application services orchestrate use cases. Provider services own external HTTP, authentication, status/content-type checks, timeout and cancellation.
- Read external JSON as `unknown`. Pure parsers validate it into provider types. Pure mappers convert validated provider types into public API contracts.
- Preserve the `types/`, `parsers/`, `dto/`, `mappers/` and `matchers/` conventions within the domains that use them.
- Shared transport DTOs live in `api/src/common/http`, pagination types in `common/pagination`, and provider guards in `common/upstream`.
- Keep provider code concrete. Avoid generic provider frameworks, base services and database/repository abstractions without a database.
- Avoid N+1 external requests. A discovery request fetches one upstream page.
- Normalize duplicate song IDs in Search and Artist Songs parsers, retaining the first valid occurrence. Preserve Album Tracks positions, including repeated song IDs.
- Keep tokens server-side. Logs must exclude secrets, authorization headers, cookies, raw upstream responses and lyrics content.
- The extension owns audio processing and tag export. Use Genius API metadata and LRCLIB lyrics through their existing boundaries.

## Naming and types

- Use `search()`, `getDetail()`, `listSongs()` and `listTracks()` for the corresponding application operations.
- REST routes use nouns, including `/artists/:id/songs` and `/albums/:id/tracks`.
- Use `interface` for object contracts and `type` for unions and meaningful aliases. Reuse a shared type directly when an alias adds no semantics.
- Use `@/` for backend imports across modules or shared code, and relative imports within a module. Keep TypeScript and both Jest alias mappings aligned. Build with Nest CLI to rewrite aliases for production.
- Public contracts use camelCase. Provider types may retain upstream naming to make mapping explicit.
- Keep TypeScript strict mode enabled. Fix typing at the source instead of bypassing validation with unsafe assertions or suppression comments.

## Verification and Git

- From `api`, run `npm run build`, `npm run typecheck`, `npm run lint`, `npm test -- --runInBand` and `npm run test:e2e -- --runInBand` after backend changes as appropriate to their scope.
- `npm run lint` checks files. `npm run lint:fix` and `npm run format` write files.
- Test parsers, matchers and provider HTTP boundaries with unit tests. Use Fastify e2e tests for validation and serialized public contracts.
- Mock external requests in automated tests. Assert request counts when orchestration could introduce N+1 calls. Keep live smoke tests separate.
- Preserve established routes, response fields and provider behavior during cleanup tasks.
- Commit, push, merge and deploy only when the user requests those actions.
