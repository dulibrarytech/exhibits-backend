/**

 Copyright 2025 University of Denver

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 */

'use strict';

// OWASP A04 (H4) — CSRF defense for state-changing requests.

const LOGGER = require('../libs/log4');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const parse_csv_env = (name) =>
    (process.env[name] || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

// Normalize an Origin/Referer header value to a lowercase host[:port], or null
// if it is absent/unparseable.
const origin_host = (value) => {
    if (!value || typeof value !== 'string') {
        return null;
    }
    try {
        return new URL(value).host.toLowerCase();
    } catch (_) {
        return null;
    }
};

module.exports = function csrf_guard(req, res, next) {

    // Reads and idempotent requests are not CSRF-relevant.
    if (SAFE_METHODS.has(req.method)) {
        return next();
    }

    // e2e/test harness — never set in production (paired with the rate-limit skip).
    if (process.env.EXHIBITS_TEST_AUTH_BYPASS === '1') {
        return next();
    }

    // Exempt the SSO POST-back (legitimate cross-origin) plus any configured paths.
    const exempt_paths = ['/auth/sso', ...parse_csv_env('CSRF_EXEMPT_PATHS')];
    if (exempt_paths.some(p => req.path === p || req.path.endsWith(p))) {
        return next();
    }

    const stated_host = origin_host(req.get('origin') || req.get('referer'));

    // No Origin AND no Referer → non-browser client (no ambient cookie). Browsers
    // always send Origin on cross-site unsafe requests, so this cannot be a
    // browser-driven CSRF attack. Allow; the auth layer still applies.
    if (!stated_host) {
        return next();
    }

    // Allowlist: the app's own host (adapts to wherever it is deployed) plus any
    // configured trusted origins.
    const allowed_hosts = new Set(
        [req.get('host'), req.hostname]
            .filter(Boolean)
            .map(h => String(h).toLowerCase())
    );
    parse_csv_env('CSRF_TRUSTED_ORIGINS').forEach(o => {
        const h = origin_host(o) || o.toLowerCase();
        if (h) {
            allowed_hosts.add(h);
        }
    });

    if (allowed_hosts.has(stated_host)) {
        return next();
    }

    LOGGER.module().warn(
        `WARNING: [/config/csrf_guard] blocked cross-origin ${req.method} to ${req.path} — Origin/Referer host: ${stated_host}`
    );

    return res.status(403).json({
        success: false,
        message: 'Cross-origin request blocked',
        data: null
    });
};
