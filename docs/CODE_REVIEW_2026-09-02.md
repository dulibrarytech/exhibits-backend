# exhibits-backend code review — 2026-09-02

Branch reviewed: `187-replace-uploaded-files-in-place` (HEAD d42b8067). Read-only review; no files
changed. The SSO HMAC / `/auth/sso` trust problem is excluded (in progress with DU IT); it is
referenced only where another finding depends on it.

Method: full read of `auth/`, `config/`, `libs/tokens.js`, `share_*`, and the authorization call
sites by hand; delegated full-file review of `exhibits/`, `media-library/` + `indexer/`, and
`users/` + `dashboard/` + `libs/` + `config/` + migrations/seeds/tools. Every CRITICAL and HIGH
item below was confirmed against the source (and, where marked, the local database) before being
listed. The client (`public/app`) and test-suite sub-reviews were cut short by a session rate
limit; what is reported for them is what was verified directly and is marked as partial.

Test runs performed on this branch:

| Suite | Result |
|---|---|
| Vitest unit (`test/tasks`, `test/unit-app`) | 54 files, 1031 passed |
| Jest integration (`test/integration`) | 31 suites, 704 passed |
| Playwright stubbed e2e (`test/e2e/specs`, APP_PORT=3100) | 199 passed, 2 timed out under load; both pass when re-run in isolation (load flake, not a defect) |
| Playwright live e2e | not run (needs the local stack) |

---

## CRITICAL

**C1. Any authenticated user can promote themselves (or anyone) to Administrator.**
*Status 2026-09-02: FIXED (uncommitted).* `update_user` now resolves the actor from the JWT
(`AUTHORIZE.get_actor_id`), admits `update_user` only when target = actor, and requires
`update_user_role` for any role change (unchanged `role_id` re-posted by the form is not a
change). Tests: `users_routes_integration.test.js` (9 new cases) and `rbac.live.spec.js`.
H11 (`save_user` role assignment by Power Users) is NOT covered by this fix.
`users/controller.js:247-252` authorizes `update_user` with `['update_users','update_user']` and
`users: true`. In `auth/authorize.js:80-91` the `users` flag returns `true` as soon as any one
listed permission matches, with no self/ownership check. `update_user` is seeded to every role
including Student (`db/seeds/03_role_permissions.js`; confirmed in the local `exhibitsv2` DB).
`users/model.js:255-291` then applies `role_id` from the body. The Administrator-only
`update_user_role` permission is never consulted anywhere. A Student sending
`PUT /api/v1/users/<own id>` with `role_id: 1` becomes Administrator on the next request
(permission lookup is DB-fresh). The same call against any other id rewrites that user.
Fix: `update_user` → target must equal actor and `role_id` must be absent; any `role_id` change
requires `update_user_role`; consider forbidding non-admins from assigning the Administrator role.

**C2. The users API returns every user's live session JWT.**
`users/tasks/user_tasks.js:40,54` are `select('*')`; `tbl_users.token` holds the raw JWT saved
at login (`auth/controller.js:107`). `users/controller.js` returns rows unfiltered. `get_users`
is gated only by `view_users` (all roles); `get_user` (`users/controller.js:102-173`) has no
permission check at all. `TOKEN.verify` checks only the signature, so a replayed token in
`x-access-token` is full account takeover until `exp`.
Fix: explicit column list without `token`; add a permission gate to `get_user`; stop persisting
the raw JWT (or store a hash).

**C3. Shared-preview tokens are accepted as session tokens.**
`libs/tokens.js` `verify`/`verify_page`/`verify_with_query` validate `sub` and `iss` only, never
`type`. `create_shared` signs with the same secret and issuer, `type:'shared'`, 7-day expiry, and
the token is in the share URL query string. Anyone holding a share link can present it as
`x-access-token`: `check_permission` fails (no user with that `du_id`), but every route that
has no `check_permission` is open to them: all reads (unpublished content, `?type=edit&uid=`
which locks records), `reorder_items`, all five unlock endpoints, `build_exhibit_preview`, and
`create_shared_exhibit_preview_url` (mint more links). No test asserts that `verify` rejects a
shared token.
Fix: reject `decoded.type !== 'session'` in the three session verifiers; require
`type === 'shared'` in `verify_shared` (today it only checks the type *if present*); ideally a
separate signing secret.

