# Exhibits v1 → v2 Migration

Tooling to migrate the legacy Exhibits **v1** database + storage into the **v2**
(`exhibits-backend`) system. The structural migration is one script; the
post-migration enrichment passes (styles, subjects) and the ownership tool are
independent sibling scripts that run against the already-migrated v2 data.

## Pipeline (run in this order)

Roles/permissions and schema come from the **v2 backend**, not this migration.
So bring the v2 database up first, then run the migration, then the enrichment passes.

| # | Step | Where | Command |
|---|------|-------|---------|
| 1 | Schema | `exhibits-backend` | `knex migrate:latest` |
| 2 | RBAC (roles + permissions + grants) | `exhibits-backend` | `knex seed:run` |
| 3 | **Structural migration** (users, exhibits, containers, items, title→subheading, media library, owner remap, role assignments, IIIF) | here | `npm run migrate` |
| 4 | **Styles** pass (inline CSS → preset slots) | here | `npm run styles` |
| 5 | **Subjects** pass (repository + `item_subjects` → media-library subject columns) | here | `npm run subjects` |

Each step has a `:dry` variant that previews without writing
(`npm run migrate:dry`, `styles:dry`, `subjects:dry`), and every script also
honors `DRY_RUN=true`.

> Steps 4 and 5 read v2 data the structural migration created (item styles,
> media records, `item_subjects`), so they must run **after** step 3.

## Scripts

- **`migrate_v1_to_v2.js`** (`npm run migrate`) — the structural v1→v2 migration.
  Reads the v1 DB + v1 storage; writes the v2 DB + media-library storage.
- **`migrate_styles_v1_to_v2.js`** (`npm run styles`) — converts v1 inline-CSS
  styles into v2 preset slots. v2-only; idempotent.
- **`backfill_media_subjects.js`** (`npm run subjects`) — populates
  `topics_subjects` / `genre_form_subjects` / `places_subjects` on
  `tbl_media_library` from the DU repository (for repo imports) and from
  `item_subjects` (classified via `vocab/` + heuristics). v2-only; only fills
  empty columns. Sets `NODE_TLS_REJECT_UNAUTHORIZED=0` for the repo host — kept a
  separate process so this does not affect the other scripts.
- **`assign_ownership.js`** (`npm run ownership:list` / `ownership:dry` /
  `ownership`) — post-migration tool to deliberately (re)assign exhibit/item/media
  ownership. See `ownership_assignments.example.json`.

## Configuration

Copy `.env.migration` to `.env` and fill in values: v1/v2 DB connections, v1
storage + v2 media-library paths, `MIGRATION_USER`, the v2 API/IIIF settings, and
(for the subjects pass) `VOCAB_DIR` + `REPOSITORY_SERVER` / `REPOSITORY_API_KEY`.

`npm install` once. Node 18+ (the subjects pass uses the global `fetch`).
