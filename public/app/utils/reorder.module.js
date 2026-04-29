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

            const updated_order = build_reorder_array(reordered_items, grid_id);

            if (!updated_order || updated_order.length === 0) {
                throw new Error(`Failed to build ${is_grid ? 'grid ' : ''}reorder data`);
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
                console.debug(`${is_grid ? 'Grid items' : 'Items'} reordered successfully`);
                return true;
            } else {
                throw new Error(`Failed to reorder ${label} - server returned an error`);
            }

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

    return obj;

}());
