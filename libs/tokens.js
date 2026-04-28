/**
 * Copyright 2019 University of Denver
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const TOKEN_CONFIG = require('../config/token_config')();
const WEBSERVICES_CONFIG = require('../config/webservices_config')();
const JWT = require('jsonwebtoken');
const VALIDATOR = require('validator');
const LOGGER = require('../libs/log4');
const CRYPTO = require('crypto');

// Constants
const TOKEN_TYPES = {
    SESSION: 'session',
    SHARED: 'shared',
    REFRESH: 'refresh'
};

const MAX_USERNAME_LENGTH = 255;
const MAX_UUID_LENGTH = 36; // Standard UUID length

// Cookie-based token transport avoids leaking the JWT into browser
// history, Referer headers, and access logs. See set_auth_cookie.
const TOKEN_COOKIE_NAME = 'exhibits_token';
// Fallback lifetime used only when the JWT's `exp` claim cannot be read.
// The effective Max-Age is normally derived from the token's exp so the
// cookie never expires before the JWT it carries.
const TOKEN_COOKIE_FALLBACK_MAX_AGE_SECONDS = 8 * 60 * 60;
// Floor so we never set a cookie that expires on arrival, which would
// trigger a burst of "no valid authentication" requests from images
// already inflight.
const TOKEN_COOKIE_MIN_MAX_AGE_SECONDS = 60;

// ===== Test-only auth bypass =====
//
// When BOTH env vars are set, verify() and verify_with_query() short-circuit
// and inject a synthetic decoded JWT into req.decoded. This lets Playwright
// E2E specs run against a server that has no real JWT issued, without
// traversing DU SSO. Two-key gate (EXHIBITS_TEST_AUTH_BYPASS + NODE_ENV) is
// defense in depth: NODE_ENV=test is uncommon in real deployments, and the
// dedicated flag means a stray NODE_ENV alone cannot disarm auth. Production
// must never set NODE_ENV=test, and CI deploys must never set the bypass
// flag. The startup warnings below scream into stderr and the application
// log if the bypass is ever active, so a misconfigured environment surfaces
// loudly rather than silently shipping unauthenticated.
const TEST_AUTH_BYPASS_ENABLED = (
    process.env.EXHIBITS_TEST_AUTH_BYPASS === '1'
    && process.env.NODE_ENV === 'test'
);

const TEST_BYPASS_DECODED = TEST_AUTH_BYPASS_ENABLED ? {
    sub: 'pw-test-user',
    iss: TOKEN_CONFIG.token_issuer,
    type: TOKEN_TYPES.SESSION,
    iat: Math.floor(Date.now() / 1000)
} : null;

if (TEST_AUTH_BYPASS_ENABLED) {
    const banner = '*** [tokens] AUTH BYPASS ACTIVE — verify() and verify_with_query() short-circuit. '
        + 'Trigger: EXHIBITS_TEST_AUTH_BYPASS=1 + NODE_ENV=test. '
        + 'This MUST NEVER fire in production. ***';
    // eslint-disable-next-line no-console
    console.warn('\n' + banner + '\n');
    try {
        LOGGER.module().warn('WARN: ' + banner);
    } catch (_) { /* logger may not be ready at module load */ }
}

/**
 * Parses a named cookie from the request's Cookie header. Kept local to
 * this module so the auth middleware does not pull in cookie-parser.
 * @param {Object} req   - Express request object
 * @param {string} name  - Cookie name
 * @returns {string|null}
 * @private
 */
function get_cookie(req, name) {

    const header = req && req.headers && req.headers.cookie;

    if (!header || typeof header !== 'string') {
        return null;
    }

    const parts = header.split(';');

    for (let i = 0; i < parts.length; i++) {
        const eq = parts[i].indexOf('=');
        if (eq < 0) {
            continue;
        }
        if (parts[i].slice(0, eq).trim() === name) {
            try {
                return decodeURIComponent(parts[i].slice(eq + 1).trim());
            } catch (error) {
                return null;
            }
        }
    }

    return null;
}

/**
 * Validates username input
 * @param {string} username - Username to validate
 * @returns {boolean} - True if valid
 * @private
 */
function validate_username(username) {

    if (!username || typeof username !== 'string') {
        return false;
    }

    const trimmed_username = username.trim();

    if (trimmed_username.length === 0 || trimmed_username.length > MAX_USERNAME_LENGTH) {
        return false;
    }

    // Prevent injection attacks - allow alphanumeric, dots, hyphens, underscores
    const safe_pattern = /^[a-zA-Z0-9._@-]+$/;
    return safe_pattern.test(trimmed_username);
}

