/**

 Copyright 2026 University of Denver

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

/**
 * Page-level actions that every dashboard edit / details / delete page used
 * to re-implement in an inline <script>:
 *
 *   wire_cancel_button()  - Cancel on an edit form: confirm when the form has
 *                           unsaved changes, then go back to a list page.
 *   wire_edit_button()    - Edit on a details page: hide the content and
 *                           replace the location with the edit page.
 *   init_delete_form()    - Delete confirmation page bootstrap: 403 notice,
 *                           permission check, exhibit title, delete handler.
 *
 * Paths are app-relative ("/items", "/items/grid/edit"); the dashboard base
 * path comes from endpointsModule.get_app_path(). Query-string values are
 * read from the current page with helperModule.get_parameter_by_name().
 *
 * Depends on: helperModule, endpointsModule, domModule, authModule,
 * exhibitsModule, navModule (all resolved at call time, not at load time).
 */
const pageActionsModule = (function () {

    'use strict';

    const obj = {};

    const DEFAULT_CANCEL_SELECTOR = '#cancel-exhibit-btn';
    const DEFAULT_EDIT_SELECTOR = '#edit-item-btn';
    const DEFAULT_DELETE_SELECTOR = '#delete-item-btn';
    const DEFAULT_CONTENT_SELECTOR = '.content';
    const DEFAULT_MESSAGE_SELECTOR = '#message';
    const DEFAULT_DELETE_PERMISSIONS = ['delete_item', 'delete_any_item'];
    const DEFAULT_PERMISSION_DENIED_MESSAGE = 'You do not have permission to delete this item.';

    function app_path() {
        return endpointsModule.get_app_path();
    }

    /**
     * Builds "a=1&b=2" from the named query-string parameters of the current
     * page. A missing parameter serialises as "null" — the same thing the
     * template-literal interpolation in the old inline scripts produced.
     * @param {string[]} params - parameter names to carry over
     * @returns {string}
     */
    function build_query(params) {

        return (Array.isArray(params) ? params : []).map(function (name) {
            return name + '=' + encodeURIComponent(helperModule.get_parameter_by_name(name));
        }).join('&');
    }

    /**
     * Appends the carried-over query string to an app-relative path.
     * @param {string} path
     * @param {string[]} params
     * @returns {string}
     */
    function with_query(path, params) {

        const query = build_query(params);

        if (query.length === 0) {
            return path;
        }

        return path + (path.indexOf('?') === -1 ? '?' : '&') + query;
    }

    /**
     * True when any input / textarea / select differs from its default value.
     * Rich-text editors are not inspected (they are div-based).
     * @returns {boolean}
     */
    obj.check_for_unsaved_changes = function () {

        const inputs = document.querySelectorAll('input, textarea, select');

        return Array.from(inputs).some(function (input) {
            return input.defaultValue !== input.value;
        });
    };

    /**
     * Wires the Cancel button of an edit form.
     * @param {Object}   options
     * @param {string}   options.redirect_path    - app-relative list page ("/items")
     * @param {string[]} [options.params]         - query params to carry over ("exhibit_id")
     * @param {string}   [options.confirm_message] - confirm() text shown when there are unsaved changes
     * @param {string}   [options.selector]       - button selector (default "#cancel-exhibit-btn")
     * @returns {boolean} true when the button was found and wired
     */
    obj.wire_cancel_button = function (options) {

        const settings = options || {};
        const button = document.querySelector(settings.selector || DEFAULT_CANCEL_SELECTOR);

        if (button === null) {
            return false;
        }

        button.addEventListener('click', function () {

            if (obj.check_for_unsaved_changes()) {

                const confirm_cancel = window.confirm(settings.confirm_message || 'Discard unsaved changes?');

                if (!confirm_cancel) {
                    return;
                }
            }

            window.location.href = app_path() + with_query(settings.redirect_path, settings.params);
        });

        return true;
    };

    /**
     * Wires the Edit button of a details page.
     * @param {Object}   options
     * @param {string}   options.edit_path          - app-relative edit page ("/items/grid/edit")
     * @param {string[]} [options.params]           - query params to carry over
     * @param {string}   [options.selector]         - button selector (default "#edit-item-btn")
     * @param {string}   [options.content_selector] - element hidden before navigating (default ".content")
     * @returns {boolean} true when the button was found and wired
     */
    obj.wire_edit_button = function (options) {

        const settings = options || {};
        const button = document.querySelector(settings.selector || DEFAULT_EDIT_SELECTOR);

        if (button === null) {
            return false;
        }

        button.addEventListener('click', function (event) {

            event.preventDefault();

            const content = document.querySelector(settings.content_selector || DEFAULT_CONTENT_SELECTOR);

            if (content !== null) {
                content.style.visibility = 'hidden';
            }

            window.location.replace(app_path() + with_query(settings.edit_path, settings.params));

            return false;
        });

        return true;
    };

    /**
     * Bootstraps a delete confirmation page.
     *
     * With `status=403` in the URL the page only shows the permission notice
     * and rewrites the address bar back to the plain delete URL. Otherwise it
     * checks the delete permissions (authModule redirects to the 403 URL on
     * failure), sets the exhibit title, attaches the delete handler and
     * reveals the card.
     *
     * @param {Object}   options
     * @param {string}   options.delete_path                - app-relative page path ("/items/grid/item/delete")
     * @param {string[]} options.url_params                 - query params that identify the page
     * @param {Function} options.on_delete                  - click handler for the delete button
     * @param {string[]} [options.permissions]              - default ['delete_item', 'delete_any_item']
     * @param {string}   [options.record_type]              - default 'item'
     * @param {string}   [options.selector]                 - delete button selector (default "#delete-item-btn")
     * @param {string}   [options.permission_denied_message]
     * @param {string}   [options.label]                    - console label used when init fails
     * @returns {Promise<boolean>} true on success, false when init failed
     */
    obj.init_delete_form = async function (options) {

        const settings = options || {};
        const label = settings.label || 'delete form';

        try {

            const status = helperModule.get_parameter_by_name('status');
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const page_path = with_query(settings.delete_path, settings.url_params);

            if (status === '403') {

                domModule.set_alert(DEFAULT_MESSAGE_SELECTOR, 'danger', settings.permission_denied_message || DEFAULT_PERMISSION_DENIED_MESSAGE);
                window.history.replaceState({ page: 'items' }, '', app_path() + page_path);

            } else {

                const redirect = page_path + (page_path.indexOf('?') === -1 ? '?' : '&') + 'status=403';

                await authModule.check_permissions(
                    settings.permissions || DEFAULT_DELETE_PERMISSIONS,
                    settings.record_type || 'item',
                    exhibit_id,
                    item_id,
                    redirect
                );

                await exhibitsModule.set_exhibit_title(exhibit_id);

                const delete_btn = document.querySelector(settings.selector || DEFAULT_DELETE_SELECTOR);

                if (delete_btn !== null && typeof settings.on_delete === 'function') {
                    delete_btn.addEventListener('click', settings.on_delete);
                }

                helperModule.show_form();
            }

            navModule.wire_nav_links();

            return true;

        } catch (error) {
            domModule.set_alert(DEFAULT_MESSAGE_SELECTOR, 'danger', error.message);
            console.error(label + ' init failed:', error);
            return false;
        }
    };

    return obj;

}());
