/**

 Copyright 2026 University of Denver

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

// OWASP A07 (C2) — gate the SSO callback (POST /auth/sso).
const CRYPTO = require('crypto');
const LOGGER = require('../libs/log4');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Normalizes an IP for comparison: strips the IPv4-mapped IPv6 prefix
 * (::ffff:1.2.3.4 -> 1.2.3.4) and folds IPv6 loopback to IPv4 loopback so a
 * value set as 127.0.0.1 still matches a `::1` peer.
 * @param {string} ip
 * @returns {string} normalized IP, or '' when the input is unusable
 */
function normalize_ip(ip) {

    if (typeof ip !== 'string') {
        return '';
    }

    let value = ip.trim();

    if (value === '') {
        return '';
    }

    if (value.toLowerCase().startsWith('::ffff:')) {
        value = value.slice('::ffff:'.length);
    }

    if (value === '::1') {
        value = '127.0.0.1';
    }

    return value;
}

// Constant-time string comparison that never throws and is not length-leaky
// beyond what timingSafeEqual already is (unequal lengths short-circuit false).
function secrets_match(provided, expected) {

    if (typeof provided !== 'string' || typeof expected !== 'string') {
        return false;
    }

    const a = Buffer.from(provided);
    const b = Buffer.from(expected);

    if (a.length !== b.length) {
        return false;
    }

    return CRYPTO.timingSafeEqual(a, b);
}

// Parsed once at load time (env is fixed for the process lifetime).
const ALLOWLIST = (process.env.SSO_HOST_IP || '')
    .split(',')
    .map((entry) => normalize_ip(entry))
    .filter((entry) => entry.length > 0);

const GATEWAY_SECRET = process.env.SSO_GATEWAY_SECRET || '';
const GATEWAY_HEADER = (process.env.SSO_GATEWAY_HEADER || 'x-sso-gateway-secret').toLowerCase();
const CLIENT_IP_HEADER = (process.env.SSO_CLIENT_IP_HEADER || '').toLowerCase();

const HAS_SECRET_CHECK = GATEWAY_SECRET.length > 0;
const HAS_IP_CHECK = ALLOWLIST.length > 0;

module.exports = function restrict_sso_callback(req, res, next) {

    // Nothing configured — fail closed in production, permissive in development.
    if (!HAS_SECRET_CHECK && !HAS_IP_CHECK) {

        if (IS_PRODUCTION) {
            LOGGER.module().error(
                'ERROR: [/auth/sso_guard] neither SSO_GATEWAY_SECRET nor SSO_HOST_IP is configured; refusing SSO callback (fail closed).'
            );
            return res.status(503).json({ message: 'Service not configured.' });
        }

        LOGGER.module().warn(
            'WARNING: [/auth/sso_guard] no SSO callback controls configured; allowing (non-production).'
        );
        return next();
    }

    // Layer 1 — shared-secret header (primary).
    if (HAS_SECRET_CHECK) {
        const provided = req.get(GATEWAY_HEADER) || '';
        if (!secrets_match(provided, GATEWAY_SECRET)) {
            LOGGER.module().warn(
                'WARNING: [/auth/sso_guard] rejected SSO callback: missing or invalid gateway secret header.'
            );
            return res.status(403).json({ message: 'Forbidden.' });
        }
    }

    // Layer 2 — source-IP allowlist (secondary / defense in depth).
    if (HAS_IP_CHECK) {
        const raw = CLIENT_IP_HEADER ? (req.get(CLIENT_IP_HEADER) || '') : req.ip;
        const client_ip = normalize_ip(raw);
        if (client_ip === '' || ALLOWLIST.indexOf(client_ip) === -1) {
            LOGGER.module().warn(
                `WARNING: [/auth/sso_guard] rejected SSO callback from unauthorized IP: ${client_ip || 'unknown'}`
            );
            return res.status(403).json({ message: 'Forbidden.' });
        }
    }

    return next();
};

// Exposed for unit testing.
module.exports.normalize_ip = normalize_ip;
module.exports.secrets_match = secrets_match;