/**
 * Validates UUID input
 * @param {string} uuid - UUID to validate
 * @returns {boolean} - True if valid
 * @private
 */
function validate_uuid(uuid) {

    if (!uuid || typeof uuid !== 'string') {
        return false;
    }

    const trimmed_uuid = uuid.trim();

    if (trimmed_uuid.length > MAX_UUID_LENGTH) {
        return false;
    }

    // Validate UUID format (v4 or similar)
    return VALIDATOR.isUUID(trimmed_uuid);
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} - True if strings match
 * @private
 */
function constant_time_compare(a, b) {

    if (typeof a !== 'string' || typeof b !== 'string') {
        return false;
    }

    try {

        const buffer_a = Buffer.from(a, 'utf8');
        const buffer_b = Buffer.from(b, 'utf8');

        if (buffer_a.length !== buffer_b.length) {
            return false;
        }

        return CRYPTO.timingSafeEqual(buffer_a, buffer_b);
    } catch (error) {
        LOGGER.module().error('ERROR: [/libs/tokens lib (constant_time_compare)] comparison failed: ' + error.message);
        return false;
    }
}

/**
 * Sanitizes string for logging (prevents log injection)
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized string
 * @private
 */
function sanitize_for_logging(str) {
    if (typeof str !== 'string') {
        return '[non-string]';
    }
    // Remove newlines and control characters to prevent log injection
    return str.replace(/[\n\r\t]/g, ' ').substring(0, 100);
}

/**
 * Creates session token
 * @param {string} username - Username for token subject
 * @returns {string|null} - JWT token or null on failure
 */
exports.create = function (username) {

    try {

        if (!validate_username(username)) {
            LOGGER.module().error('ERROR: [/libs/tokens lib (create)] invalid username format');
            return null;
        }

        const trimmed_username = username.trim();

        const token_data = {
            sub: trimmed_username,
            iss: TOKEN_CONFIG.token_issuer,
            type: TOKEN_TYPES.SESSION,
            iat: Math.floor(Date.now() / 1000)
        };

        const token = JWT.sign(token_data, TOKEN_CONFIG.token_secret, {
            algorithm: TOKEN_CONFIG.token_algo,
            expiresIn: TOKEN_CONFIG.token_expires
        });

        return token;

    } catch (error) {
        LOGGER.module().error('ERROR: [/libs/tokens lib (create)] unable to create token: ' + error.message);
        return null;
    }
};

/**
 * Creates token for shared URL
 * @param {string} uuid - UUID for token subject
 * @returns {string|null} - JWT token or null on failure
 */
exports.create_shared = function (uuid) {

    try {

        if (!validate_uuid(uuid)) {
            LOGGER.module().error('ERROR: [/libs/tokens lib (create_shared)] invalid UUID format');
            return null;
        }

        const trimmed_uuid = uuid.trim();

        const token_data = {
            sub: trimmed_uuid,
            iss: TOKEN_CONFIG.token_issuer,
            type: TOKEN_TYPES.SHARED,
            iat: Math.floor(Date.now() / 1000)
        };

        const token = JWT.sign(token_data, TOKEN_CONFIG.token_secret, {
            algorithm: TOKEN_CONFIG.token_algo,
            expiresIn: '7d'
        });

        return token;

    } catch (error) {
        LOGGER.module().error('ERROR: [/libs/tokens lib (create_shared)] unable to create shared token: ' + error.message);
        return null;
    }
};

/** TODO
 * Creates refresh token
 * @param {string} username - Username for token subject
 * @returns {string|null} - JWT refresh token or null on failure
 */
exports.refresh_token = function (username) {

    try {

        if (!validate_username(username)) {
            LOGGER.module().error('ERROR: [/libs/tokens lib (refresh_token)] invalid username format');
            return null;
        }

        const trimmed_username = username.trim();

        const token_data = {
            sub: trimmed_username,
            iss: TOKEN_CONFIG.token_issuer,
            type: TOKEN_TYPES.REFRESH,
            iat: Math.floor(Date.now() / 1000)
        };

        const token = JWT.sign(token_data, TOKEN_CONFIG.refresh_token_secret, {
            algorithm: TOKEN_CONFIG.token_algo
        });

        return token;

    } catch (error) {
        LOGGER.module().error('ERROR: [/libs/tokens lib (refresh_token)] unable to create refresh token: ' + error.message);
        return null;
    }
};

