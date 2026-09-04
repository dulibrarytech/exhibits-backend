/**

 Copyright 2024 University of Denver

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 */

const exhibitsCommonFormModule = (function () {

    'use strict';

    const APP_PATH = endpointsModule.get_app_path();
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    /**
     * Configurable message container selector.
     * Defaults to '#message' (standalone page).
     * Call set_message_selector('#add-exhibit-message') before init()
     * when the form is rendered inside the add-exhibit modal.
     * @type {string}
     */
    let message_selector = '#message';

    /**
     * Sets the CSS selector used for displaying form messages.
     * Must be called before init() when the form lives in a modal
     * whose message container differs from the page-level '#message'.
     *
     * @param {string} selector - CSS selector for the message container
     */
    obj.set_message_selector = function (selector) {

        if (typeof selector === 'string' && selector.trim().length > 0) {
            message_selector = selector.trim();
        } else {
            console.warn('Invalid message selector provided, keeping current:', message_selector);
        }
    };

    /* ==================== SHARED DOM HELPERS ====================
     *
     * Module-scope one-liners shared by the edit / details / styles form
     * modules. Keep them here rather than inside a display function, where
     * they would be rebuilt on every render and could not be shared.
     */

    /**
     * Sets an element's value when the element exists and the value is not
     * null/undefined.
     * @param {string} selector
     * @param {*} value
     */
    const set_element_value = function (selector, value) {
        const element = document.querySelector(selector);

        if (element && value != null) {
            element.value = value;
        }
    };

    /**
     * Sets a checkbox's checked state.
     * @param {string} selector
     * @param {boolean} is_checked
     */
    const set_checkbox_state = function (selector, is_checked) {
        const element = document.querySelector(selector);

        if (element) {
            element.checked = Boolean(is_checked);
        }
    };

    /**
     * Sets an element's inline display value.
     * @param {string} selector
     * @param {string} display_value
     */
    const set_element_display = function (selector, display_value) {
        const element = document.querySelector(selector);

        if (element) {
            element.style.display = display_value;
        }
    };

    /**
     * Builds an <img> node.
     * @param {string} alt_text
     * @param {string} src
     * @returns {HTMLImageElement}
     */
    const create_image_element = function (alt_text, src) {
        const img = document.createElement('img');
        img.alt = alt_text || '';
        img.src = src;
        return img;
    };

    /**
     * Replaces a container's content with a single element node.
     * @param {string} selector
     * @param {Element} content_element
     */
    const set_element_content = function (selector, content_element) {
        const element = document.querySelector(selector);

        if (element && content_element) {
            element.innerHTML = '';
            element.appendChild(content_element);
        }
    };

    /**
     * Builds the small filename caption node used under a media preview.
     * @param {string} filename
     * @returns {HTMLSpanElement}
     */
    const create_filename_display = function (filename) {
        const span = document.createElement('span');
        span.style.fontSize = '11px';
        span.textContent = filename || '';
        return span;
    };

    /**
     * Checks the radio in `name` whose value matches. No-op for an empty value.
     * @param {string} name
     * @param {string} value
     */
    const set_radio_selection = function (name, value) {

        if (!value) {
            return;
        }

        const radio_buttons = document.getElementsByName(name);

        for (let i = 0; i < radio_buttons.length; i++) {
            if (radio_buttons[i].value === value) {
                radio_buttons[i].checked = true;
                break;
            }
        }
    };

    /**
     * Resolves the thumbnail URL for a media library asset or binding.
     * Same-origin thumbnail requests authenticate via the HttpOnly
     * exhibits_token cookie; no JWT is embedded in <img src>.
     * @param {Object} media - media record or exhibit media binding
     * @returns {string} URL, or '' when none can be built
     */
    obj.build_media_thumbnail_url = function (media) {

        if (!media) {
            return '';
        }

        const uuid = media.media_uuid || media.uuid;

        if (media.ingest_method === 'kaltura' && media.kaltura_thumbnail_url) {
            return media.kaltura_thumbnail_url;
        }

        if (media.ingest_method === 'repository' && media.repo_uuid) {
            return `${APP_PATH}/api/v1/media/library/repo/thumbnail?uuid=${encodeURIComponent(media.repo_uuid)}`;
        }

        if (uuid && media.thumbnail_path) {
            return `${APP_PATH}/api/v1/media/library/thumbnail/${uuid}`;
        }

        return '';
    };

    /**
     * Populates (or hides, when name is empty) a read-only Media Name display.
     * input_selector targets the input; its wrapper is `${input_selector}-group`.
     * @param {string} input_selector
     * @param {string} name
     */
    obj.set_media_name_display = function (input_selector, name) {
        const group = document.querySelector(`${input_selector}-group`);
        const input_el = document.querySelector(input_selector);
        const decoded = helperModule.unescape(name || '').trim();

        if (input_el) {
            input_el.value = decoded;
        }

        if (group) {
            group.style.display = decoded.length > 0 ? '' : 'none';
        }
    };

    /**
     * Renders a media preview thumbnail into a container (clearing it first).
     * @param {string} selector
     * @param {Object} media
     */
    obj.render_media_preview = function (selector, media) {
        const container = document.querySelector(selector);

        if (!container) {
            return;
        }

        container.innerHTML = '';

        const thumb_url = obj.build_media_thumbnail_url(media);

        if (thumb_url) {
            container.appendChild(create_image_element(media.alt_text || media.name, thumb_url));
        }
    };

    /**
     * Renders the small filename caption for a media slot.
     * @param {string} selector
     * @param {string} name
     */
    obj.render_filename_display = function (selector, name) {
        set_element_content(selector, create_filename_display(name || ''));
    };

    /* ==================== RECORD FETCH ==================== */

    /**
     * Fetches the exhibit record named by the `exhibit_id` URL parameter.
     *
     * Shared by the edit form, the details page and the styles form. The only
     * behavioural knob is `type`: 'edit' asks the API for an edit-mode read,
     * which acquires the record lock; 'details' does not.
     *
     * @param {Object} [options]
     * @param {string} [options.type='edit'] - 'edit' (acquires the lock) or 'details'
     * @param {boolean} [options.set_title=true] - set #exhibit-title from
     *     exhibitsModule.get_exhibit_title (fire and forget)
     * @returns {Promise<Object|null>} the record, or null after reporting the
     *     failure through domModule.set_alert
     */
    obj.get_exhibit_record = async function (options = {}) {

        const type = (options && options.type) === 'details' ? 'details' : 'edit';
        const set_title = !(options && options.set_title === false);

        /* Sets the page header title without blocking the record load. */
        const set_exhibit_title = async (uuid) => {
            const title_el = document.querySelector('#exhibit-title');

            if (!title_el) {
                console.warn('Exhibit title element not found');
                return;
            }

            try {
                const title = await exhibitsModule.get_exhibit_title(uuid);

                if (title) {
                    title_el.textContent = title;
                }
            } catch (error) {
                console.error('Error getting exhibit title:', error);
                /* Don't fail the entire operation if title fetch fails */
            }
        };

        try {

            if (!EXHIBITS_ENDPOINTS || typeof EXHIBITS_ENDPOINTS !== 'object') {
                console.error('EXHIBITS_ENDPOINTS is not available');
                domModule.set_alert('#message', 'danger', 'Configuration error: API endpoints not available');
                authModule.redirect_to_auth();
                return null;
            }

            const uuid = helperModule.get_parameter_by_name('exhibit_id');

            if (!uuid) {
                domModule.set_alert('#message', 'danger', 'Missing required parameter: exhibit_id');
                return null;
            }

            const profile = authModule.get_user_profile_data();

            if (!profile || !profile.uid) {
                console.error('User profile not available');
                domModule.set_alert('#message', 'warning', 'User profile error: Please log in again');
                authModule.redirect_to_auth();
                return null;
            }

            const endpoint_config = EXHIBITS_ENDPOINTS.exhibits?.exhibit_records?.endpoints?.get?.endpoint;

            if (!endpoint_config) {
                throw new Error('Endpoint configuration not found');
            }

            if (set_title) {
                set_exhibit_title(uuid).catch(error => {
                    console.error('Failed to set exhibit title:', error);
                });
            }

            const endpoint_base = endpointsModule.build(endpoint_config, { exhibit_id: uuid });

            if (!endpoint_base) {
                throw new Error('Endpoint configuration not found');
            }

            const query_params = new URLSearchParams();
            query_params.append('type', type);
            query_params.append('uid', profile.uid);

            const response = await httpModule.api({
                method: 'GET',
                url: `${endpoint_base}?${query_params.toString()}`
            });

            if (!response) {
                throw new Error('No response received from server');
            }

            if (response.status !== 200) {
                throw new Error(`Server returned status ${response.status}`);
            }

            if (!response.data || !response.data.data) {
                throw new Error('Invalid response structure from server');
            }

            /*
             * The API returns an object for a found record and an empty array
             * when the uuid matched nothing; `.length === 0` distinguishes the
             * two (an object's `.length` is undefined).
             */
            if (response.data.data.length === 0) {
                throw new Error('Exhibit record not found');
            }

            return response.data.data;

        } catch (error) {
            console.error('Error getting exhibit record:', error);
            domModule.set_alert('#message', 'danger', error.message || 'An unexpected error occurred while loading the exhibit record');
            return null;
        }
    };

    /* ==================== RECORD -> FORM ==================== */

    /**
     * Loads the exhibit's media library bindings.
     * @param {string} exhibit_uuid
     * @returns {Promise<Array|null>} bindings, [] when the shape was
     *     unexpected, or null when the endpoint is missing / the call threw
     */
    const load_media_bindings = async function (exhibit_uuid) {

        try {

            const endpoint_base = EXHIBITS_ENDPOINTS.exhibits?.exhibit_media_library?.get?.endpoint;

            if (!endpoint_base) {
                console.warn('exhibit_media_library GET endpoint not configured');
                return null;
            }

            const endpoint = endpointsModule.build(endpoint_base, { exhibit_id: exhibit_uuid });

            if (!endpoint) {
                return null;
            }

            const response = await httpModule.api({
                method: 'GET',
                url: endpoint
            });

            if (response && response.data && Array.isArray(response.data.data)) {
                return response.data.data;
            }

            return [];

        } catch (error) {
            console.error('Error loading media bindings:', error);
            return null;
        }
    };

    /**
     * Renders a media library binding into one media slot.
     * @param {Object} binding
     * @param {Object} slot - selector set for the slot
     * @param {boolean} editable - also write the -prev tracker, media name
     *     display and trash affordance (edit form only)
     */
    const set_media_binding_display = function (binding, slot, editable) {

        if (!binding) {
            return;
        }

        const thumb_url = obj.build_media_thumbnail_url(binding);

        if (thumb_url) {
            set_element_content(slot.display, create_image_element(binding.alt_text || binding.name, thumb_url));
        }

        set_element_content(slot.filename, create_filename_display(binding.name || binding.original_filename || ''));

        const uuid_el = document.querySelector(slot.uuid_input);

        if (uuid_el) {
            uuid_el.value = binding.media_uuid;
        }

        if (!editable) {
            return;
        }

        const prev_el = document.querySelector(slot.uuid_input + '-prev');

        if (prev_el) {
            prev_el.value = binding.media_uuid;
        }

        if (slot.name_display) {
            obj.set_media_name_display(slot.name_display, binding.name);
        }

        set_element_display(slot.trash, 'inline');
    };

    /**
     * Renders a legacy filename-based image into one media slot.
     * @param {Object} record
     * @param {string} field_name - 'hero_image' or 'thumbnail'
     * @param {Object} slot - selector set for the slot
     * @param {boolean} editable - also show the trash + legacy migration hint
     */
    const set_media_display = function (record, field_name, slot, editable) {

        const media_value = record[field_name];

        if (!media_value || media_value.length === 0) {
            return;
        }

        const media_url = `${APP_PATH}/api/v1/exhibits/${record.uuid}/media/${media_value}`;

        set_element_content(slot.display, create_image_element(media_value, media_url));
        set_element_content(slot.filename, create_filename_display(media_value));
        set_element_value(slot.legacy_input, media_value);
        set_element_value(slot.legacy_prev, media_value);

        if (editable) {
            set_element_display(slot.trash, 'inline');
            set_element_display(slot.legacy_migrate, 'block');
        }
    };

    /**
     * Selector sets for the exhibit's two media slots. The two slots do not
     * share an id prefix ('hero-image' vs 'thumbnail'), so they are spelled
     * out rather than derived.
     */
    const MEDIA_SLOTS = {
        hero_image: {
            display: '#hero-image-display',
            filename: '#hero-image-filename-display',
            uuid_input: '#hero-image-media-uuid',
            name_display: '#hero-image-media-name-display',
            trash: '#hero-trash',
            legacy_input: '#hero-image',
            legacy_prev: '#hero-image-prev',
            legacy_migrate: '#hero-legacy-migrate',
            record_field: 'hero_image'
        },
        thumbnail: {
            display: '#thumbnail-image-display',
            filename: '#thumbnail-filename-display',
            uuid_input: '#thumbnail-media-uuid',
            name_display: '#thumbnail-media-name-display',
            trash: '#thumbnail-trash',
            legacy_input: '#thumbnail-image',
            legacy_prev: '#thumbnail-image-prev',
            legacy_migrate: '#thumbnail-legacy-migrate',
            record_field: 'thumbnail'
        }
    };

    /**
     * Returns the selector set for one exhibit media slot.
     * @param {string} role - 'hero_image' or 'thumbnail'
     * @returns {Object|null}
     */
    obj.get_media_slot = function (role) {
        return MEDIA_SLOTS[role] || null;
    };

    /**
     * Writes a fetched exhibit record into the page's form fields.
     *
     * Shared by the edit form and the details page. `editable` is the one
     * axis of difference: the edit form additionally writes the `-prev`
     * trackers, the read-only media name displays, the trash affordances and
     * the legacy-migration hints, none of which the read-only details page
     * has.
     *
     * @param {Object} record - exhibit record from get_exhibit_record()
     * @param {Object} [options]
     * @param {boolean} [options.editable=false]
     * @returns {Promise<boolean>} true when the record was applied
     */
    obj.apply_record_to_form = async function (record, options = {}) {

        if (!record) {
            return false;
        }

        const editable = Boolean(options && options.editable);

        helperModule.render_record_meta('#created', record);

        set_element_value('#is-published', record.is_published === 1);

        rteModule.set_html('exhibit-title-input', helperModule.unescape(record.title || ''));
        rteModule.set_html('exhibit-sub-title-input', helperModule.unescape(record.subtitle || ''));
        rteModule.set_html('exhibit-description-input', helperModule.unescape(record.description || ''));
        rteModule.set_html('exhibit-about-the-curators-input', helperModule.unescape(record.about_the_curators || ''));
        set_element_value('#exhibit-owner', record.owner);

        set_checkbox_state('#is-featured', record.is_featured === 1);
        set_checkbox_state('#is-student-curated', record.is_student_curated === 1);

        if (record.alert_text && record.alert_text.length > 0) {
            set_checkbox_state('#is-content-advisory', true);
            set_element_value('#exhibit-alert-text-input', helperModule.unescape(record.alert_text));
        }

        /* Media library bindings first; fall back to the legacy filename display. */
        const bindings = await load_media_bindings(record.uuid);

        Object.keys(MEDIA_SLOTS).forEach(function (role) {

            const slot = MEDIA_SLOTS[role];
            const binding = bindings
                ? bindings.find(function (b) { return b.media_role === role; })
                : null;

            if (binding) {
                set_media_binding_display(binding, slot, editable);
            } else if (record[slot.record_field]) {
                set_media_display(record, slot.record_field, slot, editable);
            }
        });

        set_radio_selection('banner_template', record.banner_template);

        /*
         * Style fields, when the page renders the shared exhibit-styles
         * partial. exhibitsStylesModule is table-driven over
         * STYLE_SECTIONS x STYLE_PROPERTIES and no-ops on pages without
         * those fields.
         *
         * The details and edit pages render no style fields and do not load
         * exhibitsStylesModule at all, hence the typeof guard.
         */
        if (record.styles && typeof exhibitsStylesModule !== 'undefined') {

            try {
                const styles = typeof record.styles === 'string'
                    ? JSON.parse(record.styles)
                    : record.styles;

                exhibitsStylesModule.set_styles(styles);
            } catch (parse_error) {
                console.error('Error parsing styles JSON:', parse_error);
            }
        }

        return true;
    };

    /* ==================== MEDIA PICKER WIRING ==================== */

    /**
     * Wires one "Select Media" button to the shared media picker and applies
     * the chosen asset to its slot. Used by both the edit form and the add
     * form.
     *
     * @param {Object} options
     * @param {string} options.button_selector - e.g. '#pick-hero-image-btn'
     * @param {string} options.role - 'hero_image' or 'thumbnail'
     * @param {string|null} [options.exhibit_uuid] - null on the add form,
     *     where the binding is created after the exhibit exists
     * @param {string} [options.media_type_filter='image']
     * @returns {boolean} true when the button existed and was wired
     */
    obj.wire_media_picker = function (options = {}) {

        const opts = options || {};
        const slot = MEDIA_SLOTS[opts.role];
        const button = document.querySelector(opts.button_selector);

        if (!button || !slot) {
            return false;
        }

        button.addEventListener('click', function () {

            const prev_el = document.querySelector(slot.uuid_input + '-prev');

            mediaPickerModule.open({
                role: opts.role,
                exhibit_uuid: opts.exhibit_uuid || null,
                previous_media_uuid: prev_el ? prev_el.value || null : null,
                media_type_filter: opts.media_type_filter || 'image',
                on_select: function (media) {

                    set_element_value(slot.uuid_input, media.uuid);

                    const prev_track = document.querySelector(slot.uuid_input + '-prev');

                    if (prev_track) {
                        prev_track.value = media.uuid;
                    }

                    obj.render_media_preview(slot.display, media);
                    obj.render_filename_display(slot.filename, media.name || media.original_filename);
                    obj.set_media_name_display(slot.name_display, media.name);
                    set_element_display(slot.trash, 'inline');
                    set_element_display(slot.legacy_migrate, 'none');
                }
            });
        });

        return true;
    };

    /**
     * Clears one media slot's UI client-side (no API call).
     * @param {string} role - 'hero_image' or 'thumbnail'
     */
    obj.clear_media_slot_ui = function (role) {

        const slot = MEDIA_SLOTS[role];

        if (!slot) {
            return;
        }

        obj.restore_media_placeholder(slot.display);

        set_element_value(slot.legacy_input, '');
        set_element_value(slot.uuid_input, '');
        set_element_value(slot.uuid_input + '-prev', '');

        const filename_el = document.querySelector(slot.filename);

        if (filename_el) {
            filename_el.textContent = '';
        }

        obj.set_media_name_display(slot.name_display, '');
        set_element_display(slot.trash, 'none');
        set_element_display(slot.legacy_migrate, 'none');
    };

    /**
     * Restores the "No image selected" placeholder inside a preview area.
     * @param {string} display_selector
     */
    obj.restore_media_placeholder = function (display_selector) {

        const display_el = document.querySelector(display_selector);

        if (!display_el) {
            return;
        }

        display_el.innerHTML = '';

        const placeholder = document.createElement('div');
        placeholder.className = 'media-placeholder';

        const icon = document.createElement('i');
        icon.className = 'fa fa-picture-o';
        placeholder.appendChild(icon);

        const span = document.createElement('span');
        span.textContent = 'No image selected';
        placeholder.appendChild(span);

        display_el.appendChild(placeholder);
    };

    obj.get_common_form_fields = function () {

        // Cache all DOM selectors
        const selectors = {
            title: '#exhibit-title-input',
            subtitle: '#exhibit-sub-title-input',
            description: '#exhibit-description-input',
            curators: '#exhibit-about-the-curators-input',
            alert_text: '#exhibit-alert-text-input',
            is_featured: '#is-featured',
            is_student_curated: '#is-student-curated',
            is_content_advisory: '#is-content-advisory',
            owner: '#exhibit-owner',
            is_published: '#is-published',
            hero_image: '#hero-image',
            thumbnail: '#thumbnail-image',
            page_layout: '#exhibit-page-layout',
            template: '#exhibit-template',
            message: message_selector
        };

        // Helper function to safely get element value
        const get_element_value = (selector, default_value = '') => {
            const element = document.querySelector(selector);
            return element?.value?.trim() || default_value;
        };

        // Helper function to safely get checkbox state
        const get_checkbox_value = (selector) => {
            const element = document.querySelector(selector);
            return element?.checked ?? false;
        };

        // Helper function to convert boolean to binary integer
        const bool_to_int = (value) => value ? 1 : 0;

        // Helper function to safely convert to number
        const to_number = (value, default_value = null) => {
            if (value === null || value === undefined || value === '') {
                return default_value;
            }
            const num = Number(value);
            return isNaN(num) ? default_value : num;
        };

        try {
            // Clear any previous title validation state.
            const title_el = document.querySelector(selectors.title);
            const TITLE_ERROR_ID = 'exhibit-title-input-error';

            if (title_el) {
                title_el.classList.remove('is-invalid');
                domModule.clear_field_error(title_el, TITLE_ERROR_ID);
            }

            // Get rich text field values (serialized HTML; '' when empty)
            const title = rteModule.get_html('exhibit-title-input');
            const subtitle = rteModule.get_html('exhibit-sub-title-input');
            const description = rteModule.get_html('exhibit-description-input');
            const about_curators = rteModule.get_html('exhibit-about-the-curators-input');

            // Validate required field.
            if (!title) {

                if (title_el) {
                    title_el.classList.add('is-invalid');
                    domModule.set_field_error(title_el, TITLE_ERROR_ID, 'Title is required');
                    title_el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }

                return false;
            }

            // Get checkbox values
            const is_featured = get_checkbox_value(selectors.is_featured);
            const is_student_curated = get_checkbox_value(selectors.is_student_curated);
            const is_content_advisory = get_checkbox_value(selectors.is_content_advisory);

            // Get conditional alert text (fixed boilerplate in a hidden input)
            const alert_text = is_content_advisory
                ? get_element_value(selectors.alert_text)
                : '';

            // Get optional fields (may not exist in all forms)
            const owner_value = get_element_value(selectors.owner);
            const is_published_value = get_element_value(selectors.is_published);

            // Get media fields
            const hero_image = get_element_value(selectors.hero_image);
            const thumbnail = get_element_value(selectors.thumbnail);

            // Get media library UUIDs (from picker flow)
            const hero_image_media_uuid = get_element_value('#hero-image-media-uuid');
            const thumbnail_media_uuid = get_element_value('#thumbnail-media-uuid');

            // Get banner template from radio buttons
            const banner_elements = document.getElementsByName('banner_template');
            const banner_template = banner_elements.length > 0
                ? helperModule.get_checked_radio_button(banner_elements)
                : '';

            // Get layout fields
            const page_layout = get_element_value(selectors.page_layout);
            const exhibit_template = get_element_value(selectors.template);

            // Construct exhibit object
            const exhibit = {
                title,
                subtitle,
                description,
                about_the_curators: about_curators,
                is_featured: bool_to_int(is_featured),
                is_student_curated: bool_to_int(is_student_curated),
                alert_text: alert_text,
                hero_image: hero_image,
                thumbnail: thumbnail,
                banner_template: banner_template,
                page_layout: page_layout,
                exhibit_template: exhibit_template
            };

            // Add media library UUIDs if present (from media picker flow)
            if (hero_image_media_uuid) {
                exhibit.hero_image_media_uuid = hero_image_media_uuid;
            }

            if (thumbnail_media_uuid) {
                exhibit.thumbnail_media_uuid = thumbnail_media_uuid;
            }

            // Add optional fields only if they have values, converted to Number
            if (owner_value) {
                const owner_number = to_number(owner_value, null);
                if (owner_number !== null) {
                    exhibit.owner = owner_number;
                }
            }

            if (is_published_value) {
                const is_published_number = to_number(is_published_value, null);
                if (is_published_number !== null) {
                    exhibit.is_published = is_published_number;
                }
            }

            return exhibit;

        } catch (error) {
            // Log error for debugging
            console.error('Error getting form fields:', error);

            // Display safe error message
            domModule.set_alert(selectors.message, 'danger', 'An error occurred while processing form data');

            return false;
        }
    };

    /**
     * Deletes hero image
     */
    obj.delete_hero_image = async function () {

        // Constants
        const MESSAGE_CLEAR_DELAY = 3000; // 3 seconds

        // Helper function to safely clear element content
        const clear_element = (selector) => {
            const element = document.querySelector(selector);
            if (element) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.value = '';
                } else {
                    element.innerHTML = '';
                }
            }
        };

        // Helper function to safely set element display
        const set_element_display = (selector, display_value) => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = display_value;
            }
        };

        // Helper function to clear hero image UI
        const clear_hero_image_ui = () => {
            clear_element('#hero-image');
            clear_element('#hero-image-filename-display');
            clear_element('#hero-image-display');
            clear_element('#hero-image-media-uuid');
            set_element_display('#hero-trash', 'none');
        };

        // Helper function to build query string safely
        const build_query_string = (params) => {
            const query_params = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
                if (value != null) {
                    query_params.append(key, value);
                }
            }
            return query_params.toString();
        };

        // Store timeout ID for cleanup
        let timeout_id = null;

        try {
            // Validate endpoints configuration
            if (!EXHIBITS_ENDPOINTS || typeof EXHIBITS_ENDPOINTS !== 'object') {
                throw new Error('API endpoints configuration not available');
            }

            // Get and validate hero image value
            const hero_image_el = document.querySelector('#hero-image');
            if (!hero_image_el) {
                throw new Error('Hero image input element not found');
            }

            const hero_image = hero_image_el.value?.trim();
            if (!hero_image) {
                domModule.set_alert(message_selector, 'warning', 'No hero image to delete');
                return false;
            }

            // Validate endpoint configuration exists
            const endpoint_base = EXHIBITS_ENDPOINTS.exhibits?.media?.delete?.endpoint;
            if (!endpoint_base) {
                throw new Error('Endpoint configuration not found');
            }

            // Build endpoint URL with safe query parameter encoding
            const query_string = build_query_string({ media: hero_image });
            const endpoint = `${endpoint_base}?${query_string}`;

            // Show loading state
            domModule.set_alert(message_selector, 'info', 'Deleting hero image...');

            const response = await httpModule.api({
                method: 'DELETE',
                url: endpoint
            });

            // Validate response
            if (!response) {
                throw new Error('No response received from server');
            }

            if (response.status !== 204) {
                throw new Error(`Failed to delete hero image. Server returned status ${response.status}`);
            }

            // Clear hero image UI elements
            clear_hero_image_ui();

            // Show success message
            domModule.set_alert(message_selector, 'success', 'Hero image deleted successfully');

            // Clear message after delay
            timeout_id = setTimeout(() => {
                clear_element(message_selector);
            }, MESSAGE_CLEAR_DELAY);

            return true;

        } catch (error) {
            // Clear any pending timeouts
            if (timeout_id) {
                clearTimeout(timeout_id);
            }

            // Log error for debugging
            console.error('Error deleting hero image:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An unexpected error occurred while deleting the hero image';
            domModule.set_alert(message_selector, 'danger', error_message);

            return false;
        }
    };

    obj.delete_thumbnail_image = async function () {

        // Constants
        const MESSAGE_CLEAR_DELAY = 3000; // 3 seconds

        // Helper function to safely clear element content
        const clear_element = (selector) => {
            const element = document.querySelector(selector);
            if (element) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.value = '';
                } else {
                    element.innerHTML = '';
                }
            }
        };

        // Helper function to safely set element display
        const set_element_display = (selector, display_value) => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = display_value;
            }
        };

        // Helper function to clear thumbnail image UI
        const clear_thumbnail_ui = () => {
            clear_element('#thumbnail-image');
            clear_element('#thumbnail-filename-display');
            clear_element('#thumbnail-image-display');
            clear_element('#thumbnail-media-uuid');
            set_element_display('#thumbnail-trash', 'none');
        };

        // Helper function to build query string safely
        const build_query_string = (params) => {
            const query_params = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
                if (value != null) {
                    query_params.append(key, value);
                }
            }
            return query_params.toString();
        };

        // Store timeout ID for cleanup
        let timeout_id = null;

        try {
            // Validate endpoints configuration
            if (!EXHIBITS_ENDPOINTS || typeof EXHIBITS_ENDPOINTS !== 'object') {
                throw new Error('API endpoints configuration not available');
            }

            // Get and validate thumbnail image value
            const thumbnail_image_el = document.querySelector('#thumbnail-image');
            if (!thumbnail_image_el) {
                throw new Error('Thumbnail image input element not found');
            }

            const thumbnail_image = thumbnail_image_el.value?.trim();
            if (!thumbnail_image) {
                domModule.set_alert(message_selector, 'warning', 'No thumbnail image to delete');
                return false;
            }

            // Validate endpoint configuration exists
            const endpoint_base = EXHIBITS_ENDPOINTS.exhibits?.media?.delete?.endpoint;
            if (!endpoint_base) {
                throw new Error('Endpoint configuration not found');
            }

            // Build endpoint URL with safe query parameter encoding
            const query_string = build_query_string({ media: thumbnail_image });
            const endpoint = `${endpoint_base}?${query_string}`;

            // Show loading state
            domModule.set_alert(message_selector, 'info', 'Deleting thumbnail image...');

            const response = await httpModule.api({
                method: 'DELETE',
                url: endpoint
            });

            // Validate response
            if (!response) {
                throw new Error('No response received from server');
            }

            if (response.status !== 204) {
                throw new Error(`Failed to delete thumbnail image. Server returned status ${response.status}`);
            }

            // Clear thumbnail image UI elements
            clear_thumbnail_ui();

            // Show success message
            domModule.set_alert(message_selector, 'success', 'Thumbnail image deleted successfully');

            // Clear success message after delay
            timeout_id = setTimeout(() => {
                clear_element(message_selector);
            }, MESSAGE_CLEAR_DELAY);

            return true;

        } catch (error) {
            // Clear any pending timeouts
            if (timeout_id) {
                clearTimeout(timeout_id);
            }

            // Log error for debugging
            console.error('Error deleting thumbnail image:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An unexpected error occurred while deleting the thumbnail image';
            domModule.set_alert(message_selector, 'danger', error_message);

            return false;
        }
    };

    obj.init = async function () {

        // Helper function to safely set element display
        const set_element_display = (selector, display_value) => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = display_value;
            } else {
                console.warn(`Element not found: ${selector}`);
            }
        };

        try {

            // Check authentication
            const token = authModule.get_user_token();
            if (!token) {
                throw new Error('Authentication token not available');
            }
            await authModule.check_auth(token);

            // Initialize navigation
            if (navModule && typeof navModule.init === 'function') {
                navModule.init();
            }

            // Hide trash buttons initially
            set_element_display('#hero-trash', 'none');
            set_element_display('#thumbnail-trash', 'none');

            // Show form
            if (helperModule && typeof helperModule.show_form === 'function') {
                helperModule.show_form();
            }

            console.debug('Module initialized successfully');
            return true;

        } catch (error) {
            // Log error for debugging
            console.error('Error initializing module:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An error occurred during initialization';
            domModule.set_alert(message_selector, 'danger', error_message);

            return false;
        }
    };

    return obj;

}());
