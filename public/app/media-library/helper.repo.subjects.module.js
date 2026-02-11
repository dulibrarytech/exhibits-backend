/**
 * Copyright 2026 University of Denver
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const repoSubjectsModule = (function() {

    'use strict';

    let obj = {};

    // HTTP status constants
    const HTTP_STATUS = {
        OK: 200,
        FORBIDDEN: 403,
        NOT_FOUND: 404
    };

    // Cached subject and resource type data
    let subjects_cache = null;
    let resource_types_cache = null;

    // Track whether CSS has been injected
    let styles_injected = false;

    // Multi-select field names (Item Type excluded - remains single select)
    const MULTI_SELECT_NAMES = ['topics_subjects', 'genre_form_subjects', 'places_subjects'];

    // ========================================
    // UTILITIES
    // ========================================

    /**
     * Escape HTML to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    const escape_html = (str) => {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    /**
     * Extract value and label from an API item
     * @param {Object|string} item - Subject or resource type item
     * @returns {Object} { value, label }
     */
    const extract_item_fields = (item) => {
        const value = typeof item === 'object' ? (item.term || item.resource_type || item.value || item.name || '') : String(item);
        const label = typeof item === 'object' ? (item.title || item.resource_type || item.label || item.name || '') : String(item);
        return { value: value, label: label };
    };

    /**
     * Get media library endpoints
     * @returns {Object|null} Endpoints configuration object
     */
    const get_media_library_endpoints = () => {
        try {
            return endpointsModule.get_media_library_endpoints();
        } catch (error) {
            console.error('Error getting media library endpoints:', error);
            return null;
        }
    };

    // ========================================
    // API METHODS
    // ========================================

    /**
     * Retrieve all subjects grouped by type (topical, geographic, genre_form)
     * @returns {Promise<Object|null>} Subjects grouped by type or null on failure
     */
    obj.get_subjects = async function() {

        if (subjects_cache !== null) {
            return subjects_cache;
        }

        try {

            const MEDIA_ENDPOINTS = get_media_library_endpoints();

            if (!MEDIA_ENDPOINTS?.repo_subjects?.get?.endpoint) {
                console.error('Repo subjects endpoint not configured');
                return null;
            }

            const token = authModule.get_user_token();

            if (!token || token === false) {
                console.error('Session expired');
                return null;
            }

            const endpoint = MEDIA_ENDPOINTS.repo_subjects.get.endpoint;

            const response = await httpModule.req({
                method: 'GET',
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000,
                validateStatus: (status) => status >= 200 && status < 600
            });

            if (!response) {
                console.error('No response from subjects endpoint');
                return null;
            }

            if (response.status === HTTP_STATUS.OK && response.data?.success) {
                subjects_cache = response.data.data?.subjects || {};
                return subjects_cache;
            }

            console.error('Failed to retrieve subjects:', response.data?.message);
            return null;

        } catch (error) {
            console.error('Error retrieving subjects:', error);
            return null;
        }
    };

    /**
     * Retrieve resource types for Item Type dropdown
     * @returns {Promise<Array|null>} Array of resource types or null on failure
     */
    obj.get_resource_types = async function() {

        if (resource_types_cache !== null) {
            return resource_types_cache;
        }

        try {

            const MEDIA_ENDPOINTS = get_media_library_endpoints();

            if (!MEDIA_ENDPOINTS?.repo_resource_types?.get?.endpoint) {
                console.error('Repo resource types endpoint not configured');
                return null;
            }

            const token = authModule.get_user_token();

            if (!token || token === false) {
                console.error('Session expired');
                return null;
            }

            const endpoint = MEDIA_ENDPOINTS.repo_resource_types.get.endpoint;

            const response = await httpModule.req({
                method: 'GET',
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000,
                validateStatus: (status) => status >= 200 && status < 600
            });

            if (!response) {
                console.error('No response from resource types endpoint');
                return null;
            }

            if (response.status === HTTP_STATUS.OK && response.data?.success) {
                resource_types_cache = response.data.data?.resource_types || [];
                return resource_types_cache;
            }

            console.error('Failed to retrieve resource types:', response.data?.message);
            return null;

        } catch (error) {
            console.error('Error retrieving resource types:', error);
            return null;
        }
    };

    /**
     * Clear cached subject and resource type data
     */
    obj.clear_cache = function() {
        subjects_cache = null;
        resource_types_cache = null;
        console.log('Repo subjects cache cleared');
    };

    // ========================================
    // MULTI-SELECT WIDGET CSS
    // ========================================

    /**
     * Inject multi-select widget CSS
     */
    const inject_styles = () => {

        if (styles_injected) {
            return;
        }

        const css = '' +
            '.ms-widget { position: relative; }' +
            '.ms-trigger {' +
            '  display: flex;' +
            '  align-items: center;' +
            '  flex-wrap: wrap;' +
            '  gap: 4px;' +
            '  min-height: calc(1.5em + 0.75rem + 2px);' +
            '  padding: 0.3rem 2rem 0.3rem 0.5rem;' +
            '  font-size: 0.875rem;' +
            '  border: 1px solid #ced4da;' +
            '  border-radius: 0.25rem;' +
            '  background-color: #fff;' +
            '  cursor: pointer;' +
            '  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;' +
            '}' +

            '.ms-trigger:hover { border-color: #86b7fe; }' +

            '.ms-trigger.open {' +
            '  border-color: #86b7fe;' +
            '  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);' +
            '}' +

            '.ms-placeholder {' +
            '  color: #6c757d;' +
            '  user-select: none;' +
            '  white-space: nowrap;' +
            '  overflow: hidden;' +
            '  text-overflow: ellipsis;' +
            '}' +

            '.ms-arrow {' +
            '  position: absolute;' +
            '  right: 10px;' +
            '  top: 50%;' +
            '  transform: translateY(-50%);' +
            '  font-size: 0.7rem;' +
            '  color: #6c757d;' +
            '  pointer-events: none;' +
            '  transition: transform 0.2s ease;' +
            '}' +

            '.ms-trigger.open .ms-arrow { transform: translateY(-50%) rotate(180deg); }' +

            '.ms-tag {' +
            '  display: inline-flex;' +
            '  align-items: center;' +
            '  gap: 4px;' +
            '  padding: 1px 6px;' +
            '  font-size: 0.78rem;' +
            '  background-color: #e7f1ff;' +
            '  color: #084298;' +
            '  border: 1px solid #b6d4fe;' +
            '  border-radius: 3px;' +
            '  max-width: 180px;' +
            '  white-space: nowrap;' +
            '}' +

            '.ms-tag-label {' +
            '  overflow: hidden;' +
            '  text-overflow: ellipsis;' +
            '}' +

            '.ms-tag-remove {' +
            '  cursor: pointer;' +
            '  font-weight: 700;' +
            '  font-size: 0.85rem;' +
            '  line-height: 1;' +
            '  color: #084298;' +
            '  opacity: 0.65;' +
            '  flex-shrink: 0;' +
            '}' +

            '.ms-tag-remove:hover { opacity: 1; }' +

            '.ms-dropdown {' +
            '  position: fixed;' +
            '  z-index: 1060;' +
            '  background: #fff;' +
            '  border: 1px solid #ced4da;' +
            '  border-top: none;' +
            '  border-radius: 0 0 0.25rem 0.25rem;' +
            '  box-shadow: 0 4px 12px rgba(0,0,0,0.15);' +
            '}' +

            '.ms-search-wrap { padding: 6px; border-bottom: 1px solid #e9ecef; }' +

            '.ms-search {' +
            '  width: 100%;' +
            '  padding: 4px 8px;' +
            '  font-size: 0.82rem;' +
            '  border: 1px solid #ced4da;' +
            '  border-radius: 0.2rem;' +
            '  outline: none;' +
            '}' +

            '.ms-search:focus { border-color: #86b7fe; box-shadow: 0 0 0 0.15rem rgba(13,110,253,0.2); }' +

            '.ms-options-list {' +
            '  max-height: 350px;' +
            '  overflow-y: auto;' +
            '  padding: 4px 0;' +
            '}' +

            '.ms-option {' +
            '  display: flex;' +
            '  align-items: center;' +
            '  gap: 8px;' +
            '  padding: 5px 10px;' +
            '  font-size: 0.82rem;' +
            '  cursor: pointer;' +
            '  user-select: none;' +
            '  transition: background-color 0.1s ease;' +
            '}' +

            '.ms-option:hover { background-color: #f0f6ff; }' +

            '.ms-option.selected { background-color: #e7f1ff; font-weight: 500; }' +

            '.ms-option input[type="checkbox"] {' +
            '  flex-shrink: 0;' +
            '  cursor: pointer;' +
            '  accent-color: #0d6efd;' +
            '}' +

            '.ms-option-label {' +
            '  overflow: hidden;' +
            '  text-overflow: ellipsis;' +
            '  white-space: nowrap;' +
            '}' +

            '.ms-divider {' +
            '  height: 1px;' +
            '  background: #e9ecef;' +
            '  margin: 4px 10px;' +
            '}' +

            '.ms-no-results {' +
            '  padding: 8px 10px;' +
            '  font-size: 0.82rem;' +
            '  color: #6c757d;' +
            '  text-align: center;' +
            '  font-style: italic;' +
            '}' +

            '.ms-widget.disabled .ms-trigger {' +
            '  background-color: #e9ecef;' +
            '  cursor: not-allowed;' +
            '  opacity: 0.7;' +
            '}' +

            '/* Validation error state */' +
            '.ms-widget.is-invalid .ms-trigger {' +
            '  border-color: #dc3545;' +
            '}' +

            '.ms-widget.is-invalid .ms-trigger:hover {' +
            '  border-color: #dc3545;' +
            '}' +

            '.ms-invalid-feedback {' +
            '  display: none;' +
            '  width: 100%;' +
            '  margin-top: 0.25rem;' +
            '  font-size: 80%;' +
            '  color: #dc3545;' +
            '}'  +

            '.ms-widget.is-invalid + .ms-invalid-feedback {' +
            '  display: block;' +
            '}';

        const style_el = document.createElement('style');
        style_el.id = 'ms-widget-styles';
        style_el.textContent = css;
        document.head.appendChild(style_el);
        styles_injected = true;
    };

    // ========================================
    // MULTI-SELECT WIDGET RENDERING
    // ========================================

    /**
     * Render the options list inside a multi-select dropdown.
     * Selected items grouped at the top, then a divider, then unselected.
     * Both groups sorted alphabetically. Filtered by search term.
     *
     * @param {HTMLElement} options_list - The .ms-options-list container
     * @param {Array} all_items - Array of { value, label } objects
     * @param {Set} selected_values - Set of currently selected values
     * @param {string} search_term - Current search filter text
     */
    const render_options = (options_list, all_items, selected_values, search_term) => {

        const term = (search_term || '').toLowerCase().trim();

        // Filter by search term
        const filtered = term
            ? all_items.filter(item => item.label.toLowerCase().indexOf(term) !== -1)
            : all_items;

        // Split into selected and unselected
        const selected_items = [];
        const unselected_items = [];

        filtered.forEach(item => {
            if (selected_values.has(item.value)) {
                selected_items.push(item);
            } else {
                unselected_items.push(item);
            }
        });

        // Sort each group alphabetically
        const sort_fn = (a, b) => a.label.localeCompare(b.label);
        selected_items.sort(sort_fn);
        unselected_items.sort(sort_fn);

        // Build HTML
        let html = '';

        selected_items.forEach(item => {
            html += '<div class="ms-option selected" data-value="' + escape_html(item.value) + '">';
            html += '<input type="checkbox" checked tabindex="-1">';
            html += '<span class="ms-option-label">' + escape_html(item.label) + '</span>';
            html += '</div>';
        });

        if (selected_items.length > 0 && unselected_items.length > 0) {
            html += '<div class="ms-divider"></div>';
        }

        unselected_items.forEach(item => {
            html += '<div class="ms-option" data-value="' + escape_html(item.value) + '">';
            html += '<input type="checkbox" tabindex="-1">';
            html += '<span class="ms-option-label">' + escape_html(item.label) + '</span>';
            html += '</div>';
        });

        if (filtered.length === 0) {
            html += '<div class="ms-no-results">No results found</div>';
        }

        options_list.innerHTML = html;
    };

    /**
     * Update the trigger area to show selected tags or placeholder
     *
     * @param {HTMLElement} trigger - The .ms-trigger element
     * @param {Array} all_items - Array of { value, label } objects
     * @param {Set} selected_values - Set of currently selected values
     * @param {string} placeholder - Placeholder text when nothing selected
     */
    const render_trigger = (trigger, all_items, selected_values, placeholder) => {

        const existing = trigger.querySelectorAll('.ms-tag, .ms-placeholder');
        existing.forEach(el => el.remove());

        const arrow = trigger.querySelector('.ms-arrow');

        if (selected_values.size === 0) {
            const ph = document.createElement('span');
            ph.className = 'ms-placeholder';
            ph.textContent = placeholder;
            trigger.insertBefore(ph, arrow);
            return;
        }

        // Build label lookup
        const label_map = {};
        all_items.forEach(item => { label_map[item.value] = item.label; });

        // Create sorted tags
        const sorted_selected = Array.from(selected_values).sort((a, b) => {
            return (label_map[a] || a).localeCompare(label_map[b] || b);
        });

        sorted_selected.forEach(value => {
            const tag = document.createElement('span');
            tag.className = 'ms-tag';
            tag.setAttribute('data-value', value);

            const tag_label = document.createElement('span');
            tag_label.className = 'ms-tag-label';
            tag_label.textContent = label_map[value] || value;

            const tag_remove = document.createElement('span');
            tag_remove.className = 'ms-tag-remove';
            tag_remove.innerHTML = '&times;';
            tag_remove.setAttribute('aria-label', 'Remove ' + (label_map[value] || value));

            tag.appendChild(tag_label);
            tag.appendChild(tag_remove);
            trigger.insertBefore(tag, arrow);
        });
    };

    /**
     * Update the hidden input value from the selected set
     *
     * @param {HTMLInputElement} hidden_input - The hidden input element
     * @param {Set} selected_values - Set of currently selected values
     */
    const sync_hidden_input = (hidden_input, selected_values) => {
        hidden_input.value = Array.from(selected_values).join(',');
    };

    /**
     * Initialize a single multi-select widget that already exists in the DOM
     *
     * @param {HTMLElement} widget - The .ms-widget container element
     * @param {Array} raw_items - Array of API items (objects or strings)
     */
    const init_multi_select = (widget, raw_items) => {

        if (widget.getAttribute('data-initialized') === 'true') {
            return;
        }

        // Parse items into normalized { value, label } objects
        const all_items = [];
        (raw_items || []).forEach(item => {
            const fields = extract_item_fields(item);
            if (fields.value) {
                all_items.push(fields);
            }
        });

        const trigger = widget.querySelector('.ms-trigger');
        const dropdown = widget.querySelector('.ms-dropdown');
        const search_input = widget.querySelector('.ms-search');
        const options_list = widget.querySelector('.ms-options-list');
        const hidden_input = widget.querySelector('input[type="hidden"]');
        const placeholder = widget.getAttribute('data-placeholder') || 'Select...';

        // State: set of selected values
        const selected_values = new Set();

        // Pre-populate from data-selected attribute (for edit forms and repo import)
        const pre_selected_str = widget.getAttribute('data-selected') || '';

        if (pre_selected_str) {
            // Build lookups of valid option values and labels for matching
            const valid_values = new Set(all_items.map(item => item.value));

            // Build case-insensitive label-to-value map for fuzzy matching
            const label_to_value = {};
            all_items.forEach(item => {
                label_to_value[item.label.toLowerCase()] = item.value;
                // Also map value lowercase for case-insensitive value matching
                label_to_value[item.value.toLowerCase()] = item.value;
            });

            // Split on ", " (comma-space) to extract individual terms
            const pre_selected_terms = pre_selected_str.split(', ').map(s => s.trim()).filter(s => s.length > 0);

            pre_selected_terms.forEach(term => {
                if (valid_values.has(term)) {
                    // Exact value match
                    selected_values.add(term);
                } else {
                    // Case-insensitive match against values and labels
                    const matched_value = label_to_value[term.toLowerCase()];
                    if (matched_value) {
                        selected_values.add(matched_value);
                    }
                }
            });

            // Sync the hidden input with pre-selected values
            if (selected_values.size > 0) {
                sync_hidden_input(hidden_input, selected_values);
            }
        }

        // Initial render
        render_options(options_list, all_items, selected_values, '');
        render_trigger(trigger, all_items, selected_values, placeholder);

        /**
         * Position the fixed dropdown beneath the trigger element
         */
        const position_dropdown = () => {
            const rect = trigger.getBoundingClientRect();
            dropdown.style.left = rect.left + 'px';
            dropdown.style.top = rect.bottom + 'px';
            dropdown.style.width = rect.width + 'px';
        };

        // Toggle dropdown on trigger click
        trigger.addEventListener('click', (e) => {

            if (e.target.closest('.ms-tag-remove')) {
                return;
            }

            if (widget.classList.contains('disabled')) {
                return;
            }

            const is_open = dropdown.style.display === 'block';

            // Close all other open widgets first
            document.querySelectorAll('.ms-dropdown').forEach(dd => {
                dd.style.display = 'none';
                const parent_trigger = dd.parentElement.querySelector('.ms-trigger');
                if (parent_trigger) parent_trigger.classList.remove('open');
            });

            if (!is_open) {
                dropdown.style.display = 'block';
                position_dropdown();
                trigger.classList.add('open');
                search_input.value = '';
                render_options(options_list, all_items, selected_values, '');
                search_input.focus();
            }
        });

        // Reposition dropdown on scroll or resize while open
        const on_scroll_or_resize = () => {
            if (dropdown.style.display === 'block') {
                position_dropdown();
            }
        };

        window.addEventListener('scroll', on_scroll_or_resize, true);
        window.addEventListener('resize', on_scroll_or_resize);

        // Tag remove click (delegated on trigger)
        trigger.addEventListener('click', (e) => {
            const remove_btn = e.target.closest('.ms-tag-remove');
            if (!remove_btn) return;

            e.stopPropagation();

            const tag = remove_btn.closest('.ms-tag');
            if (!tag) return;

            const value = tag.getAttribute('data-value');
            selected_values.delete(value);

            sync_hidden_input(hidden_input, selected_values);
            render_trigger(trigger, all_items, selected_values, placeholder);

            if (dropdown.style.display === 'block') {
                render_options(options_list, all_items, selected_values, search_input.value);
            }
        });

        // Search input handler with debounce
        let search_timer = null;
        search_input.addEventListener('input', () => {
            clearTimeout(search_timer);
            search_timer = setTimeout(() => {
                render_options(options_list, all_items, selected_values, search_input.value);
            }, 150);
        });

        // Prevent dropdown close when clicking inside search
        search_input.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Option click handler (delegated on options list)
        options_list.addEventListener('click', (e) => {
            const option_el = e.target.closest('.ms-option');
            if (!option_el) return;

            // Prevent event from reaching document click handler.
            // render_options replaces innerHTML which detaches the clicked element;
            // without this, widget.contains(e.target) returns false and closes the dropdown.
            e.stopPropagation();

            const value = option_el.getAttribute('data-value');

            if (selected_values.has(value)) {
                selected_values.delete(value);
            } else {
                selected_values.add(value);
            }

            sync_hidden_input(hidden_input, selected_values);
            render_trigger(trigger, all_items, selected_values, placeholder);
            render_options(options_list, all_items, selected_values, search_input.value);
            search_input.focus();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!widget.contains(e.target)) {
                dropdown.style.display = 'none';
                trigger.classList.remove('open');
            }
        });

        // Keyboard: Escape closes
        search_input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dropdown.style.display = 'none';
                trigger.classList.remove('open');
            }
        });

        widget.setAttribute('data-initialized', 'true');
    };

    // ========================================
    // MULTI-SELECT
    // ========================================

    /**
     * Build multi-select widget HTML string
     *
     * @param {string} name - Form field name for the hidden input
     * @param {string} placeholder - Placeholder text
     * @param {string} id - Original select element ID (preserved for reference)
     * @param {boolean} [required=false] - Whether the field is required
     * @returns {string} HTML string
     */
    const build_widget_html = (name, placeholder, id, required) => {

        const req_attr = required ? ' data-required="true"' : '';
        let html = '';
        html += '<div class="ms-widget" data-name="' + name + '" data-placeholder="' + escape_html(placeholder) + '" data-orig-id="' + escape_html(id) + '"' + req_attr + '>';
        html += '<input type="hidden" name="' + name + '" value="">';
        html += '<div class="ms-trigger">';
        html += '<span class="ms-placeholder">' + escape_html(placeholder) + '</span>';
        html += '<i class="fa fa-chevron-down ms-arrow" aria-hidden="true"></i>';
        html += '</div>';
        html += '<div class="ms-dropdown" style="display: none;">';
        html += '<div class="ms-search-wrap">';
        html += '<input type="text" class="ms-search" placeholder="Search...">';
        html += '</div>';
        html += '<div class="ms-options-list"></div>';
        html += '</div>';
        html += '</div>';

        if (required) {
            html += '<div class="ms-invalid-feedback">Please select at least one option.</div>';
        }

        return html;
    };

    /**
     * Replace a native <select> element with a multi-select widget.
     * Preserves the parent container and label.
     *
     * @param {HTMLSelectElement} select_el - The select element to replace
     * @returns {HTMLElement|null} The new .ms-widget element, or null on failure
     */
    const upgrade_select_to_widget = (select_el) => {

        if (!select_el || !select_el.parentNode) {
            return null;
        }

        const name = select_el.getAttribute('name') || '';
        const id = select_el.id || '';

        // Genre/Form is a required field
        const is_required = (name === 'genre_form_subjects');

        // Derive placeholder from the first option text
        const first_option = select_el.querySelector('option');
        const placeholder = (first_option && first_option.value === '') ? first_option.textContent : 'Select...';

        // Capture pre-selected values from data attribute (for edit forms)
        const pre_selected = select_el.getAttribute('data-selected') || '';

        // Build widget HTML
        const widget_html = build_widget_html(name, placeholder, id, is_required);

        // Insert widget and remove original select
        select_el.insertAdjacentHTML('afterend', widget_html);
        const widget = select_el.nextElementSibling;
        select_el.remove();

        // Transfer pre-selected values to widget
        if (pre_selected && widget) {
            widget.setAttribute('data-selected', pre_selected);
        }

        return widget;
    };

    // ========================================
    // ITEM TYPE (SINGLE SELECT) HELPER
    // ========================================

    /**
     * Build <option> elements HTML for single-select (Item Type)
     * @param {Array} items - Array of resource type items
     * @returns {string} HTML string of option elements
     */
    const build_options_html = (items) => {

        if (!Array.isArray(items)) {
            return '';
        }

        let html = '';

        items.forEach((item) => {
            const fields = extract_item_fields(item);

            if (fields.value) {
                html += '<option value="' + escape_html(fields.value) + '">' + escape_html(fields.label) + '</option>';
            }
        });

        return html;
    };

    // ========================================
    // POPULATE (MAIN ENTRY POINT)
    // ========================================

    /**
     * Populate subject dropdowns and initialize multi-select widgets within a container.
     *
     * Detects existing elements and handles both scenarios:
     *   - Native <select> elements (from inline modal HTML) → upgraded to multi-select widgets
     *   - Existing .ms-widget elements (from build_subjects_html) → initialized directly
     *
     * Item Type always remains a standard single-select.
     *
     * @param {HTMLElement} container - DOM element containing the form elements
     * @returns {Promise<boolean>} True if dropdowns were populated successfully
     */
    obj.populate_subjects_dropdowns = async function(container) {

        if (!container) {
            console.error('No container provided for dropdown population');
            return false;
        }

        // Inject CSS on first use
        inject_styles();

        // Show loading message
        const loading_id = 'subjects-loading-' + Date.now();
        const loading_html = '<div id="' + loading_id + '" class="subjects-loading-message text-muted small mb-2">' +
            '<i class="fa fa-spinner fa-spin" style="margin-right: 6px;" aria-hidden="true"></i>' +
            'Loading subjects...' +
            '</div>';

        // Find the first subjects-related element (select or widget) to place loading message
        const first_subject_el = container.querySelector(
            'select[name="topics_subjects"], select[name="genre_form_subjects"], select[name="places_subjects"], ' +
            '.ms-widget[data-name="topics_subjects"], .ms-widget[data-name="genre_form_subjects"], .ms-widget[data-name="places_subjects"]'
        );

        if (first_subject_el) {
            const first_row = first_subject_el.closest('.row');

            if (first_row) {
                first_row.insertAdjacentHTML('beforebegin', loading_html);
            }
        }

        // Disable Item Type selects during load
        const item_type_selects = container.querySelectorAll('select[name="item_type"]');
        item_type_selects.forEach(s => { s.disabled = true; });

        // Step 1: Upgrade any native <select> elements for multi-select fields to widgets
        const upgraded_widgets = [];

        MULTI_SELECT_NAMES.forEach(name => {
            const selects = container.querySelectorAll('select[name="' + name + '"]');

            selects.forEach(select_el => {
                const widget = upgrade_select_to_widget(select_el);

                if (widget) {
                    upgraded_widgets.push(widget);
                }
            });
        });

        // Collect all multi-select widgets (both upgraded and pre-existing)
        const all_widgets = container.querySelectorAll('.ms-widget');
        all_widgets.forEach(w => w.classList.add('disabled'));

        try {

            // Fetch subjects and resource types in parallel
            const [subjects, resource_types] = await Promise.all([
                obj.get_subjects(),
                obj.get_resource_types()
            ]);

            // Map field name to subject data
            const subject_data_map = {
                'topics_subjects': subjects?.topical || null,
                'genre_form_subjects': subjects?.genre_form || null,
                'places_subjects': subjects?.geographic || null
            };

            // Initialize each multi-select widget with its data
            all_widgets.forEach(widget => {
                const name = widget.getAttribute('data-name');
                const data = subject_data_map[name];

                if (data) {
                    init_multi_select(widget, data);
                }
            });

            // Populate Item Type single-select
            if (resource_types) {
                const type_options = build_options_html(resource_types);

                item_type_selects.forEach((select) => {
                    select.insertAdjacentHTML('beforeend', type_options);

                    // Pre-select existing value from data-selected (for edit forms)
                    const pre_selected = select.getAttribute('data-selected');

                    if (pre_selected) {
                        select.value = pre_selected;
                    }
                });
            }

            // Remove loading message, enable controls
            const loading_el = document.getElementById(loading_id);
            if (loading_el) loading_el.remove();

            all_widgets.forEach(w => w.classList.remove('disabled'));
            item_type_selects.forEach(s => { s.disabled = false; });

            return true;

        } catch (error) {
            console.error('Error populating subject dropdowns:', error);

            const loading_el = document.getElementById(loading_id);
            if (loading_el) loading_el.remove();

            all_widgets.forEach(w => w.classList.remove('disabled'));
            item_type_selects.forEach(s => { s.disabled = false; });

            return false;
        }
    };

    // ========================================
    // BUILD HTML
    // ========================================

    /**
     * Build subject dropdown HTML for Topics, Genre/Form, Places, and Item Type
     *
     * Topics, Genre/Form, and Places render as multi-select widgets.
     * Item Type renders as a standard single select.
     *
     * @param {string} prefix - ID/class prefix for the form elements
     * @param {number|null|undefined} index - Optional numeric index for multi-form contexts
     * @returns {string} HTML string containing the two rows of dropdown fields
     */
    obj.build_subjects_html = function(prefix, index) {

        const has_index = (typeof index !== 'undefined' && index !== null);
        const id_suffix = has_index ? '-' + index : '';

        let html = '';

        // Row: Topics (multi-select), Genre/Form (multi-select)
        html += '<div class="row">';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label">Topics</label>';
        html += build_widget_html('topics_subjects', 'Select topics...', prefix + '-topics' + id_suffix);
        html += '</div>';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label">Genre/Form <span class="text-danger">*</span></label>';
        html += build_widget_html('genre_form_subjects', 'Select genre/form...', prefix + '-genre-form' + id_suffix, true);
        html += '</div></div>';

        // Row: Places (multi-select), Item Type (single select)
        html += '<div class="row">';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label">Places</label>';
        html += build_widget_html('places_subjects', 'Select places...', prefix + '-places' + id_suffix);
        html += '</div>';
        html += '<div class="col-md-6 mb-3">';
        html += '<label class="form-label" for="' + prefix + '-item-type' + id_suffix + '">Item Type <span class="text-danger">*</span></label>';
        html += '<select class="form-control form-select custom-select ' + prefix + '-item-type" id="' + prefix + '-item-type' + id_suffix + '" name="item_type" required>';
        html += '<option value="">Select item type...</option>';
        html += '</select>';
        html += '</div></div>';

        return html;
    };

    // ========================================
    // VALIDATION
    // ========================================

    /**
     * Validate required subject fields within a container.
     * Checks Genre/Form multi-select widget and Item Type single select.
     * Adds/removes visual error states as appropriate.
     *
     * @param {HTMLElement} container - DOM element containing the form fields
     * @returns {boolean} True if all required fields are valid
     */
    obj.validate_required_fields = function(container) {

        if (!container) {
            return true;
        }

        let is_valid = true;

        // Validate required multi-select widgets (Genre/Form)
        const required_widgets = container.querySelectorAll('.ms-widget[data-required="true"]');

        required_widgets.forEach(widget => {
            const hidden_input = widget.querySelector('input[type="hidden"]');
            const value = hidden_input ? hidden_input.value.trim() : '';

            if (!value) {
                widget.classList.add('is-invalid');
                is_valid = false;
            } else {
                widget.classList.remove('is-invalid');
            }
        });

        // Validate required Item Type select
        const item_type_selects = container.querySelectorAll('select[name="item_type"][required]');

        item_type_selects.forEach(select => {
            if (!select.value) {
                select.classList.add('is-invalid');
                is_valid = false;
            } else {
                select.classList.remove('is-invalid');
            }
        });

        return is_valid;
    };

    // ========================================
    // MODULE INIT
    // ========================================

    /**
     * Initialize module - pre-fetches and caches subjects and resource types
     */
    obj.init = async function() {
        try {

            const token = authModule.get_user_token();

            if (!token || token === false) {
                console.warn('Repo subjects module: no auth token available, skipping pre-fetch');
                return;
            }

            await Promise.all([
                obj.get_subjects(),
                obj.get_resource_types()
            ]);

            console.log('Repo subjects module initialized');

        } catch (error) {
            console.error('Error initializing repo subjects module:', error);
            const message_element = document.querySelector('#message');

            if (message_element) {
                message_element.innerHTML = '<div class="alert alert-danger">Error initializing repo subjects module. Please refresh the page.</div>';
            }
        }
    };

    return obj;

}());
