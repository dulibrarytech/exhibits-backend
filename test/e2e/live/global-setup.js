'use strict';

/**
 * Global setup for the LIVE (full-stack) Playwright project (PW_MODE=live).
 *
 * Unlike the stubbed suite, live specs exercise the real pipeline:
 * UI -> real API -> real MySQL -> real file storage. This setup prepares that
 * world once per run:
 *
 *   1. Creates the dedicated e2e database (E2E_DB_NAME, default `exhibits_e2e`)
 *      if it doesn't exist — the app itself never gets CREATE DATABASE rights.
 *   2. Runs `knex migrate:latest` + the RBAC seeds (role catalog, permission
 *      catalog, role->permission grants) against it. Seeds only run when the
 *      role catalog is empty, so an existing e2e DB isn't churned.
 *   3. Upserts one user per role (Administrator / Power User / General User /
 *      Student) into tbl_users + ctbl_user_roles.
 *   4. Mints a REAL session JWT per user via libs/tokens.create(du_id) — the
 *      same signer the SSO callback uses — so server-side verify()/authorize
 *      run for real per role (no EXHIBITS_TEST_AUTH_BYPASS in live mode).
 *   5. Writes the tokens + user profiles to test/e2e/live/.auth/live-auth.json
 *      for the loginAs() fixture.
 *
 * Requires the backend .env (DB_* credentials, TOKEN_* config) — loaded below
 * before libs/tokens is required.
 */

const path = require('path');
const fs = require('fs');

const BACKEND_ROOT = path.join(__dirname, '..', '..', '..');

// DB creds + TOKEN_* config come from the backend .env — but this file runs in
// the Playwright RUNNER process, whose env is INHERITED by worker processes
// that re-evaluate playwright.config.js. A plain dotenv.config() here once
// leaked the backend's APP_PORT (the DEV instance's port) into that env, and
// every worker silently re-resolved baseURL to the dev server — the browser
// ended up testing the wrong app against the wrong database. So: PARSE the
// .env without touching process.env, use values explicitly, and only assign
// the keys that app libs read at require time (libs/tokens -> config/*) when
// they aren't already set — never the Playwright-config keys.
const DOTENV_PARSED = require('dotenv').parse(
    fs.readFileSync(path.join(BACKEND_ROOT, '.env'))
);

const PLAYWRIGHT_CONFIG_KEYS = new Set([
    'APP_HOST', 'APP_PORT', 'APP_PATH', 'BASE_URL', 'PW_MODE',
    'E2E_DB_NAME', 'DB_NAME', 'NODE_ENV', 'STORAGE_PATH', 'CI'
]);

for (const [key, value] of Object.entries(DOTENV_PARSED)) {
    if (!PLAYWRIGHT_CONFIG_KEYS.has(key) && process.env[key] === undefined) {
        process.env[key] = value;
    }
}

const E2E_DB_NAME = process.env.E2E_DB_NAME || 'exhibits_e2e';
const AUTH_DIR = path.join(__dirname, '.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'live-auth.json');

// One user per role. du_ids satisfy libs/tokens validate_username
// (alphanumeric plus . _ @ -) and are clearly test-owned.
const ROLE_USERS = [
    { key: 'administrator', role: 'Administrator', du_id: 'pw-e2e-admin', first_name: 'PW', last_name: 'Admin' },
    { key: 'power', role: 'Power User', du_id: 'pw-e2e-power', first_name: 'PW', last_name: 'Power' },
    { key: 'general', role: 'General User', du_id: 'pw-e2e-general', first_name: 'PW', last_name: 'General' },
    { key: 'student', role: 'Student', du_id: 'pw-e2e-student', first_name: 'PW', last_name: 'Student' }
];

function jwt_expiry_ms(token) {
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
        if (payload && typeof payload.exp === 'number') {
            return payload.exp * 1000;
        }
    } catch (_) { /* fall through */ }
    return Date.now() + 8 * 60 * 60 * 1000;
}

module.exports = async function global_setup() {

    const db_conn = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
    };

    // 1. Ensure the e2e database exists (name is config-controlled, not user input).
    const mysql = require('mysql2/promise');
    const admin_conn = await mysql.createConnection(db_conn);
    await admin_conn.query(`CREATE DATABASE IF NOT EXISTS \`${E2E_DB_NAME}\``);
    await admin_conn.end();

    // 2. Migrate + seed the RBAC catalogs/grants.
    const knex = require('knex')({
        client: 'mysql2',
        connection: { ...db_conn, database: E2E_DB_NAME },
        migrations: { directory: path.join(BACKEND_ROOT, 'migrations') },
        seeds: { directory: path.join(BACKEND_ROOT, 'db', 'seeds') }
    });

    try {
        await knex.migrate.latest();

        const [{ role_count }] = await knex('tbl_user_roles').count({ role_count: '*' });
        if (Number(role_count) === 0) {
            await knex.seed.run();
        }

        // 4 (part). libs/tokens reads TOKEN_* env at require time — after dotenv above.
        const TOKENS = require(path.join(BACKEND_ROOT, 'libs', 'tokens'));

        // 3 + 4. Upsert role users, mint real JWTs.
        const roles = {};

        for (const u of ROLE_USERS) {

            const email = `${u.du_id}@du.edu`;

            let user = await knex('tbl_users').where({ du_id: u.du_id }).first();

            if (!user) {
                const [inserted_id] = await knex('tbl_users').insert({
                    du_id: u.du_id,
                    email: email,
                    first_name: u.first_name,
                    last_name: u.last_name,
                    is_active: 1
                });
                user = { id: inserted_id };
            } else {
                // Re-activate in case a prior run's deactivation test left it off.
                await knex('tbl_users').where({ id: user.id }).update({ is_active: 1 });
            }

            const role_row = await knex('tbl_user_roles').where({ role: u.role }).first();
            if (!role_row) {
                throw new Error(`global-setup: role "${u.role}" not found in tbl_user_roles — did the RBAC seeds run?`);
            }

            // One role per user (UNIQUE(user_id)) — replace any prior assignment.
            await knex('ctbl_user_roles').where({ user_id: user.id }).del();
            await knex('ctbl_user_roles').insert({ user_id: user.id, role_id: role_row.id });

            const token = TOKENS.create(u.du_id);
            if (!token) {
                throw new Error(`global-setup: tokens.create("${u.du_id}") returned null — check TOKEN_* env in .env`);
            }

            roles[u.key] = {
                token: token,
                expires: jwt_expiry_ms(token),
                user: {
                    id: String(user.id),
                    uid: String(user.id),
                    du_id: u.du_id,
                    name: `${u.first_name} ${u.last_name}`,
                    email: email,
                    role: u.role
                }
            };
        }

        // 5. Persist for the loginAs() fixture.
        fs.mkdirSync(AUTH_DIR, { recursive: true });
        fs.writeFileSync(AUTH_FILE, JSON.stringify({
            created: new Date().toISOString(),
            database: E2E_DB_NAME,
            roles: roles
        }, null, 2));

        // eslint-disable-next-line no-console
        console.log(`[live global-setup] db=${E2E_DB_NAME} migrated; role users ready: ${ROLE_USERS.map(r => r.du_id).join(', ')}`);

    } finally {
        await knex.destroy();
    }
};
