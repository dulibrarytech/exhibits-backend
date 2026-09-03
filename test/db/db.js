/**
 * Shared helpers for the database-backed task suites (test/db).
 *
 * Reads DB credentials from the backend .env WITHOUT mutating process.env for
 * anything but the DB_* keys (see the live e2e global-setup for why leaking
 * the whole .env into the runner is a bad idea), and always targets the e2e
 * database — never the dev one named in .env.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BACKEND_ROOT = path.join(__dirname, '..', '..');
const E2E_DB_NAME = process.env.E2E_DB_NAME || 'exhibits_e2e';

function db_connection() {

    const parsed = require('dotenv').parse(fs.readFileSync(path.join(BACKEND_ROOT, '.env')));

    return {
        host: process.env.DB_HOST || parsed.DB_HOST,
        user: process.env.DB_USER || parsed.DB_USER,
        password: process.env.DB_PASSWORD || parsed.DB_PASSWORD
    };
}

/**
 * Knex instance bound to the e2e database. Callers own its lifecycle
 * (destroy() in afterAll).
 */
function create_knex() {
    return require('knex')({
        client: 'mysql2',
        connection: { ...db_connection(), database: E2E_DB_NAME },
        migrations: { directory: path.join(BACKEND_ROOT, 'migrations') },
        seeds: { directory: path.join(BACKEND_ROOT, 'db', 'seeds') }
    });
}

/*
 * The table map the task classes expect (config/db_tables_config shape). The
 * physical names are fixed by the baseline migration, so they are stated here
 * rather than read from env.
 */
const TABLES = Object.freeze({
    user_records: 'tbl_users',
    roles_records: 'tbl_user_roles',
    users_roles: 'ctbl_user_roles',
    exhibit_records: 'tbl_exhibits',
    item_records: 'tbl_standard_items',
    heading_records: 'tbl_heading_items',
    grid_records: 'tbl_grids',
    grid_item_records: 'tbl_grid_items',
    timeline_records: 'tbl_timelines',
    timeline_item_records: 'tbl_timeline_items',
    media_library_records: 'tbl_media_library'
});

const uuid = () => crypto.randomUUID();

/* Unique, validate_username-safe du_id per run so parallel/aborted runs never collide. */
const du_id = (label) => `9db${label}${crypto.randomBytes(3).toString('hex')}`;

module.exports = { create_knex, db_connection, E2E_DB_NAME, TABLES, uuid, du_id };
