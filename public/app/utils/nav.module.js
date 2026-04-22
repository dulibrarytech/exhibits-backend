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

const navModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const SIDEBAR_STORAGE_KEY = 'exhibits_sidebar_collapsed';
    let obj = {};

    // ==================== COLLAPSED CENTERING ====================

    /**
     * Determines if the sidebar is currently in collapsed (83px icon-only) state.
     *
     * The sidebar can be collapsed in TWO ways:
     * 1. The `.open` class on <html>/<body> (user preference via localStorage)
     * 2. The theme's @media (max-width: 1024px) responsive rules which
     *    collapse the sidebar WITHOUT .open — directly on aside.left-panel
     *
     * Checking only .open misses case 2, causing off-center icons on
     * narrower viewports.  Checking the actual rendered width catches both.
     *
     * @returns {boolean}
     */
    function is_sidebar_collapsed() {

        const panel = document.getElementById('left-panel');

        if (!panel) {
            return false;
        }

        // 83px is the theme's collapsed width in both .open and @media modes
        return panel.offsetWidth <= 83;
    }

    /**
     * Applies or clears inline style attributes on sidebar nav elements
     * to center icons in collapsed state.  Inline style attributes sit at
     * the absolute top of the CSS cascade and cannot be overridden by any
     * stylesheet rule.
     *
     * @param {boolean} collapsed - true when sidebar is in 83px state
     */
    function apply_collapsed_centering(collapsed) {

        const panel = document.getElementById('left-panel');

        if (!panel) {
            return;
        }

        const navbar = panel.querySelector('.navbar');
        const main_menu = panel.querySelector('#main-menu');
        const nav_ul = panel.querySelector('#main-menu .navbar-nav');
        const items = panel.querySelectorAll('#main-menu .navbar-nav > li');
        const links = panel.querySelectorAll('#main-menu .navbar-nav > li > a');
        const icons = panel.querySelectorAll('#main-menu .navbar-nav > li > a > .menu-icon');
        const labels = panel.querySelectorAll('#main-menu .nav-label');

        if (collapsed) {

            // Force full-width on all container levels.
            // The theme sets .navbar { display: inline-block } which
            // shrink-wraps the nav to content width (~20px icon).
            // Without full-width containers, centering within the <a>
            // has no effect — the whole chain is flush-left in the 83px sidebar.
            if (navbar) {
                navbar.style.cssText = 'display:block;width:100%;';
            }

            if (main_menu) {
                main_menu.style.cssText = 'display:block;width:100%;';
            }

            // Force vertical stacking — Bootstrap's .navbar-expand-sm sets
            // flex-direction:row on .navbar-nav at ≥576px, which makes each
            // <li> only as wide as its icon (~20px) and left-aligned within
            // the row.  Switching to column + width:100% ensures each <li>
            // spans the full 83px sidebar width so centering works.
            if (nav_ul) {
                nav_ul.style.cssText = 'flex-direction:column;width:100%;';
            }

            for (let i = 0; i < items.length; i++) {
                items[i].style.cssText = 'padding:0;width:100%;';
            }

            for (let j = 0; j < links.length; j++) {
                links[j].style.cssText = 'display:flex;justify-content:center;align-items:center;max-width:none;padding:12px 0;font-size:14px;width:100%;';
            }

            for (let k = 0; k < icons.length; k++) {
                icons[k].style.cssText = 'float:none;display:inline-block;width:auto;margin:0;font-size:20px;';
            }

            for (let m = 0; m < labels.length; m++) {
                labels[m].style.display = 'none';
            }

        } else {

            // Apply expanded layout styles — theme CSS alone leaves
            // .menu-icon with a large fixed width (~70px gap) and no
            // white-space control, causing labels to sit far from icons
            // and wrap to a second line.
            if (navbar) {
                navbar.style.cssText = 'display:block;width:100%;';
            }

            if (main_menu) {
                main_menu.style.cssText = 'display:block;width:100%;';
            }

            if (nav_ul) {
                nav_ul.style.cssText = 'flex-direction:column;width:100%;';
            }

            for (let i = 0; i < items.length; i++) {
                items[i].style.cssText = 'padding:0;width:100%;';
            }

            for (let j = 0; j < links.length; j++) {
                links[j].style.cssText = 'display:flex;align-items:center;max-width:none;padding:12px 15px;font-size:14px;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
            }

            for (let k = 0; k < icons.length; k++) {
                icons[k].style.cssText = 'float:none;display:inline-flex;flex-shrink:0;width:auto;margin:0 10px 0 0;font-size:20px;';
            }

            for (let m = 0; m < labels.length; m++) {
                labels[m].style.cssText = 'display:inline;white-space:nowrap;';
            }
        }
    }

    // ==================== SIDEBAR TOGGLE ====================

    /**
     * Initializes the sidebar collapse/expand toggle.
     *
     * The early inline script in header.ejs applies `.open` to <html>
     * synchronously before first paint, so the sidebar renders in its
     * saved state immediately with no visible transition.
     *
     * This function:
     * 1. Syncs the `.open` class from <html> to <body>
     * 2. Sets the toggle tooltip
     * 3. Applies collapsed centering based on actual sidebar width
     * 4. After the first painted frame, adds `.sidebar-ready` to <body>
     *    and re-applies centering to catch any late overrides
     * 5. Attaches the click handler to #sidebar-toggle
     * 6. Listens for viewport resize to re-apply centering when the
     *    theme's @media (max-width: 1024px) responsive collapse triggers
     *
     * Self-invoked via DOMContentLoaded (see bottom of module) so it
     * works on every page regardless of whether init() is called.
     */
    obj.init_sidebar_toggle = function () {

        const toggle_btn = document.getElementById('sidebar-toggle');

        if (!toggle_btn) {
            return;
        }

        // Guard against double-initialization
        if (toggle_btn.dataset.initialized === '1') {
            return;
        }

        toggle_btn.dataset.initialized = '1';

        /**
         * Updates the toggle button tooltip to reflect current state
         * @param {boolean} is_collapsed
         */
        const update_toggle_label = function (is_collapsed) {
            toggle_btn.title = is_collapsed ? 'Expand sidebar' : 'Collapse sidebar';
        };

        // Sync state: the early <head> script set .open on <html>.
        // Copy it to <body> so both ancestors carry the class (some
        // theme rules may target body.open specifically).
        const has_open = document.documentElement.classList.contains('open');

        if (has_open) {
            document.body.classList.add('open');
        } else {
            document.body.classList.remove('open');
        }

        update_toggle_label(has_open);

        // Apply centering based on actual sidebar width (catches both
        // .open-based collapse AND @media responsive collapse)
        apply_collapsed_centering(is_sidebar_collapsed());

        // Re-apply centering after the browser has fully painted.
        // Double rAF ensures all other DOMContentLoaded handlers
        // and style recalculations have completed.
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                document.body.classList.add('sidebar-ready');
                apply_collapsed_centering(is_sidebar_collapsed());
            });
        });

        // Toggle on click
        toggle_btn.addEventListener('click', function (e) {
            e.preventDefault();

            const is_now_collapsed = document.body.classList.toggle('open');
            document.documentElement.classList.toggle('open');

            try {
                window.localStorage.setItem(SIDEBAR_STORAGE_KEY, is_now_collapsed ? '1' : '0');
            } catch (err) {
                console.warn('Unable to save sidebar state:', err);
            }

            update_toggle_label(is_now_collapsed);

            // Use the known toggle state directly — is_sidebar_collapsed()
            // measures offsetWidth, which is unreliable during the CSS
            // width transition (still reads <=83px, causing labels to
            // be re-hidden immediately after expanding).
            apply_collapsed_centering(is_now_collapsed);

            // Re-apply after the CSS transition completes to catch any
            // edge cases where the final rendered width disagrees.
            setTimeout(function () {
                apply_collapsed_centering(is_sidebar_collapsed());
            }, 350);
        });

        // Re-apply centering when viewport crosses the 1024px breakpoint
        // (the theme collapses/expands the sidebar via @media rules)
        let resize_timer;

        window.addEventListener('resize', function () {
            clearTimeout(resize_timer);
            resize_timer = setTimeout(function () {
                apply_collapsed_centering(is_sidebar_collapsed());
            }, 100);
        });
    };

    // ==================== NAV LINK WIRING ====================

    /**
     * Generic nav link wiring — resolves data-nav-path tokens and sets href.
     *
     * Reads query-string params from the current URL and replaces {exhibit_id},
     * {item_id}, {grid_id}, and {timeline_id} tokens found in data-nav-path
     * attributes within #main-menu.  Prepends APP_PATH to the resolved path.
     *
     * If a required token value is missing (null / empty), the link's parent
     * <li> is removed from the DOM (matches the old set_item_list_link behavior
     * of removing the nav entry when exhibit_id is absent).
     */
    obj.wire_nav_links = function () {

        const params = new URLSearchParams(window.location.search);
        const tokens = {
            '{exhibit_id}': params.get('exhibit_id'),
            '{item_id}': params.get('item_id'),
            '{grid_id}': params.get('grid_id'),
            '{timeline_id}': params.get('timeline_id')
        };

        const nav_links = document.querySelectorAll('#main-menu [data-nav-path]');

        for (let i = 0; i < nav_links.length; i++) {
            const el = nav_links[i];
            let path = el.getAttribute('data-nav-path');
            let has_missing_token = false;

            const token_keys = Object.keys(tokens);

            for (let j = 0; j < token_keys.length; j++) {
                const token = token_keys[j];

                if (path.indexOf(token) !== -1) {

                    if (tokens[token] === null || tokens[token] === '') {
                        has_missing_token = true;
                        break;
                    }

                    path = path.split(token).join(encodeURIComponent(tokens[token]));
                }
            }

            if (has_missing_token) {
                const li = el.closest('li');

                if (li) {
                    li.remove();
                }

                continue;
            }

            el.href = APP_PATH + path;
        }
    };

    // ==================== LEGACY NAV FUNCTIONS ====================
    // Preserved for non-exhibit page families until they migrate
    // to the unified nav partial + wire_nav_links().

    obj.set_preview_link = function () {

        const uuid = helperModule.get_parameter_by_name('exhibit_id');
        const preview_link = APP_PATH + '/preview?uuid=' + uuid;
        const li = document.getElementById('preview-link');

        if (li === null) {
            return;
        }

        const anchor = document.createElement('a');
        anchor.title = 'Previews Exhibit';
        anchor.href = preview_link;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.innerHTML = '<i class="menu-icon fa fa-eye"></i><span class="nav-label">Preview</span>';

        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            exhibitsModule.open_preview(preview_link);
        });

        li.textContent = '';
        li.appendChild(anchor);
    };

    obj.back_to_exhibits = function () {
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const back_link = document.getElementById('back-to-exhibits');
        const item_list_link = document.getElementById('item-list');

        if (back_link) {
            back_link.href = `${APP_PATH}/exhibits?exhibit_id=${encodeURIComponent(exhibit_id)}`;
        }

        if (item_list_link) {
            item_list_link.href = `${APP_PATH}/items?exhibit_id=${encodeURIComponent(exhibit_id)}`;
        }
    };

    // nav-dashboard-items.ejs
    obj.set_item_nav_menu_links = function () {

        const uuid = helperModule.get_parameter_by_name('exhibit_id');

        const link_map = {
            'exhibits-link': '/exhibits/exhibit/details',
            'heading-link': '/items/heading',
            'standard-media-item-link': '/items/standard/media',
            'standard-text-item-link': '/items/standard/text',
            'item-grid-link': '/items/grid',
            'item-vertical-timeline-link': '/items/vertical-timeline'
        };

        const entries = Object.entries(link_map);

        for (let i = 0; i < entries.length; i++) {
            const el = document.getElementById(entries[i][0]);

            if (el === null) {
                console.log('WARN: nav menu link element not found: #' + entries[i][0]);
                continue;
            }

            el.href = APP_PATH + entries[i][1] + '?exhibit_id=' + uuid;
        }
    };

    // nav-dashboard-grid-add-form.ejs
    // items.add.grid.form.module.js
    obj.back_to_items = function () {
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const back_to_items_link = document.getElementById('back-to-items');

        if (back_to_items_link) {
            back_to_items_link.href = `${APP_PATH}/items?exhibit_id=${encodeURIComponent(exhibit_id)}`;
        }
    };

    // nav-dashboard-grid-edit-form.ejs
    // items.edit.grid.form.module.js
    obj.edit_grid_back_to_items = function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const grid_id = helperModule.get_parameter_by_name('item_id');
        const params = `exhibit_id=${encodeURIComponent(exhibit_id)}&grid_id=${encodeURIComponent(grid_id)}`;
        const grid_items_link = document.getElementById('grid-items');
        const back_to_items_link = document.getElementById('back-to-items');

        if (grid_items_link) {
            grid_items_link.href = `${APP_PATH}/items/grid/items?${params}`;
        }

        if (back_to_items_link) {
            back_to_items_link.href = `${APP_PATH}/items?exhibit_id=${encodeURIComponent(exhibit_id)}`;
        }
    };

    // nav-dashboard-grid-items.ejs
    obj.set_grid_item_nav_menu_links = function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const grid_id = helperModule.get_parameter_by_name('grid_id');
        const query = '?exhibit_id=' + exhibit_id + '&grid_id=' + grid_id;

        const link_map = {
            'back-to-items': '/items?exhibit_id=' + exhibit_id,
            'grid-media-item-link': '/items/grid/item/media' + query,
            'grid-text-item-link': '/items/grid/item/text' + query
        };

        const entries = Object.entries(link_map);

        for (let i = 0; i < entries.length; i++) {
            const el = document.getElementById(entries[i][0]);

            if (el === null) {
                console.log('WARN: nav menu link element not found: #' + entries[i][0]);
                continue;
            }

            el.href = APP_PATH + entries[i][1];
        }
    };

    // dashboard-timeline-items.ejs
    obj.set_timeline_item_nav_menu_links = function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const timeline_id = helperModule.get_parameter_by_name('timeline_id');
        const query = '?exhibit_id=' + exhibit_id + '&timeline_id=' + timeline_id;

        const link_map = {
            'back-to-items': '/items?exhibit_id=' + exhibit_id,
            'timeline-media-item-link': '/items/vertical-timeline/item/media' + query,
            'timeline-text-item-link': '/items/vertical-timeline/item/text' + query
        };

        const entries = Object.entries(link_map);

        for (let i = 0; i < entries.length; i++) {
            const el = document.getElementById(entries[i][0]);

            if (el === null) {
                console.log('WARN: nav menu link element not found: #' + entries[i][0]);
                continue;
            }

            el.href = APP_PATH + entries[i][1];
        }
    };

    obj.set_exhibits_details_nav_menu_links = function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const back_link = document.getElementById('back-to-exhibits');
        const styles_link = document.getElementById('exhibit-styles');

        if (back_link) {
            back_link.href = `${APP_PATH}/exhibits?exhibit_id=${encodeURIComponent(exhibit_id)}`;
        }

        if (styles_link) {
            styles_link.href = `${APP_PATH}/styles?exhibit_id=${encodeURIComponent(exhibit_id)}`;
        }
    };

    obj.back_to_grid_items = function () {
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const grid_id = helperModule.get_parameter_by_name('grid_id');
        const back_link = document.getElementById('back-to-items');

        if (back_link) {
            back_link.href = `${APP_PATH}/items/grid/items?exhibit_id=${encodeURIComponent(exhibit_id)}&grid_id=${encodeURIComponent(grid_id)}`;
        }
    };

    obj.back_to_timeline_items = function () {
        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const timeline_id = helperModule.get_parameter_by_name('timeline_id');
        const back_link = document.getElementById('back-to-items');

        if (back_link) {
            back_link.href = `${APP_PATH}/items/timeline/items?exhibit_id=${encodeURIComponent(exhibit_id)}&timeline_id=${encodeURIComponent(timeline_id)}`;
        }
    };

    // nav-dashboard-vertical-timeline-edit-form.ejs
    // items.edit.vertical.timeline.form.module.js
    obj.edit_timeline_back_to_items = function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        const timeline_id = helperModule.get_parameter_by_name('item_id');
        const timeline_items = document.getElementById('timeline-items');
        const back_to_items_link = document.getElementById('back-to-items');

        if (timeline_items) {
            timeline_items.href = `${APP_PATH}/items/timeline/items?exhibit_id=${encodeURIComponent(exhibit_id)}&timeline_id=${encodeURIComponent(timeline_id)}`;
        }

        if (back_to_items_link) {
            back_to_items_link.href = `${APP_PATH}/items?exhibit_id=${encodeURIComponent(exhibit_id)}`;
        }
    };

    //
    obj.set_item_list_link = function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');

        if (exhibit_id !== null) {
            document.querySelector('#item-list').setAttribute('href', `${APP_PATH}/items?exhibit_id=${exhibit_id}`);
        } else {
            document.querySelector('#item-list-nav').remove();
        }
    };

    obj.set_logout_link = function () {
        document.querySelector('#logout').addEventListener('click', authModule.logout);
    };

    obj.init = function () {
        this.set_preview_link();
        this.set_logout_link();

        // Re-apply centering after dynamic links (preview) are created
        apply_collapsed_centering(is_sidebar_collapsed());
    };

    // ==================== AUTO-INIT SIDEBAR TOGGLE ====================
    // The sidebar toggle must work on every page, including pages whose
    // modules do not call navModule.init().  DOMContentLoaded guarantees
    // #sidebar-toggle exists before we attach the listener.

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            obj.init_sidebar_toggle();
        });
    } else {
        obj.init_sidebar_toggle();
    }

    return obj;

}());
