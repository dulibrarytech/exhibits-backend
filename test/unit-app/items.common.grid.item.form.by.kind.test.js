// @vitest-environment jsdom

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(
    __dirname,
    '../../public/app/grid-items/items.common.grid.item.form.module.js',
);

const REQUIRED_LABEL = 'Exhibit Text <span class="badge badge-required">Required</span>';

function load_module() {
    const src = readFileSync(MODULE_PATH, 'utf8');
    const patched = src.replace(
        /^const\s+itemsCommonGridItemFormModule\s*=/m,
        'globalThis.itemsCommonGridItemFormModule =',
    );
    (0, eval)(patched);
    return globalThis.itemsCommonGridItemFormModule;
}

function build_form() {
    document.body.innerHTML = `
        <div id="message"></div>
        <div id="item-media-card" class="card">
            <div class="card-header"></div>
            <div id="item-media-display"></div>
            <span id="item-media-filename-display"></span>
            <a href="#" id="item-media-trash" style="display:none"></a>
            <input type="hidden" id="item-media-uuid" />
            <input type="hidden" id="item-media-uuid-prev" />
            <input type="hidden" id="item-media-type" />
            <input type="hidden" id="item-mime-type" />
            <button type="button" id="pick-item-media-btn"></button>
            <div id="thumbnail-image-display"></div>
            <span id="thumbnail-filename-display"></span>
            <a href="#" id="thumbnail-trash" style="display:none"></a>
            <input type="hidden" id="thumbnail-media-uuid" />
            <input type="hidden" id="thumbnail-media-uuid-prev" />
            <button type="button" id="pick-thumbnail-btn"></button>
            <div id="is-media-only-caption" style="display: none">
                <textarea id="item-caption-input"></textarea>
            </div>
            <div id="embed-item-group" class="form-group">
                <input type="checkbox" id="embed-item" />
            </div>
        </div>
        <div id="item-data-card" class="card">
            <div class="card-header">
                <div class="btn-group"><span id="created"></span></div>
            </div>
            <span id="item-title-input-label">Title</span>
            <input type="text" id="item-title-input" />
            <span id="is-required-text">${REQUIRED_LABEL}</span>
            <input type="text" id="item-text-input" />
            <div id="is-media-only-description" style="display: none">
                <input type="text" id="item-description-input" />
            </div>
        </div>
        <input type="radio" name="layout" value="media_right" />
        <input type="radio" name="layout" value="media_top" checked />
        <input type="radio" name="layout" value="media_bottom" />
        <input type="radio" name="media_width" value="25" />
        <input type="radio" name="media_width" value="50" checked />
        <input type="radio" name="media_width" value="100" />
    `;
}

const value_of = (selector) => document.querySelector(selector).value;
const display_of = (selector) => document.querySelector(selector).style.display;
const checked_value = (name) => document.querySelector(`input[name="${name}"]:checked`).value;

const MEDIA_RECORD = {
    title: 'Photo',
    text: '<p>Body</p>',
    description: '<p>About</p>',
    caption: 'Tom &amp; Jerry',
    media_uuid: 'media-1',
    item_type: 'image',
    mime_type: 'image/jpeg',
    media_thumbnail_path: '/thumbs/a.jpg',
    thumbnail_media_uuid: 'thumb-1',
    layout: 'media_right',
    media_width: 25,
    is_embedded: 1,
};

