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
class SubjectsMenu {

    /**
     * Element IDs used by the widget
     * @type {Object}
     */
    static ELEMENT_IDS = {
        header: 'dropdownHeader',
        list: 'dropdownList',
        virtual_list: 'virtualList',
        arrow: 'arrow',
        selected_text: 'selectedText',
        result_list: 'resultList',
        search_box: 'searchBox',
        search_input: 'searchInput',
        selected_subjects_input: 'selected-subjects'
    };

    /**
     * Default configuration values
     * @type {Object}
     */
    static DEFAULTS = {
        ITEM_HEIGHT: 48,
        BUFFER: 50,
        SEARCH_DEBOUNCE_MS: 150
    };

    /**
     * Creates a new SubjectsMenu instance
     * @param {Object} options - Configuration options
     * @param {Function} options.get_item_subjects - Async function that returns array of available subjects
     * @param {Function} options.show_error_message - Function to display error messages to user
     * @param {Function} [options.on_change] - Optional callback when selection changes
     */
    constructor(options = {}) {
        // Validate required options
        if (typeof options.get_item_subjects !== 'function') {
            throw new Error('SubjectsMenu requires get_item_subjects function');
        }

        if (typeof options.show_error_message !== 'function') {
            throw new Error('SubjectsMenu requires show_error_message function');
        }

        // Store configuration
        this.get_item_subjects = options.get_item_subjects;
        this.show_error_message = options.show_error_message;
        this.on_change = options.on_change || null;

        // Instance state
        this.elements = null;
        this.state = null;
        this.abort_controller = null;
        this.search_timeout = null;
        this.all_items = [];
        this.initialized = false;

        // Bind methods to preserve context
        this._handle_search_input = this._handle_search_input.bind(this);
        this._handle_header_click = this._handle_header_click.bind(this);
        this._handle_document_click = this._handle_document_click.bind(this);
        this._handle_scroll = this._handle_scroll.bind(this);
    }

    /**
     * Initialize the subjects menu
     * @param {string[]} [subjects=[]] - Array of pre-selected subject strings
     * @returns {Promise<boolean>} - True if initialization succeeded
     */
    async init(subjects = []) {
        try {
            // Clean up any previous instance
            this.destroy();

            // Create new AbortController for this instance
            this.abort_controller = new AbortController();

            // Validate and normalize subjects input
            if (!Array.isArray(subjects)) {
                console.warn('SubjectsMenu: subjects parameter is not an array, converting');
                subjects = [];
            }

            // Fetch all available subjects
            this.all_items = await this.get_item_subjects();

            if (!this.all_items || !Array.isArray(this.all_items)) {
                console.error('SubjectsMenu: Failed to retrieve item subjects');
                this.show_error_message('Failed to load subjects.');
                return false;
            }

            // Get and validate DOM elements
            if (!this._setup_elements()) {
                return false;
            }

            // Initialize state
            this._setup_state(subjects);

            // Attach event listeners
            this._attach_listeners();

            // Initial render
            this._render_virtual_list();
            this._update_selected();

            this.initialized = true;
            return true;

        } catch (error) {
            console.error('SubjectsMenu: Error in init:', error.message);
            this.show_error_message(`An error occurred: ${error.message}`);
            return false;
        }
    }

    /**
     * Update the selected subjects without full re-initialization
     * Use this when receiving a new payload after the page has loaded
     * @param {string[]} [subjects=[]] - Array of subject strings to select
     * @returns {Promise<boolean>} - True if update succeeded
     */
    async update(subjects = []) {
        // If not initialized, do full init
        if (!this.initialized) {
            return this.init(subjects);
        }

        try {
            // Validate input
            if (!Array.isArray(subjects)) {
                console.warn('SubjectsMenu: subjects parameter is not an array, converting');
                subjects = [];
            }

            // Update state with new subjects
            this.state.selected = new Set(subjects.filter(s => s && s.trim()));

            // Reset filtered items to show all
            this.state.filtered_items = [...this.all_items];

            // Clear search input if present
            if (this.elements.search_input) {
                this.elements.search_input.value = '';
            }

            // Close dropdown if open
            this._close_dropdown();

            // Re-render
            this._render_virtual_list();
            this._update_selected();

            return true;

        } catch (error) {
            console.error('SubjectsMenu: Error in update:', error.message);
            this.show_error_message(`An error occurred: ${error.message}`);
            return false;
        }
    }

    /**
     * Get the currently selected subjects
     * @returns {string[]} - Array of selected subject strings
     */
    get_selected() {
        if (!this.state) {
            return [];
        }
        return Array.from(this.state.selected).filter(item => item && item.trim());
    }

