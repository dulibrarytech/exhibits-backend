// @vitest-environment jsdom
//
// Unit tests for public/app/timeline-items/items.common.vertical.timeline.item.form.module.js.
//
// Covers get_common_timeline_item_form_fields — the required-date
// validation chain (presence, YYYY-MM-DD format, real calendar date),
// the media-path vs text-path field sets, and the embed flag. The
// media/text branch is selected from window.location.pathname, driven
// here via history.pushState like items.common.grid.item.form.module.test.js.

'use strict';

const { load_browser_module } = require('./helpers/load_module');
const { dom_stub_with_set_value, endpoints_fixed_stub, rte_stub } = require('./helpers/stubs');

function navigate(pathname) {
    window.history.pushState({}, '', pathname);
}

function build_form({ media = false } = {}) {
    document.body.innerHTML = `
        <div id="message"></div>
        <input type="text" id="item-title-input" value="Item title" />
        <input type="text" id="item-text-input" value="Item text" />
        <input type="date" id="item-date-input" value="2026-04-15" />
        ${media ? `
        <input type="hidden" id="item-media-uuid" value="media-uuid-1" />
        <input type="hidden" id="item-media-type" value="image" />
        <input type="hidden" id="item-mime-type" value="image/jpeg" />
        <input type="hidden" id="thumbnail-media-uuid" value="thumb-uuid-1" />
        <input type="text" id="item-description-input" value="Pop-up description" />
        <input type="text" id="item-caption-input" value="A caption" />
        <input type="checkbox" id="embed-item" />
        ` : ''}
    `;
}

function set_value(selector, value) {
    document.querySelector(selector).value = value;
}

describe('itemsCommonVerticalTimelineItemFormModule', () => {

    beforeAll(() => {
        // The IIFE reads endpointsModule.get_app_path() at eval time —
        // stub it before loading the module.
        globalThis.endpointsModule = endpoints_fixed_stub('/exhibits-dashboard');
        load_browser_module(
            'public/app/timeline-items/items.common.vertical.timeline.item.form.module.js',
            'itemsCommonVerticalTimelineItemFormModule',
        );
    });

    beforeEach(() => {
        globalThis.rteModule = rte_stub();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        globalThis.domModule = dom_stub_with_set_value();
        navigate('/items/timeline/item/text');
        build_form();
    });

    describe('date validation', () => {

        it('returns false and flags the field when the date is missing', () => {
            set_value('#item-date-input', '');

            const result = globalThis.itemsCommonVerticalTimelineItemFormModule
                .get_common_timeline_item_form_fields();

            expect(result).toBe(false);
            expect(globalThis.domModule.show_field_error).toHaveBeenCalledWith(
                'Please enter a timeline date',
                '#item-date-input',
            );
        });

        /*
         * jsdom (like real date inputs) sanitizes invalid values to '', so a
         * malformed value can only reach the module's defensive regex / NaN
         * branches if the value getter is overridden — standing in for a
         * browser quirk or DOM tampering.
         */
        const force_date_value = (bad) => {
            Object.defineProperty(document.querySelector('#item-date-input'), 'value', {
                get: () => bad,
            });
        };

        it('rejects dates that are not in YYYY-MM-DD format', () => {
            for (const bad of ['04/15/2026', '2026-4-15', '15-04-2026', 'yesterday']) {
                build_form();
                force_date_value(bad);

                const result = globalThis.itemsCommonVerticalTimelineItemFormModule
                    .get_common_timeline_item_form_fields();

                expect(result, `expected '${bad}' to be rejected`).toBe(false);
            }
            expect(globalThis.domModule.show_field_error).toHaveBeenCalledWith(
                'Please enter a valid date format (YYYY-MM-DD)',
                '#item-date-input',
            );
        });

        it('rejects a well-formatted but impossible calendar date', () => {
            force_date_value('2026-99-99');

            const result = globalThis.itemsCommonVerticalTimelineItemFormModule
                .get_common_timeline_item_form_fields();

            expect(result).toBe(false);
            expect(globalThis.domModule.show_field_error).toHaveBeenCalledWith(
                'Please enter a valid date',
                '#item-date-input',
            );
        });

        it('clears prior field errors before validating', () => {
            globalThis.itemsCommonVerticalTimelineItemFormModule
                .get_common_timeline_item_form_fields();

            expect(globalThis.domModule.clear_field_error).toHaveBeenCalledWith(
                '#item-date-input',
                'item-date-input-error',
            );
            expect(globalThis.domModule.clear_field_error).toHaveBeenCalledWith(
                '#item-media-uuid',
                'item-media-uuid-error',
            );
        });
    });

    describe('text path', () => {

        it('assembles a text item with default type and mime type', () => {
            const result = globalThis.itemsCommonVerticalTimelineItemFormModule
                .get_common_timeline_item_form_fields();

            expect(result).toMatchObject({
                title: 'Item title',
                text: 'Item text',
                date: '2026-04-15',
                item_type: 'text',
                mime_type: 'text/plain',
            });
            expect(result).not.toHaveProperty('media_uuid');
        });

        it('does not require a media selection on the text path', () => {
            const result = globalThis.itemsCommonVerticalTimelineItemFormModule
                .get_common_timeline_item_form_fields();

            expect(result).not.toBe(false);
        });
    });

    describe('media path', () => {

        beforeEach(() => {
            navigate('/items/timeline/item/media');
            build_form({ media: true });
        });

        it('returns false and flags the picker when no media is selected', () => {
            set_value('#item-media-uuid', '');

            const result = globalThis.itemsCommonVerticalTimelineItemFormModule
                .get_common_timeline_item_form_fields();

            expect(result).toBe(false);
            expect(globalThis.domModule.show_field_error).toHaveBeenCalledWith(
                'Please select a media item',
                '#item-media-uuid',
            );
        });

        it('assembles the media item from the picker hidden inputs', () => {
            const result = globalThis.itemsCommonVerticalTimelineItemFormModule
                .get_common_timeline_item_form_fields();

            expect(result).toMatchObject({
                date: '2026-04-15',
                media_uuid: 'media-uuid-1',
                thumbnail_media_uuid: 'thumb-uuid-1',
                item_type: 'image',
                mime_type: 'image/jpeg',
                description: 'Pop-up description',
                caption: 'A caption',
            });
        });

        it('defaults thumbnail_media_uuid to an empty string when unset', () => {
            set_value('#thumbnail-media-uuid', '');

            const result = globalThis.itemsCommonVerticalTimelineItemFormModule
                .get_common_timeline_item_form_fields();

            expect(result.thumbnail_media_uuid).toBe('');
        });

        it('serializes the embed checkbox to 1/0', () => {
            document.querySelector('#embed-item').checked = true;
            const embedded = globalThis.itemsCommonVerticalTimelineItemFormModule
                .get_common_timeline_item_form_fields();
            expect(embedded.is_embedded).toBe(1);

            document.querySelector('#embed-item').checked = false;
            const not_embedded = globalThis.itemsCommonVerticalTimelineItemFormModule
                .get_common_timeline_item_form_fields();
            expect(not_embedded.is_embedded).toBe(0);
        });
    });

    describe('error handling', () => {

        it('returns false and alerts when an unexpected error is thrown', () => {
            globalThis.rteModule.get_html = vi.fn(() => {
                throw new Error('boom');
            });

            const result = globalThis.itemsCommonVerticalTimelineItemFormModule
                .get_common_timeline_item_form_fields();

            expect(result).toBe(false);
            expect(console.error).toHaveBeenCalled();
            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
                document.querySelector('#message'),
                'danger',
                'boom',
            );
        });
    });
});