/**
 * Verifies JWT token from request
 * @param {string} token - JWT token to verify
 * @param {Function} callback - Callback function (error, decoded)
 * @private
 */
function verify_jwt_token(token, callback) {

    if (!token || !VALIDATOR.isJWT(token)) {
        return callback(new Error('Invalid token format'), null);
    }

    JWT.verify(token, TOKEN_CONFIG.token_secret, {
        algorithms: [TOKEN_CONFIG.token_algo]
    }, function (error, decoded) {
        if (error) {
            return callback(error, null);
        }

        // Validate decoded token structure
        if (!decoded || !decoded.sub || !decoded.iss) {
            return callback(new Error('Invalid token payload'), null);
        }

        // Verify issuer matches
        if (decoded.iss !== TOKEN_CONFIG.token_issuer) {
            return callback(new Error('Invalid token issuer'), null);
        }

        callback(null, decoded);
    });
}

/**
 * Validates API key from request
 * @param {string|Array} key - API key from request
 * @returns {boolean} - True if valid
 * @private
 */
function validate_api_key(key) {
    if (!key || !TOKEN_CONFIG.api_key) {
        return false;
    }

    let api_key = key;

    // Handle array input (query string with duplicate keys)
    if (Array.isArray(key)) {
        if (key.length === 0) {
            return false;
        }
        api_key = key[key.length - 1]; // Use last value
    }

    if (typeof api_key !== 'string') {
        return false;
    }

    // Validate format
    if (!VALIDATOR.isAlphanumeric(api_key)) {
        return false;
    }

    // Use constant-time comparison to prevent timing attacks
    return constant_time_compare(api_key, TOKEN_CONFIG.api_key);
}

