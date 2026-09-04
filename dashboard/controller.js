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

 Design history and rationale: NOTES/EXHIBITS_BACKEND_CODE_NOTES.md

 */

'use strict';

const CONFIG = require('../config/app_config')();
const SSO_CONFIG = require('../config/webservices_config')();

exports.default = function (req, res) {
    res.status(403).send({
        info: 'University of Denver Libraries - Exhibit Builder'
    });
};

const template_config = {
    host: CONFIG.host,
    appname: CONFIG.app_name,
    appversion: CONFIG.app_version,
    organization: CONFIG.organization,
    app_message: CONFIG.app_message,
    build_version: CONFIG.build_version
};

const APP_PATH = CONFIG.app_path;

/*
 * Media Library nav glyph — Bootstrap Icons' `collection-play-fill`, inlined
 * as markup because the dashboard's only icon font (FontAwesome 4.7) has no
 * equivalent. Rendered by views/partials/nav-dashboard.ejs via the `icon_svg`
 * link property. `currentColor` so it inherits the nav's colour and hover
 * state exactly as a font icon would.
 */
const MEDIA_LIBRARY_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" focusable="false"><path d="M2.5 3.5a.5.5 0 0 1 0-1h11a.5.5 0 0 1 0 1zm2-2a.5.5 0 0 1 0-1h7a.5.5 0 0 1 0 1zM0 13a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 16 13V6a1.5 1.5 0 0 0-1.5-1.5h-13A1.5 1.5 0 0 0 0 6zm6.258-6.437a.5.5 0 0 1 .507.013l4 2.5a.5.5 0 0 1 0 .848l-4 2.5A.5.5 0 0 1 6 12V7a.5.5 0 0 1 .258-.437"/></svg>';

/**
 * Admin Utils sub-navigation — the tools nested under the top-level "Admin Utils"
 * item. Spread into each admin page's nav config so you can move between Users /
 * Index Management / Recycle Bin without leaving the area. All admin-gated: revealed
 * by navModule.gate_admin_links for administrators, hidden otherwise.
 */
const ADMIN_UTILS_LINKS = [
    { id: 'admin-users-link', label: 'Users', icon: 'fa fa-users', href: APP_PATH + '/users', admin_only: true },
    { id: 'admin-index-management-link', label: 'Index Management', icon: 'fa fa-database', href: APP_PATH + '/index-management', admin_only: true },
    { id: 'admin-recycle-bin-link', label: 'Recycle Bin', icon: 'fa fa-trash', href: APP_PATH + '/recycle', admin_only: true }
];

/**
 * Nav configurations for the exhibits family.
 * Static links use `href` (fully qualified).
 * Dynamic links use `nav_path` (relative; resolved client-side by navModule.wire_nav_links).
 */
