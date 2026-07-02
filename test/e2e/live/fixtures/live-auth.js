'use strict';

/**
 * Role login for LIVE (full-stack) specs.
 *
 * Uses the real JWTs minted by global-setup (libs/tokens.create per seeded role
 * user) and starts the browser session just after where the SSO redirect would
 * have landed:
 *
 *   - the `exhibits_token` cookie carries the JWT to page routes (verify_page
 *     reads header-or-cookie; a browser navigation can only send the cookie), and
 *   - seedAuth() (shared with the stubbed suite) writes the client session —
 *     sessionStorage token/profile + the localStorage endpoint registry — exactly
 *     as the post-login landing page would.
 *
 * From that point everything is real: API calls send the JWT via x-access-token,
 * verify() validates the signature, and authorize resolves the acting user's
 * role/permissions DB-fresh from req.decoded.sub (the du_id).
 */

const fs = require('fs');
const path = require('path');
const { seedAuth } = require('../../fixtures/auth');

const AUTH_FILE = path.join(__dirname, '..', '.auth', 'live-auth.json');
const APP_HOST = process.env.APP_HOST || 'localhost';

const ROLE_KEYS = ['administrator', 'power', 'general', 'student'];

function load_auth() {
    if (!fs.existsSync(AUTH_FILE)) {
        throw new Error(`live-auth: ${AUTH_FILE} not found — run with PW_MODE=live so global-setup mints the role tokens.`);
    }
    return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
}

/**
 * Logs the page's browser context in as the given role.
 * @param {import('@playwright/test').BrowserContext} context
 * @param {import('@playwright/test').Page} page
 * @param {'administrator'|'power'|'general'|'student'} role_key
 * @returns {Promise<Object>} the seeded user profile (id/uid/du_id/name/role)
 */
async function loginAs(context, page, role_key) {

    const entry = load_auth().roles[role_key];

    if (!entry) {
        throw new Error(`live-auth: unknown role key "${role_key}" (expected one of ${ROLE_KEYS.join(', ')})`);
    }

    // Page navigations authenticate via the HttpOnly cookie (verify_page).
    await context.addCookies([{
        name: 'exhibits_token',
        value: entry.token,
        domain: APP_HOST,
        path: '/',
        httpOnly: true,
        sameSite: 'Lax'
    }]);

    // Client session + endpoint registry — same seeding the stubbed suite uses,
    // but with the REAL token and the REAL seeded user.
    await seedAuth(page, {
        token: { token: entry.token, expires: entry.expires },
        user: {
            id: entry.user.id,
            uid: entry.user.uid,
            name: entry.user.name,
            role: entry.user.role,
            permissions: []
        }
    });

    return entry.user;
}

module.exports = { loginAs, ROLE_KEYS };