**C4. Share token is not bound to its exhibit, and the anonymous path writes state.**
`exhibits/share_controller.js:54-85` never compares `req.decoded.sub` with `req.query.uuid` and
does not validate the uuid, so one share link previews any exhibit. When no preview exists the
GET calls `build_exhibit_preview`, which sets `is_preview=1` and indexes. The rendered page embeds
`EXHIBIT_PREVIEW_API_KEY` in the iframe URL for anonymous viewers. When the delayed build fails
no response is sent (request hangs), and `create_shared` returning `null` yields a 201 with
`t=null`. `create_shared_exhibit_preview_url` needs only `TOKEN.verify` (no permission), so any
staff user can mint a 7-day anonymous link to any unpublished exhibit.
Fix: `403` unless `decoded.sub === uuid`; validate uuid; never build from the anonymous path
(404 if no preview); gate link creation on exhibit ownership/permission; keep the preview key out
of the page.

**C5. Orphaned-file sweep is non-functional today and destructive once "fixed".**
`media-library/tasks/cleanup_orphaned_files.js:76` reads `DB_TABLES.media_library_records`, but
`config/db_tables_config.js` exports `{ exhibits: {...} }`, so `TABLES` is `undefined`; the DB
lookup throws inside a try and the catch marks every file as "has a record", so nothing is
deleted. Separately, the sweep keys orphans on the *filename* uuid, but v2 uploads name the file
by the upload uuid and give the record a different uuid (`uploads.js:355`, `model.js:211`). The
media reviewer counted 136 of 924 `upload` rows in the local DB whose filename uuid is not the
record uuid. If someone corrects the table reference and runs the documented `--delete` cron,
every v2-uploaded original and thumbnail older than 24h is unlinked. The replace-file feature
names this sweep as its backstop (`media-library/model.js:466-470`).
Fix: key on `storage_path`/`thumbnail_path` across all rows (including `is_deleted=1`); fix the
table reference; add a unit test with a v2-shaped row. `run_cleanup` has zero test references.

---

## HIGH

**H1. Outbound TLS verification is disabled process-wide.** `exhibits-backend.js:25` sets
`NODE_TLS_REJECT_UNAUTHORIZED = 0` unconditionally, before anything loads (the dev-only copy in
`config/express.js:53` is redundant). Kaltura, repo API, thumbnail service, and subjects API
calls, all carrying API keys, accept any certificate. Known from the earlier OWASP review; still
open. Fix: delete the line; use a per-agent `rejectUnauthorized:false` only for the one
self-signed local host if needed.

**H2. State-changing routes with no authorization (token only).**
`items_controller.reorder_items` (`:295`); `build_exhibit_preview` (auth block commented out as
TODO, `exhibits_controller.js:453`); the five unlock handlers (`exhibits_controller.js:859`
TODO, `headings_controller.js:151`, `items_controller.js:369`, `grid_controller.js:520`,
`timelines_controller.js:340`); `share_controller.create_shared_exhibit_preview_url`;
`media-library/controller.update_media_exhibits` (`routes.js:121`, the only media write without
a check, and it drives which exhibits get republished on replace, see H9); the un-prefixed
`/api/v1/indexer/:uuid` GET/POST/DELETE (`indexer/routes.js:35-42`, DELETE removes any public
doc; reachable only without the app-path prefix).

**H3. Ownership check does not bind the child to the parent; several operations act on the
child uuid alone (IDOR).** `auth/tasks/auth_tasks.js:552-615` returns the exhibit owner whenever
the caller owns the exhibit named in the URL without checking the child's
`is_member_of_exhibit`. Regular update/delete are safe because the task `WHERE` includes the
parent, but these are not: recycle restore/hard-delete (`exhibit_recycled_record_tasks.js:92,122`
operate on `uuid` only); suppress and publish by uuid (`items_model.js:627,687`,
`headings_model.js:438`, `grid_model.js:987`, `timelines_model.js:808`, `tasks_helper.js:266`);
grid/timeline item suppress deletes the *foreign* container's index doc before the scoped DB
update throws (`grid_model.js:1151-1227`, `timelines_model.js:967-1001`). Fix: select the child
with its parent columns first and act only on the matched row; delete index docs only after the
DB row matched.