/**
 * Verifies session token
 * Supports token from:
 *   - Header: x-access-token
 *   - Query parameter: t
 *   - Query parameter: token (for img src URLs)
 *   - API key: api_key query parameter
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.verify = function (req, res, next) {

    if (TEST_AUTH_BYPASS_ENABLED) {
        req.decoded = TEST_BYPASS_DECODED;
        return next();
    }

    const token = req.headers['x-access-token']
        || get_cookie(req, TOKEN_COOKIE_NAME)
        || req.query.t
        || req.query.token;
    const api_key = req.query.api_key;

    // Verify JWT token
    if (token) {
        verify_jwt_token(token, function (error, decoded) {
            if (error) {
                const sanitized_error = sanitize_for_logging(error.message);
                LOGGER.module().error('ERROR: [/libs/tokens lib (verify)] token verification failed: ' + sanitized_error);

                return res.status(401).send({
                    message: 'Unauthorized request'
                });
            }

            // Rolling cookie refresh: re-issue the cookie on every
            // authenticated request so its Max-Age always tracks the
            // JWT's remaining lifetime. Prevents the cookie from
            // expiring before the token and stranding <img> requests.
            exports.set_auth_cookie(res, token);

            req.decoded = decoded;
            return next();
        });
        return;
    }

    // Verify API key
    if (api_key) {

        if (!validate_api_key(api_key)) {
            LOGGER.module().error('ERROR: [/libs/tokens lib (verify)] invalid API key format or value');

            return res.status(401).send({
                message: 'Unauthorized request'
            });
        }

        // Normalize API key if it was an array
        if (Array.isArray(api_key)) {
            req.query.api_key = api_key[api_key.length - 1];
        }

        return next();
    }

    // No valid authentication provided - redirect to SSO
    LOGGER.module().info('INFO: [/libs/tokens lib (verify)] no valid authentication provided, redirecting to SSO');

    // Use URL-safe encoding for redirect parameter
    const encoded_callback = encodeURIComponent(WEBSERVICES_CONFIG.sso_response_url);
    const redirect_url = WEBSERVICES_CONFIG.sso_url + '?app_url=' + encoded_callback;

    res.redirect(redirect_url);
};

/**
 * Verifies session token with query parameter support
 * Does NOT redirect to SSO - returns 401 instead (for API/resource endpoints)
 *
 * Supports token from:
 *   - Header: x-access-token
 *   - Query parameter: token (for img src URLs that cannot set headers)
 *   - Query parameter: t
 *   - API key: api_key query parameter
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.verify_with_query = function (req, res, next) {

    if (TEST_AUTH_BYPASS_ENABLED) {
        req.decoded = TEST_BYPASS_DECODED;
        return next();
    }

    const token = req.headers['x-access-token']
        || get_cookie(req, TOKEN_COOKIE_NAME)
        || req.query.token
        || req.query.t;
    const api_key = req.query.api_key;

    // Verify JWT token
    if (token) {
        verify_jwt_token(token, function (error, decoded) {
            if (error) {
                const sanitized_error = sanitize_for_logging(error.message);
                LOGGER.module().error('ERROR: [/libs/tokens lib (verify_with_query)] token verification failed: ' + sanitized_error);

                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized request',
                    data: null
                });
            }

            // Rolling cookie refresh: see verify() for rationale.
            exports.set_auth_cookie(res, token);

            req.decoded = decoded;
            return next();
        });
        return;
    }

    // Verify API key
    if (api_key) {

        if (!validate_api_key(api_key)) {
            LOGGER.module().error('ERROR: [/libs/tokens lib (verify_with_query)] invalid API key format or value');

            return res.status(401).json({
                success: false,
                message: 'Unauthorized request',
                data: null
            });
        }

        // Normalize API key if it was an array
        if (Array.isArray(api_key)) {
            req.query.api_key = api_key[api_key.length - 1];
        }

        return next();
    }

    // No valid authentication provided - return 401 (no SSO redirect for API endpoints).
    // Logged at info rather than warn: an unauth'd resource request is
    // an ordinary 401, not an alert. A browser whose session cookie
    // expired will emit many of these per page as <img> tags reload.
    LOGGER.module().info('INFO: [/libs/tokens lib (verify_with_query)] no valid authentication provided');

    return res.status(401).json({
        success: false,
        message: 'No token provided',
        data: null
    });
};

/**
 * Verifies token for shared preview URL
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.verify_shared = function (req, res, next) {

    const token = req.query.t;

    if (!token) {
        LOGGER.module().error('ERROR: [/libs/tokens lib (verify_shared)] no token provided');

        return res.status(403).send({
            message: 'Exhibit preview URL has expired or is invalid.'
        });
    }

    verify_jwt_token(token, function (error, decoded) {

        if (error) {
            const sanitized_error = sanitize_for_logging(error.message);
            LOGGER.module().error('ERROR: [/libs/tokens lib (verify_shared)] shared token verification failed: ' + sanitized_error);

            return res.status(403).send({
                message: 'Exhibit preview URL has expired or is invalid.'
            });
        }

        // Validate token type if present
        if (decoded.type && decoded.type !== TOKEN_TYPES.SHARED) {
            LOGGER.module().error('ERROR: [/libs/tokens lib (verify_shared)] invalid token type');

            return res.status(403).send({
                message: 'Invalid preview URL.'
            });
        }

        req.decoded = decoded;
        next();
    });
};

/**
 * Derives the cookie Max-Age from a signed JWT's `exp` claim so the
 * cookie never outlives — or, crucially, undercuts — the token it
 * carries. When the cookie Max-Age was shorter than the JWT lifetime,
 * the cookie would silently expire first and cookie-authenticated
 * requests (media <img> src, preview windows) would 401 even though
 * the user's session was still valid.
 * @param {string} token - Signed JWT
 * @returns {number}     - Cookie Max-Age in seconds
 * @private
 */
function derive_cookie_max_age(token) {

    try {

        const decoded = JWT.decode(token);

        if (decoded && typeof decoded.exp === 'number') {

            const remaining = decoded.exp - Math.floor(Date.now() / 1000);

            if (remaining > TOKEN_COOKIE_MIN_MAX_AGE_SECONDS) {
                return remaining;
            }
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/libs/tokens lib (derive_cookie_max_age)] unable to decode token: ' + error.message);
    }

    return TOKEN_COOKIE_FALLBACK_MAX_AGE_SECONDS;
}

/**
 * Writes the session JWT into an HttpOnly cookie. Lets preview windows
 * and media <img> requests authenticate without the token appearing in
 * URLs, browser history, Referer headers, or access logs.
 * @param {Object} res   - Express response object
 * @param {string} token - Signed JWT
 */
exports.set_auth_cookie = function (res, token) {

    if (!res || typeof token !== 'string' || token.length === 0) {
        return;
    }

    const max_age = derive_cookie_max_age(token);

    const parts = [
        `${TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${max_age}`
    ];

    if (process.env.NODE_ENV === 'production') {
        parts.push('Secure');
    }

    res.append('Set-Cookie', parts.join('; '));
};
