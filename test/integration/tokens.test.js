/**
 * Unit Tests for libs/tokens.js
 *
 * The JWT issue/verify layer gates every route, so these tests exercise
 * the REAL jsonwebtoken sign/verify round trip against a mocked config
 * (known secret, issuer, algorithm) rather than mocking the crypto:
 * token creation and input validation, the three verify middlewares'
 * acceptance/rejection matrix (bad signature, expired, wrong issuer,
 * algorithm confusion, query-string exclusion), API-key handling, the
 * shared-token type check, cookie transport, and the two-key test
 * bypass gate.
 *
 * Lives in the Jest suite (not test/tasks) because the config modules
 * must be mocked at require time and Vitest cannot intercept these CJS
 * require chains — same reason the rest of test/integration is on Jest.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const JWT = require('jsonwebtoken');

const TEST_SECRET = 'unit-test-secret-key-1234567890';
const TEST_ISSUER = 'test-issuer';
const TEST_ALGO = 'HS512';
const TEST_API_KEY = 'testapikey1234567890';
const SSO_URL = 'https://sso.test.du.edu/login';
const SSO_RESPONSE_URL = 'https://app.test.du.edu/exhibits-dashboard/auth/sso';

jest.mock('../../config/token_config', () => () => ({
    token_secret: 'unit-test-secret-key-1234567890',
    refresh_token_secret: 'unit-test-refresh-secret-0987654321',
    token_algo: 'HS512',
    token_expires: '1h',
    token_issuer: 'test-issuer',
    api_key: 'testapikey1234567890'
}));

jest.mock('../../config/webservices_config', () => () => ({
    sso_url: 'https://sso.test.du.edu/login',
    sso_response_url: 'https://app.test.du.edu/exhibits-dashboard/auth/sso'
}));

jest.mock('../../libs/log4', () => ({
    module: () => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    })
}));

const TOKENS = require('../../libs/tokens');

/*
 * Builds mock req/res and a promise that settles when the middleware
 * concludes — via next(), a status().send/json, or a redirect.
 */
function run_middleware(middleware, { headers = {}, query = {} } = {}) {

    return new Promise((resolve) => {

        const req = { headers, query };

        const res = {
            status_code: null,
            body: null,
            redirect_url: null,
            cookies: [],
            status(code) {
                this.status_code = code;
                return this;
            },
            send(body) {
                this.body = body;
                resolve({ outcome: 'response', req, res });
            },
            json(body) {
                this.body = body;
                resolve({ outcome: 'response', req, res });
            },
            redirect(url) {
                this.redirect_url = url;
                resolve({ outcome: 'redirect', req, res });
            },
            append(name, value) {
                if (name === 'Set-Cookie') {
                    this.cookies.push(value);
                }
            }
        };

        middleware(req, res, () => resolve({ outcome: 'next', req, res }));
    });
}

function sign_token(payload = {}, options = {}, secret = TEST_SECRET) {
    return JWT.sign(
        { sub: 'test.user', iss: TEST_ISSUER, type: 'session', ...payload },
        secret,
        { algorithm: TEST_ALGO, expiresIn: '1h', ...options }
    );
}

