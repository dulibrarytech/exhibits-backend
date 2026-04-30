/**

 Copyright 2023 University of Denver

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

const reorderModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Reorders item list via drag and drop
     *
     * @param {Event} event - The drag/drop event
     * @param {Array} reordered_items - Array of reordered item objects from DataTables
     * @returns {Promise<boolean>} True if successful, false otherwise
     */
    obj.reorder_items = async function (event, reordered_items) {
        return _reorder(event, reordered_items, null);
    };

    /**
     * Reorders grid items via drag and drop
     *
     * @param {Event} event - The drag/drop event
     * @param {Array} reordered_items - Array of reordered grid item objects from DataTables
     * @returns {Promise<boolean>} True if successful, false otherwise
     */
    obj.reorder_grid_items = async function (event, reordered_items) {
        const grid_id = helperModule.get_parameter_by_name('grid_id');

        if (!grid_id) {
            console.error('Error reordering grid items: Grid ID not found in URL');
            const message_element = document.querySelector('#message');
            if (message_element) {
                display_error_message(message_element, 'Grid ID not found in URL');
            }
            return false;
        }

        return _reorder(event, reordered_items, grid_id);
    };

    /**
     * Shared reorder POST. When `grid_id` is provided the request reorders
     * grid items (each entry tagged with `grid_id` and `type: 'griditem'`);
     * otherwise it reorders top-level items (each entry tagged with the
     * type parsed from the row id).
     */
    async function _reorder(event, reordered_items, grid_id) {

        const is_grid = grid_id != null;
        const label = is_grid ? 'grid items' : 'items';

        try {
            if (!reordered_items || !Array.isArray(reordered_items)) {
                console.error('Invalid reordered_items parameter');
                return false;
            }

            if (reordered_items.length === 0) {
                console.debug(`No ${label} to reorder`);
                return false;
            }

            const updated_order = build_reorder_array(reordered_items, grid_id);

            if (!updated_order || updated_order.length === 0) {
                throw new Error(`Failed to build ${is_grid ? 'grid ' : ''}reorder data`);
            }

            return await _apply_reorder_post(updated_order, label);

        } catch (error) {
            console.error(`Error reordering ${label}:`, error);

            const message_element = document.querySelector('#message');
            if (message_element) {
                display_error_message(message_element, error.message || `An error occurred while reordering ${label}`);
            }

            return false;
        }
    }

    /**
     * POSTs a pre-built reorder array to the reorder endpoint. Shared by
     * the drag flow (_reorder above) and the keyboard flow
     * (_apply_keyboard_move below). Endpoint resolution and authentication
     * checks live here so both call sites stay in sync.
     *
     * @param {Array<Object>} updated_order - {uuid, type, order [, grid_id]} entries
     * @param {string}        label         - "items" or "grid items" for log/error text
     * @returns {Promise<boolean>}
     */
    async function _apply_reorder_post(updated_order, label) {

        const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();

        if (!EXHIBITS_ENDPOINTS?.exhibits?.reorder_records?.post?.endpoint) {
            throw new Error('Reorder endpoint not configured');
        }

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

        if (!exhibit_id) {
            throw new Error('Exhibit ID not found in URL');
        }

        const token = authModule.get_user_token();

        if (!token || token === false) {
            throw new Error('Not authenticated - please log in again');
        }

        const endpoint = EXHIBITS_ENDPOINTS.exhibits.reorder_records.post.endpoint
            .replace(':exhibit_id', encodeURIComponent(exhibit_id));

        const response = await httpModule.req({
            method: 'POST',
            url: endpoint,
            data: updated_order,
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            },
            timeout: 30000
        });

        if (response && response.status === 200) {
            console.debug(`${label} reordered successfully`);
            return true;
        }

        throw new Error(`Failed to reorder ${label} - server returned an error`);
    }

    /**
     * Build reorder array from DataTables reordered items.
     *
     * When `grid_id` is provided, each entry is tagged with `grid_id` and
     * `type: 'griditem'`; otherwise the type is parsed from the row id.
     */
    function build_reorder_array(reordered_items, grid_id) {

        const is_grid = grid_id != null;
        const item_label = is_grid ? 'grid item' : 'item';
        const updated_order = [];

        for (let i = 0; i < reordered_items.length; i++) {
            const item = reordered_items[i];

            if (!item || !item.node) {
                console.warn(`Invalid ${item_label} at index`, i);
                continue;
            }

            const node = item.node;
            const id = node.getAttribute('id');

            if (!id) {
                console.warn(`${is_grid ? 'Grid item' : 'Item'} missing id attribute at index`, i);
                continue;
            }

            const order_number = get_order_number(node);

            if (order_number === null) {
                console.warn(`Could not find order number for ${item_label}:`, id);
                continue;
            }

            if (is_grid) {
                const uuid = parse_grid_item_id(id);

                if (!uuid) {
                    console.warn('Could not parse grid item ID:', id);
                    continue;
                }

                updated_order.push({
                    grid_id: grid_id,
                    uuid: uuid,
                    type: 'griditem',
                    order: order_number
                });
            } else {
                const parsed_data = parse_item_id(id);

                if (!parsed_data) {
                    console.warn('Could not parse item ID:', id);
                    continue;
                }

                updated_order.push({
                    uuid: parsed_data.uuid,
                    type: parsed_data.type,
                    order: order_number
                });
            }
        }

        return updated_order;
    }

    /**
     * Parse item ID to extract UUID and type
     *
     * Expected formats:
     * - "uuid_type" (e.g., "abc123_heading")
     * - "uuid_itemtype_type" (e.g., "abc123_image_item")
     */
    function parse_item_id(id) {

        if (!id || typeof id !== 'string') {
            return null;
        }

        const id_parts = id.split('_');

        if (id_parts.length < 2) {
            return null;
        }

        if (id_parts.length === 3) {
            // Format: uuid_itemtype_type — remove middle element
            return {
                uuid: id_parts[0],
                type: id_parts[2]
            };
        } else if (id_parts.length === 2) {
            return {
                uuid: id_parts[0],
                type: id_parts[1]
            };
        } else {
            // For longer formats, assume first is UUID, last is type
            return {
                uuid: id_parts[0],
                type: id_parts[id_parts.length - 1]
            };
        }
    }

    /**
     * Parse grid item ID to extract UUID
     */
    function parse_grid_item_id(id) {

        if (!id || typeof id !== 'string') {
            return null;
        }

        const id_parts = id.split('_');

        if (id_parts.length < 1) {
            return null;
        }

        const uuid = id_parts[0];

        if (uuid && uuid.length > 0) {
            return uuid;
        }

        return null;
    }

    /**
     * Get order number from DOM node
     */
    function get_order_number(node) {

        try {
            const order_cell = node.querySelector('.item-order');

            if (order_cell) {
                const order_span = order_cell.querySelector('span');
                if (order_span) {
                    const order_text = order_span.textContent.trim();
                    const order_number = parseInt(order_text, 10);

                    if (!isNaN(order_number) && order_number > 0) {
                        return order_number;
                    }
                }

                const cell_text = order_cell.textContent.trim();
                const cell_number = parseInt(cell_text, 10);

                if (!isNaN(cell_number) && cell_number > 0) {
                    return cell_number;
                }
            }

            const first_cell = node.querySelector('td');

            if (first_cell && first_cell.classList.contains('item-order')) {
                const order_text = first_cell.textContent.trim();
                const order_number = parseInt(order_text, 10);

                if (!isNaN(order_number) && order_number > 0) {
                    return order_number;
                }
            }

            const order_attr = node.getAttribute('data-order');
            if (order_attr) {
                const order_number = parseInt(order_attr, 10);

                if (!isNaN(order_number) && order_number > 0) {
                    return order_number;
                }
            }

            return null;

        } catch (error) {
            console.error('Error getting order number:', error);
            return null;
        }
    }

    function display_error_message(element, message) {
        if (!element) {
            return;
        }

        element.textContent = '';

        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-danger';
        alert_div.setAttribute('role', 'alert');

        const icon = document.createElement('i');
        icon.className = 'fa fa-exclamation';
        icon.setAttribute('aria-hidden', 'true');
        alert_div.appendChild(icon);

        const text = document.createTextNode(` ${message}`);
        alert_div.appendChild(text);

        element.appendChild(alert_div);
    }

    /* ═══════════════════════════════════════════════════════════════════
       Phase 4 — Keyboard reorder API (WCAG 2.1.1 + 2.5.7)

       DataTables RowReorder is mouse-drag only. Keyboard users get
       per-row Move up / Move down buttons that mutate the DOM, build a
       reorder array from the new order, POST it via the same endpoint
       the drag flow uses, refocus the moved button, and announce the
       move via a polite live region.
       ═══════════════════════════════════════════════════════════════════ */

    /**
     * Build a reorder array from the current DOM order of <tr> nodes.
     * After move_row_up / move_row_down swaps adjacent rows in the DOM,
     * each row's NEW order number is its 1-based position in the tbody;
     * each row's id encodes the uuid + type the way build_reorder_array
     * expects.
     *
     * @param {NodeList|Array<HTMLTableRowElement>} rows
     * @param {string|null} grid_id
     * @returns {Array<Object>} reorder entries
     */
    function build_reorder_array_from_dom(rows, grid_id) {

        const is_grid = grid_id != null;
        const updated_order = [];

        for (let i = 0; i < rows.length; i++) {
            const node = rows[i];
            const id = node && node.getAttribute ? node.getAttribute('id') : null;

            if (!id) {
                continue;
            }

            const order_number = i + 1;

            if (is_grid) {
                const uuid = parse_grid_item_id(id);
                if (!uuid) continue;
                updated_order.push({ grid_id: grid_id, uuid: uuid, type: 'griditem', order: order_number });
            } else {
                const parsed = parse_item_id(id);
                if (!parsed) continue;
                updated_order.push({ uuid: parsed.uuid, type: parsed.type, order: order_number });
            }
        }

        return updated_order;
    }

    /**
     * Update the visible order-number text inside each row's .item-order
     * cell to match its 1-based DOM position. Keeps the visual order
     * column in sync with the new sequence after a keyboard move.
     */
    function refresh_order_numbers(rows) {
        for (let i = 0; i < rows.length; i++) {
            const node = rows[i];
            if (!node) continue;
            const order_cell = node.querySelector('.item-order');
            if (!order_cell) continue;
            const order_span = order_cell.querySelector('span[data-role="order-number"]')
                || order_cell.querySelector('span');
            if (order_span) {
                order_span.textContent = String(i + 1);
                order_span.setAttribute('aria-label', `Item order ${i + 1}`);
            }
        }
    }

    /**
     * Sweep the rows and toggle disabled/aria-disabled on the move-up
     * button of the first row and the move-down button of the last row.
     * Also refreshes the buttons' aria-label to reflect the new
     * "position N of M" context after a move.
     */
    obj.update_reorder_button_states = function (table_selector) {

        const tbody = document.querySelector(`${table_selector} tbody`);
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr');
        const total = rows.length;

        // Apply disabled state to a move button. Phase 5b': handles both
        // the original .btn-link form (the disabled DOM attribute alone
        // is enough) and the dropdown-item form, which Bootstrap styles
        // via the .disabled class.
        const set_state = (btn, is_disabled) => {
            if (!btn) return;
            btn.disabled = is_disabled;
            btn.classList.toggle('disabled', is_disabled);
            btn.setAttribute('aria-disabled', is_disabled ? 'true' : 'false');
            if (is_disabled) {
                btn.setAttribute('tabindex', '-1');
            } else {
                btn.removeAttribute('tabindex');
            }
        };

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const up = row.querySelector('[data-action="move-up"]');
            const down = row.querySelector('[data-action="move-down"]');
            set_state(up, i === 0);
            set_state(down, i === total - 1);
        }
    };

    /**
     * Announce a move via the page's polite live region. The list-page
     * templates ship with <div id="reorder-status" class="visually-hidden"
     * role="status" aria-live="polite"></div>; the textContent is
     * replaced on each call so screen readers re-announce.
     */
    function announce(message) {
        const region = document.getElementById('reorder-status');
        if (!region) return;
        // Force a re-announcement when the same text fires twice in a
        // row by clearing first.
        region.textContent = '';
        // Defer one tick so the live region observer picks up the change.
        setTimeout(() => { region.textContent = message; }, 16);
    }

    /**
     * Resolve the row title for an aria announcement. Looks for a
     * .item-title element; falls back to the row's id.
     */
    function read_row_title(row) {
        if (!row) return '';
        const title_el = row.querySelector('.item-title, [data-role="row-title"]');
        if (title_el && title_el.textContent) {
            return title_el.textContent.trim();
        }
        const id = row.getAttribute && row.getAttribute('id');
        return id ? `row ${id}` : 'row';
    }

    /**
     * Move the row containing `trigger_button` one position up or down
     * in its tbody, POST the new order, refresh visual order numbers,
     * refocus the same button on its new row (or the still-enabled
     * sibling at the new boundary), and announce the move.
     *
     * @param {HTMLButtonElement} trigger_button - the move-up / move-down button
     * @param {('up'|'down')}     direction
     * @param {Object}            [opts]
     * @param {string|null}       [opts.grid_id] - explicit grid_id (else read from URL)
     * @param {string}            [opts.table_selector] - "#items" or "#grid-items"
     * @returns {Promise<boolean>}
     */
    async function _apply_keyboard_move(trigger_button, direction, opts) {

        if (!trigger_button) return false;
        if (trigger_button.disabled || trigger_button.getAttribute('aria-disabled') === 'true') {
            return false;
        }

        const row = trigger_button.closest('tr');
        if (!row || !row.parentNode) return false;

        const tbody = row.parentNode;
        const all_rows = Array.from(tbody.querySelectorAll('tr'));
        const idx = all_rows.indexOf(row);
        const total = all_rows.length;

        if (idx === -1) return false;
        if (direction === 'up' && idx === 0) return false;
        if (direction === 'down' && idx === total - 1) return false;

        const sibling = direction === 'up' ? all_rows[idx - 1] : all_rows[idx + 1];
        const new_idx = direction === 'up' ? idx - 1 : idx + 1;

        // Snapshot for rollback if POST fails.
        const next_sibling_before = row.nextSibling;
        const sibling_next_before = sibling.nextSibling;

        // Swap rows in the DOM.
        if (direction === 'up') {
            tbody.insertBefore(row, sibling);
        } else {
            tbody.insertBefore(sibling, row);
        }

        const opt = opts || {};
        const explicit_grid_id = Object.prototype.hasOwnProperty.call(opt, 'grid_id') ? opt.grid_id : null;
        const url_grid_id = helperModule && typeof helperModule.get_parameter_by_name === 'function'
            ? helperModule.get_parameter_by_name('grid_id')
            : null;
        const grid_id = explicit_grid_id || url_grid_id || null;
        const label = grid_id ? 'grid items' : 'items';
        const table_selector = opt.table_selector || (grid_id ? '#grid-items' : '#items');

        const updated_rows = Array.from(tbody.querySelectorAll('tr'));
        const updated_order = build_reorder_array_from_dom(updated_rows, grid_id);

        try {
            const ok = await _apply_reorder_post(updated_order, label);
            if (!ok) throw new Error(`Failed to reorder ${label}`);
        } catch (error) {
            // Roll back the DOM swap so the visible order matches the server.
            if (direction === 'up') {
                if (next_sibling_before) {
                    tbody.insertBefore(row, next_sibling_before);
                } else {
                    tbody.appendChild(row);
                }
            } else {
                if (sibling_next_before) {
                    tbody.insertBefore(sibling, sibling_next_before);
                } else {
                    tbody.appendChild(sibling);
                }
            }
            const message_element = document.querySelector('#message');
            if (message_element) {
                display_error_message(message_element, error.message || `An error occurred while reordering ${label}`);
            }
            return false;
        }

        // Update visible order numbers and boundary button states.
        const final_rows = Array.from(tbody.querySelectorAll('tr'));
        refresh_order_numbers(final_rows);
        obj.update_reorder_button_states(table_selector);

        // Refocus contract: same button on the new row, falling back to
        // the still-enabled sibling if we landed at a boundary.
        const moved_row = final_rows[new_idx];
        const target_action = direction === 'up' ? 'move-up' : 'move-down';
        let next_focus = moved_row && moved_row.querySelector(`[data-action="${target_action}"]`);
        if (next_focus && next_focus.disabled) {
            const fallback_action = direction === 'up' ? 'move-down' : 'move-up';
            next_focus = moved_row.querySelector(`[data-action="${fallback_action}"]`);
        }
        if (next_focus && typeof next_focus.focus === 'function') {
            next_focus.focus();
        }

        // Announce.
        const title = read_row_title(moved_row);
        announce(`Moved ${title} to position ${new_idx + 1} of ${total}`);

        return true;
    }

    /**
     * Public: move the row containing `trigger_button` up by one.
     * @param {HTMLButtonElement} trigger_button
     * @param {Object} [opts] - { grid_id, table_selector }
     */
    obj.move_row_up = function (trigger_button, opts) {
        return _apply_keyboard_move(trigger_button, 'up', opts);
    };

    /**
     * Public: move the row containing `trigger_button` down by one.
     * @param {HTMLButtonElement} trigger_button
     * @param {Object} [opts] - { grid_id, table_selector }
     */
    obj.move_row_down = function (trigger_button, opts) {
        return _apply_keyboard_move(trigger_button, 'down', opts);
    };

    /**
     * Wire delegated click handlers on a table for
     * [data-action="move-up"] and [data-action="move-down"]. Idempotent
     * via dataset flag — safe to call after every DataTable redraw.
     *
     * @param {string} table_selector - e.g. "#items" or "#grid-items"
     * @param {Object} [opts] - { grid_id }
     */
    obj.attach_keyboard_reorder_handlers = function (table_selector, opts) {

        const tbody = document.querySelector(`${table_selector} tbody`);
        if (!tbody) return;

        if (tbody.dataset.keyboardReorderInitialized === '1') {
            // Refresh boundary states even when re-called (post-redraw).
            obj.update_reorder_button_states(table_selector);
            return;
        }

        tbody.dataset.keyboardReorderInitialized = '1';

        tbody.addEventListener('click', async (event) => {
            const btn = event.target.closest('[data-action="move-up"], [data-action="move-down"]');
            if (!btn || !tbody.contains(btn)) return;

            // Don't let DataTables RowReorder interpret this as a drag.
            // (The pointerdown/mousedown stoppers in items.list.displays.module.js
            // create_order_cell prevent RowReorder from initiating drag tracking
            // in the first place; this is a belt-and-suspenders guard.)
            event.preventDefault();
            event.stopPropagation();

            const direction = btn.getAttribute('data-action') === 'move-up' ? 'up' : 'down';
            const merged_opts = Object.assign({ table_selector: table_selector }, opts || {});
            await _apply_keyboard_move(btn, direction, merged_opts);
        });

        // Initial boundary-state pass.
        obj.update_reorder_button_states(table_selector);
    };

    return obj;

}());
