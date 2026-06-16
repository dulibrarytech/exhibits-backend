'use strict';

/**
 * Regression for the indexer is_valid_uuid no-op: it used to `return
 * uuid_regex.test(uuid) || uuid.length > 0`, so the `|| uuid.length > 0` made it
 * return true for ANY non-empty string — the format check never mattered. It now
 * enforces the 8-4-4-4-12 hex shape.
 */

vi.mock('../../libs/log4', () => ({
    module: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}));

const { is_valid_uuid } = require('../../indexer/indexer_helper');

describe('indexer is_valid_uuid', () => {

    test('accepts a well-formed UUID (case-insensitive)', () => {
        expect(is_valid_uuid('5ce8ac28-63d9-4fb6-94d7-bbff2760c06b')).toBe(true);
        expect(is_valid_uuid('B042F609-B680-4CA9-BE40-AAF194DCFCED')).toBe(true);
    });

    test('rejects non-UUID strings (the regression — these used to pass)', () => {
        expect(is_valid_uuid('not-a-uuid')).toBe(false);
        expect(is_valid_uuid('123')).toBe(false);
        expect(is_valid_uuid('5ce8ac28-63d9-4fb6-94d7-bbff2760c06')).toBe(false);   // too short
        expect(is_valid_uuid('zzzzzzzz-63d9-4fb6-94d7-bbff2760c06b')).toBe(false);  // non-hex
        expect(is_valid_uuid('5ce8ac2863d94fb694d7bbff2760c06b')).toBe(false);      // missing dashes
    });

    test('rejects empty and non-string inputs', () => {
        expect(is_valid_uuid('')).toBe(false);
        expect(is_valid_uuid(null)).toBe(false);
        expect(is_valid_uuid(undefined)).toBe(false);
        expect(is_valid_uuid(123)).toBe(false);
    });
});
