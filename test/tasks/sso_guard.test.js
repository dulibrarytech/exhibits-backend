/**
 * SSO callback guard (auth/sso_guard.js) — OWASP A07 / C2.
 *
 * The guard reads its config from env at module-load time, so each test sets
 * env, resets the module registry, and re-imports a fresh instance.
 */

'use strict';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../libs/log4', () => ({
    module: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() })
}));

const GUARD_KEYS = [
    'NODE_ENV', 'SSO_HOST_IP', 'SSO_GATEWAY_SECRET',
    'SSO_GATEWAY_HEADER', 'SSO_CLIENT_IP_HEADER'
];

const saved = {};

beforeEach(() => {
    GUARD_KEYS.forEach(k => { saved[k] = process.env[k]; delete process.env[k]; });
});

afterEach(() => {
    GUARD_KEYS.forEach(k => {
        if (saved[k] === undefined) { delete process.env[k]; }
        else { process.env[k] = saved[k]; }
    });
});

// Load a fresh guard instance under the given env (dynamic import + resetModules
// so the module re-reads process.env at load time).
const load = async (env) => {
    Object.entries(env).forEach(([k, v]) => { process.env[k] = v; });
    vi.resetModules();
    const mod = await import('../../auth/sso_guard.js');
    return mod.default;
};

const make_req = ({ ip = '127.0.0.1', headers = {} } = {}) => {
    const lower = {};
    Object.keys(headers).forEach(k => { lower[k.toLowerCase()] = headers[k]; });
    return { ip, get: (name) => lower[String(name).toLowerCase()] };
};

const make_res = () => {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
};

describe('sso_guard', () => {

    describe('unconfigured', () => {
        it('fails closed (503) in production when neither control is set', async () => {
            const guard = await load({ NODE_ENV: 'production' });
            const res = make_res(); const next = vi.fn();
            guard(make_req(), res, next);
            expect(res.status).toHaveBeenCalledWith(503);
            expect(next).not.toHaveBeenCalled();
        });

        it('allows (permissive) in non-production when nothing is set', async () => {
            const guard = await load({ NODE_ENV: 'development' });
            const res = make_res(); const next = vi.fn();
            guard(make_req(), res, next);
            expect(next).toHaveBeenCalledOnce();
            expect(res.status).not.toHaveBeenCalled();
        });
    });

    describe('shared-secret header', () => {
        it('allows when the secret header matches', async () => {
            const guard = await load({ NODE_ENV: 'production', SSO_GATEWAY_SECRET: 's3cret-value' });
            const res = make_res(); const next = vi.fn();
            guard(make_req({ headers: { 'x-sso-gateway-secret': 's3cret-value' } }), res, next);
            expect(next).toHaveBeenCalledOnce();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('rejects (403) when the secret header is missing', async () => {
            const guard = await load({ NODE_ENV: 'production', SSO_GATEWAY_SECRET: 's3cret-value' });
            const res = make_res(); const next = vi.fn();
            guard(make_req(), res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it('rejects (403) when the secret header is wrong', async () => {
            const guard = await load({ NODE_ENV: 'production', SSO_GATEWAY_SECRET: 's3cret-value' });
            const res = make_res(); const next = vi.fn();
            guard(make_req({ headers: { 'x-sso-gateway-secret': 'nope' } }), res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it('honors a custom header name via SSO_GATEWAY_HEADER', async () => {
            const guard = await load({ NODE_ENV: 'production', SSO_GATEWAY_SECRET: 'abc', SSO_GATEWAY_HEADER: 'X-Internal-Auth' });
            const res = make_res(); const next = vi.fn();
            guard(make_req({ headers: { 'x-internal-auth': 'abc' } }), res, next);
            expect(next).toHaveBeenCalledOnce();
        });
    });

    describe('IP allowlist', () => {
        it('allows when req.ip is in the allowlist', async () => {
            const guard = await load({ NODE_ENV: 'production', SSO_HOST_IP: '10.0.0.5, 10.0.0.6' });
            const res = make_res(); const next = vi.fn();
            guard(make_req({ ip: '10.0.0.6' }), res, next);
            expect(next).toHaveBeenCalledOnce();
        });

        it('rejects (403) when req.ip is not in the allowlist', async () => {
            const guard = await load({ NODE_ENV: 'production', SSO_HOST_IP: '10.0.0.5' });
            const res = make_res(); const next = vi.fn();
            guard(make_req({ ip: '203.0.113.9' }), res, next);
            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('normalizes IPv4-mapped IPv6 (::ffff:) before comparing', async () => {
            const guard = await load({ NODE_ENV: 'production', SSO_HOST_IP: '10.0.0.5' });
            const res = make_res(); const next = vi.fn();
            guard(make_req({ ip: '::ffff:10.0.0.5' }), res, next);
            expect(next).toHaveBeenCalledOnce();
        });

        it('reads the source from SSO_CLIENT_IP_HEADER when set', async () => {
            const guard = await load({ NODE_ENV: 'production', SSO_HOST_IP: '10.0.0.5', SSO_CLIENT_IP_HEADER: 'X-Real-IP' });
            const res = make_res(); const next = vi.fn();
            // req.ip is loopback, but the trusted header carries the real source.
            guard(make_req({ ip: '127.0.0.1', headers: { 'x-real-ip': '10.0.0.5' } }), res, next);
            expect(next).toHaveBeenCalledOnce();
        });
    });

    describe('both controls configured (AND)', () => {
        it('allows only when secret AND ip both pass', async () => {
            const guard = await load({ NODE_ENV: 'production', SSO_GATEWAY_SECRET: 'abc', SSO_HOST_IP: '10.0.0.5' });
            const res = make_res(); const next = vi.fn();
            guard(make_req({ ip: '10.0.0.5', headers: { 'x-sso-gateway-secret': 'abc' } }), res, next);
            expect(next).toHaveBeenCalledOnce();
        });

        it('rejects when the secret passes but the ip fails', async () => {
            const guard = await load({ NODE_ENV: 'production', SSO_GATEWAY_SECRET: 'abc', SSO_HOST_IP: '10.0.0.5' });
            const res = make_res(); const next = vi.fn();
            guard(make_req({ ip: '203.0.113.9', headers: { 'x-sso-gateway-secret': 'abc' } }), res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('helpers', () => {
        it('normalize_ip folds ::1 to 127.0.0.1 and strips ::ffff:', async () => {
            const mod = await import('../../auth/sso_guard.js');
            const normalize_ip = mod.default.normalize_ip;
            expect(normalize_ip('::1')).toBe('127.0.0.1');
            expect(normalize_ip('::ffff:192.168.1.1')).toBe('192.168.1.1');
            expect(normalize_ip('  10.1.2.3 ')).toBe('10.1.2.3');
            expect(normalize_ip(undefined)).toBe('');
        });

        it('secrets_match is true only for exact equal-length matches', async () => {
            const mod = await import('../../auth/sso_guard.js');
            const secrets_match = mod.default.secrets_match;
            expect(secrets_match('abc', 'abc')).toBe(true);
            expect(secrets_match('abc', 'abd')).toBe(false);
            expect(secrets_match('abc', 'abcd')).toBe(false);
            expect(secrets_match('', '')).toBe(true);
        });
    });
});