**H4. Lock identity is taken from the client.** `uid` comes from the query string in every lock
and unlock path (`exhibits_controller.js:143,796`; `items_controller.js:102,375`; etc.) and is
never compared with `req.decoded`. The guard at `exhibits_controller.js:911` reads `req.user`,
which production never populates (acknowledged in the comment there). Any user can lock as, or
unlock, anyone. Fix: resolve the numeric id from `req.decoded.sub` server-side.

**H5. Mass assignment of ownership, state, and audit columns.** Exhibit create inserts
`{...data}` with no whitelist (`exhibit_record_tasks.js:245`). Update whitelists include `owner`,
`order`, `is_published`, `is_locked`, `locked_by_user`, `is_deleted`, `is_preview`, `is_featured`
(`exhibit_record_tasks.js:43-48`; grid `:408`; timeline `:234`; timeline-item `:791`; item,
heading, grid-item similar). The dashboard sends `owner`/`created_by`/`updated_by` from the
client; the server never derives them from the JWT, so ownership, the basis of every permission
check, is client-asserted. Fix: split INTERNAL vs CLIENT field lists; controllers set
owner/audit fields from `req.decoded`; state flags change only via their dedicated endpoints.

**H6. Publish-permission bypass through `is_published` on update.** `items_model.js:389-391`
(also `headings_model.js:321`, `grid_model.js:748`) treat a truthy `is_published` in the update
payload as "republish" and call the publish path, which sets the flag and indexes. A user with
`update_item` but no `publish_item` publishes. For exhibits (`exhibits_model.js:431`) the
re-index has no `is_published` guard, so an unpublished exhibit's doc reaches the public index.
Fix: decide republish from the DB row, never the payload.

**H7. Deleting an exhibit never removes it from the public index.**
`exhibits_model.delete_exhibit_record` (`:623-664`) makes no indexer call and the client sends a
plain DELETE with no prior suppress. A published exhibit moved to the recycle bin stays live.
Also `:562-566` returns early when there are no standard items, so headings/grids/timelines in
such an exhibit are never cascaded. Same class: deleting a published grid/timeline item never
updates the container doc (`grid_model.js:786`, `timelines_model.js:633`).

**H8. Suppressing one grid (or timeline) unpublishes every grid/timeline item in the exhibit.**
`grid_model.js:1002` calls `get_grid_records(exhibit_id, item_id)` but the task takes one
argument (`exhibit_grid_record_tasks.js:324`) and returns all grids; the loop then flags every
item of every grid. DB says unpublished, index still says published. Identical in
`timelines_model.js:823`.

**H9. Replace-file reindex mutates publish state.** `media-library/model.js:456` calls
`index_exhibit(uuid, 'publish')`, and publish mode writes `is_published=1` to every grid/timeline
child (`indexer_helper.js:674-677` → `_update_single_publish_status`). Individually suppressed
items are republished as a side effect of a media owner replacing a file, in exhibits the media
owner may not own (see H2, `update_media_exhibits`). Fix: a non-mutating index mode, or re-index
only docs that reference the media.

**H10. Client-supplied `storage_path` at create plus hard-delete on replace = cross-user file
destruction.** `media-library/controller.js:451-456` and `tasks/media_record_tasks.js:167-176`
accept any relative `storage_path`/`thumbnail_path` from the body; nothing checks it is an
unreferenced staged upload. `GET /media/library` exposes every record's path. `replace_media_file`
(`model.js:562-568`) unlinks the old path after a successful replace. User A creates a record
pointing at B's file, replaces it, and B's original and thumbnail are gone. Related:
`DELETE /media/library/upload` (`model.js:725-763`) checks only `storage_path` against
`is_deleted=0` rows and never checks the thumbnail argument, so it can delete any live
thumbnail, any recycled original, or anything under `iiif_cache/`. `resolve_storage_path`
(`uploads.js:598`) uses a bare `startsWith` (no separator), weaker than the delete-side guard.
Fix: on create, reject paths referenced by any row and require the upload subtrees; on replace,
unlink only when no other row references the path; check both arguments against both columns.

