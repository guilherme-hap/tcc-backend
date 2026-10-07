# tcc-backend

Black-box API auditor (undergraduate thesis project). Given an OpenAPI spec URL, it scores the target API on three pillars — **contract** (Spectral lint), **performance** (autocannon load test, Apdex-based) and **security** (header/HTTPS/CORS probes) — and stores a weighted final score.

## Stack
Node 22, TypeScript (strict, ESM `NodeNext`), Express 5, TypeORM + PostgreSQL, Zod 4, swagger-jsdoc. No Redis: the job queue is Postgres itself.

## Commands
- `npm run typecheck` — **the only automated check** (~1s). Run it before every commit.
- `npm run dev` — `tsx watch`; needs a reachable Postgres (see `.env.example`). Swagger UI at `/api-docs`.
- `npm run build` / `npm start` — compile to `dist/` and run it.
- `npm test` is a placeholder that exits 1; there is no test suite or linter yet.

## Request → result flow
```
routes/*.routes.ts        validate(schema) + optionalAuth/requireAuth, @openapi JSDoc
 → controllers/           thin; EvaluationController.evaluate(type) returns 202 {evaluationId,status}
 → usecases/EvaluationUsecase   re-parses with EVALUATION_SCHEMAS[type], creates Evaluation row, enqueues
 → queues/EvaluationQueue       evaluation_jobs table, NOTIFY/LISTEN per type, FOR UPDATE SKIP LOCKED
 → workers/index.ts             N consumer loops per type (<TYPE>_WORKER_CONCURRENCY), lifecycle.start guard
 → workers/EvaluationWorker     runs PIPELINES[type] stage by stage, then conclude()
 → pillars/{contract,performance,security}Pillar.ts → services/*Service.ts + utils/calculate*Score.ts
 → services/EvaluationLifecycleService   status PENDING → RUNNING → COMPLETED | PARTIAL | FAILED
```
Client polls `GET /api/evaluations/:id`.

## Where things live
- `pillars/pipelines.ts` — which pillars run per type, in which stages, with which weights and preconditions. `full` = `[contract, security]` in parallel, then `performance` alone (skipped via `PillarSkipped` if the spec is structurally invalid).
- `pillars/types.ts` — `Pillar`, `PillarContext` (memoized `spec()` / `apiBaseUrl()`), `PillarOutcome`. A new pillar = new file implementing `Pillar` + entry in `PIPELINES` + result column on `Evaluation`.
- `interfaces/evaluation.interface.ts` — all result/job types. `EvaluationRequestMap` ties each type to its Zod input.
- `schemas/` — Zod request schemas; reusable pieces in `schemas/shared.ts`; load-test bounds in `utils/loadTestLimits.ts`.
- `messages/catalog.ts` — typed audit message catalog (`auditMessage(code, params)`). Add codes here; never inline audit text.
- `entities/` — TypeORM entities (`evaluations`, `evaluation_jobs`, `users`, `saved_apis`, `custom_rules`).
- CRUD slices to copy for new resources: `savedApi.routes.ts` → `SavedApiController` → `SavedApiService` → `schemas/savedApi.schema.ts`.

## Conventions
- Relative imports **must** end in `.js` (`'../errors/AppError.js'`); use `import type` for type-only imports.
- 4-space indent, single quotes, semicolons, named exports (routers are the only default exports).
- No code comments — only `@openapi` JSDoc blocks on routes. Keep Swagger docs in sync when changing a request/response shape.
- Language split: identifiers, logs, and API error messages in English; Swagger descriptions and audit catalog messages in Brazilian Portuguese.
- Errors: throw `AppError(message, status)`; `errorHandler` maps it. Anything else becomes a generic 500. Validate input with `validate(schema)` middleware or `parseOrThrow` — never hand-rolled checks.
- Controllers are arrow-function class properties (`public create = async (req, res) => {}`); services own repository access via `AppDataSource.getRepository`.
- Interfaces are `I`-prefixed (`IPerformanceTarget`); Zod input types are `XxxInput` via `z.infer`.
- Commits: Conventional Commits, lowercase, imperative (`feat: …`, `fix: …`, `refactor: …`).

## Invariants and gotchas
- **Ownership returns 404, not 403.** User-scoped lookups filter by `(id, userId)`; evaluations with a `userId` are hidden from other users as "not found". Keep it that way.
- `withMeasurementLock` (process-wide) serializes all Spectral runs and load tests so measurements don't contend. Don't wrap new I/O in it unless it's a measurement.
- Lifecycle updates are conditional on current status (`start` only from PENDING/RUNNING, `complete`/`partial` only from RUNNING) — this makes job re-delivery idempotent. Preserve the `where` clauses.
- `finishJob` strips `loadTestOptions.headers`/`body` from the stored job payload because they may hold credentials. Don't persist them elsewhere.
- On boot, `RUNNING` jobs are reset to `PENDING` (`recoverOrphanedJobs`), so handlers must tolerate being re-run.
- Load tests hit real third-party endpoints; mutating methods default to shorter durations and emit `PERF_MUTATING_METHOD`. Respect the limits in `utils/loadTestLimits.ts`.
- Schema is managed by `DB_SYNCHRONIZE=true` (no migrations). Entity edits change the live schema on next boot.

## Boundaries
- Ask before: changing entity columns, adding dependencies, changing scoring weights/formulas (`utils/weights.ts`, `utils/calculate*Score.ts`) — scores are thesis results.
- Never commit `.env`; `JWT_SECRET` must come from the environment.
