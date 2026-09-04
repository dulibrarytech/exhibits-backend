// @vitest-environment jsdom
//
// Unit coverage for httpModule.api — the token-injecting envelope over
// httpModule.req (Phase 1 DRY, cluster C7).
//
// Loader pattern matches helper.module.test.js: read the IIFE source,
// rewrite the const assignment so the export survives eval, and evaluate
// inside the jsdom window. `axios`, `authModule` and `domModule` are bare
// globals the module resolves at call time, so they are stubbed on
// globalThis before the eval.

'use strict';

const { load_browser_module } = require('./helpers/load_module');

describe('httpModule.api', () => {

    let axios_mock;
    let token;

    beforeAll(() => {
        axios_mock = vi.fn(async (request) => ({ status: 200, data: { ok: true }, config: request }));
        globalThis.axios = (request) => axios_mock(request);

        load_browser_module('public/app/utils/http.module.js', 'httpModule');
    });

    beforeEach(() => {
        token = 'unit-test-token';
        axios_mock.mockClear();
        globalThis.authModule = {
            get_user_token: vi.fn(() => token),
            redirect_to_auth: vi.fn(),
            logout: vi.fn(),
        };
        globalThis.domModule = {
            set_alert: vi.fn(),
        };
        document.body.innerHTML = '<div id="message"></div>';
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('injects Content-Type, x-access-token, timeout 30000 and the permissive validateStatus', async () => {
        const response = await globalThis.httpModule.api({ method: 'POST', url: '/x', data: { a: 1 } });

        expect(axios_mock).toHaveBeenCalledTimes(1);
        const request = axios_mock.mock.calls[0][0];
        expect(request.method).toBe('POST');
        expect(request.url).toBe('/x');
        expect(request.data).toEqual({ a: 1 });
        expect(request.timeout).toBe(30000);
        expect(request.headers['Content-Type']).toBe('application/json');
        expect(request.headers['x-access-token']).toBe('unit-test-token');
        expect(typeof request.validateStatus).toBe('function');
        expect(request.validateStatus(200)).toBe(true);
        expect(request.validateStatus(404)).toBe(true);
        expect(request.validateStatus(599)).toBe(true);
        expect(request.validateStatus(199)).toBe(false);
        expect(request.validateStatus(600)).toBe(false);

        // Response object is returned unchanged.
        expect(response.status).toBe(200);
        expect(response.data).toEqual({ ok: true });
    });

    it('defaults method to GET and omits data when none is given', async () => {
        await globalThis.httpModule.api({ url: '/y' });
        const request = axios_mock.mock.calls[0][0];
        expect(request.method).toBe('GET');
        expect('data' in request).toBe(false);
    });

    it('merges caller headers over the defaults and honours caller timeout / validateStatus', async () => {
        const custom_validate = (s) => s === 200;
        await globalThis.httpModule.api({
            url: '/z',
            timeout: 5000,
            headers: { 'Content-Type': 'multipart/form-data', 'X-Extra': '1' },
            validateStatus: custom_validate,
        });
        const request = axios_mock.mock.calls[0][0];
        expect(request.timeout).toBe(5000);
        expect(request.headers['Content-Type']).toBe('multipart/form-data');
        expect(request.headers['X-Extra']).toBe('1');
        expect(request.headers['x-access-token']).toBe('unit-test-token');
        expect(request.validateStatus).toBe(custom_validate);
    });

    it('passes other axios config keys through untouched and strips the wrapper-only option', async () => {
        const controller = new AbortController();
        await globalThis.httpModule.api({
            url: '/p',
            params: { q: 'x' },
            responseType: 'blob',
            signal: controller.signal,
            logout_on_missing_token: true,
        });
        const request = axios_mock.mock.calls[0][0];
        expect(request.params).toEqual({ q: 'x' });
        expect(request.responseType).toBe('blob');
        expect(request.signal).toBe(controller.signal);
        expect('logout_on_missing_token' in request).toBe(false);
    });

    it('returns a 4xx/5xx response rather than throwing', async () => {
        axios_mock.mockImplementationOnce(async () => ({ status: 500, data: { message: 'boom' } }));
        const response = await globalThis.httpModule.api({ url: '/err' });
        expect(response.status).toBe(500);
        expect(response.data.message).toBe('boom');
    });

    it('missing token: alerts in #message, schedules authModule.logout() after 1000 ms, resolves null, never calls axios', async () => {
        vi.useFakeTimers();
        token = null;

        const response = await globalThis.httpModule.api({ url: '/needs-auth' });

        expect(response).toBeNull();
        expect(axios_mock).not.toHaveBeenCalled();
        expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
            '#message', 'danger', 'Session expired. Please log in again.',
        );
        expect(globalThis.authModule.logout).not.toHaveBeenCalled();
        vi.advanceTimersByTime(999);
        expect(globalThis.authModule.logout).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(globalThis.authModule.logout).toHaveBeenCalledTimes(1);
    });

    it('missing token with logout_on_missing_token=false: resolves null silently', async () => {
        vi.useFakeTimers();
        token = '';

        const response = await globalThis.httpModule.api({ url: '/quiet', logout_on_missing_token: false });

        expect(response).toBeNull();
        expect(axios_mock).not.toHaveBeenCalled();
        expect(globalThis.domModule.set_alert).not.toHaveBeenCalled();
        vi.advanceTimersByTime(5000);
        expect(globalThis.authModule.logout).not.toHaveBeenCalled();
    });

    it('missing token with no #message container: still logs out, no alert', async () => {
        vi.useFakeTimers();
        token = null;
        document.body.innerHTML = '';

        await globalThis.httpModule.api({ url: '/needs-auth' });

        expect(globalThis.domModule.set_alert).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1000);
        expect(globalThis.authModule.logout).toHaveBeenCalledTimes(1);
    });

    it('delegates to req: a 401 rejection triggers redirect_to_auth and resolves undefined', async () => {
        axios_mock.mockImplementationOnce(async () => {
            const error = new Error('Unauthorized');
            error.response = { status: 401 };
            throw error;
        });
        const response = await globalThis.httpModule.api({ url: '/expired' });
        expect(response).toBeUndefined();
        expect(globalThis.authModule.redirect_to_auth).toHaveBeenCalledTimes(1);
    });

    it('a 401 that RESOLVES under the permissive validateStatus still redirects and resolves undefined', async () => {
        /* Regression: api() installs accept-any-status, so axios resolves a 401
         * instead of throwing; req's catch-block redirect must not be bypassed. */
        axios_mock.mockImplementationOnce(async () => ({ status: 401, data: { message: 'expired' } }));
        const response = await globalThis.httpModule.api({ url: '/expired-resolved' });
        expect(response).toBeUndefined();
        expect(globalThis.authModule.redirect_to_auth).toHaveBeenCalledTimes(1);
    });

    it('delegates to req: a network failure resolves undefined', async () => {
        axios_mock.mockImplementationOnce(async () => {
            throw new Error('Network Error');
        });
        const response = await globalThis.httpModule.api({ url: '/offline' });
        expect(response).toBeUndefined();
    });

    it('leaves req behaviour unchanged (no header injection)', async () => {
        await globalThis.httpModule.req({ method: 'GET', url: '/raw' });
        const request = axios_mock.mock.calls[0][0];
        expect(request.headers).toBeUndefined();
        expect(request.timeout).toBeUndefined();
    });
});