const NAV_CONFIGS = {

    exhibits_list: {
        links: [
            { label: 'Add Exhibit', icon: 'fa fa-columns', modal: '#add-exhibit-modal' },
            { label: 'Media Library', icon_svg: MEDIA_LIBRARY_ICON_SVG, href: APP_PATH + '/media/library' },
            // Users / Index Management / Recycle Bin are nested under Admin Utils, which
            // opens the Users view by default; the sub-tools appear as its sub-nav on the
            // admin pages (see ADMIN_UTILS_LINKS).
            { id: 'admin-utils-link', label: 'Admin Utils', icon: 'fa fa-cogs', href: APP_PATH + '/users', admin_only: true }
        ]
    },

    exhibits_add_form: {
        back: {
            id: 'back-to-exhibits',
            label: 'Back to Exhibits',
            href: APP_PATH + '/exhibits'
        }
    },

    exhibits_details: {
        show_preview: true,
        back: {
            id: 'back-to-exhibits',
            label: 'Back to Exhibits',
            nav_path: '/exhibits?exhibit_id={exhibit_id}'
        },
        links: [
            { id: 'exhibit-styles', label: 'Exhibit Styles', icon: 'fa fa-paint-brush', nav_path: '/styles?exhibit_id={exhibit_id}' },
            { id: 'item-list', label: 'Exhibit Items', icon: 'fa fa-list pr-1', nav_path: '/items?exhibit_id={exhibit_id}', wrapper_id: 'item-list-nav' }
        ]
    },

    exhibits_edit_form: {
        show_preview: true,
        back: {
            id: 'back-to-exhibits',
            label: 'Back to Exhibits',
            nav_path: '/exhibits?exhibit_id={exhibit_id}'
        },
        links: [
            { id: 'item-list', label: 'Exhibit Items', icon: 'fa fa-list pr-1', nav_path: '/items?exhibit_id={exhibit_id}', wrapper_id: 'item-list-nav' }
        ]
    },

    exhibits_delete_form: {
        back: {
            id: 'back-to-exhibits',
            label: 'Back to Exhibit Builder',
            href: APP_PATH + '/exhibits'
        }
    },

    styles_form: {
        show_preview: true,
        back: {
            id: 'back-to-exhibits',
            label: 'Back to Exhibit Details',
            nav_path: '/exhibits/exhibit/details?exhibit_id={exhibit_id}'
        },
        links: [
            { id: 'edit-exhibit', label: 'Edit Exhibit', icon: 'fa fa-pencil pr-1', nav_path: '/exhibits/exhibit/edit?exhibit_id={exhibit_id}' },
            { id: 'item-list', label: 'Exhibit Items', icon: 'fa fa-list pr-1', nav_path: '/items?exhibit_id={exhibit_id}', wrapper_id: 'item-list-nav' }
        ]
    },

    // ── Items family ──

    items_list: {
        show_preview: true,
        back: {
            id: 'exhibits-link',
            label: 'Back to Exhibit Details',
            icon: 'fa-arrow-left',
            nav_path: '/exhibits/exhibit/details?exhibit_id={exhibit_id}'
        },
        links: [
            { id: 'heading-link', label: 'Add Heading', icon: 'fa fa-header', nav_path: '/items/heading?exhibit_id={exhibit_id}' },
            { id: 'standard-media-item-link', label: 'Add Media Item', icon: 'fa fa-picture-o', nav_path: '/items/standard/media?exhibit_id={exhibit_id}' },
            { id: 'standard-text-item-link', label: 'Add Text Item', icon: 'fa fa-align-center', nav_path: '/items/standard/text?exhibit_id={exhibit_id}' },
            { id: 'item-grid-link', label: 'Add Grid', icon: 'fa fa-th', nav_path: '/items/grid?exhibit_id={exhibit_id}' },
            { id: 'item-vertical-timeline-link', label: 'Add Vertical Timeline', icon: 'fa fa-calendar', nav_path: '/items/vertical-timeline?exhibit_id={exhibit_id}' }
        ]
    },

    standard_item_form: {
        show_preview: true,
        back: {
            id: 'back-to-items',
            label: 'Back to Exhibit Items',
            nav_path: '/items?exhibit_id={exhibit_id}'
        }
    },

    items_delete_form: {
        back: {
            id: 'back-to-items',
            label: 'Back to Exhibit Items',
            nav_path: '/items?exhibit_id={exhibit_id}'
        }
    },

    // ── Grid family ──

    grid_add_form: {
        show_preview: true,
        back: {
            id: 'back-to-items',
            label: 'Back to Exhibit Items',
            nav_path: '/items?exhibit_id={exhibit_id}'
        }
    },

    grid_edit_form: {
        show_preview: true,
        back: {
            id: 'back-to-items',
            label: 'Back to Exhibit Items',
            nav_path: '/items?exhibit_id={exhibit_id}'
        },
        links: [
            { id: 'grid-items', label: 'Grid Items', icon: 'fa fa-list', nav_path: '/items/grid/items?exhibit_id={exhibit_id}&grid_id={item_id}' }
        ]
    },

    grid_details: {
        show_preview: true,
        back: {
            id: 'back-to-items',
            label: 'Back to Exhibit Items',
            nav_path: '/items?exhibit_id={exhibit_id}'
        },
        links: [
            { id: 'grid-items', label: 'Grid Items', icon: 'fa fa-list', nav_path: '/items/grid/items?exhibit_id={exhibit_id}&grid_id={item_id}' }
        ]
    },

    grid_items_list: {
        show_preview: true,
        back: {
            id: 'back-to-items',
            label: 'Back to Exhibit Items',
            nav_path: '/items?exhibit_id={exhibit_id}'
        },
        links: [
            { id: 'grid-media-item-link', label: 'Add Media Grid Item', icon: 'fa fa-picture-o', nav_path: '/items/grid/item/media?exhibit_id={exhibit_id}&grid_id={grid_id}' },
            { id: 'grid-text-item-link', label: 'Add Text Grid Item', icon: 'fa fa-align-center', nav_path: '/items/grid/item/text?exhibit_id={exhibit_id}&grid_id={grid_id}' }
        ]
    },

    grid_item_form: {
        show_preview: true,
        back: {
            id: 'back-to-items',
            label: 'Back to Grid Items',
            nav_path: '/items/grid/items?exhibit_id={exhibit_id}&grid_id={grid_id}'
        }
    },

    grid_item_details: {
        show_preview: true,
        back: {
            id: 'back-to-items',
            label: 'Back to Grid Items',
            nav_path: '/items/grid/items?exhibit_id={exhibit_id}&grid_id={grid_id}'
        }
    },

    grid_items_delete_form: {
        back: {
            id: 'back-to-items',
            label: 'Back to Grid Items',
            nav_path: '/items/grid/items?exhibit_id={exhibit_id}&grid_id={grid_id}'
        }
    },

    // ── Timeline family ──

    timeline_add_form: {
        show_preview: true,
        back: {
            id: 'back-to-items',
            label: 'Back to Exhibit Items',
            nav_path: '/items?exhibit_id={exhibit_id}'
        }
    },

    timeline_edit_form: {
        show_preview: true,
        back: {
            id: 'back-to-items',
            label: 'Back to Exhibit Items',
            nav_path: '/items?exhibit_id={exhibit_id}'
        },
        links: [
            { id: 'timeline-items', label: 'Timeline Items', icon: 'fa fa-list', nav_path: '/items/timeline/items?exhibit_id={exhibit_id}&timeline_id={item_id}' }
        ]
    },

    timeline_details: {
        show_preview: true,
        back: {
            id: 'back-to-items',
            label: 'Back to Exhibit Items',
            nav_path: '/items?exhibit_id={exhibit_id}'
        },
        links: [
            { id: 'timeline-items', label: 'Timeline Items', icon: 'fa fa-list', nav_path: '/items/timeline/items?exhibit_id={exhibit_id}&timeline_id={item_id}' }
        ]
    },

    timeline_items_list: {
        show_preview: true,
        back: {
            id: 'back-to-items',
            label: 'Back to Exhibit Items',
            nav_path: '/items?exhibit_id={exhibit_id}'
        },
        links: [
            { id: 'timeline-media-item-link', label: 'Add Media Timeline Item', icon: 'fa fa-picture-o', nav_path: '/items/vertical-timeline/item/media?exhibit_id={exhibit_id}&timeline_id={timeline_id}' },
            { id: 'timeline-text-item-link', label: 'Add Text Timeline Item', icon: 'fa fa-align-center', nav_path: '/items/vertical-timeline/item/text?exhibit_id={exhibit_id}&timeline_id={timeline_id}' }
        ]
    },

    timeline_item_form: {
        show_preview: true,
        back: {
            id: 'back-to-items',
            label: 'Back to Timeline Items',
            nav_path: '/items/timeline/items?exhibit_id={exhibit_id}&timeline_id={timeline_id}'
        }
    },

    timeline_item_details: {
        back: {
            id: 'back-to-items',
            label: 'Back to Timeline Items',
            nav_path: '/items/timeline/items?exhibit_id={exhibit_id}&timeline_id={timeline_id}'
        }
    },

    timeline_items_delete_form: {
        back: {
            id: 'back-to-items',
            label: 'Back to Timeline Items',
            nav_path: '/items/timeline/items?exhibit_id={exhibit_id}&timeline_id={timeline_id}'
        }
    },

    // ── Users ──

    users_list: {
        back: {
            label: 'Exhibit Builder',
            href: APP_PATH + '/exhibits'
        },
        // Add User sits directly under Users (its parent tool), ahead of the other
        // admin tools. Users is the first/default entry in ADMIN_UTILS_LINKS, so insert
        // Add User right after it, then the remaining tools (Index Management, Recycle Bin).
        links: [
            ADMIN_UTILS_LINKS[0],
            { label: 'Add User', icon: 'fa fa-user', href: APP_PATH + '/users/add', wrapper_id: 'add-user' },
            ...ADMIN_UTILS_LINKS.slice(1)
        ]
    },

    users_add_form: {
        back: {
            label: 'Back to Users',
            href: APP_PATH + '/users'
        }
    },

    users_edit_form: {
        back: {
            label: 'Back to Users',
            href: APP_PATH + '/users'
        },
        links: [
            { label: 'Add User', icon: 'fa fa-user', href: APP_PATH + '/users/add' }
        ]
    },

    // ── Media Library ──

    media_library: {
        back: {
            label: 'Back to Exhibit Builder',
            href: APP_PATH + '/exhibits'
        }
    },

    // ── Minimal (session-out, logout, recycle) ──
    minimal: {},

    access_denied: {
        back: {
            id: 'back-to-items',
            label: 'Back to Exhibit Items',
            nav_path: '/items?exhibit_id={exhibit_id}'
        }
    },

    index_management: {
        back: {
            id: 'back-to-exhibits',
            label: 'Exhibit Builder',
            href: APP_PATH + '/exhibits'
        },
        links: [...ADMIN_UTILS_LINKS]
    },

    recycle: {
        back: {
            id: 'back-to-exhibits',
            label: 'Exhibit Builder',
            href: APP_PATH + '/exhibits'
        },
        links: [...ADMIN_UTILS_LINKS]
    }
};