    /**
     * Clear all selections
     */
    clear() {
        if (!this.state) {
            return;
        }
        this.state.selected.clear();
        this._render_virtual_list();
        this._update_selected();
    }

    /**
     * Destroy the instance and clean up all resources
     */
    destroy() {
        // Abort all event listeners
        if (this.abort_controller) {
            this.abort_controller.abort();
            this.abort_controller = null;
        }

        // Clear any pending timeout
        if (this.search_timeout) {
            clearTimeout(this.search_timeout);
            this.search_timeout = null;
        }

        // Clear state
        this.state = null;
        this.elements = null;
        this.initialized = false;
    }

    /**
     * Check if the menu is currently initialized
     * @returns {boolean}
     */
    is_initialized() {
        return this.initialized;
    }

    // =========================================================================
    // Private Methods
    // =========================================================================

    /**
     * Set up DOM element references
     * @returns {boolean} - True if all elements found
     * @private
     */
    _setup_elements() {
        this.elements = {};

        for (const [key, id] of Object.entries(SubjectsMenu.ELEMENT_IDS)) {
            const element = document.getElementById(id);

            if (!element) {
                console.error(`SubjectsMenu: Required element not found: ${key} (id: ${id})`);
                this.show_error_message(`Missing required UI element: ${key}`);
                return false;
            }

            this.elements[key] = element;
        }

        return true;
    }

    /**
     * Initialize the state object
     * @param {string[]} subjects - Pre-selected subjects
     * @private
     */
    _setup_state(subjects) {
        this.state = {
            selected: new Set(subjects.filter(s => s && s.trim())),
            filtered_items: [...this.all_items],
            item_map: new Map(),
            is_open: false,
            ITEM_HEIGHT: SubjectsMenu.DEFAULTS.ITEM_HEIGHT,
            BUFFER: SubjectsMenu.DEFAULTS.BUFFER
        };
    }

    /**
     * Attach all event listeners using AbortController signal
     * @private
     */
    _attach_listeners() {
        const signal = this.abort_controller.signal;

        // Search input handler
        this.elements.search_input.addEventListener('input', this._handle_search_input, { signal });

        // Dropdown toggle handler
        this.elements.header.addEventListener('click', this._handle_header_click, { signal });

        // Close dropdown when clicking outside
        document.addEventListener('click', this._handle_document_click, { signal });

        // Scroll handler for virtual list
        this.elements.list.addEventListener('scroll', this._handle_scroll, { signal });
    }

    /**
     * Handle search input with debouncing
     * @param {Event} e - Input event
     * @private
     */
    _handle_search_input(e) {
        clearTimeout(this.search_timeout);

        this.search_timeout = setTimeout(() => {
            const query = e.target.value.toLowerCase().trim();

            this.state.filtered_items = query
                ? this.all_items.filter(item => item.toLowerCase().startsWith(query))
                : [...this.all_items];

            this._render_virtual_list();
        }, SubjectsMenu.DEFAULTS.SEARCH_DEBOUNCE_MS);
    }

    /**
     * Handle dropdown header click (toggle open/close)
     * @private
     */
    _handle_header_click() {
        this.state.is_open = !this.state.is_open;

        this.elements.list.classList.toggle('show');
        this.elements.header.classList.toggle('active');
        this.elements.arrow.classList.toggle('rotate');
        this.elements.search_box.classList.toggle('show');

        if (this.state.is_open) {
            this.elements.search_input.focus();
            this._render_virtual_list();
        } else {
            this.elements.search_input.value = '';
            this.state.filtered_items = [...this.all_items];
        }
    }

    /**
     * Handle clicks outside the dropdown to close it
     * @param {Event} e - Click event
     * @private
     */
    _handle_document_click(e) {
        if (!e.target.closest('.dropdown-container')) {
            this._close_dropdown();
        }
    }

    /**
     * Handle scroll events for virtual list rendering
     * @private
     */
    _handle_scroll() {
        this._render_virtual_list();
    }

    /**
     * Close the dropdown and reset search
     * @private
     */
    _close_dropdown() {
        if (!this.state || !this.elements) {
            return;
        }

        this.state.is_open = false;
        this.elements.list.classList.remove('show');
        this.elements.header.classList.remove('active');
        this.elements.arrow.classList.remove('rotate');
        this.elements.search_box.classList.remove('show');
        this.elements.search_input.value = '';
        this.state.filtered_items = [...this.all_items];
    }

