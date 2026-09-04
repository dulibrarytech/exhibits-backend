/**

 Copyright 2025 University of Denver

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 Design history and rationale: NOTES/EXHIBITS_BACKEND_CODE_NOTES.md

 */

/*
 * Config-driven base for the add / edit / details forms of the four item
 * families (standard item, heading, grid + grid item, timeline + timeline
 * item).
 *
 * A form's configuration supplies only what differs between families: which
 * endpoint keys to use, which URL query parameters name the record's ids, the
 * noun in the status messages, and the field population / collection hooks.
 * Everything else lives here once.
 *
 * The RECORD_TYPES table below follows the same shape as lockModule's
 * path -> unlock-endpoint config table: one row per record type, naming the
 * endpoint registry nodes and the id parameters. A per-type module names its
 * row and supplies `populate` / `collect` hooks.
 */

const itemFormBaseModule = (function () {

    'use strict';

    const obj = {};

    /* Success alerts are cleared after this delay. */
    const MESSAGE_CLEAR_DELAY = 3000;

    /* The add forms show their success alert this long before replacing the
     * page with the edit form. */
    const REDIRECT_DELAY = 1200;

    /* After a successful save the submit button is disabled this long so a
     * double-click cannot fire a second PUT. */
    const SUBMIT_RELOCK_DELAY = 1000;

    /* Longest accepted id; anything longer is rejected as "Invalid parameter
     * length" before a URL is built from it. */
    const MAX_ID_LENGTH = 255;

    const EXHIBIT_PARAM = { param: 'exhibit_id', key: 'exhibit_id' };

    /**
     * Record-type table. Each row names, for one record type:
     *   label          - noun used to build the status messages
     *   endpoints      - dot paths into EXHIBITS_ENDPOINTS.exhibits
     *   parent_params  - ids that address the collection (used by POST)
     *   record_param   - the id that addresses one record (GET / PUT)
     *   edit_path      - path of the edit page, or a function returning it
     *                    (the media/text families pick the form from the URL)
     *   messages       - the per-type strings that are not derived from label
     *
     * `param` is the URL query-string parameter the page carries; `key` is
     * the `:placeholder` name in the endpoint template. They differ wherever
     * a container is addressed as the page's `item_id` (a grid edit page's
     * `item_id` is the endpoint's `:grid_id`).
     */
    const RECORD_TYPES = {

        item: {
            label: 'Item',
            endpoints: { get: 'item_records.get', post: 'item_records.post', put: 'item_records.put' },
            parent_params: [EXHIBIT_PARAM],
            record_param: { param: 'item_id', key: 'item_id' },
            edit_path: function () {
                return '/items/standard/' + form_type_from_path() + '/edit';
            },
            messages: {
                missing_record_ids: 'Missing required record identifiers',
                missing_parent_ids: 'Missing exhibit ID. Cannot create item record.',
                permission_denied: 'Permission denied. You do not have access to add items to this exhibit.'
            }
        },

        heading: {
            label: 'Heading',
            endpoints: { get: 'heading_records.get', post: 'heading_records.post', put: 'heading_records.put' },
            parent_params: [EXHIBIT_PARAM],
            record_param: { param: 'item_id', key: 'heading_id' },
            edit_path: '/items/heading/edit',
            messages: {
                missing_record_ids: 'Missing required parameters: exhibit_id or item_id',
                missing_parent_ids: 'Missing exhibit ID. Cannot create heading record.',
                permission_denied: 'Permission denied. You do not have access to add items to this exhibit.',
                creating: 'Creating item heading record...'
            }
        },

        grid: {
            label: 'Grid',
            endpoints: { get: 'grid_records.get', post: 'grid_records.post', put: 'grid_records.put' },
            parent_params: [EXHIBIT_PARAM],
            record_param: { param: 'item_id', key: 'grid_id' },
            edit_path: '/items/grid/edit',
            messages: {
                missing_record_ids: 'Missing required parameters: exhibit_id or grid_id',
                missing_parent_ids: 'Missing exhibit ID. Cannot create grid record.',
                permission_denied: 'Permission denied. You do not have access to add items to this exhibit.',
                update_success: 'Grid record updated'
            }
        },

        grid_item: {
            label: 'Grid item',
            endpoints: { get: 'grid_item_record.get', post: 'grid_item_records.post', put: 'grid_item_records.put' },
            parent_params: [EXHIBIT_PARAM, { param: 'grid_id', key: 'grid_id' }],
            record_param: { param: 'item_id', key: 'item_id' },
            edit_path: function () {
                return '/items/grid/item/' + form_type_from_path() + '/edit';
            },
            messages: {
                missing_record_ids: 'Missing required parameters: exhibit_id, grid_id, or item_id',
                missing_parent_ids: 'Missing exhibit ID or grid ID. Cannot create grid item record.',
                permission_denied: 'Permission denied. You do not have access to add items to this grid.'
            }
        },

        timeline: {
            label: 'Timeline',
            endpoints: { get: 'timeline_records.get', post: 'timeline_records.post', put: 'timeline_records.put' },
            parent_params: [EXHIBIT_PARAM],
            record_param: { param: 'item_id', key: 'timeline_id' },
            edit_path: '/items/vertical-timeline/edit',
            messages: {
                missing_record_ids: 'Missing required parameters: exhibit_id or timeline_id',
                missing_parent_ids: 'Missing exhibit ID. Cannot create timeline record.',
                permission_denied: 'Permission denied. You do not have access to add items to this exhibit.'
            }
        },

        timeline_item: {
            label: 'Timeline item',
            endpoints: {
                get: 'timeline_item_record.get',
                post: 'timeline_item_records.post',
                put: 'timeline_item_records.put'
            },
            parent_params: [EXHIBIT_PARAM, { param: 'timeline_id', key: 'timeline_id' }],
            record_param: { param: 'item_id', key: 'item_id' },
            edit_path: function () {
                return '/items/vertical-timeline/item/' + form_type_from_path() + '/edit';
            },
            messages: {
                missing_record_ids: 'Missing required parameters: exhibit_id, timeline_id, or item_id',
                missing_parent_ids: 'Missing exhibit ID or timeline ID. Cannot create timeline item record.',
                permission_denied: 'Permission denied. You do not have access to add items to this timeline.'
            }
        }
    };

    /**
     * 'media' or 'text' for the families whose add/edit pages come in both
     * flavours; taken from the current path.
     * @returns {string}
     */
    function form_type_from_path() {
        return window.location.pathname.indexOf('media') !== -1 ? 'media' : 'text';
    }

    /**
     * Resolves a dot path ('grid_item_record.get') inside the exhibits
     * endpoint registry and returns the endpoint template, or null when the
     * registry does not carry it.
     * @param {string} dot_path
     * @returns {string|null}
     */
    function endpoint_template(dot_path) {

        const registry = endpointsModule.get_exhibits_endpoints();
        let node = registry && registry.exhibits;

        const keys = String(dot_path || '').split('.');

        for (const key of keys) {

            if (!node || typeof node !== 'object') {
                return null;
            }

            node = node[key];
        }

        return (node && typeof node.endpoint === 'string') ? node.endpoint : null;
    }

    /**
     * Reads a list of id parameter definitions off the current URL.
     * @param {Array} definitions - [{param, key}]
     * @param {string} error_message - message for a missing id
     * @returns {{valid: boolean, error?: string, keys?: Object, params?: Object}}
     */
    function read_ids(definitions, error_message) {

        const keys = {};
        const params = {};

        for (const definition of definitions) {

            const value = helperModule.get_parameter_by_name(definition.param);

            if (!value) {
                return { valid: false, error: error_message };
            }

            if (String(value).length > MAX_ID_LENGTH) {
                return { valid: false, error: 'Invalid parameter length' };
            }

            keys[definition.key] = value;
            params[definition.param] = value;
        }

        return { valid: true, keys: keys, params: params };
    }

    /**
     * Builds the message set for one form from the record type's label, the
     * type row's own overrides, and finally the module's overrides.
     * @param {Object} type
     * @param {Object} overrides
     * @returns {Object}
     */
    function build_messages(type, overrides) {

        const label = type.label;
        const noun = label.toLowerCase();

        const derived = {
            load_error: `Unable to load the ${noun} record. Please try again.`,
            display_error: `Unable to display the ${noun} record. Please try again.`,
            updating: `Updating ${noun} record...`,
            creating: `Creating ${noun} record...`,
            update_success: `${label} record updated successfully`,
            create_success: `${label} record created successfully. Redirecting to edit page...`,
            update_error: `Unable to update ${noun} record. Please try again.`,
            create_error: `Unable to create ${noun} record. Please try again.`,
            endpoint_missing: 'API endpoint configuration missing',
            invalid_profile: 'Invalid user profile data',
            already_editing: 'Already in edit mode.',
            no_new_id: `Server did not return a valid ${noun} ID`
        };

        return Object.assign(derived, type.messages || {}, overrides || {});
    }

    /**
     * Temporarily disables the submit button and drops the unsaved-changes
     * guard after a successful save.
     * @param {string} submit_card_selector
     */
    function reset_form_state(submit_card_selector) {

        const submit_button = document.querySelector(`${submit_card_selector} button[type="submit"], button[type="submit"]`);

        if (submit_button) {

            submit_button.disabled = true;

            setTimeout(() => {
                submit_button.disabled = false;
            }, SUBMIT_RELOCK_DELAY);
        }

        /* Clear the unsaved-changes warning the cancel/navigation guard sets. */
        window.onbeforeunload = null;
    }

    /**
     * Makes a details page read-only after its fields have been populated.
     */
    obj.disable_all_fields = function () {

        const form_elements = document.querySelectorAll(
            'input:not([type="hidden"]), textarea, select, button[type="button"]:not(#edit-item-btn)'
        );

        /* Rich text editors are div-based and not caught by the selector above */
        if (typeof rteModule !== 'undefined') {
            rteModule.set_all_enabled(false);
        }

        form_elements.forEach(element => {
            if (!element.disabled && !element.readOnly) {
                element.disabled = true;
            }
        });

        /* Hide media picker buttons and trash links (not applicable on details view) */
        document.querySelectorAll('#pick-item-media-btn, #pick-thumbnail-btn').forEach(button => {
            button.style.display = 'none';
        });

        document.querySelectorAll('#item-media-trash, #thumbnail-trash').forEach(link => {
            link.style.display = 'none';
        });
    };

    /**
     * Scrolls the page to the top so an alert written into #message is
     * visible. Called before writing a status message.
     */
    function scroll_to_top() {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }

    /**
     * Builds one form's behaviour from its configuration.
     *
     * @param {Object} config
     * @param {string} config.record_type - key into RECORD_TYPES
     * @param {string} config.mode - 'add' | 'edit' | 'details'
     * @param {Function} [config.populate] - (record) => void|Promise, called
     *        after the audit line is rendered (edit and details)
     * @param {Function} [config.collect] - () => Object|false, the form's
     *        field collector; false means it has already reported the
     *        validation failure (add and edit)
     * @param {string} [config.submit_selector] - save button (add and edit)
     * @param {string} [config.submit_card_selector='#item-submit-card']
     * @param {string} [config.created_selector='#created'] - audit-line node
     * @param {Object|false} [config.lock] - {card_selector} to run the
     *        check_if_locked / disable / auto-unlock trio (edit only). The
     *        container edit forms pass false: they do not request
     *        `?type=edit`, so the server never locks the record for them.
     * @param {boolean} [config.disable_fields=false] - make the page
     *        read-only after populating (details)
     * @param {Object} [config.query] - GET query: {type: 'edit'|'details'|
     *        null, uid: boolean}. Defaults by mode.
     * @param {string[]} [config.permissions] - passed to check_permissions
     * @param {string} [config.permission_record_type] - defaults to record_type
     * @param {Function} [config.redirect_path] - (ids) => path used as the
     *        403 redirect for check_permissions
     * @param {boolean} [config.show_denied_banner=false] - render the
     *        "?status=403" banner on load (details pages)
     * @param {Function} [config.on_init] - extra init step, awaited last
     * @param {Object} [config.messages] - message overrides
     * @returns {Object} {get_record, display_record, submit_record, init}
     */
    obj.create = function (config) {

        const settings = config || {};
        const type = RECORD_TYPES[settings.record_type];

        if (!type) {
            throw new Error(`itemFormBaseModule: unknown record_type "${settings.record_type}"`);
        }

        const mode = settings.mode;
        const messages = build_messages(type, settings.messages);
        const created_selector = settings.created_selector || '#created';
        const submit_card_selector = settings.submit_card_selector || '#item-submit-card';
        const record_params = type.parent_params.concat([type.record_param]);
        const log_tag = settings.record_type;

        const query_defaults = (mode === 'details')
            ? { type: 'details', uid: false }
            : { type: 'edit', uid: true };
        const query = Object.assign({}, query_defaults, settings.query || {});

        /* Reentrancy guard. Must stay a closure variable, not a property of
         * `this` — under addEventListener `this` is the button element. */
        let is_submitting = false;

        const form = {};

        /**
         * Fetches the record addressed by the page's URL parameters.
         * @returns {Promise<Object|null>} null when the record could not be
         *          loaded; the failure has already been reported.
         */
        form.get_record = async function () {

            const message_element = document.querySelector('#message');

            try {

                const ids = read_ids(record_params, messages.missing_record_ids);

                if (!ids.valid) {
                    domModule.set_alert(message_element, 'danger', ids.error);
                    return null;
                }

                const template = endpoint_template(type.endpoints.get);

                if (!template) {
                    domModule.set_alert(message_element, 'danger', messages.endpoint_missing);
                    return null;
                }

                const endpoint = endpointsModule.build(template, ids.keys);

                if (!endpoint) {
                    domModule.set_alert(message_element, 'danger', messages.missing_record_ids);
                    return null;
                }

                const search = new URLSearchParams();

                if (query.type) {
                    search.set('type', query.type);
                }

                if (query.uid) {

                    const profile = authModule.get_user_profile_data();

                    if (!profile || !profile.uid) {
                        domModule.set_alert(message_element, 'danger', messages.invalid_profile);
                        return null;
                    }

                    search.set('uid', profile.uid);
                }

                const search_string = search.toString();
                const url = search_string.length > 0 ? `${endpoint}?${search_string}` : endpoint;

                const response = await httpModule.api({
                    method: 'GET',
                    url: url
                });

                /* null = missing token; httpModule.api has already alerted and
                 * scheduled the logout — do not overwrite that alert. */
                if (response === null) {
                    return null;
                }

                if (!response) {
                    throw new Error('No response received from server');
                }

                if (response.status !== 200) {
                    throw new Error(`Server returned status ${response.status}`);
                }

                if (!response.data?.data) {
                    throw new Error('Invalid response structure');
                }

                return response.data.data;

            } catch (error) {

                console.error(`Error loading ${log_tag} record:`, error);
                domModule.set_alert(message_element, 'danger', error.user_message || messages.load_error);

                return null;
            }
        };

        /**
         * Fetches the record and paints the form: lock handling (edit), the
         * audit line, the per-type field population, and the read-only sweep
         * (details).
         * @returns {Promise<boolean>} always false, so a submit handler bound
         *          to it never submits.
         */
        form.display_record = async function () {

            try {

                const record = await form.get_record();

                /* get_record has already reported why; leave its (specific)
                 * alert in place rather than replacing it with the generic
                 * display error. */
                if (!record) {
                    return false;
                }

                if (settings.lock) {

                    await lockModule.check_if_locked(record, settings.lock.card_selector);

                    if (lockModule.is_locked_by_other_user(record)) {
                        const is_admin = await lockModule.is_user_administrator();
                        lockModule.disable_form_fields({ preserve_selectors: is_admin ? ['#unlock-record'] : [] });
                    }

                    lockModule.setup_auto_unlock(record);
                }

                helperModule.render_record_meta(created_selector, record);

                if (typeof settings.populate === 'function') {
                    await settings.populate(record);
                }

                if (settings.disable_fields === true) {
                    obj.disable_all_fields();
                }

                return false;

            } catch (error) {

                console.error(`Error displaying ${log_tag} record:`, error);
                domModule.set_alert('#message', 'danger', messages.display_error);

                return false;
            }
        };

        /**
         * PUTs the collected form data, then repaints the form from the
         * saved record.
         * @returns {Promise<boolean>} true on a successful save
         */
        async function update_record() {

            if (is_submitting) {
                return false;
            }

            is_submitting = true;

            const message_element = document.querySelector('#message');
            let timeout_id = null;

            try {

                scroll_to_top();

                const ids = read_ids(record_params, messages.missing_record_ids);

                if (!ids.valid) {
                    domModule.set_alert(message_element, 'warning', ids.error);
                    return false;
                }

                /* Collect before announcing "Updating ..." so a validation
                 * failure that reports itself silently cannot leave a stale
                 * progress alert on screen. */
                const form_data = settings.collect();

                if (!form_data || form_data === false) {
                    return false;
                }

                domModule.set_alert(message_element, 'info', messages.updating);

                const user_name = helperModule.get_user_name();

                if (user_name) {
                    form_data.updated_by = user_name;
                }

                const template = endpoint_template(type.endpoints.put);

                if (!template) {
                    domModule.set_alert(message_element, 'danger', messages.endpoint_missing);
                    return false;
                }

                const endpoint = endpointsModule.build(template, ids.keys);

                if (!endpoint) {
                    domModule.set_alert(message_element, 'danger', messages.missing_record_ids);
                    return false;
                }

                const response = await httpModule.api({
                    method: 'PUT',
                    url: endpoint,
                    data: form_data
                });

                if (response === null) {
                    return false;
                }

                if (!response || response.status !== 201) {
                    throw new Error(`Failed to update ${type.label.toLowerCase()} record`);
                }

                domModule.set_alert(message_element, 'success', messages.update_success);

                /* Repaint from the saved record rather than reloading. */
                try {
                    await form.display_record();
                    reset_form_state(submit_card_selector);
                } catch (refresh_error) {
                    console.error('Error refreshing display:', refresh_error);
                }

                timeout_id = setTimeout(() => {
                    helperModule.clear_status_message(message_element);
                }, MESSAGE_CLEAR_DELAY);

                return true;

            } catch (error) {

                if (timeout_id) {
                    clearTimeout(timeout_id);
                }

                console.error(`Error updating ${log_tag} record:`, error);
                domModule.set_alert(message_element, 'danger', error.user_message || error.message || messages.update_error);

                return false;

            } finally {
                is_submitting = false;
            }
        }

        /**
         * POSTs the collected form data and replaces the page with the new
         * record's edit form.
         * @returns {Promise<boolean>} true once the redirect is scheduled
         */
        async function create_record() {

            const message_element = document.querySelector('#message');

            /* The add and edit pages share a module bundle; an item_id in the
             * URL means the record already exists. */
            if (helperModule.get_parameter_by_name(type.record_param.param)) {
                domModule.set_alert(message_element, 'warning', messages.already_editing);
                return false;
            }

            if (is_submitting) {
                return false;
            }

            is_submitting = true;

            try {

                scroll_to_top();

                const ids = read_ids(type.parent_params, messages.missing_parent_ids);

                if (!ids.valid) {
                    domModule.set_alert(message_element, 'warning', ids.error);
                    return false;
                }

                const form_data = settings.collect();

                if (!form_data || form_data === false) {
                    return false;
                }

                domModule.set_alert(message_element, 'info', messages.creating);

                const user_name = helperModule.get_user_name();
                const owner = helperModule.get_owner();

                if (user_name) {
                    form_data.created_by = user_name;
                }

                if (owner) {
                    form_data.owner = owner;
                }

                const template = endpoint_template(type.endpoints.post);

                if (!template) {
                    domModule.set_alert(message_element, 'danger', messages.endpoint_missing);
                    return false;
                }

                const endpoint = endpointsModule.build(template, ids.keys);

                if (!endpoint) {
                    domModule.set_alert(message_element, 'warning', messages.missing_parent_ids);
                    return false;
                }

                const response = await httpModule.api({
                    method: 'POST',
                    url: endpoint,
                    data: form_data
                });

                if (response === null) {
                    return false;
                }

                /* No response at all: the request never reached the server or
                 * came back 401 (httpModule.api redirects). */
                if (!response) {
                    domModule.set_alert(message_element, 'danger', messages.permission_denied);
                    return false;
                }

                if (response.status !== 201) {
                    throw new Error(`Failed to create ${type.label.toLowerCase()} record`);
                }

                const new_id = response.data?.data;

                if (!new_id) {
                    throw new Error(messages.no_new_id);
                }

                domModule.set_alert(message_element, 'success', messages.create_success);
                scroll_to_top();

                setTimeout(() => {
                    redirect_to_edit_page(ids.params, new_id);
                }, REDIRECT_DELAY);

                return true;

            } catch (error) {

                console.error(`Error creating ${log_tag} record:`, error);
                domModule.set_alert(message_element, 'danger', error.user_message || error.message || messages.create_error);

                return false;

            } finally {
                is_submitting = false;
            }
        }

        /**
         * Replaces the add page with the new record's edit page. Uses
         * location.replace so the back button cannot return to a create form
         * whose record now exists.
         * @param {Object} parent_params - {exhibit_id, grid_id, ...}
         * @param {string} new_id
         */
        function redirect_to_edit_page(parent_params, new_id) {

            const search = new URLSearchParams(Object.assign({}, parent_params, { item_id: new_id }));
            const path = (typeof type.edit_path === 'function') ? type.edit_path() : type.edit_path;

            window.location.replace(`${endpointsModule.get_app_path()}${path}?${search.toString()}`);
        }

        form.submit_record = (mode === 'add') ? create_record : update_record;

        /**
         * Standard page bring-up: permission gate, exhibit title, then
         * (details/edit) paint the record and bind the save button.
         * @returns {Promise<void>}
         */
        form.init = async function () {

            try {

                const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

                if (settings.show_denied_banner === true
                    && helperModule.get_parameter_by_name('status') === '403') {
                    scroll_to_top();
                    domModule.set_alert(document.querySelector('#message'), 'danger', 'You do not have permission to edit this record.');
                }

                if (Array.isArray(settings.permissions) && settings.permissions.length > 0) {

                    const record_id = helperModule.get_parameter_by_name(type.record_param.param);
                    const redirect = (typeof settings.redirect_path === 'function')
                        ? settings.redirect_path({ exhibit_id: exhibit_id, record_id: record_id })
                        : settings.redirect_path;

                    await authModule.check_permissions(
                        settings.permissions,
                        settings.permission_record_type || settings.record_type,
                        exhibit_id,
                        mode === 'add' ? null : record_id,
                        redirect
                    );
                }

                await exhibitsModule.set_exhibit_title(exhibit_id);

                if (mode !== 'add') {
                    await form.display_record();
                }

                if (settings.submit_selector) {
                    domModule.on(settings.submit_selector, 'click', form.submit_record);
                }

                if (typeof settings.on_init === 'function') {
                    await settings.on_init();
                }

            } catch (error) {
                domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
            }
        };

        return form;
    };

    return obj;

}());
