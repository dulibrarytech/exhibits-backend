// @vitest-environment jsdom
//
// Unit tests for public/app/exhibits/exhibits.common.form.module.js.
//
// Covers obj.set_message_selector and obj.get_common_form_fields. The
// network-bound methods (delete_hero_image, delete_thumbnail_image, init)
// are out of scope here — see the module-coverage notes in the staging
// proposal for why those belong in integration-style tests with full
// httpModule stubs.

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(
    __dirname,
    '../../public/app/exhibits/exhibits.common.form.module.js',
);

function build_form() {
    document.body.innerHTML = `
        <div id="message"></div>
        <div id="custom-message"></div>
        <form>
            <div class="form-group">
                <input type="text" id="exhibit-title-input" />
            </div>
            <input type="text" id="exhibit-sub-title-input" />
            <textarea id="exhibit-description-input"></textarea>
            <textarea id="exhibit-about-the-curators-input"></textarea>
            <textarea id="exhibit-alert-text-input"></textarea>
            <input type="checkbox" id="is-featured" />
            <input type="checkbox" id="is-student-curated" />
            <input type="checkbox" id="is-content-advisory" />
            <select id="exhibit-owner">
                <option value=""></option>
                <option value="1">User 1</option>
                <option value="2">User 2</option>
            </select>
            <select id="is-published">
                <option value=""></option>
                <option value="0">No</option>
                <option value="1">Yes</option>
            </select>
            <input type="hidden" id="hero-image" />
            <input type="hidden" id="hero-image-media-uuid" />
            <input type="hidden" id="thumbnail-image" />
            <input type="hidden" id="thumbnail-media-uuid" />
            <select id="exhibit-page-layout">
                <option value=""></option>
                <option value="grid">grid</option>
            </select>
            <select id="exhibit-template">
                <option value=""></option>
                <option value="default">default</option>
            </select>
            <input type="radio" name="banner_template" value="banner_1" />
            <input type="radio" name="banner_template" value="banner_2" />
        </form>
    `;
}

function fill_minimum_valid_form() {
    document.querySelector('#exhibit-title-input').value = 'Minimum Title';
}

