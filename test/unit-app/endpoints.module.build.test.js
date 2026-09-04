// @vitest-environment jsdom
//
// Unit coverage for endpointsModule.build — the `:name` placeholder
// substitution promoted from lockModule's private build_endpoint_url
// (Phase 1 DRY, cluster C8).
//
// Loader mirrors endpoints.module.version.test.js: install a deterministic
// Storage before eval because the module probes localStorage once at load.

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

describe('endpointsModule.build', () => {

    beforeAll(() => {
        Object.defineProperty(window, 'localStorage', { configurable: true, value: make_storage() });
        Object.defineProperty(window, 'sessionStorage', { configurable: true, value: make_storage() });

        load_browser_module('public/app/utils/endpoints.module.js', 'endpointsModule');
    });

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    const build = (...args) => globalThis.endpointsModule.build(...args);

    it('substitutes every named placeholder', () => {
        const url = build('/api/v1/exhibits/:exhibit_id/grids/:grid_id/items/:item_id', {
            exhibit_id: 'e1', grid_id: 'g1', item_id: 'i1',
        });
        expect(url).toBe('/api/v1/exhibits/e1/grids/g1/items/i1');
    });

    it('URL-encodes values and coerces non-strings with String()', () => {
        expect(build('/media/:media_id', { media_id: 'a b/c?d' })).toBe('/media/a%20b%2Fc%3Fd');
        expect(build('/users/:user_id', { user_id: 42 })).toBe('/users/42');
    });

    it('is prefix-safe: :item does not clobber :item_id', () => {
        const url = build('/x/:item/:item_id', { item: 'A', item_id: 'B' });
        expect(url).toBe('/x/A/B');
    });

    it('replaces repeated occurrences of the same placeholder', () => {
        expect(build('/:id/copy/:id', { id: 'z' })).toBe('/z/copy/z');
    });

    it('returns null and logs when a param is undefined, null or empty string', () => {
        expect(build('/a/:x', { x: undefined })).toBeNull();
        expect(build('/a/:x', { x: null })).toBeNull();
        expect(build('/a/:x', { x: '' })).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(3);
    });

    it('accepts 0 and false as values (unlike the old !value check)', () => {
        expect(build('/a/:x', { x: 0 })).toBe('/a/0');
        expect(build('/a/:x', { x: false })).toBe('/a/false');
    });

    it('returns null for a non-string or empty template', () => {
        expect(build(undefined, { a: 1 })).toBeNull();
        expect(build('', { a: 1 })).toBeNull();
        expect(build({ endpoint: '/x' }, { a: 1 })).toBeNull();
    });

    it('treats missing params as {} and warns on unresolved placeholders', () => {
        expect(build('/a/:x')).toBe('/a/:x');
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(':x'));
    });

    it('does not warn for a template with no placeholders', () => {
        expect(build('/exhibits-dashboard/api/v1/exhibits', {})).toBe('/exhibits-dashboard/api/v1/exhibits');
        expect(console.warn).not.toHaveBeenCalled();
    });

    it('ignores params that have no placeholder in the template', () => {
        expect(build('/a/:x', { x: '1', extra: 'ignored' })).toBe('/a/1');
    });

    it('does not treat a port number as a placeholder', () => {
        expect(build('http://localhost:8004/api/:id', { id: '7' })).toBe('http://localhost:8004/api/7');
        expect(console.warn).not.toHaveBeenCalled();
    });
});