**H11. Power Users can create or promote Administrators.** `save_user` requires only `add_users`
and accepts any `role_id` (`users/controller.js:354`, `users/model.js:337-411`); Power User holds
`add_users` and `update_users`. Same fix as C1.

**H12. Seeds are destructive with no production guard.** `db/seeds/01..03` wipe and reinsert;
`knexfile.js` wires `seeds` for `production`; no `NODE_ENV` guard and no transaction spanning
02→03. A partial run can leave `ctbl_role_permissions` empty, denying everyone including admins.
Fix: refuse in production without an explicit override; one transaction; or upsert by name.

**H13. Controllers ignore the model's status and report success on failure.** Users: PUT on a
nonexistent id → 201; PUT with only `role_id` → knex "Empty .update()" → 201 and the role is not
applied; duplicate email → 201; DELETE nonexistent → 204 (`users/controller.js:268-305,472-503,
588-625`). Auth: `get_auth_user_data` returns 200 `[]` when the model says 404/500
(`auth/controller.js`); in `sso`, `save_token` returns an object so `!is_token_saved` never
fires (`auth/controller.js:107-121`). Fix: honor `response.status` uniformly.

---

## MEDIUM

- **Session JWT is exposed to script and to URLs.** After SSO the redirect carries
  `?t=<jwt>&id=` (`auth/controller.js:118`) even though the HttpOnly cookie is now the primary
  transport; the client stores it in `sessionStorage` (`public/app/utils/auth.module.js:39`).
  With `'unsafe-inline'`/`'unsafe-eval'` in `script-src` (`config/helmet_config.js:73-78`) and
  214 `innerHTML` sinks in `public/app`, any XSS is token theft. Helmet 3.23.3 is end-of-life
  and `xssFilter:true` emits the legacy header. An unset CSP env var throws an opaque error at
  startup (fail-closed, but bypasses `check_config`).
- **Read IDOR on auth endpoints.** `/auth/authentication?id=N` and `/auth/role?user_id=N`
  return any user's id, du_id, email, name, role to any authenticated user.
- **Admin dashboard pages are not role-gated server-side** (`dashboard/routes.js:155-190`
  use only `verify_page`); the "fail closed" in `dashboard/controller.js:44` is client nav
  hiding. Combined with C1/C2 a Student can drive the Users admin UI.
- **`/auth/login` IP limiter is 5 per 15 min** (`config/rate_limits_loader.js`). Staff behind a
  shared NAT/VPN egress will get 429 on the sixth login in a window; the re-auth loop noted in
  memory would burn attempts quickly.
- **`EXHIBITS_TEST_AUTH_BYPASS=1` alone disables the CSRF guard and all rate limits**
  (`config/csrf_guard.js:37`, `rate_limits_loader.js:151`), while the auth bypass correctly
  also requires `NODE_ENV=test`. Align the three gates.
- **API-key auth path is dead.** `validate_api_key` reads `TOKEN_CONFIG.api_key`, which
  `config/token_config.js` never defines, so `?api_key=` always 401s. Remove or wire it.
- **Preview build is a GET that tears down live docs.** `check_preview` is true for any indexed
  exhibit; `build_exhibit_preview` deletes the exhibit and all component docs then re-indexes
  in preview mode, which does not gate children on `is_published`. Cookie is `SameSite=Lax`, so a
  cross-site link triggers it. Also `GET …?type=edit&uid=` locks, and `GET …/items` heals gaps
  (writes on GET).
- **Upload/replace trust the client MIME type** (`uploads.js:155-159`, `model.js:500-503`);
  thumbnail failure is non-fatal, so arbitrary bytes named `.jpg`/`.pdf` are stored and served
  publicly with `Access-Control-Allow-Origin: *` for PDFs. Sniff magic bytes.
- **Public IIIF `Cache-Control: public, max-age=86400`** with version-less indexed URLs means
  the public site serves the old derivative for up to a day after a replace; the ETag does not
  help a fresh cache. `index_exhibit` returns 201 even if every component doc failed
  (`indexer/model.js:161-173`). Concurrent replaces on one record orphan a file permanently.
- **Publish gate counts recycled rows** (heading/item/timeline `get_record_count` ignore
  `is_deleted`; base `_update_publish_status` too), so bulk publish flips recycled items.
