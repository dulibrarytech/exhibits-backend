'use strict';

/**
 * common_helper.is_valid_uuid was a no-op (`uuid && typeof === 'string' &&
 * uuid.length > 0`) used by every exhibit model, so their UUID input validation
 * accepted any non-empty string. is_valid_uuid now enforces the UUID format, and
 * a dedicated is_valid_user_id covers the one non-UUID arg (`uid` = the numeric
 * tbl_users.id / record-lock owner), which must NOT be validated as a UUID.
 */

vi.mock('../../libs/log4', () => ({
    module: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}));

const { is_valid_uuid, is_valid_user_id } = require('../../exhibits/common_helper');

describe('common_helper validators', () => {

    describe('is_valid_uuid (regression: was a length-only no-op)', () => {
        test('accepts well-formed UUIDs (case-insensitive)', () => {
            expect(is_valid_uuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
            expect(is_valid_uuid('5CE8AC28-63D9-4FB6-94D7-BBFF2760C06B')).toBe(true);
        });
        test('rejects non-UUID strings — these used to pass', () => {
            expect(is_valid_uuid('not-a-uuid')).toBe(false);
            expect(is_valid_uuid('1')).toBe(false);
            expect(is_valid_uuid('550e8400-e29b-41d4-a716-44665544000')).toBe(false); // short
            expect(is_valid_uuid('')).toBe(false);
            expect(is_valid_uuid(null)).toBe(false);
        });
    });

    describe('is_valid_user_id (numeric tbl_users.id — the lock owner)', () => {
        test('accepts positive integers (string or number)', () => {
            expect(is_valid_user_id('1')).toBe(true);
            expect(is_valid_user_id(42)).toBe(true);
        });
        test('rejects non-positive-integers — including a UUID (uid is NOT a UUID)', () => {
            expect(is_valid_user_id('0')).toBe(false);
            expect(is_valid_user_id('-1')).toBe(false);
            expect(is_valid_user_id('1.5')).toBe(false);
            expect(is_valid_user_id('abc')).toBe(false);
            expect(is_valid_user_id('')).toBe(false);
            expect(is_valid_user_id(null)).toBe(false);
            expect(is_valid_user_id('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
        });
    });
});
