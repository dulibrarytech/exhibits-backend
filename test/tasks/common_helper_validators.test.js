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

const { is_valid_uuid, is_valid_user_id, validate_link_field } = require('../../exhibits/common_helper');

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

    describe('validate_link_field (content block button URL)', () => {
        test('keeps http(s), mailto, tel, root-relative and fragment links as given', () => {
            for (const url of ['https://library.du.edu/x?a=1&b=2', 'http://du.edu', 'mailto:ask@du.edu', 'tel:+13038712007', '/exhibits/1', '#top']) {
                const data = { url };
                expect(validate_link_field(data, 'url', 'Button URL'), url).toBeNull();
                expect(data.url).toBe(url);
            }
        });
        test('adds https:// to a bare host and trims whitespace', () => {
            const data = { url: '  www.du.edu/library  ' };
            expect(validate_link_field(data, 'url', 'Button URL')).toBeNull();
            expect(data.url).toBe('https://www.du.edu/library');
        });
        test('rejects script, data and protocol-relative URLs with a 400 that names the field', () => {
            for (const url of ['javascript:alert(document.cookie)', 'JavaScript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x', '//evil.example/x']) {
                const data = { url };
                const result = validate_link_field(data, 'url', 'Button URL');
                expect(result, url).toMatchObject({ status: 400 });
                expect(result.message).toMatch(/^Button URL must be a web address/);
                expect(data.url).toBe(url);
            }
        });
        test('leaves an absent field alone and blanks a whitespace-only one', () => {
            const absent = {};
            expect(validate_link_field(absent, 'url', 'Button URL')).toBeNull();
            expect('url' in absent).toBe(false);

            const empty = { url: '   ' };
            expect(validate_link_field(empty, 'url', 'Button URL')).toBeNull();
            expect(empty.url).toBe('');
        });
        test('rejects a non-string value', () => {
            expect(validate_link_field({ url: 42 }, 'url', 'Button URL')).toMatchObject({ status: 400 });
        });
    });
});
