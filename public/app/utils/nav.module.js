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
     * Sidebar element references, cached on first successful lookup. The
     * sidebar structure is static after DOMContentLoaded, so re-querying
     * it on every resize tick and every sidebar toggle is wasted work.
     * get_nav_elements() populates this once and reuses it thereafter.
     */
    let nav_elements_cache = null;

    function get_nav_elements() {

        if (nav_elements_cache !== null) {
            return nav_elements_cache;
        }

        const panel = document.getElementById('left-panel');

        if (!panel) {
            return null;
        }

        nav_elements_cache = {
            panel: panel,
            navbar: panel.querySelector('.navbar'),
            main_menu: panel.querySelector('#main-menu'),
            nav_ul: panel.querySelector('#main-menu .navbar-nav'),
            items: panel.querySelectorAll('#main-menu .navbar-nav > li'),
            links: panel.querySelectorAll('#main-menu .navbar-nav > li > a'),
            icons: panel.querySelectorAll('#main-menu .navbar-nav > li > a > .menu-icon'),
            labels: panel.querySelectorAll('#main-menu .nav-label')
        };

        return nav_elements_cache;
    }

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

        const els = get_nav_elements();

        if (!els) {
            return false;
        }

        // 83px is the theme's collapsed width in both .open and @media modes
        return els.panel.offsetWidth <= 83;
    }

    /**
     * Applies inline style attributes on sidebar nav elements so the
     * collapsed (83px) layout centers icons and the expanded layout
     * closes the icon/label gap and prevents label wrapping. Inline
     * style attributes sit at the absolute top of the CSS cascade and
     * cannot be overridden by any stylesheet rule.
     *
     * Why full-width containers (navbar, main_menu, nav_ul, items)?
     * The theme sets .navbar { display: inline-block } which shrink-
     * wraps the nav to the icon width (~20px). Without full-width
     * containers, centering inside the <a> has no effect — the whole
     * chain collapses flush-left in the 83px sidebar.
     *
     * Why flex-direction:column on the nav <ul>?
     * Bootstrap's .navbar-expand-sm sets flex-direction:row on
     * .navbar-nav at ≥576px, which makes each <li> only as wide as its
     * icon (~20px) and left-aligned within the row. Column + width:100%
     * forces each <li> to span the full sidebar so centering works.
     *
     * Source of truth for the style strings themselves:
     * window.__EXHIBITS_NAV_STYLES__, defined by the post-aside inline
     * script in views/partials/nav-dashboard.ejs. Both the pre-paint
     * applier there and this function read from that table so edits in
     * either place stay in sync.
     *
     * @param {boolean} collapsed - true when sidebar is in 83px state
     */
    function apply_collapsed_centering(collapsed) {

        const els = get_nav_elements();

        if (!els) {
            return;
        }

        const table = window.__EXHIBITS_NAV_STYLES__;

        if (!table) {
            // Partial did not emit the style table (e.g., a page that
            // renders nav.module.js without nav-dashboard.ejs). Nothing
            // we can safely apply without it; bail rather than inventing
            // a second source of truth.
            return;
        }

        const styles = table[collapsed ? 'collapsed' : 'expanded'];

        if (!styles) {
            return;
        }

        if (els.navbar)    els.navbar.style.cssText    = styles.navbar;
        if (els.main_menu) els.main_menu.style.cssText = styles.main_menu;
        if (els.nav_ul)    els.nav_ul.style.cssText    = styles.nav_ul;

        for (let i = 0; i < els.items.length;  i++) els.items[i].style.cssText  = styles.item;
        for (let j = 0; j < els.links.length;  j++) els.links[j].style.cssText  = styles.link;
        for (let k = 0; k < els.icons.length;  k++) els.icons[k].style.cssText  = styles.icon;
        for (let m = 0; m < els.labels.length; m++) els.labels[m].style.cssText = styles.label;
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
     * Populates the preview-link placeholder emitted by the unified nav
     * partial when `show_preview: true`. The partial emits an empty
     * <li id="preview-link"> and relies on this function to build the
     * anchor and wire the click handler, since the preview URL depends
     * on the current exhibit_id query param. Idempotent — repeated calls
     * are no-ops so it is safe to run on DOMContentLoaded AND from
     * wire_nav_links() without double-binding.
     */
    function wire_preview_link() {

        const li = document.getElementById('preview-link');

        if (!li || li.dataset.initialized === '1') {
            return;
        }

        const uuid = helperModule.get_parameter_by_name('exhibit_id');
        const preview_link = APP_PATH + '/preview?uuid=' + uuid;

        const anchor = document.createElement('a');
        anchor.title = 'Previews Exhibit';
        anchor.href = preview_link;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';

        const icon = document.createElement('i');
        icon.className = 'menu-icon fa fa-eye';
        anchor.appendChild(icon);

        const label = document.createElement('span');
        label.className = 'nav-label';
        label.textContent = 'Preview';
        anchor.appendChild(label);

        anchor.addEventListener('click', function (e) {
            // Defer the exhibitsModule lookup to click time so pages
            // that never trigger preview don't need the dep loaded.
            if (typeof exhibitsModule !== 'undefined' && typeof exhibitsModule.open_preview === 'function') {
                e.preventDefault();
                exhibitsModule.open_preview(preview_link);
            }
        });

        li.textContent = '';
        li.appendChild(anchor);
        li.dataset.initialized = '1';
    }

    /**
     * Attaches the logout click handler to the #logout link emitted by
     * the unified nav partial. Idempotent via dataset flag — every page
     * with a nav gets this wired automatically on DOMContentLoaded.
     */
    function wire_logout_link() {

        const el = document.getElementById('logout');

        if (!el || el.dataset.initialized === '1') {
            return;
        }

        el.addEventListener('click', authModule.logout);
        el.dataset.initialized = '1';
    }

    /**
     * Generic nav link wiring — resolves data-nav-path tokens and sets href.
     *
     * Reads query-string params from the current URL and replaces {exhibit_id},
     * {item_id}, {grid_id}, and {timeline_id} tokens found in data-nav-path
     * attributes within #main-menu.  Prepends APP_PATH to the resolved path.
     *
     * If a required token value is missing (null / empty), the link's parent
     * <li> is removed from the DOM — the nav entry vanishes rather than
     * linking to a broken path with an undefined id.
     *
     * Also wires the preview and logout links so a single call from per-page
     * scripts covers everything needed by the unified nav partial.
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

        wire_preview_link();
        wire_logout_link();
    };

    /**
     * Back-compat shim. Preview and logout wiring moved to private
     * wire_preview_link() / wire_logout_link() helpers auto-invoked
     * on DOMContentLoaded and from wire_nav_links(). Existing pages
     * that still call navModule.init() continue to work; new pages
     * should call wire_nav_links() directly.
     */
    obj.init = function () {
        wire_preview_link();
        wire_logout_link();
        // Re-apply centering after dynamic links (preview) are created
        apply_collapsed_centering(is_sidebar_collapsed());
    };

    // ==================== AUTO-INIT ====================
    // The sidebar toggle, preview link, and logout handler must work on
    // every page, including pages whose modules do not explicitly call
    // navModule.init() or navModule.wire_nav_links(). DOMContentLoaded
    // guarantees the nav elements exist before we touch them.

    function auto_init() {
        obj.init_sidebar_toggle();
        wire_preview_link();
        wire_logout_link();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', auto_init);
    } else {
        auto_init();
    }

    return obj;

}());
