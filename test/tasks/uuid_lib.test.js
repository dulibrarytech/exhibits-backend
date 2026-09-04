'use strict';

/**
 * Pins libs/uuid as the single UUID definition (DRY review 2026-09-03, O3).
 *
 * Strict RFC 4122 shape: version 1-5, variant 8-b, case-insensitive. The
 * former auth/ pattern accepted any version/variant nibble; every id in this
 * application is minted by the uuid library and every other layer already
 * validated strictly, so auth now agrees with them. The last block scans the
 * converted server files so a pasted-back regex literal fails here.
 */

const FS = require('fs');
const PATH = require('path');

vi.mock('../../libs/log4', () => ({
    module: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}));

const UUID_LIB = require('../../libs/uuid');
const { UUID_REGEX, is_valid_uuid } = UUID_LIB;

const V4 = '5ce8ac28-63d9-4fb6-94d7-bbff2760c06b';

describe('libs/uuid — is_valid_uuid', () => {

    test('accepts a v4 UUID', () => {
        expect(is_valid_uuid(V4)).toBe(true);
        expect(is_valid_uuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    test('accepts uppercase', () => {
        expect(is_valid_uuid(V4.toUpperCase())).toBe(true);
        expect(is_valid_uuid('B042F609-B680-4CA9-BE40-AAF194DCFCED')).toBe(true);
    });

    test('accepts every RFC version (1-5) and variant (8-b) nibble', () => {
        for (const version of ['1', '2', '3', '4', '5']) {
            for (const variant of ['8', '9', 'a', 'b', 'A', 'B']) {
                expect(is_valid_uuid(`12345678-1234-${version}234-${variant}234-123456789012`)).toBe(true);
            }
        }
    });

    test('rejects version 0 and a non-RFC variant (the former loose auth pattern accepted these)', () => {
        expect(is_valid_uuid('12345678-1234-0234-8234-123456789012')).toBe(false); /* version 0 */
        expect(is_valid_uuid('12345678-1234-1234-0234-123456789012')).toBe(false); /* variant 0 */
        expect(is_valid_uuid('12345678-1234-1234-1234-123456789012')).toBe(false); /* variant 1 */
        expect(is_valid_uuid('12345678-1234-6234-8234-123456789012')).toBe(false); /* version 6 */
        expect(is_valid_uuid('12345678-1234-1234-c234-123456789012')).toBe(false); /* variant c */
    });

    test('rejects non-strings, null, undefined and empty', () => {
        expect(is_valid_uuid(null)).toBe(false);
        expect(is_valid_uuid(undefined)).toBe(false);
        expect(is_valid_uuid('')).toBe(false);
        expect(is_valid_uuid(0)).toBe(false);
        expect(is_valid_uuid(12345)).toBe(false);
        expect(is_valid_uuid({})).toBe(false);
        expect(is_valid_uuid([V4])).toBe(false);
    });

    test('rejects malformed strings', () => {
        expect(is_valid_uuid('not-a-uuid')).toBe(false);
        expect(is_valid_uuid('5ce8ac28-63d9-4fb6-94d7-bbff2760c06')).toBe(false);   /* short */
        expect(is_valid_uuid('5ce8ac28-63d9-4fb6-94d7-bbff2760c06bb')).toBe(false); /* long */
        expect(is_valid_uuid(` ${V4}`)).toBe(false);                                 /* padding */
        expect(is_valid_uuid('5ce8ac2863d94fb694d7bbff2760c06b')).toBe(false);      /* no dashes */
        expect(is_valid_uuid('5ce8ac28-63d9-4fb6-94d7-bbff2760c06g')).toBe(false);  /* non-hex */
    });

    test('UUID_REGEX is anchored and case-insensitive', () => {
        expect(UUID_REGEX.flags).toContain('i');
        expect(UUID_REGEX.source.startsWith('^')).toBe(true);
        expect(UUID_REGEX.source.endsWith('$')).toBe(true);
        expect(UUID_REGEX.test(`x${V4}`)).toBe(false);
    });
});

describe('libs/uuid — every module delegates to the one definition', () => {

    test('exhibits/common_helper.is_valid_uuid IS libs/uuid.is_valid_uuid', () => {
        const COMMON_HELPER = require('../../exhibits/common_helper');
        expect(COMMON_HELPER.is_valid_uuid).toBe(is_valid_uuid);
    });

    test('Base_tasks.UUID_REGEX IS libs/uuid.UUID_REGEX', () => {
        const Base_tasks = require('../../exhibits/tasks/tasks_helper');
        const tasks = new Base_tasks({}, {});
        expect(tasks.UUID_REGEX).toBe(UUID_REGEX);
    });

    test('libs/helper-style validation (trim, then strict test) agrees with libs/uuid', () => {
        /*
         * libs/helper.js validates `uuid.trim()` before querying; the trimmed
         * value must be judged exactly as libs/uuid judges it.
         */
        const helper_style = (uuid) => (typeof uuid === 'string' && !!uuid.trim() && is_valid_uuid(uuid.trim()));
        expect(helper_style(`  ${V4}  `)).toBe(true);
        expect(helper_style('  12345678-1234-1234-1234-123456789012  ')).toBe(false);
        expect(helper_style('   ')).toBe(false);
    });

    test('no converted server file carries its own UUID regex literal any more', () => {
        const ROOT = PATH.join(__dirname, '..', '..');
        const converted = [
            'auth/controller.js',
            'auth/tasks/auth_tasks.js',
            'exhibits/common_helper.js',
            'exhibits/tasks/tasks_helper.js',
            'indexer/indexer_helper.js',
            'libs/helper.js',
            'media-library/controller.js',
            'media-library/iiif-service.js',
            'media-library/model.js',
            'media-library/repo-service.js',
            'media-library/tasks/cleanup_orphaned_files.js'
        ];
        const literal = /\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}/;

        for (const file of converted) {
            const source = FS.readFileSync(PATH.join(ROOT, file), 'utf8');
            expect(literal.test(source), `${file} re-declares the UUID regex`).toBe(false);
        }
    });

    test('cleanup_orphaned_files prefix pattern is derived from libs/uuid (leading anchor only)', () => {
        const prefix = new RegExp(`^(${UUID_REGEX.source.slice(1, -1)})`, 'i');
        expect(prefix.exec(`${V4}_thumb.jpg`)[1]).toBe(V4);
        expect(prefix.test(`${V4.toUpperCase()}.tif`)).toBe(true);
        expect(prefix.test(`thumb_${V4}.jpg`)).toBe(false);
        expect(prefix.test('12345678-1234-1234-1234-123456789012.jpg')).toBe(false);
    });
});