/**
 * Every dashboard page in one table.
 *
 * Each entry carries the route path (appended to APP_PATH by dashboard/routes.js),
 * the view to render, the nav config for that view, and the name the handler is
 * exported under. Both the handlers and the route registrations are generated from
 * this table, so a new page is one row here and nothing else.
 *
 * - `public: true` marks the pages served without page auth — logout, session-out
 *   and access-denied have to render for a visitor whose session is already gone.
 * - `locals` supplies per-render extras; it is called on every request so the
 *   returned values never accumulate on the shared `template_config`.
 */
const PAGES = [

    //======================== Exhibits ========================//
    { handler: 'get_dashboard_exhibits', path: '/exhibits', view: 'dist/exhibits/dashboard-exhibits', nav: NAV_CONFIGS.exhibits_list },
    { handler: 'get_dashboard_exhibits_add_form', path: '/exhibits/exhibit', view: 'dist/exhibits/dashboard-exhibits-add-form', nav: NAV_CONFIGS.exhibits_add_form },
    { handler: 'get_dashboard_exhibits_details', path: '/exhibits/exhibit/details', view: 'dist/exhibits/dashboard-exhibits-details', nav: NAV_CONFIGS.exhibits_details },
    { handler: 'get_dashboard_exhibits_edit_form', path: '/exhibits/exhibit/edit', view: 'dist/exhibits/dashboard-exhibits-edit-form', nav: NAV_CONFIGS.exhibits_edit_form },
    { handler: 'get_dashboard_exhibits_delete_form', path: '/exhibits/exhibit/delete', view: 'dist/exhibits/dashboard-exhibits-delete-form', nav: NAV_CONFIGS.exhibits_delete_form },

    //======================== Standard items ========================//
    { handler: 'get_dashboard_items', path: '/items', view: 'dist/standard-items/dashboard-items', nav: NAV_CONFIGS.items_list },
    { handler: 'get_dashboard_items_standard_media_add_form', path: '/items/standard/media', view: 'dist/standard-items/dashboard-item-standard-media-add-form', nav: NAV_CONFIGS.standard_item_form },
    { handler: 'get_dashboard_items_standard_text_add_form', path: '/items/standard/text', view: 'dist/standard-items/dashboard-item-standard-text-add-form', nav: NAV_CONFIGS.standard_item_form },
    { handler: 'get_dashboard_items_standard_media_edit_form', path: '/items/standard/media/edit', view: 'dist/standard-items/dashboard-item-standard-media-edit-form', nav: NAV_CONFIGS.standard_item_form },
    { handler: 'get_dashboard_items_standard_text_edit_form', path: '/items/standard/text/edit', view: 'dist/standard-items/dashboard-item-standard-text-edit-form', nav: NAV_CONFIGS.standard_item_form },
    { handler: 'get_dashboard_items_standard_media_details', path: '/items/standard/media/details', view: 'dist/standard-items/dashboard-item-standard-media-details', nav: NAV_CONFIGS.standard_item_form },
    { handler: 'get_dashboard_items_standard_text_details', path: '/items/standard/text/details', view: 'dist/standard-items/dashboard-item-standard-text-details', nav: NAV_CONFIGS.standard_item_form },

    //======================== Heading items ========================//
    { handler: 'get_dashboard_item_heading_add_form', path: '/items/heading', view: 'dist/heading-items/dashboard-item-heading-add-form', nav: NAV_CONFIGS.standard_item_form },
    { handler: 'get_dashboard_item_heading_details', path: '/items/heading/details', view: 'dist/heading-items/dashboard-item-heading-details', nav: NAV_CONFIGS.standard_item_form },
    { handler: 'get_dashboard_items_heading_edit_form', path: '/items/heading/edit', view: 'dist/heading-items/dashboard-item-heading-edit-form', nav: NAV_CONFIGS.standard_item_form },

    //======================== Grids ========================//
    { handler: 'get_dashboard_grid_add_form', path: '/items/grid', view: 'dist/grid-items/dashboard-grid-add-form', nav: NAV_CONFIGS.grid_add_form },
    { handler: 'get_dashboard_grid_details', path: '/items/grid/details', view: 'dist/grid-items/dashboard-grid-details', nav: NAV_CONFIGS.grid_details },
    { handler: 'get_dashboard_grid_edit_form', path: '/items/grid/edit', view: 'dist/grid-items/dashboard-grid-edit-form', nav: NAV_CONFIGS.grid_edit_form },
    { handler: 'get_dashboard_grid_add_media_item_form', path: '/items/grid/item/media', view: 'dist/grid-items/dashboard-grid-add-media-item-form', nav: NAV_CONFIGS.grid_item_form },
    { handler: 'get_dashboard_grid_add_text_item_form', path: '/items/grid/item/text', view: 'dist/grid-items/dashboard-grid-add-text-item-form', nav: NAV_CONFIGS.grid_item_form },
    { handler: 'get_dashboard_grid_item_media_details', path: '/items/grid/item/media/details', view: 'dist/grid-items/dashboard-grid-item-media-details', nav: NAV_CONFIGS.grid_item_details },
    { handler: 'get_dashboard_grid_item_text_details', path: '/items/grid/item/text/details', view: 'dist/grid-items/dashboard-grid-item-text-details', nav: NAV_CONFIGS.grid_item_details },
    { handler: 'get_dashboard_grid_edit_media_item_form', path: '/items/grid/item/media/edit', view: 'dist/grid-items/dashboard-grid-edit-media-item-form', nav: NAV_CONFIGS.grid_item_form },
    { handler: 'get_dashboard_grid_edit_text_item_form', path: '/items/grid/item/text/edit', view: 'dist/grid-items/dashboard-grid-edit-text-item-form', nav: NAV_CONFIGS.grid_item_form },
    { handler: 'get_dashboard_item_grid_items', path: '/items/grid/items', view: 'dist/grid-items/dashboard-grid-items', nav: NAV_CONFIGS.grid_items_list },
    { handler: 'get_dashboard_grid_items_delete_form', path: '/items/grid/item/delete', view: 'dist/grid-items/dashboard-grid-items-delete-form', nav: NAV_CONFIGS.grid_items_delete_form },

    //======================== Timelines ========================//
    { handler: 'get_dashboard_vertical_timeline_add_form', path: '/items/vertical-timeline', view: 'dist/timeline-items/dashboard-vertical-timeline-add-form', nav: NAV_CONFIGS.timeline_add_form },
    { handler: 'get_dashboard_vertical_timeline_details', path: '/items/vertical-timeline/details', view: 'dist/timeline-items/dashboard-vertical-timeline-details', nav: NAV_CONFIGS.timeline_details },
    { handler: 'get_dashboard_vertical_timeline_edit_form', path: '/items/vertical-timeline/edit', view: 'dist/timeline-items/dashboard-vertical-timeline-edit-form', nav: NAV_CONFIGS.timeline_edit_form },
    { handler: 'get_dashboard_vertical_timeline_item_media_add_form', path: '/items/vertical-timeline/item/media', view: 'dist/timeline-items/dashboard-vertical-timeline-item-media-add-form', nav: NAV_CONFIGS.timeline_item_form },
    { handler: 'get_dashboard_vertical_timeline_item_media_edit_form', path: '/items/vertical-timeline/item/media/edit', view: 'dist/timeline-items/dashboard-vertical-timeline-item-media-edit-form', nav: NAV_CONFIGS.timeline_item_form },
    { handler: 'get_dashboard_vertical_timeline_item_text_add_form', path: '/items/vertical-timeline/item/text', view: 'dist/timeline-items/dashboard-vertical-timeline-item-text-add-form', nav: NAV_CONFIGS.timeline_item_form },
    { handler: 'get_dashboard_vertical_timeline_item_text_edit_form', path: '/items/vertical-timeline/item/text/edit', view: 'dist/timeline-items/dashboard-vertical-timeline-item-text-edit-form', nav: NAV_CONFIGS.timeline_item_form },
    { handler: 'get_dashboard_vertical_timeline_item_media_details', path: '/items/vertical-timeline/item/media/details', view: 'dist/timeline-items/dashboard-vertical-timeline-item-media-details', nav: NAV_CONFIGS.timeline_item_details },
    { handler: 'get_dashboard_vertical_timeline_item_text_details', path: '/items/vertical-timeline/item/text/details', view: 'dist/timeline-items/dashboard-vertical-timeline-item-text-details', nav: NAV_CONFIGS.timeline_item_details },
    { handler: 'get_dashboard_item_timeline_items', path: '/items/timeline/items', view: 'dist/timeline-items/dashboard-timeline-items', nav: NAV_CONFIGS.timeline_items_list },
    { handler: 'get_dashboard_timeline_items_delete_form', path: '/items/timeline/item/delete', view: 'dist/timeline-items/dashboard-timeline-items-delete-form', nav: NAV_CONFIGS.timeline_items_delete_form },

    { handler: 'get_dashboard_items_delete_form', path: '/items/delete', view: 'dist/standard-items/dashboard-items-delete-form', nav: NAV_CONFIGS.items_delete_form },

    //======================== Users ========================//
    { handler: 'get_dashboard_users', path: '/users', view: 'dist/users/dashboard-users', nav: NAV_CONFIGS.users_list },
    { handler: 'get_dashboard_users_add_form', path: '/users/add', view: 'dist/users/dashboard-add-user', nav: NAV_CONFIGS.users_add_form },
    { handler: 'get_dashboard_users_edit_form', path: '/users/edit', view: 'dist/users/dashboard-edit-user', nav: NAV_CONFIGS.users_edit_form },
    { handler: 'get_dashboard_users_delete_form', path: '/users/delete', view: 'dist/users/dashboard-delete-user-form', nav: NAV_CONFIGS.users_edit_form },

    //======================== Auth ========================//
    { handler: 'get_dashboard_session_out', path: '/session', view: 'dist/dashboard-session-out', nav: NAV_CONFIGS.minimal, public: true },
    {
        handler: 'get_dashboard_logout',
        path: '/logout',
        view: 'dist/dashboard-logout',
        nav: NAV_CONFIGS.minimal,
        public: true,
        // Per-render, never assigned onto the shared template_config: that object
        // is reused by every page render, so anything set on it persists.
        locals: () => ({ sso_logout_url: SSO_CONFIG.sso_logout_url })
    },
    { handler: 'get_dashboard_access_denied', path: '/access-denied', view: 'dist/dashboard-access-denied', nav: NAV_CONFIGS.access_denied, public: true },
    { handler: 'get_dashboard_recycle', path: '/recycle', view: 'dist/dashboard-recycle', nav: NAV_CONFIGS.recycle },

    //======================== Media Library ========================//
    { handler: 'get_dashboard_media', path: '/media/library', view: 'dist/media-library/dashboard-media-home.ejs', nav: NAV_CONFIGS.media_library },

    //======================== Styles ========================//
    { handler: 'get_dashboard_styles', path: '/styles', view: 'dist/exhibits/dashboard-styles-form.ejs', nav: NAV_CONFIGS.styles_form },

    //======================== Index Management ========================//
    { handler: 'get_dashboard_index_management', path: '/index-management', view: 'dist/dashboard-index-management', nav: NAV_CONFIGS.index_management }
];

/**
 * Builds the Express handler for one PAGES entry
 * @param {Object} page - PAGES entry
 * @returns {Function} Express request handler
 */
const render_page = (page) => {

    return function (req, res) {
        res.render(page.view, {
            ...template_config,
            ...(typeof page.locals === 'function' ? page.locals() : {}),
            nav: page.nav
        });
    };
};

/*
 * The per-page named exports (get_dashboard_exhibits, ...) are generated from
 * PAGES. dashboard/routes.js resolves handlers through PAGES, but any other
 * caller referencing a page by name still works.
 */
for (const page of PAGES) {
    exports[page.handler] = render_page(page);
}

exports.PAGES = PAGES;
