// @vitest-environment jsdom
//
// Unit coverage for the lock trio hoisted into lockModule (Phase 1 DRY,
// cluster C10) — is_user_administrator / is_locked_by_other_user /
// disable_form_fields — plus a pin that unlock_record now builds its URL
// through endpointsModule.build (cluster C8) with unchanged output.
//
// Loader pattern matches helper.module.test.js. authModule, endpointsModule,
// helperModule, httpModule and rteModule are bare globals the module resolves
// at call time, so they're stubbed on globalThis before each test.

'use strict';

const { load_browser_module } = require('./helpers/load_module');

function make_storage() {
    let map = {};
    return {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null),
        setItem: (k, v) => { map[k] = String(v); },
        removeItem: (k) => { delete map[k]; },
        clear: () => { map = {}; },
    };
}

describe('lockModule', () => {

    beforeAll(() => {
        Object.defineProperty(window, 'localStorage', { configurable: true, value: make_storage() });
        Object.defineProperty(window, 'sessionStorage', { configurable: true, value: make_storage() });

        // Real endpointsModule so the unlock_record pin exercises the promoted build().
        load_browser_module('public/app/utils/endpoints.module.js', 'endpointsModule');

        load_browser_module('public/app/utils/lock.module.js', 'lockModule');
    });

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});
        document.body.innerHTML = '';
        globalThis.authModule = {
            get_user_profile_data: vi.fn(() => ({ uid: '12', name: 'Unit Tester' })),
            get_user_token: vi.fn(() => 'unit-test-token'),
            get_user_role: vi.fn(async () => 'Student'),
            is_administrator: vi.fn(async () => false),
        };
        delete globalThis.rteModule;
    });

    // ───────────────────────── is_locked_by_other_user ─────────────────────────

    describe('is_locked_by_other_user', () => {

        const lock = (...args) => globalThis.lockModule.is_locked_by_other_user(...args);

        it('is true when locked by a different user (ids normalised with Number)', () => {
            expect(lock({ is_locked: 1, locked_by_user: 7 }, '12')).toBe(true);
            expect(lock({ is_locked: 1, locked_by_user: '7' }, 12)).toBe(true);
        });

        it('is false when locked by the same user regardless of string/number', () => {
            expect(lock({ is_locked: 1, locked_by_user: '12' }, 12)).toBe(false);
            expect(lock({ is_locked: 1, locked_by_user: 12 }, '12')).toBe(false);
        });

        it('is false when the record is not locked (0, undefined, "1")', () => {
            expect(lock({ is_locked: 0, locked_by_user: 7 }, 12)).toBe(false);
            expect(lock({ locked_by_user: 7 }, 12)).toBe(false);
            expect(lock({ is_locked: '1', locked_by_user: 7 }, 12)).toBe(false);
        });

        it('accepts is_locked === true as locked (check_if_locked parity)', () => {
            expect(lock({ is_locked: true, locked_by_user: 7 }, 12)).toBe(true);
        });

        it('is false for a missing / non-object record', () => {
            expect(lock(null, 12)).toBe(false);
            expect(lock(undefined, 12)).toBe(false);
            expect(lock('x', 12)).toBe(false);
        });

        it('is false (with console.error) when either id is non-numeric', () => {
            expect(lock({ is_locked: 1, locked_by_user: null }, 12)).toBe(false);
            expect(lock({ is_locked: 1, locked_by_user: 'abc' }, 12)).toBe(false);
            expect(lock({ is_locked: 1, locked_by_user: 7 }, 'abc')).toBe(false);
            expect(lock({ is_locked: 1, locked_by_user: 7 }, '12abc')).toBe(false);
            expect(console.error).toHaveBeenCalled();
        });

        it('defaults current_user_id from authModule.get_user_profile_data().uid', () => {
            expect(lock({ is_locked: 1, locked_by_user: 12 })).toBe(false);
            expect(lock({ is_locked: 1, locked_by_user: 99 })).toBe(true);
            expect(globalThis.authModule.get_user_profile_data).toHaveBeenCalledTimes(2);
        });

        it('does not consult the profile when current_user_id is supplied', () => {
            lock({ is_locked: 1, locked_by_user: 99 }, 12);
            expect(globalThis.authModule.get_user_profile_data).not.toHaveBeenCalled();
        });

        it('is false (with console.warn) when the profile is unavailable', () => {
            globalThis.authModule.get_user_profile_data = vi.fn(() => null);
            expect(lock({ is_locked: 1, locked_by_user: 99 })).toBe(false);
            expect(console.warn).toHaveBeenCalled();
        });
    });

    // ───────────────────────── is_user_administrator ─────────────────────────

    describe('is_user_administrator', () => {

        it('delegates to authModule.is_administrator', async () => {
            globalThis.authModule.is_administrator = vi.fn(async () => true);
            await expect(globalThis.lockModule.is_user_administrator()).resolves.toBe(true);
            expect(globalThis.authModule.is_administrator).toHaveBeenCalledTimes(1);
            expect(globalThis.authModule.get_user_role).not.toHaveBeenCalled();

            globalThis.authModule.is_administrator = vi.fn(async () => false);
            await expect(globalThis.lockModule.is_user_administrator()).resolves.toBe(false);
        });

        it('coerces a non-boolean delegate result to boolean', async () => {
            globalThis.authModule.is_administrator = vi.fn(async () => 'Administrator');
            await expect(globalThis.lockModule.is_user_administrator()).resolves.toBe(false);
        });

        it('falls back to profile + get_user_role when is_administrator is absent', async () => {
            delete globalThis.authModule.is_administrator;
            globalThis.authModule.get_user_role = vi.fn(async () => 'Administrator');
            await expect(globalThis.lockModule.is_user_administrator()).resolves.toBe(true);
            expect(globalThis.authModule.get_user_role).toHaveBeenCalledWith(12);

            globalThis.authModule.get_user_role = vi.fn(async () => 'Student');
            await expect(globalThis.lockModule.is_user_administrator()).resolves.toBe(false);
        });

        it('returns false (never throws) when the delegate throws', async () => {
            globalThis.authModule.is_administrator = vi.fn(async () => { throw new Error('nope'); });
            await expect(globalThis.lockModule.is_user_administrator()).resolves.toBe(false);
            expect(console.error).toHaveBeenCalled();
        });
    });

    // ───────────────────────── disable_form_fields ─────────────────────────

    describe('disable_form_fields', () => {

        const FORM_HTML = `
            <div id="message"></div>
            <form id="edit-form">
                <input type="hidden" id="hidden-1">
                <input type="text" id="text-1">
                <input type="text" id="text-ro" readonly>
                <input type="checkbox" id="check-1" disabled>
                <textarea id="ta-1"></textarea>
                <select id="sel-1"><option>a</option></select>
                <button type="submit" id="submit-1">Save</button>
                <button type="button" id="btn-1">Pick</button>
                <a class="btn btn-secondary" id="link-btn">Link</a>
                <button type="button" class="btn btn-secondary" id="unlock-record">Unlock</button>
            </form>
            <form id="other-form">
                <input type="text" id="other-text">
            </form>`;

        beforeEach(() => {
            document.body.innerHTML = FORM_HTML;
        });

        const is_disabled = (id) => {
            const el = document.getElementById(id);
            return el.disabled === true && el.style.cursor === 'not-allowed' && el.style.opacity === '0.6';
        };

        it('defaults: disables inputs/textarea/select/submit/button, .btn sweep, skips hidden/readonly/already-disabled, no preservation', () => {
            const rte = { set_all_enabled: vi.fn() };
            globalThis.rteModule = rte;

            const count = globalThis.lockModule.disable_form_fields();

            expect(is_disabled('text-1')).toBe(true);
            expect(is_disabled('ta-1')).toBe(true);
            expect(is_disabled('sel-1')).toBe(true);
            expect(is_disabled('submit-1')).toBe(true);
            expect(is_disabled('btn-1')).toBe(true);
            expect(is_disabled('other-text')).toBe(true);
            expect(is_disabled('unlock-record')).toBe(true);
            // .btn sweep also greys out non-form-control .btn elements
            expect(document.getElementById('link-btn').style.opacity).toBe('0.6');
            // hidden input untouched; readonly untouched; already-disabled untouched (no style)
            expect(document.getElementById('hidden-1').disabled).toBe(false);
            expect(document.getElementById('text-ro').disabled).toBe(false);
            expect(document.getElementById('check-1').style.opacity).toBe('');
            expect(rte.set_all_enabled).toHaveBeenCalledWith(false);
            // text-1, ta-1, sel-1, submit-1, btn-1, unlock-record, other-text (7) + link-btn (1)
            expect(count).toBe(8);
        });

        it('preserve_selectors skips matching elements in both sweeps', () => {
            globalThis.lockModule.disable_form_fields({ preserve_selectors: ['#unlock-record'] });
            expect(document.getElementById('unlock-record').disabled).toBe(false);
            expect(document.getElementById('unlock-record').style.opacity).toBe('');
            expect(is_disabled('submit-1')).toBe(true);
        });

        it('include_submit=false leaves the submit button enabled (styles-form variant)', () => {
            globalThis.lockModule.disable_form_fields({ include_submit: false });
            expect(document.getElementById('submit-1').disabled).toBe(false);
            expect(is_disabled('btn-1')).toBe(true);
        });

        it('disable_rte=false does not touch rteModule', () => {
            const rte = { set_all_enabled: vi.fn() };
            globalThis.rteModule = rte;
            globalThis.lockModule.disable_form_fields({ disable_rte: false });
            expect(rte.set_all_enabled).not.toHaveBeenCalled();
        });

        it('disable_custom_buttons=false skips the .btn sweep', () => {
            globalThis.lockModule.disable_form_fields({ disable_custom_buttons: false });
            expect(document.getElementById('link-btn').style.opacity).toBe('');
            // unlock-record is still caught by button[type="button"]
            expect(is_disabled('unlock-record')).toBe(true);
        });

        it('form_selector scopes both sweeps to that root', () => {
            const count = globalThis.lockModule.disable_form_fields({ form_selector: '#other-form' });
            expect(is_disabled('other-text')).toBe(true);
            expect(document.getElementById('text-1').disabled).toBe(false);
            expect(count).toBe(1);
        });

        it('returns 0 and warns when form_selector matches nothing', () => {
            expect(globalThis.lockModule.disable_form_fields({ form_selector: '#missing' })).toBe(0);
            expect(console.warn).toHaveBeenCalled();
            expect(document.getElementById('text-1').disabled).toBe(false);
        });

        it('is safe when rteModule is not loaded', () => {
            expect(() => globalThis.lockModule.disable_form_fields()).not.toThrow();
        });
    });

    // ───────────────────────── unlock_record → endpointsModule.build ─────────────────────────

    describe('unlock_record builds its URL via endpointsModule.build', () => {

        it('produces the same substituted URL as before promotion', async () => {
            window.history.pushState({}, '', '/exhibits-dashboard/items/heading/edit?exhibit_id=ex%201&item_id=h1');
            document.body.innerHTML = '<div id="message"></div>';

            globalThis.helperModule = {
                get_parameter_by_name: (name) => new URLSearchParams(window.location.search).get(name),
            };
            globalThis.endpointsModule.get_exhibits_endpoints = () => ({
                exhibits: {
                    heading_unlock_record: {
                        post: { endpoint: '/exhibits-dashboard/api/v1/exhibits/:exhibit_id/headings/:heading_id/unlock' },
                    },
                },
            });
            const build_spy = vi.spyOn(globalThis.endpointsModule, 'build');
            globalThis.httpModule = { req: vi.fn(async () => ({ status: 200 })) };
            vi.useFakeTimers();

            const ok = await globalThis.lockModule.unlock_record(false, { force: true });

            expect(ok).toBe(true);
            expect(build_spy).toHaveBeenCalledWith(
                '/exhibits-dashboard/api/v1/exhibits/:exhibit_id/headings/:heading_id/unlock',
                { exhibit_id: 'ex 1', heading_id: 'h1' },
            );
            const request = globalThis.httpModule.req.mock.calls[0][0];
            expect(request.url).toBe('/exhibits-dashboard/api/v1/exhibits/ex%201/headings/h1/unlock?uid=12&force=true');
            expect(request.headers['x-access-token']).toBe('unit-test-token');

            build_spy.mockRestore();
            vi.useRealTimers();
        });
    });
});
