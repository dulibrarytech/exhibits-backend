/**
 * Shared global-collaborator stubs for the public/app module tests.
 *
 * The browser modules resolve helperModule, domModule, rteModule,
 * authModule and endpointsModule off the global scope at call time, so
 * each test file assigns stand-ins to globalThis before loading the
 * module under test (see ./load_module.js). The factories below are the
 * byte-for-byte-equivalent extractions of the stubs that were duplicated
 * across files. Each call returns a FRESH object — several contain
 * vi.fn() spies and are re-created in beforeEach so call history never
 * leaks between tests; keep calling them from the same hook the literal
 * used to live in.
 *
 * Stubs that were unique to one file (or whose variants differ in more
 * than a token / app-path value) stay local to that file on purpose —
 * do not "unify" them here.
 */

/*
 * `vi` comes from the vitest `globals: true` config, exactly as the test
 * files use it. This helper is pulled in through Node's native CJS
 * require (not vite-node), where require('vitest') is refused, so it is
 * read off globalThis lazily — inside each factory — rather than
 * captured at load time.
 */
function spy() {
    return globalThis.vi.fn();
}

/**
 * rteModule stand-in backed by the plain <textarea> the fixtures render:
 * get/set/is_empty read and write the element's .value, everything else
 * is a no-op. Used by the item/container form tests and the upload modals.
 */
function rte_stub() {
    return {
        get_html: (id) => document.getElementById(id)?.value?.trim() ?? '',
        set_html: (id, html) => {
            const el = document.getElementById(id);
            if (el) el.value = html;
        },
        is_empty: (id) => (document.getElementById(id)?.value?.trim() ?? '') === '',
        init: () => null,
        init_all: () => {},
        set_enabled: () => {},
        set_all_enabled: () => {},
        on_change: () => {},
        is_dirty: () => false,
    };
}

/**
 * domModule stand-in: the alert / field-error surface as vi.fn() spies so
 * tests can assert what the form reported. Container-form flavour.
 */
function dom_stub() {
    return {
        set_alert: spy(),
        set_field_error: spy(),
        show_field_error: spy(),
        clear_field_error: spy(),
    };
}

/**
 * dom_stub() plus a live set_value(selector, value) that writes into the
 * jsdom fixture — the item forms call it to populate their fields.
 */
function dom_stub_with_set_value() {
    return {
        ...dom_stub(),
        set_value: (selector, value) => {
            const el = document.querySelector(selector);
            if (el) el.value = value;
        },
    };
}

/**
 * helperModule stand-in covering the two radio-group helpers the
 * container forms (grid / heading / timeline) depend on.
 */
function helper_stub() {
    return {
        get_checked_radio_button: (radios) => {
            if (!radios || !radios.length) return null;
            const checked = Array.from(radios).find((b) => b && b.checked);
            if (!checked) return null;
            const v = String(checked.value);
            return v === '' || v === 'undefined' ? null : v;
        },
        check_item_style_option: (value) => {
            const radios = document.getElementsByName('styles');
            if (!radios || !radios.length) return;
            const target = value || '';
            for (const r of radios) { if (r.value === target) { r.checked = true; return; } }
            for (const r of radios) { if (r.value === '') { r.checked = true; return; } }
        },
    };
}

/**
 * authModule stand-in whose get_user_token() returns `token` verbatim
 * (a string, '' or false — callers pick what the test needs). Extra
 * members (e.g. a no-op logout) go in `overrides`.
 */
function auth_stub(token, overrides = {}) {
    return {
        get_user_token: () => token,
        ...overrides,
    };
}

/**
 * endpointsModule stand-in whose get_app_path() reads the same
 * localStorage key the real module does, falling back to the default
 * dashboard path. Extra endpoint getters go in `overrides`.
 */
function endpoints_stub(overrides = {}) {
    return {
        get_app_path: () => window.localStorage.getItem('exhibits_app_path') || '/exhibits-dashboard',
        ...overrides,
    };
}

/**
 * endpointsModule stand-in with a FIXED app path (no localStorage read).
 * Extra endpoint getters go in `overrides`.
 */
function endpoints_fixed_stub(app_path, overrides = {}) {
    return {
        get_app_path: () => app_path,
        ...overrides,
    };
}

module.exports = {
    rte_stub,
    dom_stub,
    dom_stub_with_set_value,
    helper_stub,
    auth_stub,
    endpoints_stub,
    endpoints_fixed_stub,
};