describe('itemsCommonGridItemFormModule by item kind', () => {

    let form;

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});

        globalThis.endpointsModule = { get_app_path: () => '/exhibits-dashboard' };
        globalThis.authModule = { get_user_token: () => 'test-token' };
        globalThis.rteModule = {
            get_html: (id) => document.getElementById(id)?.value?.trim() ?? '',
            set_html: (id, html) => {
                const el = document.getElementById(id);
                if (el) el.value = html ?? '';
            },
        };
        globalThis.domModule = {
            html: (selector, markup) => {
                const el = document.querySelector(selector);
                if (el) el.innerHTML = markup;
            },
            set_alert: vi.fn(),
            set_field_error: vi.fn(),
            clear_field_error: vi.fn(),
        };
        globalThis.helperModule = {
            get_parameter_by_name: (name) => (name === 'exhibit_id' ? 'exhibit-1' : null),
            get_checked_radio_button: (els) => {
                for (const el of els) {
                    if (el.checked) return el.value;
                }
                return '';
            },
            unescape: (value) => (typeof value === 'string' ? value.replace(/&amp;/g, '&') : value),
            bind_embed_description: vi.fn(() => true),
            toggle_media_deleted_warning: vi.fn(),
        };
        globalThis.mediaPickerModule = {
            open: vi.fn(),
            remove_exhibit_association: vi.fn(),
        };

        window.history.pushState({}, '', '/exhibits-dashboard/items/grid/items');
        build_form();
        form = load_module();
    });

    describe('prepare', () => {

        it('marks the text as required and keeps the media-only fields hidden for a text item', () => {
            document.querySelector('#is-required-text').innerHTML = 'Text';

            form.prepare('text');

            expect(document.querySelector('#is-required-text').innerHTML).toBe(REQUIRED_LABEL);
            expect(display_of('#is-media-only-description')).toBe('none');
            expect(display_of('#is-media-only-caption')).toBe('none');
        });

        it('shows the media-only fields and drops the required badge for a media item', () => {
            form.prepare('media');

            expect(document.querySelector('#is-required-text').innerHTML).toBe('Exhibit Text');
            expect(display_of('#is-media-only-description')).toBe('');
            expect(display_of('#is-media-only-caption')).toBe('');
            expect(document.querySelector('#item-media-card .card-header #created')).not.toBeNull();
            expect(globalThis.helperModule.bind_embed_description)
                .toHaveBeenCalledWith('embed-item', 'item-description-input');
        });

        it('opens the media picker once per click however often a media item is prepared', () => {
            form.prepare('media');
            form.prepare('media');

            document.querySelector('#pick-item-media-btn').click();

            expect(globalThis.mediaPickerModule.open).toHaveBeenCalledTimes(1);
            expect(globalThis.mediaPickerModule.open).toHaveBeenCalledWith(
                expect.objectContaining({ role: 'item_media', exhibit_uuid: 'exhibit-1' }),
            );
        });

        it('leaves the picker buttons unwired on a read-only form', () => {
            form.prepare('media', { read_only: true });

            document.querySelector('#pick-item-media-btn').click();
            document.querySelector('#pick-thumbnail-btn').click();

            expect(globalThis.mediaPickerModule.open).not.toHaveBeenCalled();
            expect(display_of('#is-media-only-description')).toBe('');
        });

        it('switches a form prepared for media back to text', () => {
            form.prepare('media');
            form.prepare('text');

            expect(document.querySelector('#is-required-text').innerHTML).toBe(REQUIRED_LABEL);
            expect(display_of('#is-media-only-description')).toBe('none');
            expect(display_of('#is-media-only-caption')).toBe('none');
        });

        it('changes nothing for a kind it does not know', () => {
            form.prepare('content_block');

            expect(document.querySelector('#is-required-text').innerHTML).toBe(REQUIRED_LABEL);
            expect(display_of('#is-media-only-description')).toBe('none');
            expect(globalThis.helperModule.bind_embed_description).not.toHaveBeenCalled();
        });
    });

    describe('fill', () => {

        it('fills a text item and leaves the media fields alone', () => {
            form.fill({ ...MEDIA_RECORD, layout: 'media_bottom', media_width: '100', is_embedded: 0 }, 'text');

            expect(value_of('#item-title-input')).toBe('Photo');
            expect(value_of('#item-text-input')).toBe('<p>Body</p>');
            expect(checked_value('layout')).toBe('media_bottom');
            expect(checked_value('media_width')).toBe('100');
            expect(document.querySelector('#embed-item').checked).toBe(false);
            expect(value_of('#item-media-uuid')).toBe('');
            expect(value_of('#item-description-input')).toBe('');
            expect(value_of('#item-caption-input')).toBe('');
        });

        it('fills a media item with its media, description and caption', () => {
            form.fill(MEDIA_RECORD, 'media');

            expect(value_of('#item-media-uuid')).toBe('media-1');
            expect(value_of('#item-media-type')).toBe('image');
            expect(value_of('#thumbnail-media-uuid')).toBe('thumb-1');
            expect(document.querySelector('#item-media-display img')).not.toBeNull();
            expect(value_of('#item-description-input')).toBe('<p>About</p>');
            expect(value_of('#item-caption-input')).toBe('Tom & Jerry');
            expect(checked_value('layout')).toBe('media_right');
            expect(checked_value('media_width')).toBe('25');
            expect(document.querySelector('#embed-item').checked).toBe(true);
        });

        it('tells the embed checkbox it changed', () => {
            const on_change = vi.fn();
            document.querySelector('#embed-item').addEventListener('change', on_change);

            form.fill(MEDIA_RECORD, 'media');

            expect(on_change).toHaveBeenCalledTimes(1);
        });

        it('keeps the form defaults when the record has no layout or width', () => {
            form.fill({ title: 'Plain', text: 'Body' }, 'text');

            expect(checked_value('layout')).toBe('media_top');
            expect(checked_value('media_width')).toBe('50');
        });

        it('does nothing without a record', () => {
            form.fill(null, 'media');
            form.fill(undefined, 'text');

            expect(value_of('#item-title-input')).toBe('');
            expect(value_of('#item-media-uuid')).toBe('');
        });
    });

    describe('collect', () => {

        it('requires text for a text item whatever the page address is', () => {
            expect(form.collect('text')).toBe(false);
            expect(globalThis.domModule.set_field_error).toHaveBeenCalledWith(
                '#item-text-input', 'item-text-input-error', 'Please enter "Text" for this item',
            );
        });

        it('requires media for a media item whatever the page address is', () => {
            document.querySelector('#item-text-input').value = 'Body';

            expect(form.collect('media')).toBe(false);
            expect(globalThis.domModule.set_field_error).toHaveBeenCalledWith(
                '#item-media-uuid', 'item-media-uuid-error', 'Please select a media item',
            );
        });

        it('builds a text item', () => {
            document.querySelector('#item-title-input').value = 'A title';
            document.querySelector('#item-text-input').value = '<p>Body</p>';

            const item = form.collect('text');

            expect(item).toMatchObject({
                title: 'A title',
                text: '<p>Body</p>',
                item_type: 'text',
                mime_type: 'text/plain',
                layout: 'media_top',
                media_width: '50',
                is_embedded: 0,
            });
            expect(item).not.toHaveProperty('media_uuid');
            expect(item).not.toHaveProperty('caption');
        });

        it('allows a media item with no text', () => {
            document.querySelector('#item-media-uuid').value = 'media-1';
            document.querySelector('#item-media-type').value = 'image';
            document.querySelector('#item-mime-type').value = 'image/jpeg';

            expect(form.collect('media')).toMatchObject({
                media_uuid: 'media-1',
                item_type: 'image',
                mime_type: 'image/jpeg',
                text: '',
            });
        });

        it('reads back what fill wrote for a media item', () => {
            form.fill(MEDIA_RECORD, 'media');

            expect(form.collect('media')).toMatchObject({
                title: 'Photo',
                text: '<p>Body</p>',
                description: '<p>About</p>',
                caption: 'Tom & Jerry',
                media_uuid: 'media-1',
                item_type: 'image',
                mime_type: 'image/jpeg',
                thumbnail_media_uuid: 'thumb-1',
                layout: 'media_right',
                media_width: '25',
                is_embedded: 1,
            });
        });

        it('reads back what fill wrote for a text item', () => {
            form.fill({ title: 'A title', text: '<p>Body</p>', layout: 'media_bottom', media_width: 100 }, 'text');

            expect(form.collect('text')).toMatchObject({
                title: 'A title',
                text: '<p>Body</p>',
                item_type: 'text',
                layout: 'media_bottom',
                media_width: '100',
            });
        });
    });
});