describe('libs/tokens', () => {

    // ==================== TOKEN CREATION ====================

    describe('create', () => {

        it('issues a session JWT that verifies against the configured secret and issuer', () => {
            const token = TOKENS.create('test.user@du.edu');

            expect(token).not.toBeNull();
            const decoded = JWT.verify(token, TEST_SECRET, { algorithms: [TEST_ALGO] });
            expect(decoded.sub).toBe('test.user@du.edu');
            expect(decoded.iss).toBe(TEST_ISSUER);
            expect(decoded.type).toBe('session');
            expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
        });

        it('trims surrounding whitespace from the username', () => {
            const token = TOKENS.create('  test.user  ');

            expect(JWT.decode(token).sub).toBe('test.user');
        });

        it('rejects invalid usernames', () => {
            const invalid = [null, undefined, '', '   ', 123, 'bad user', 'user;drop', 'user\nname', 'x'.repeat(300)];
            for (const username of invalid) {
                expect(TOKENS.create(username)).toBeNull();
            }
        });
    });

    describe('create_shared', () => {

        it('issues a shared-type JWT for a valid UUID', () => {
            const uuid = '550e8400-e29b-41d4-a716-446655440000';
            const token = TOKENS.create_shared(uuid);

            const decoded = JWT.verify(token, TEST_SECRET, { algorithms: [TEST_ALGO] });
            expect(decoded.sub).toBe(uuid);
            expect(decoded.type).toBe('shared');
        });

        it('rejects non-UUID subjects', () => {
            for (const bad of [null, '', 'not-a-uuid', 'test.user', '550e8400']) {
                expect(TOKENS.create_shared(bad)).toBeNull();
            }
        });
    });

    describe('refresh_token', () => {

        it('signs with the refresh secret and refresh type', () => {
            const token = TOKENS.refresh_token('test.user');

            expect(() => JWT.verify(token, TEST_SECRET, { algorithms: [TEST_ALGO] })).toThrow();
            const decoded = JWT.verify(token, 'unit-test-refresh-secret-0987654321', { algorithms: [TEST_ALGO] });
            expect(decoded.type).toBe('refresh');
        });
    });

    // ==================== verify() ====================

    describe('verify middleware', () => {

        it('accepts a valid token from the x-access-token header and decodes it onto req', async () => {
            const token = sign_token();

            const { outcome, req } = await run_middleware(TOKENS.verify, {
                headers: { 'x-access-token': token }
            });

            expect(outcome).toBe('next');
            expect(req.decoded.sub).toBe('test.user');
            expect(req.decoded.iss).toBe(TEST_ISSUER);
        });

        it('accepts a valid token from the exhibits_token cookie', async () => {
            const token = sign_token();

            const { outcome, req } = await run_middleware(TOKENS.verify, {
                headers: { cookie: `other=1; exhibits_token=${encodeURIComponent(token)}` }
            });

            expect(outcome).toBe('next');
            expect(req.decoded.sub).toBe('test.user');
        });

        it('re-issues the auth cookie on every authenticated request (rolling refresh)', async () => {
            const token = sign_token();

            const { res } = await run_middleware(TOKENS.verify, {
                headers: { 'x-access-token': token }
            });

            expect(res.cookies.length).toBe(1);
            expect(res.cookies[0]).toContain('exhibits_token=');
            expect(res.cookies[0]).toContain('HttpOnly');
        });

        it('rejects a token signed with a different secret with 401', async () => {
            const token = sign_token({}, {}, 'wrong-secret-abcdefghij1234567890');

            const { outcome, res } = await run_middleware(TOKENS.verify, {
                headers: { 'x-access-token': token }
            });

            expect(outcome).toBe('response');
            expect(res.status_code).toBe(401);
        });

        it('rejects an expired token with 401', async () => {
            const token = sign_token({}, { expiresIn: '-1h' });

            const { res } = await run_middleware(TOKENS.verify, {
                headers: { 'x-access-token': token }
            });

            expect(res.status_code).toBe(401);
        });

        it('rejects a token from a different issuer with 401', async () => {
            const token = JWT.sign(
                { sub: 'test.user', iss: 'evil-issuer', type: 'session' },
                TEST_SECRET,
                { algorithm: TEST_ALGO, expiresIn: '1h' }
            );

            const { res } = await run_middleware(TOKENS.verify, {
                headers: { 'x-access-token': token }
            });

            expect(res.status_code).toBe(401);
        });

        it('rejects a token signed with a different algorithm (algorithm confusion) with 401', async () => {
            const token = JWT.sign(
                { sub: 'test.user', iss: TEST_ISSUER, type: 'session' },
                TEST_SECRET,
                { algorithm: 'HS256', expiresIn: '1h' }
            );

            const { res } = await run_middleware(TOKENS.verify, {
                headers: { 'x-access-token': token }
            });

            expect(res.status_code).toBe(401);
        });

        it('rejects garbage that is not a JWT with 401', async () => {
            const { res } = await run_middleware(TOKENS.verify, {
                headers: { 'x-access-token': 'not-a-jwt' }
            });

            expect(res.status_code).toBe(401);
        });

        it('does NOT accept a session token from the query string (leak prevention)', async () => {
            const token = sign_token();

            const { outcome, res } = await run_middleware(TOKENS.verify, {
                query: { t: token, token }
            });

            // No header/cookie auth → falls through to the SSO redirect,
            // proving the query string is never consulted.
            expect(outcome).toBe('redirect');
            expect(res.redirect_url).toContain(SSO_URL);
        });

        it('accepts a valid api_key query parameter', async () => {
            const { outcome } = await run_middleware(TOKENS.verify, {
                query: { api_key: TEST_API_KEY }
            });

            expect(outcome).toBe('next');
        });

        it('uses the last value when api_key arrives as an array and normalizes req.query', async () => {
            const { outcome, req } = await run_middleware(TOKENS.verify, {
                query: { api_key: ['bogus', TEST_API_KEY] }
            });

            expect(outcome).toBe('next');
            expect(req.query.api_key).toBe(TEST_API_KEY);
        });

        it('rejects a wrong api_key with 401', async () => {
            const { res } = await run_middleware(TOKENS.verify, {
                query: { api_key: 'wrongkey1234567890' }
            });

            expect(res.status_code).toBe(401);
        });

        it('redirects to SSO with the encoded callback when no credentials are supplied', async () => {
            const { outcome, res } = await run_middleware(TOKENS.verify);

            expect(outcome).toBe('redirect');
            expect(res.redirect_url).toBe(
                `${SSO_URL}?app_url=${encodeURIComponent(SSO_RESPONSE_URL)}`
            );
        });
    });

    // ==================== verify_page() ====================

    describe('verify middleware — token type is enforced (C3, review 2026-09-02)', () => {

        it('rejects a shared-preview token presented as a session with 401', async () => {
            const shared = TOKENS.create_shared('550e8400-e29b-41d4-a716-446655440000');

            const { res } = await run_middleware(TOKENS.verify, {
                headers: { 'x-access-token': shared }
            });

            expect(res.status_code).toBe(401);
        });

        it('rejects a shared-preview token delivered via the session cookie', async () => {
            const shared = TOKENS.create_shared('550e8400-e29b-41d4-a716-446655440000');

            const { res } = await run_middleware(TOKENS.verify, {
                headers: { cookie: `exhibits_token=${encodeURIComponent(shared)}` }
            });

            expect(res.status_code).toBe(401);
        });

        it('rejects a correctly signed token that carries no type claim', async () => {
            const untyped = JWT.sign({ sub: 'test.user', iss: TEST_ISSUER }, TEST_SECRET, { algorithm: TEST_ALGO, expiresIn: '1h' });

            const { res } = await run_middleware(TOKENS.verify, {
                headers: { 'x-access-token': untyped }
            });

            expect(res.status_code).toBe(401);
        });

        it('rejects a refresh-type token presented as a session', async () => {
            const refresh = sign_token({ type: 'refresh' });

            const { res } = await run_middleware(TOKENS.verify, {
                headers: { 'x-access-token': refresh }
            });

            expect(res.status_code).toBe(401);
        });
    });

    describe('verify_page middleware', () => {

        it('accepts a valid cookie token', async () => {
            const token = sign_token();

            const { outcome, req } = await run_middleware(TOKENS.verify_page, {
                headers: { cookie: `exhibits_token=${encodeURIComponent(token)}` }
            });

            expect(outcome).toBe('next');
            expect(req.decoded.sub).toBe('test.user');
        });

        it('redirects to SSO instead of 401 when the token is missing', async () => {
            const { outcome, res } = await run_middleware(TOKENS.verify_page);

            expect(outcome).toBe('redirect');
            expect(res.redirect_url).toContain(SSO_URL);
        });

        it('redirects to SSO instead of 401 when the token is invalid', async () => {
            const token = sign_token({}, { expiresIn: '-1h' });

            const { outcome, res } = await run_middleware(TOKENS.verify_page, {
                headers: { 'x-access-token': token }
            });

            expect(outcome).toBe('redirect');
            expect(res.redirect_url).toContain(SSO_URL);
        });
    });

    // ==================== verify_with_query() ====================

    describe('verify_page middleware — token type is enforced', () => {

        it('redirects to SSO when a shared-preview token is used as a page session', async () => {
            const shared = TOKENS.create_shared('550e8400-e29b-41d4-a716-446655440000');

            const { outcome, res } = await run_middleware(TOKENS.verify_page, {
                headers: { cookie: `exhibits_token=${encodeURIComponent(shared)}` }
            });

            expect(outcome).toBe('redirect');
            expect(res.redirect_url.startsWith(SSO_URL)).toBe(true);
        });
    });

    describe('verify_with_query middleware', () => {

        it('accepts a valid token from the token query parameter (img src transport)', async () => {
            const token = sign_token();

            const { outcome, req } = await run_middleware(TOKENS.verify_with_query, {
                query: { token }
            });

            expect(outcome).toBe('next');
            expect(req.decoded.sub).toBe('test.user');
        });

        it('accepts a valid token from the t query parameter', async () => {
            const token = sign_token();

            const { outcome } = await run_middleware(TOKENS.verify_with_query, {
                query: { t: token }
            });

            expect(outcome).toBe('next');
        });

        it('returns a 401 JSON envelope (no SSO redirect) when no credentials are supplied', async () => {
            const { outcome, res } = await run_middleware(TOKENS.verify_with_query);

            expect(outcome).toBe('response');
            expect(res.status_code).toBe(401);
            expect(res.body).toEqual({ success: false, message: 'No token provided', data: null });
        });

        it('rejects an invalid token with a 401 JSON envelope', async () => {
            const { res } = await run_middleware(TOKENS.verify_with_query, {
                query: { token: 'not-a-jwt' }
            });

            expect(res.status_code).toBe(401);
            expect(res.body).toMatchObject({ success: false });
        });
    });

    // ==================== verify_shared() ====================

    describe('verify_with_query middleware — token type is enforced', () => {

        it('rejects a shared-preview token in the t query parameter with 401', async () => {
            const shared = TOKENS.create_shared('550e8400-e29b-41d4-a716-446655440000');

            const { res } = await run_middleware(TOKENS.verify_with_query, {
                query: { t: shared }
            });

            expect(res.status_code).toBe(401);
        });
    });

    describe('verify_shared middleware', () => {

        it('accepts a shared-type token from the t query parameter', async () => {
            const token = TOKENS.create_shared('550e8400-e29b-41d4-a716-446655440000');

            const { outcome, req } = await run_middleware(TOKENS.verify_shared, {
                query: { t: token }
            });

            expect(outcome).toBe('next');
            expect(req.decoded.type).toBe('shared');
        });

        it('rejects a session token used as a share link with 403 (type check)', async () => {
            const token = sign_token({ type: 'session' });

            const { res } = await run_middleware(TOKENS.verify_shared, {
                query: { t: token }
            });

            expect(res.status_code).toBe(403);
            /* Type mismatch is reported like any other invalid share token — no hint which check failed. */
            expect(res.body.message).toBe('Exhibit preview URL has expired or is invalid.');
        });

        it('rejects a token with NO type claim (type is required, not optional)', async () => {
            const untyped = JWT.sign({ sub: '550e8400-e29b-41d4-a716-446655440000', iss: TEST_ISSUER }, TEST_SECRET, { algorithm: TEST_ALGO, expiresIn: '1h' });

            const { res } = await run_middleware(TOKENS.verify_shared, {
                query: { t: untyped }
            });

            expect(res.status_code).toBe(403);
        });

        it('rejects a missing token with 403', async () => {
            const { res } = await run_middleware(TOKENS.verify_shared);

            expect(res.status_code).toBe(403);
        });

        it('rejects an expired shared token with 403', async () => {
            const token = sign_token({ type: 'shared' }, { expiresIn: '-1h' });

            const { res } = await run_middleware(TOKENS.verify_shared, {
                query: { t: token }
            });

            expect(res.status_code).toBe(403);
        });
    });

    // ==================== set_auth_cookie() ====================

    describe('set_auth_cookie', () => {

        function capture_cookie(token) {
            const cookies = [];
            TOKENS.set_auth_cookie({
                append: (name, value) => { if (name === 'Set-Cookie') cookies.push(value); }
            }, token);
            return cookies;
        }

        it('writes an HttpOnly SameSite=Lax cookie whose Max-Age tracks the JWT exp', () => {
            const token = sign_token({}, { expiresIn: '1h' });

            const cookies = capture_cookie(token);

            expect(cookies.length).toBe(1);
            expect(cookies[0]).toContain('HttpOnly');
            expect(cookies[0]).toContain('SameSite=Lax');
            expect(cookies[0]).toContain('Path=/');
            const max_age = Number(cookies[0].match(/Max-Age=(\d+)/)[1]);
            expect(max_age).toBeGreaterThan(3500);
            expect(max_age).toBeLessThanOrEqual(3600);
        });

        it('falls back to the 8h default when the remaining lifetime is under the floor', () => {
            const token = sign_token({}, { expiresIn: '30s' });

            const cookies = capture_cookie(token);

            const max_age = Number(cookies[0].match(/Max-Age=(\d+)/)[1]);
            expect(max_age).toBe(8 * 60 * 60);
        });

        it('omits the Secure flag outside production', () => {
            const cookies = capture_cookie(sign_token());

            expect(cookies[0]).not.toContain('Secure');
        });

        it('is a no-op for a missing response or empty token', () => {
            expect(() => TOKENS.set_auth_cookie(null, 'x')).not.toThrow();
            expect(capture_cookie('')).toEqual([]);
        });
    });

    // ==================== TEST BYPASS GATE ====================

    describe('test auth bypass two-key gate', () => {

        const load_fresh_tokens = () => {
            jest.resetModules();
            // eslint-disable-next-line global-require
            return require('../../libs/tokens');
        };

        afterEach(() => {
            delete process.env.EXHIBITS_TEST_AUTH_BYPASS;
            jest.resetModules();
        });

        it('stays OFF when only NODE_ENV=test is set (vitest default env)', async () => {
            expect(process.env.NODE_ENV).toBe('test');

            const fresh = load_fresh_tokens();
            const { outcome } = await run_middleware(fresh.verify);

            // Without the dedicated flag, an unauthenticated request still
            // redirects to SSO — NODE_ENV alone cannot disarm auth.
            expect(outcome).toBe('redirect');
        });

        it('arms only when BOTH keys are set, injecting the synthetic session', async () => {
            jest.spyOn(console, 'warn').mockImplementation(() => {});
            process.env.EXHIBITS_TEST_AUTH_BYPASS = '1';

            const fresh = load_fresh_tokens();
            const { outcome, req } = await run_middleware(fresh.verify);

            expect(outcome).toBe('next');
            expect(req.decoded.sub).toBe('pw-test-user');
        });
    });
});
