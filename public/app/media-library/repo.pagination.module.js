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

const repoPaginationModule = (function() {

    'use strict';

    // Configuration
    const CONFIG = {
        RESULTS_PER_PAGE: 10,
        MAX_VISIBLE_PAGES: 5
    };

    // Pagination state
    let state = {
        all_results: [],
        current_page: 1,
        total_pages: 0,
        total_results: 0
    };

    // Callback for page changes
    let on_page_change_callback = null;

    // Tracked listeners so re-bind across renders doesn't stack.
    // Each render previously called container.addEventListener without
    // removing the prior one — N renders meant N listeners and a single
    // click triggered go_to_page N times (the same-page no-ops self-mask
    // the duplicate fires). We also track mousedown (suppresses focus-
    // induced scroll-into-view) and keydown (Enter/Space activation,
    // since page-links no longer carry href="#").
    let bound_listener = null;
    let bound_mousedown_listener = null;
    let bound_keydown_listener = null;
    let bound_container = null;

    let obj = {};

    /**
     * Reset pagination state
     */
    obj.reset = function() {
        state = {
            all_results: [],
            current_page: 1,
            total_pages: 0,
            total_results: 0
        };
    };

    /**
     * Set results and initialize pagination
     * @param {Array} results - Full array of search results
     */
    obj.set_results = function(results) {
        state.all_results = results || [];
        state.total_results = state.all_results.length;
        state.total_pages = Math.ceil(state.total_results / CONFIG.RESULTS_PER_PAGE);
        state.current_page = 1;
    };

    /**
     * Get results for the current page
     * @returns {Array} Results for current page
     */
    obj.get_current_page_results = function() {
        const start_index = (state.current_page - 1) * CONFIG.RESULTS_PER_PAGE;
        const end_index = start_index + CONFIG.RESULTS_PER_PAGE;
        return state.all_results.slice(start_index, end_index);
    };

    /**
     * Get all results (for selection tracking across pages)
     * @returns {Array} All results
     */
    obj.get_all_results = function() {
        return state.all_results;
    };

    /**
     * Get the global index for an item on the current page
     * @param {number} page_index - Index within current page (0-based)
     * @returns {number} Global index across all results
     */
    obj.get_global_index = function(page_index) {
        return (state.current_page - 1) * CONFIG.RESULTS_PER_PAGE + page_index;
    };

    /**
     * Navigate to a specific page.
     *
     * @param {number} page - Page number (1-based)
     * @returns {boolean|null} `true` on a real page change, `null`
     *   when the requested page equals the current page (no-op),
     *   `false` when the page is out of range. Splitting the no-op
     *   from the invalid case lets callers distinguish "you're
     *   already there" from "that page doesn't exist".
     */
    obj.go_to_page = function(page) {
        if (page < 1 || page > state.total_pages) {
            return false;
        }
        if (page === state.current_page) {
            return null;
        }
        state.current_page = page;
        return true;
    };

    /**
     * Go to next page
     * @returns {boolean} True if navigation successful
     */
    obj.next_page = function() {
        return obj.go_to_page(state.current_page + 1);
    };

    /**
     * Go to previous page
     * @returns {boolean} True if navigation successful
     */
    obj.prev_page = function() {
        return obj.go_to_page(state.current_page - 1);
    };

    /**
     * Get current pagination state
     * @returns {Object} Current state with computed properties
     */
    obj.get_state = function() {
        const start_index = (state.current_page - 1) * CONFIG.RESULTS_PER_PAGE + 1;
        const end_index = Math.min(state.current_page * CONFIG.RESULTS_PER_PAGE, state.total_results);

        return {
            current_page: state.current_page,
            total_pages: state.total_pages,
            total_results: state.total_results,
            results_per_page: CONFIG.RESULTS_PER_PAGE,
            start_index: state.total_results > 0 ? start_index : 0,
            end_index: end_index,
            has_previous: state.current_page > 1,
            has_next: state.current_page < state.total_pages
        };
    };

    /**
     * Check if pagination is needed
     * @returns {boolean} True if there are multiple pages
     */
    obj.needs_pagination = function() {
        return state.total_pages > 1;
    };

    /**
     * Generate array of page numbers to display
     * @returns {Array} Array of page numbers and '...' markers
     */
    obj.get_page_numbers = function() {
        const pages = [];
        const current = state.current_page;
        const total = state.total_pages;
        const max_visible = CONFIG.MAX_VISIBLE_PAGES;

        if (total <= max_visible + 2) {
            // Show all pages if total is small
            for (let i = 1; i <= total; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);

            if (current > 3) {
                pages.push('...');
            }

            // Calculate range around current page
            let start = Math.max(2, current - 1);
            let end = Math.min(total - 1, current + 1);

            // Adjust range to show context
            if (current <= 3) {
                end = Math.min(total - 1, 4);
            }
            if (current >= total - 2) {
                start = Math.max(2, total - 3);
            }

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            if (current < total - 2) {
                pages.push('...');
            }

            // Always show last page
            pages.push(total);
        }

        return pages;
    };

    /**
     * Render pagination controls HTML
     * @returns {string} HTML string for pagination controls
     */
    obj.render = function() {
        const pagination_state = obj.get_state();

        if (pagination_state.total_results === 0 || pagination_state.total_pages <= 1) {
            return '';
        }

        const page_numbers = obj.get_page_numbers();

        let html = '';
        html += '<nav aria-label="Repository search results pagination" class="repo-pagination mt-4">';
        html += '<div class="d-flex justify-content-between align-items-center flex-wrap">';

        // Results info
        html += '<div class="pagination-info text-muted small mb-2 mb-md-0">';
        html += 'Showing ' + pagination_state.start_index + ' - ' + pagination_state.end_index;
        html += ' of ' + pagination_state.total_results + ' results';
        html += '</div>';

        // Pagination controls
        html += '<ul class="pagination pagination-sm mb-0">';

        // Previous button
        const prev_disabled = !pagination_state.has_previous ? 'disabled' : '';
        const prev_tabindex = pagination_state.has_previous ? '0' : '-1';
        html += '<li class="page-item ' + prev_disabled + '">';
        html += '<a class="page-link repo-page-link" role="button" tabindex="' + prev_tabindex + '" data-page="' + (pagination_state.current_page - 1) + '"';
        html += ' aria-label="Previous page"';
        if (!pagination_state.has_previous) {
            html += ' aria-disabled="true"';
        }
        html += '>';
        html += '<i class="fa fa-chevron-left" aria-hidden="true"></i>';
        html += '<span class="sr-only">Previous</span>';
        html += '</a>';
        html += '</li>';

        // Page numbers
        page_numbers.forEach(function(page_num) {
            if (page_num === '...') {
                html += '<li class="page-item disabled">';
                html += '<span class="page-link">...</span>';
                html += '</li>';
            } else {
                const is_active = page_num === pagination_state.current_page;
                html += '<li class="page-item ' + (is_active ? 'active' : '') + '">';
                html += '<a class="page-link repo-page-link" role="button" tabindex="0" data-page="' + page_num + '"';
                if (is_active) {
                    html += ' aria-current="page"';
                }
                html += '>' + page_num;
                if (is_active) {
                    html += '<span class="sr-only"> (current)</span>';
                }
                html += '</a>';
                html += '</li>';
            }
        });

        // Next button
        const next_disabled = !pagination_state.has_next ? 'disabled' : '';
        const next_tabindex = pagination_state.has_next ? '0' : '-1';
        html += '<li class="page-item ' + next_disabled + '">';
        html += '<a class="page-link repo-page-link" role="button" tabindex="' + next_tabindex + '" data-page="' + (pagination_state.current_page + 1) + '"';
        html += ' aria-label="Next page"';
        if (!pagination_state.has_next) {
            html += ' aria-disabled="true"';
        }
        html += '>';
        html += '<i class="fa fa-chevron-right" aria-hidden="true"></i>';
        html += '<span class="sr-only">Next</span>';
        html += '</a>';
        html += '</li>';

        html += '</ul>';
        html += '</div>';
        html += '</nav>';

        return html;
    };

    /**
     * Set callback for page change events
     * @param {Function} callback - Function to call when page changes
     */
    obj.on_page_change = function(callback) {
        if (typeof callback === 'function') {
            on_page_change_callback = callback;
        }
    };

    /**
     * Bind click events for pagination controls
     * @param {HTMLElement} container - Container element with pagination controls
     */
    obj.bind_events = function(container) {
        if (!container) {
            container = document.getElementById('repo-search-results');
        }

        if (!container) return;

        // Detach prior listeners before binding new ones. Without this,
        // every re-render stacks another delegated handler on the same
        // container — N renders → N go_to_page calls per click.
        if (bound_listener && bound_container) {
            bound_container.removeEventListener('click', bound_listener);
        }
        if (bound_mousedown_listener && bound_container) {
            bound_container.removeEventListener('mousedown', bound_mousedown_listener);
        }
        if (bound_keydown_listener && bound_container) {
            bound_container.removeEventListener('keydown', bound_keydown_listener);
        }

        // Suppress mouse-induced focus on page links. The browser
        // focuses an <a> before the click handler runs, and the
        // "scroll focused element fully into view" behavior can jump
        // the page when the anchor is near the viewport edge — far
        // enough to bring the next section (the Media List card) into
        // view. preventDefault on mousedown stops the focus from being
        // applied without affecting the click event itself.
        const mousedown_handler = function(event) {
            if (event.button !== 0) return;
            if (event.target.closest('.repo-page-link')) {
                event.preventDefault();
            }
        };

        const handler = function(event) {
            const page_link = event.target.closest('.repo-page-link');

            if (page_link) {
                event.preventDefault();

                const page_item = page_link.closest('.page-item');
                if (page_item && page_item.classList.contains('disabled')) {
                    return;
                }

                const page = parseInt(page_link.dataset.page, 10);

                if (page && obj.go_to_page(page)) {
                    // Capture scroll position BEFORE the page-change
                    // callback runs. The callback re-renders the
                    // results container, which destroys the focused
                    // page-link anchor. Browsers — and possibly
                    // intermediate tab/focus logic — can react to that
                    // by scrolling another element into view (in
                    // particular, the Media List card below). Restore
                    // scrollY synchronously after the callback to
                    // anchor the user where they were. We use rAF +
                    // a fallback restore to catch any deferred scroll
                    // that runs after layout settles.
                    const scroll_x = window.scrollX;
                    const scroll_y = window.scrollY;

                    if (typeof on_page_change_callback === 'function') {
                        on_page_change_callback(page, obj.get_current_page_results());
                    }

                    // Synchronous restore (in case a scroll already
                    // happened during the re-render).
                    if (window.scrollX !== scroll_x || window.scrollY !== scroll_y) {
                        window.scrollTo(scroll_x, scroll_y);
                    }
                    // Deferred restore covers any post-layout focus or
                    // smooth-scroll that fires on the next frame.
                    requestAnimationFrame(() => {
                        if (window.scrollX !== scroll_x || window.scrollY !== scroll_y) {
                            window.scrollTo(scroll_x, scroll_y);
                        }
                    });

                    // Announce page change for screen readers
                    announce_page_change();
                }
            }
        };

        // Keyboard activation. Page links no longer carry href="#"
        // (it was the original culprit for fragment-navigation scroll
        // jumps). Without href the anchor still focuses and click-fires
        // via mouse, but keyboard users need Enter/Space to dispatch
        // the click explicitly. role="button" + tabindex="0" already
        // make the element focusable and announced as a button.
        const keydown_handler = function(event) {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const page_link = event.target.closest('.repo-page-link');
            if (page_link) {
                event.preventDefault();
                page_link.click();
            }
        };

        container.addEventListener('click', handler);
        container.addEventListener('mousedown', mousedown_handler);
        container.addEventListener('keydown', keydown_handler);
        bound_listener = handler;
        bound_mousedown_listener = mousedown_handler;
        bound_keydown_listener = keydown_handler;
        bound_container = container;
    };

    /**
     * Announce page change for accessibility
     */
    const announce_page_change = function() {
        const pagination_state = obj.get_state();

        // Create or find live region
        let live_region = document.getElementById('repo-pagination-live');
        if (!live_region) {
            live_region = document.createElement('div');
            live_region.id = 'repo-pagination-live';
            live_region.setAttribute('role', 'status');
            live_region.setAttribute('aria-live', 'polite');
            live_region.className = 'sr-only';
            document.body.appendChild(live_region);
        }

        live_region.textContent = 'Page ' + pagination_state.current_page + ' of ' + pagination_state.total_pages +
            '. Showing results ' + pagination_state.start_index + ' to ' + pagination_state.end_index +
            ' of ' + pagination_state.total_results + '.';
    };

    /**
     * Get results per page setting
     * @returns {number} Number of results per page
     */
    obj.get_results_per_page = function() {
        return CONFIG.RESULTS_PER_PAGE;
    };

    /**
     * Get the maximum number of page links rendered before the
     * ellipsis-boundary kicks in. Symmetric with get_results_per_page
     * so tests/consumers don't need to mirror the constant locally.
     *
     * @returns {number} Max visible page count
     */
    obj.get_max_visible_pages = function() {
        return CONFIG.MAX_VISIBLE_PAGES;
    };

    /**
     * Initialize module
     */
    obj.init = function() {
        obj.reset();
        console.debug('Repo pagination module initialized');
        return true;
    };

    return obj;

}());