describe('exhibitsCommonFormModule', () => {

    beforeAll(() => {
        // Required globals — the module reaches for these by bare name
        // both at IIFE-definition time and inside method bodies.
        globalThis.endpointsModule = {
            get_exhibits_endpoints: () => ({}),
        };

        const src = readFileSync(MODULE_PATH, 'utf8');
        const patched = src.replace(
            /^const\s+exhibitsCommonFormModule\s*=/m,
            'globalThis.exhibitsCommonFormModule =',
        );
        // eslint-disable-next-line no-eval
        (0, eval)(patched);
    });

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        Element.prototype.scrollIntoView = function () {};
        // helperModule is referenced inside get_common_form_fields. Reset
        // each test so individual tests can override behavior to drive the
        // catch-path or the radio-selection path.
        globalThis.helperModule = {
            clean_html: (s) => s,
            get_checked_radio_button: (els) => {
                for (const el of els) {
                    if (el.checked) return el.value;
                }
                return '';
            },
        };
        // Phase 3b refactored exhibits.common.form.module to use
        // domModule.set_field_error / clear_field_error for title
        // validation, and to use domModule.set_alert via the local
        // show_error helper for catch-path summaries. Stub all three
        // before each test so individual cases can assert on calls.
        globalThis.domModule = {
            set_alert: vi.fn(),
            set_field_error: vi.fn((field, error_id, message) => {
                // Mirror the real helper closely enough that existing
                // assertions ("title-validation-feedback creates a node
                // with the message text") keep working. We insert a
                // sibling div with the error_id so .toContain('alert')
                // and other DOM-shape assertions still hold.
                if (typeof field === 'string') {
                    field = document.querySelector(field);
                }
                if (!field) return;
                field.setAttribute('aria-invalid', 'true');
                let msg = document.getElementById(error_id);
                if (!msg) {
                    msg = document.createElement('div');
                    msg.id = error_id;
                    msg.className = 'invalid-feedback d-block';
                    msg.setAttribute('role', 'alert');
                    if (field.parentNode) {
                        field.parentNode.insertBefore(msg, field.nextSibling);
                    }
                }
                msg.textContent = message == null ? '' : String(message);
            }),
            clear_field_error: vi.fn((field, error_id) => {
                if (typeof field === 'string') {
                    field = document.querySelector(field);
                }
                if (!field) return;
                field.removeAttribute('aria-invalid');
                if (error_id) {
                    const msg = document.getElementById(error_id);
                    if (msg && msg.parentNode) {
                        msg.parentNode.removeChild(msg);
                    }
                }
            }),
        };
        build_form();
        // Reset message_selector to its default by re-eval is not ideal —
        // tests that mutate it should restore via set_message_selector.
        globalThis.exhibitsCommonFormModule.set_message_selector('#message');
    });

    describe('set_message_selector', () => {

        it('accepts a non-empty string without warning', () => {
            globalThis.exhibitsCommonFormModule.set_message_selector('#custom-message');
            expect(console.warn).not.toHaveBeenCalled();
        });

        it('warns and ignores an empty string', () => {
            globalThis.exhibitsCommonFormModule.set_message_selector('');
            expect(console.warn).toHaveBeenCalled();
        });

        it('warns and ignores a whitespace-only string', () => {
            globalThis.exhibitsCommonFormModule.set_message_selector('   ');
            expect(console.warn).toHaveBeenCalled();
        });

        it('warns and ignores non-string input', () => {
            globalThis.exhibitsCommonFormModule.set_message_selector(42);
            globalThis.exhibitsCommonFormModule.set_message_selector(null);
            globalThis.exhibitsCommonFormModule.set_message_selector(undefined);
            globalThis.exhibitsCommonFormModule.set_message_selector({});
            expect(console.warn).toHaveBeenCalledTimes(4);
        });

        it('routes downstream error rendering to the new selector', () => {
            // Force an exception inside get_common_form_fields so the catch
            // branch renders an alert into the message_selector container.
            globalThis.helperModule.get_checked_radio_button = () => {
                throw new Error('forced failure for selector routing test');
            };
            globalThis.exhibitsCommonFormModule.set_message_selector('#custom-message');
            fill_minimum_valid_form();

            const result = globalThis.exhibitsCommonFormModule.get_common_form_fields();

            expect(result).toBe(false);
            expect(document.querySelector('#custom-message').innerHTML).toContain('alert');
            expect(document.querySelector('#message').innerHTML).toBe('');
        });
    });

    describe('get_common_form_fields', () => {

        it('returns false and flags the title field when title is empty', () => {
            const result = globalThis.exhibitsCommonFormModule.get_common_form_fields();

            expect(result).toBe(false);

            // Phase 3b: Bootstrap's `.is-invalid` visual class is preserved
            // for styling, AND set_field_error wires aria-invalid + a
            // sibling <div id="exhibit-title-input-error" role="alert">.
            const title_el = document.querySelector('#exhibit-title-input');
            expect(title_el.classList.contains('is-invalid')).toBe(true);
            expect(title_el.getAttribute('aria-invalid')).toBe('true');

            // The `.title-validation-feedback` class is gone; the message
            // now lives in the standardized error container that
            // domModule.set_field_error owns.
            expect(globalThis.domModule.set_field_error).toHaveBeenCalledWith(
                expect.anything(),                  // title element
                'exhibit-title-input-error',
                'Title is required',
            );
            const feedback = document.getElementById('exhibit-title-input-error');
            expect(feedback).not.toBeNull();
            expect(feedback.getAttribute('role')).toBe('alert');
            expect(feedback.textContent).toBe('Title is required');
        });

        it('clears prior title validation state on subsequent successful calls', () => {
            // First call: blank title → invalid state added.
            globalThis.exhibitsCommonFormModule.get_common_form_fields();
            expect(document.getElementById('exhibit-title-input-error')).not.toBeNull();

            // Second call: provide a title — invalid state should be wiped.
            // Phase 3b clears via domModule.clear_field_error, which the
            // mock implements (see beforeEach) to remove the message node
            // and aria-invalid.
            fill_minimum_valid_form();
            const result = globalThis.exhibitsCommonFormModule.get_common_form_fields();

            expect(result).not.toBe(false);
            const title_el = document.querySelector('#exhibit-title-input');
            expect(title_el.classList.contains('is-invalid')).toBe(false);
            expect(title_el.hasAttribute('aria-invalid')).toBe(false);
            expect(document.getElementById('exhibit-title-input-error')).toBeNull();
            expect(globalThis.domModule.clear_field_error).toHaveBeenCalledWith(
                expect.anything(),
                'exhibit-title-input-error',
            );
        });

        it('returns the assembled exhibit object on a fully valid form', () => {
            document.querySelector('#exhibit-title-input').value = 'My Exhibit';
            document.querySelector('#exhibit-sub-title-input').value = 'Subtitle';
            document.querySelector('#exhibit-description-input').value = 'Description';
            document.querySelector('#exhibit-about-the-curators-input').value = 'About';
            document.querySelector('#hero-image').value = 'hero.jpg';
            document.querySelector('#thumbnail-image').value = 'thumb.jpg';
            document.querySelector('#exhibit-page-layout').value = 'grid';
            document.querySelector('#exhibit-template').value = 'default';
            document.querySelector('input[name="banner_template"][value="banner_2"]').checked = true;

            const result = globalThis.exhibitsCommonFormModule.get_common_form_fields();

            expect(result).toMatchObject({
                title: 'My Exhibit',
                subtitle: 'Subtitle',
                description: 'Description',
                about_the_curators: 'About',
                hero_image: 'hero.jpg',
                thumbnail: 'thumb.jpg',
                page_layout: 'grid',
                exhibit_template: 'default',
                banner_template: 'banner_2',
                is_featured: 0,
                is_student_curated: 0,
                alert_text: '',
            });
        });

        it('converts checkbox booleans to 0 / 1 integers', () => {
            fill_minimum_valid_form();
            document.querySelector('#is-featured').checked = true;
            document.querySelector('#is-student-curated').checked = false;

            const result = globalThis.exhibitsCommonFormModule.get_common_form_fields();

            expect(result.is_featured).toBe(1);
            expect(result.is_student_curated).toBe(0);
        });

        it('forces alert_text to empty string when is-content-advisory is unchecked', () => {
            fill_minimum_valid_form();
            document.querySelector('#is-content-advisory').checked = false;
            document.querySelector('#exhibit-alert-text-input').value = 'should be ignored';

            const result = globalThis.exhibitsCommonFormModule.get_common_form_fields();

            expect(result.alert_text).toBe('');
        });

        it('includes alert_text only when is-content-advisory is checked', () => {
            fill_minimum_valid_form();
            document.querySelector('#is-content-advisory').checked = true;
            document.querySelector('#exhibit-alert-text-input').value = 'Heads up.';

            const result = globalThis.exhibitsCommonFormModule.get_common_form_fields();

            expect(result.alert_text).toBe('Heads up.');
        });

        it('omits hero_image_media_uuid / thumbnail_media_uuid when their inputs are empty', () => {
            fill_minimum_valid_form();
            const result = globalThis.exhibitsCommonFormModule.get_common_form_fields();

            expect(result).not.toHaveProperty('hero_image_media_uuid');
            expect(result).not.toHaveProperty('thumbnail_media_uuid');
        });

        it('includes hero_image_media_uuid / thumbnail_media_uuid when populated', () => {
            fill_minimum_valid_form();
            document.querySelector('#hero-image-media-uuid').value = 'hero-uuid-123';
            document.querySelector('#thumbnail-media-uuid').value = 'thumb-uuid-456';

            const result = globalThis.exhibitsCommonFormModule.get_common_form_fields();

            expect(result.hero_image_media_uuid).toBe('hero-uuid-123');
            expect(result.thumbnail_media_uuid).toBe('thumb-uuid-456');
        });

        it('coerces owner and is_published to numbers when populated', () => {
            fill_minimum_valid_form();
            document.querySelector('#exhibit-owner').value = '2';
            document.querySelector('#is-published').value = '1';

            const result = globalThis.exhibitsCommonFormModule.get_common_form_fields();

            expect(result.owner).toBe(2);
            expect(result.is_published).toBe(1);
        });

        it('omits owner and is_published when their inputs are empty', () => {
            fill_minimum_valid_form();
            const result = globalThis.exhibitsCommonFormModule.get_common_form_fields();

            expect(result).not.toHaveProperty('owner');
            expect(result).not.toHaveProperty('is_published');
        });

        it('uses helperModule.get_checked_radio_button for banner_template', () => {
            fill_minimum_valid_form();
            const spy = vi.fn(() => 'banner_from_spy');
            globalThis.helperModule.get_checked_radio_button = spy;

            const result = globalThis.exhibitsCommonFormModule.get_common_form_fields();

            expect(spy).toHaveBeenCalledTimes(1);
            const passed_elements = spy.mock.calls[0][0];
            expect(passed_elements.length).toBe(2);
            expect(result.banner_template).toBe('banner_from_spy');
        });

        it('runs every text input through helperModule.clean_html', () => {
            const clean_calls = [];
            globalThis.helperModule.clean_html = (s) => {
                clean_calls.push(s);
                return s + '_cleaned';
            };
            fill_minimum_valid_form();
            document.querySelector('#exhibit-sub-title-input').value = 'Sub';
            document.querySelector('#exhibit-description-input').value = 'Desc';
            document.querySelector('#exhibit-about-the-curators-input').value = 'About';
            document.querySelector('#is-content-advisory').checked = true;
            document.querySelector('#exhibit-alert-text-input').value = 'Alert';

            const result = globalThis.exhibitsCommonFormModule.get_common_form_fields();

            expect(clean_calls).toEqual(
                expect.arrayContaining(['Minimum Title', 'Sub', 'Desc', 'About', 'Alert']),
            );
            expect(result.title).toBe('Minimum Title_cleaned');
            expect(result.subtitle).toBe('Sub_cleaned');
            expect(result.alert_text).toBe('Alert_cleaned');
        });

        it('returns false and renders an alert when an unexpected error is thrown', () => {
            globalThis.helperModule.get_checked_radio_button = () => {
                throw new Error('boom');
            };
            fill_minimum_valid_form();

            const result = globalThis.exhibitsCommonFormModule.get_common_form_fields();

            expect(result).toBe(false);
            expect(console.error).toHaveBeenCalled();
            const message = document.querySelector('#message');
            expect(message.querySelector('.alert.alert-danger')).not.toBeNull();
        });
    });
});