    /**
     * Render the virtual list for performance with large datasets
     * Only renders visible items plus a buffer
     * @private
     */
    _render_virtual_list() {
        if (!this.elements || !this.state) {
            return;
        }

        const { virtual_list, list } = this.elements;
        const { filtered_items, selected, ITEM_HEIGHT, BUFFER, item_map } = this.state;

        // Clear existing content
        virtual_list.innerHTML = '';
        item_map.clear();

        // Calculate visible range
        const scroll_top = list.scrollTop || 0;
        const start_idx = Math.max(0, Math.floor(scroll_top / ITEM_HEIGHT) - BUFFER);
        const end_idx = Math.min(
            filtered_items.length,
            Math.ceil((scroll_top + list.clientHeight) / ITEM_HEIGHT) + BUFFER
        );

        // Set container height for proper scrollbar
        virtual_list.style.height = `${filtered_items.length * ITEM_HEIGHT}px`;
        virtual_list.style.position = 'relative';

        // Render only visible items
        for (let i = start_idx; i < end_idx; i++) {
            const item = filtered_items[i];
            const div = this._create_dropdown_item(item, selected.has(item));
            virtual_list.appendChild(div);
        }
    }

    /**
     * Create a dropdown item element
     * @param {string} item - The subject text
     * @param {boolean} is_checked - Whether the item is selected
     * @returns {HTMLElement} - The dropdown item element
     * @private
     */
    _create_dropdown_item(item, is_checked) {
        const index = this.state.filtered_items.indexOf(item);

        const div = document.createElement('div');
        div.className = 'dropdown-item';
        div.style.position = 'absolute';
        div.style.top = `${index * this.state.ITEM_HEIGHT}px`;
        div.style.width = '100%';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = item;
        checkbox.className = 'form-check-input';
        checkbox.checked = is_checked;

        const label = document.createElement('label');
        label.className = 'ms-2';
        label.style.cursor = 'pointer';
        label.style.marginBottom = '0';
        label.textContent = item;
        label.style.paddingLeft = '30px';

        // Checkbox change handler
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.state.selected.add(item);
            } else {
                this.state.selected.delete(item);
            }
            this._update_selected();
            this._notify_change();
        });

        // Label click handler
        label.addEventListener('click', (e) => {
            e.stopPropagation();
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        });

        div.appendChild(checkbox);
        div.appendChild(label);

        // Store reference for unchecking from result list
        this.state.item_map.set(item, checkbox);

        return div;
    }

    /**
     * Update the selected items display and hidden input
     * @private
     */
    _update_selected() {
        if (!this.elements || !this.state) {
            return;
        }

        const { selected_text, result_list, selected_subjects_input } = this.elements;
        const { selected, item_map, is_open } = this.state;

        // Convert Set to Array and filter out empty strings
        const selected_array = Array.from(selected).filter(item => item && item.trim());

        // Update the Set to match the filtered array
        this.state.selected = new Set(selected_array);

        const count = selected_array.length;

        if (count === 0) {
            selected_text.innerHTML = '<span class="placeholder">Select subjects...</span>';
            result_list.innerHTML = '<li style="color: #999;">None selected</li>';
            selected_subjects_input.value = '';
        } else {
            // Update header display
            const display = count <= 2
                ? selected_array.join(', ')
                : `${selected_array[0]}, ${selected_array[1]}...`;

            selected_text.innerHTML = `${display} <span class="selected-count">${count}</span>`;

            // Update result list
            result_list.innerHTML = selected_array
                .sort()
                .map(item => {
                    // Escape HTML to prevent XSS
                    const escaped_item = document.createElement('div');
                    escaped_item.textContent = item;
                    const safe_item = escaped_item.innerHTML;

                    return `<li>
                        <span>${safe_item}</span>
                        <button class="uncheck-btn" title="Remove subject" data-item="${safe_item}" 
                            style="background: none; border: none; cursor: pointer; color: #999; padding: 0 5px; font-size: 18px; line-height: 1;">×</button>
                    </li>`;
                })
                .join('');

            // Add event listeners to remove buttons
            this._attach_remove_buttons();

            // Update hidden input with pipe-separated values
            selected_subjects_input.value = selected_array.join('|');
        }
    }

    /**
     * Attach click handlers to remove buttons in the result list
     * @private
     */
    _attach_remove_buttons() {
        this.elements.result_list.querySelectorAll('.uncheck-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const item = btn.dataset.item;

                // Remove from selected Set
                this.state.selected.delete(item);

                // Uncheck the checkbox in the dropdown if visible
                const checkbox = this.state.item_map.get(item);
                if (checkbox) {
                    checkbox.checked = false;
                }

                // Re-render
                this._update_selected();

                // Re-render virtual list if dropdown is open
                if (this.state.is_open) {
                    this._render_virtual_list();
                }

                this._notify_change();
            });
        });
    }

    /**
     * Notify external listeners of selection changes
     * @private
     */
    _notify_change() {
        if (typeof this.on_change === 'function') {
            this.on_change(this.get_selected());
        }
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SubjectsMenu;
}