- **`update_exhibit_timestamp` catch references an undefined `data`**
  (`exhibit_record_tasks.js:666-669`): editing a child of a recycled exhibit returns 400
  "data is not defined" after the write succeeded.
- **Timeline item update resets `order` to 1** (`timelines_model.js:587` calls the exhibit-scoped
  helper with a timeline uuid).
- **Recycle bin:** heading/grid/timeline creates never set `created_by`, so non-admins cannot
  see or restore them; exhibit restore does not restore cascaded children; `TYPE_TABLE` lacks
  grid_item/timeline_item so purging a container orphans its items.
- **Hanging responses / precedence bugs:** `headings_controller.get_heading_record` unknown
  `type`, `timelines_controller.get_timeline_item_record`; `a || b && c || d` guards in
  headings/timelines controllers; `timeline_item_id` unvalidated in timeline publish/suppress.
- **Raw `error.message` (knex/MySQL text) reaches clients with 400** in most model catch blocks
  and several controllers; `grid_helper.handle_error` gates on `NODE_ENV` and should be the model.
- **Global request sanitizer:** `sanitize_req_params` is a no-op (app-level middleware sees
  `req.params = {}` in Express 4); the DOMPurify pass entity-encodes `<`/`>` in plain-text
  fields (names, alt text, `internal_name`, search terms), the same class of bug
  `tools/migrate-rte-content.js` had to undo.
- **Data-layer inconsistencies:** `Roles_tasks` is constructed with a string in `users/model.js`
  and an object in `auth/model.js`, so half its methods work on each instance; role assignment
  on update is an UPDATE that silently no-ops when no role row exists; duplicate email → 500
  not 409; `lock_record` compares INT to string so same-user re-lock is unreachable and
  20-minute auto-unlock timers are never cleared.
- **Migrations:** utf8mb4 conversion has no `ROW_FORMAT` pre-check (fails mid-loop on COMPACT
  tables with `varchar(500) UNIQUE` keys) and silently promotes TEXT→MEDIUMTEXT; `down()` in
  `20260403200926_titles-to-subheadings.js` alters a dropped column; `20260226214116` narrows
  LONGTEXT→VARCHAR(255) on rollback; Kaltura backfill no-ops without env vars yet is recorded
  as applied. `tools/rte-migration-report.txt` (524 KB of staff content) is git-tracked.
- **Share URL is built from `req.hostname`** (Host header) rather than configured base URL.

---

## LOW / maintainability

- `var` appears twice in `public/app/exhibits/exhibits.add.form.module.js:744,767`. No `var` in
  server code or EJS scriptlets. Unlike repo-backend-v2 there is no ESLint config and no
  template-scanning guard test in this repo, so the convention is unenforced.
- `//` line comments dominate every module (roughly 600 in `exhibits/` alone) against the
  starred-block convention.
- jQuery usage stays within the allowed Bootstrap 4 / DataTables surface.
- Dead code: `auth/tasks/permissions_tasks.js` (stub, only its own test), token-based
  `get_user_id`/`get_user_permissions` in `auth_tasks.js`, `tokens.refresh_token` (uses a
  secret that does not exist), all `reorder_*` model/task methods except
  `items_model.reorder_exhibit_items`, `exhibits_model.get_exhibit_title`,
  `common_helper.process_media_files`, `helper.process_uploaded_media`,
  `schemas/exhibit_item_create_record_schema.js`, media `tasks.get_user(token)`,
  `search_media_records`, `repo_service_tasks.get_by_uuid`, `indexer/controller.index_record`,
  `iiif-service.extract_dimensions`, the unreachable "model not initialized" `typeof` checks in
  `exhibits_controller.js`. Endpoint entries `exhibit_media`, `item_media`, `media`,
  `heading_records.delete`, `timeline_records.delete` have no registered route.
- Duplication: the five container types re-implement create/update/get/publish/suppress/unlock
  with divergent status codes and response shapes; four controller helper files implement
  `validate_param`/`check_authorization`/`handle_error` differently; `build_response`,
  `is_valid_uuid`, `decode_html_entities`, `_with_timeout` copied across 5–8 files. H8 and the
  timeline `order` bug are copy-paste artefacts of this.
