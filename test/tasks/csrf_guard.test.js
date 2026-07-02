/**
 * CSRF guard middleware (config/csrf_guard.js) — OWASP A04/H4.
 *
 * Verifies the Origin/Referer first-party check on state-changing methods:
 * safe methods pass, same-origin mutations pass, cross-origin mutations are
 * blocked with 403, non-browser (no Origin/Referer) requests pass, and the
 * SSO callback + test-bypass + configurable trusted origins/exempt paths are
 * honored.
 */

'use strict';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../libs/log4', () => ({
    module: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() })
}));

const CSRF_GUARD = require('../../config/csrf_guard');

const APP_HOST = 'exhibits.du.edu';

// Build a mock request. headers is a case-insensitive-ish lookup for the few
// headers the guard reads (origin, referer, host).
const make_req = ({ method = 'POST', path = '/exhibits-dashboard/api/v1/exhibits', headers = {}, hostname = APP_HOST } = {}) => {
    const lower = {};
    Object.keys(headers).forEach(k => { lower[k.toLowerCase()] = headers[k]; });
    if (!('host' in lower)) {
        lower.host = APP_HOST;
    }
    return {
        method,
        path,
        hostname,
        get: (name) => lower[String(name).toLowerCase()]
    };
};

const make_res = () => {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
};

beforeEach(() => {
    delete process.env.EXHIBITS_TEST_AUTH_BYPASS;
    delete process.env.CSRF_TRUSTED_ORIGINS;
    delete process.env.CSRF_EXEMPT_PATHS;
});

afterEach(() => {
    delete process.env.EXHIBITS_TEST_AUTH_BYPASS;
    delete process.env.CSRF_TRUSTED_ORIGINS;
    delete process.env.CSRF_EXEMPT_PATHS;
});

describe('csrf_guard', () => {

    it('allows safe methods (GET) regardless of origin', () => {
        const next = vi.fn();
        const res = make_res();
        CSRF_GUARD(make_req({ method: 'GET', headers: { origin: 'https://evil.example' } }), res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('allows a same-origin POST (Origin host === Host)', () => {
        const next = vi.fn();
        const res = make_res();
        CSRF_GUARD(make_req({ headers: { origin: `https://${APP_HOST}`, host: APP_HOST } }), res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('blocks a cross-origin POST with 403', () => {
        const next = vi.fn();
        const res = make_res();
        CSRF_GUARD(make_req({ headers: { origin: 'https://evil.example', host: APP_HOST } }), res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('blocks a cross-origin request stated via Referer', () => {
        const next = vi.fn();
        const res = make_res();
        CSRF_GUARD(make_req({ headers: { referer: 'https://evil.example/attack.html', host: APP_HOST } }), res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('allows a POST with no Origin and no Referer (non-browser / server-to-server)', () => {
        const next = vi.fn();
        const res = make_res();
        CSRF_GUARD(make_req({ headers: { host: APP_HOST } }), res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('exempts the SSO callback even when cross-origin', () => {
        const next = vi.fn();
        const res = make_res();
        CSRF_GUARD(make_req({ path: '/exhibits-dashboard/auth/sso', headers: { origin: 'https://idp.du.edu', host: APP_HOST } }), res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('skips the check under the e2e/test bypass', () => {
        process.env.EXHIBITS_TEST_AUTH_BYPASS = '1';
        const next = vi.fn();
        const res = make_res();
        CSRF_GUARD(make_req({ headers: { origin: 'https://evil.example', host: APP_HOST } }), res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('matches the Origin against req.hostname (X-Forwarded-Host behind a proxy)', () => {
        // Host header is the internal proxy target; hostname reflects X-Forwarded-Host.
        const next = vi.fn();
        const res = make_res();
        CSRF_GUARD(make_req({
            headers: { origin: `https://${APP_HOST}`, host: 'internal-app:8004' },
            hostname: APP_HOST
        }), res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('honors CSRF_TRUSTED_ORIGINS for an additional first-party origin', () => {
        process.env.CSRF_TRUSTED_ORIGINS = 'https://public-app.du.edu, https://another.du.edu';
        const next = vi.fn();
        const res = make_res();
        CSRF_GUARD(make_req({ headers: { origin: 'https://public-app.du.edu', host: APP_HOST } }), res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('honors CSRF_EXEMPT_PATHS', () => {
        process.env.CSRF_EXEMPT_PATHS = '/webhook/ingest';
        const next = vi.fn();
        const res = make_res();
        CSRF_GUARD(make_req({ path: '/exhibits-dashboard/webhook/ingest', headers: { origin: 'https://partner.example', host: APP_HOST } }), res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('blocks a cross-origin DELETE (unsafe method other than POST)', () => {
        const next = vi.fn();
        const res = make_res();
        CSRF_GUARD(make_req({ method: 'DELETE', headers: { origin: 'https://evil.example', host: APP_HOST } }), res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });
});