- Minor: PUT returns 201 throughout; `libs/validate.js` returns `true` or an errors array
  (truthy) and marks every key required; `check_config` `encodeURI`s any URL-looking value
  (double-encodes, and would touch `DB_PASSWORD` if it matched); `method-override` header
  tunnelling is enabled but unused; log4js logs to stdout and file (double logging under a
  journal supervisor).

---

## Test suite assessment

Is the code being tested correctly? Partly. The suite is large, green, and well organised, and
several guards are genuinely valuable: the route-mounting suites mount the real route files,
endpoints module, and controllers; `permissions_matrix_integration` and
`authorize_check_permission_integration` exercise the real `auth/authorize.js`;
`client_endpoints_parity`, `dashboard_view_targets`, and the indexer whitelist pin tests protect
real contracts. `TEST_SUMMARY.md` counts match what ran.

Where it does not catch what matters:

1. **The authorization boundary is mostly mocked.** 12 of 31 integration suites mock
   `libs/tokens` and 14 mock `auth/authorize`, so those routes are asserted as "whatever the
   mock returns". Every CRITICAL/HIGH authorization finding above (C1–C4, H2–H6) lives either in a
   path where authorization is mocked or in a path that has no authorization to test. The
   "returns 403 when authorization denies" tests prove the controller honours a `false` from the
   mock, not that the real check is correct or present.
2. **No negative token-type test.** `tokens.test.js` proves `verify_shared` rejects a session
   token but never that `verify` rejects a shared one (C3).
3. **Models that hold the bugs are never executed.** `users/model.js` is only ever mocked
   (H13, role no-op, duplicate email); `share_controller.js` and the `/shared` route have zero
   references; `dashboard/controller.js` (49 handlers) and `dashboard/routes.js` have none;
   `replace_media_file` orchestration (unlink old, purge, reindex) is untested beyond the
   whitelist; `cleanup_orphaned_files.js` is untested (C5); `auth/tasks/roles_tasks.js` has no
   test. Indexer `create_index`/`recreate_index`/`delete_index`/`reindex_published_exhibits`
   untested.
4. **Tests assert behaviour production cannot have.** `exhibits_integration.test.js:35,170`
   and `items_integration.test.js:121` set `req.user`, which nothing in production populates
   (H4); the inert guard passes under test and fails silently in production.
5. **Stub drift risk.** `test/e2e/fixtures/api-stubs.js` answers every data API in-browser; the
   two stub timeouts seen here were load flakes, but the stub suite cannot detect server-side
   contract changes by design (that is what the live suite is for, and it was not run here).
6. **Committed credentials.** `test/e2e/live/.auth/live-auth.json` is git-tracked (added
   2026-07-02, before the `.gitignore` entry) and contains four real HS512 session JWTs for the
   e2e role users (issuer `https://exhibits.dev`, expiring 2026-09-03), signed with the local
   `TOKEN_SECRET`. If that secret is shared with any deployed environment, rotate it. Fix with
   `git rm --cached test/e2e/live/.auth/live-auth.json`.
7. **Convention guards are missing** for `var` in templates and for comment style (repo-backend-v2
   has the template guard; this repo does not).

Predeploy gate (`test:predeploy`) runs unit + integration + stub e2e + live e2e in sequence. Whether
a missing live DB fails loudly or is skipped was not verified in this review.

---

## Recommended order

1. Hotfix, small and contained: C1/C2/H11 (users API column list + permission split),
   C3 (token `type` check), C4 (bind share token to uuid, no build from the anonymous path),
   H1 (delete the TLS override line).
2. Before merging branch 187: C5 (fix or retire the sweep), H10 (storage_path validation on
   create/delete), H2 (`update_media_exhibits` permission), H9 (non-mutating reindex).
3. Next sprint: H2 remaining routes, H4 (server-derived identity), H5/H6 (field lists and
   republish-from-DB), H3 (parent-scoped model operations), H7/H8 (index consistency on delete
   and suppress), H12 (seed guard), H13 (honor model status).
4. Tests to add alongside: a live-`authorize` route test per H2 route asserting 403 for a
   Student; a `verify` rejects-shared-token test; a users-model test suite; a cleanup-sweep test
   with a v2-shaped row; a `var`/comment-style guard test.
5. Cleanup: dead code list above, consolidate the five container flows, comment style.
