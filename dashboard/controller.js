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

/**
 * Nav configurations for the exhibits family.
 * Static links use `href` (fully qualified).
 * Dynamic links use `nav_path` (relative; resolved client-side by navModule.wire_nav_links).
 */
const NAV_CONFIGS = {

    exhibits_list: {
        links: [
            { label: 'Add Exhibit', icon: 'ti-layout', modal: '#add-exhibit-modal' },
            { label: 'Media Library', icon: 'bi bi-collection-play-fill', href: APP_PATH + '/media/library' },
            { label: 'Users', icon: 'bi bi-people-fill', href: APP_PATH + '/users' }
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
        back: {
            id: 'back-to-exhibits',
            label: 'Back to Exhibits',
            nav_path: '/exhibits?exhibit_id={exhibit_id}'
        },
        links: [
            { id: 'exhibit-styles', label: 'Exhibit Styles', icon: 'bi bi-border-style', nav_path: '/styles?exhibit_id={exhibit_id}' },
            { id: 'item-list', label: 'Exhibit Items', icon: 'fa fa-list pr-1', nav_path: '/items?exhibit_id={exhibit_id}', wrapper_id: 'item-list-nav' }
        ]
    },

    exhibits_edit_form: {
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
            { id: 'heading-link', label: 'Add Heading', icon: 'ti-layout-menu', nav_path: '/items/heading?exhibit_id={exhibit_id}' },
            { id: 'standard-media-item-link', label: 'Add Media Item', icon: 'ti-image', nav_path: '/items/standard/media?exhibit_id={exhibit_id}' },
            { id: 'standard-text-item-link', label: 'Add Text Item', icon: 'ti-align-center', nav_path: '/items/standard/text?exhibit_id={exhibit_id}' },
            { id: 'item-grid-link', label: 'Add Grid', icon: 'fa fa-th', nav_path: '/items/grid?exhibit_id={exhibit_id}' },
            { id: 'item-vertical-timeline-link', label: 'Add Vertical Timeline', icon: 'ti-calendar', nav_path: '/items/vertical-timeline?exhibit_id={exhibit_id}' }
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

    standard_item_details: {
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
            { id: 'grid-media-item-link', label: 'Add Media Grid Item', icon: 'ti-image', nav_path: '/items/grid/item/media?exhibit_id={exhibit_id}&grid_id={grid_id}' },
            { id: 'grid-text-item-link', label: 'Add Text Grid Item', icon: 'ti-align-center', nav_path: '/items/grid/item/text?exhibit_id={exhibit_id}&grid_id={grid_id}' }
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
            { id: 'timeline-media-item-link', label: 'Add Media Timeline Item', icon: 'ti-image', nav_path: '/items/vertical-timeline/item/media?exhibit_id={exhibit_id}&timeline_id={timeline_id}' },
            { id: 'timeline-text-item-link', label: 'Add Text Timeline Item', icon: 'ti-align-center', nav_path: '/items/vertical-timeline/item/text?exhibit_id={exhibit_id}&timeline_id={timeline_id}' }
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
        links: [
            { label: 'Add User', icon: 'fa fa-user', href: APP_PATH + '/users/add', wrapper_id: 'add-user' }
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
    }
};

//======================== Exhibits ========================//
exports.get_dashboard_exhibits = function (req, res) {
    res.render('dist/exhibits/dashboard-exhibits', {
        ...template_config,
        nav: NAV_CONFIGS.exhibits_list
    });
};

exports.get_dashboard_exhibits_add_form = function (req, res) {
    res.render('dist/exhibits/dashboard-exhibits-add-form', {
        ...template_config,
        nav: NAV_CONFIGS.exhibits_add_form
    });
};

exports.get_dashboard_exhibits_details = function (req, res) {
    res.render('dist/exhibits/dashboard-exhibits-details', {
        ...template_config,
        nav: NAV_CONFIGS.exhibits_details
    });
};

exports.get_dashboard_exhibits_edit_form = function (req, res) {
    res.render('dist/exhibits/dashboard-exhibits-edit-form', {
        ...template_config,
        nav: NAV_CONFIGS.exhibits_edit_form
    });
};

exports.get_dashboard_exhibits_delete_form = function (req, res) {
    res.render('dist/exhibits/dashboard-exhibits-delete-form', {
        ...template_config,
        nav: NAV_CONFIGS.exhibits_delete_form
    });
};

//======================== Heading items ========================//
exports.get_dashboard_item_heading_add_form = function (req, res) {
    res.render('dist/heading-items/dashboard-item-heading-add-form', {
        ...template_config,
        nav: NAV_CONFIGS.standard_item_form
    });
};

exports.get_dashboard_item_heading_details = function (req, res) {
    res.render('dist/heading-items/dashboard-item-heading-details', {
        ...template_config,
        nav: NAV_CONFIGS.standard_item_form
    });
};

exports.get_dashboard_items_heading_edit_form = function (req, res) {
    res.render('dist/heading-items/dashboard-item-heading-edit-form', {
        ...template_config,
        nav: NAV_CONFIGS.standard_item_form
    });
};

//======================== Standard items ========================//
exports.get_dashboard_items = function (req, res) {
    res.render('dist/standard-items/dashboard-items', {
        ...template_config,
        nav: NAV_CONFIGS.items_list
    });
};

exports.get_dashboard_items_standard_details = function (req, res) {
    res.render('dist/standard-items/dashboard-item-standard-details', {
        ...template_config,
        nav: NAV_CONFIGS.standard_item_details
    });
};

exports.get_dashboard_items_standard_media_details = function (req, res) {
    res.render('dist/standard-items/dashboard-item-standard-media-details', {
        ...template_config,
        nav: NAV_CONFIGS.standard_item_form
    });
};

exports.get_dashboard_items_standard_text_details = function (req, res) {
    res.render('dist/standard-items/dashboard-item-standard-text-details', {
        ...template_config,
        nav: NAV_CONFIGS.standard_item_form
    });
};

exports.get_dashboard_items_delete_form = function (req, res) {
    res.render('dist/standard-items/dashboard-items-delete-form', {
        ...template_config,
        nav: NAV_CONFIGS.items_delete_form
    });
};

exports.get_dashboard_items_standard_media_add_form = function (req, res) {
    res.render('dist/standard-items/dashboard-item-standard-media-add-form', {
        ...template_config,
        nav: NAV_CONFIGS.standard_item_form
    });
};

exports.get_dashboard_items_standard_media_edit_form = function (req, res) {
    res.render('dist/standard-items/dashboard-item-standard-media-edit-form', {
        ...template_config,
        nav: NAV_CONFIGS.standard_item_form
    });
};

exports.get_dashboard_items_standard_text_add_form = function (req, res) {
    res.render('dist/standard-items/dashboard-item-standard-text-add-form', {
        ...template_config,
        nav: NAV_CONFIGS.standard_item_form
    });
};

exports.get_dashboard_items_standard_text_edit_form = function (req, res) {
    res.render('dist/standard-items/dashboard-item-standard-text-edit-form', {
        ...template_config,
        nav: NAV_CONFIGS.standard_item_form
    });
};

//======================== Grids ========================//
exports.get_dashboard_grid_add_form = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-add-form', {
        ...template_config,
        nav: NAV_CONFIGS.grid_add_form
    });
};

exports.get_dashboard_grid_details = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-details', {
        ...template_config,
        nav: NAV_CONFIGS.grid_details
    });
};

exports.get_dashboard_grid_edit_form = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-edit-form', {
        ...template_config,
        nav: NAV_CONFIGS.grid_edit_form
    });
};

exports.get_dashboard_grid_add_media_item_form = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-add-media-item-form', {
        ...template_config,
        nav: NAV_CONFIGS.grid_item_form
    });
};

exports.get_dashboard_grid_add_text_item_form = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-add-text-item-form', {
        ...template_config,
        nav: NAV_CONFIGS.grid_item_form
    });
};

exports.get_dashboard_grid_edit_media_item_form = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-edit-media-item-form', {
        ...template_config,
        nav: NAV_CONFIGS.grid_item_form
    });
};

exports.get_dashboard_grid_edit_text_item_form = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-edit-text-item-form', {
        ...template_config,
        nav: NAV_CONFIGS.grid_item_form
    });
};

exports.get_dashboard_grid_item_details = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-item-details', {
        ...template_config,
        nav: NAV_CONFIGS.grid_item_details
    });
};

exports.get_dashboard_grid_item_media_details = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-item-media-details', {
        ...template_config,
        nav: NAV_CONFIGS.grid_item_details
    });
};

exports.get_dashboard_grid_item_text_details = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-item-text-details', {
        ...template_config,
        nav: NAV_CONFIGS.grid_item_details
    });
};

exports.get_dashboard_item_grid_items = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-items', {
        ...template_config,
        nav: NAV_CONFIGS.grid_items_list
    });
};

exports.get_dashboard_grid_items_delete_form = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-items-delete-form', {
        ...template_config,
        nav: NAV_CONFIGS.grid_items_delete_form
    });
};

//======================== Timelines ========================//
exports.get_dashboard_vertical_timeline_add_form = function (req, res) {
    res.render('dist/timeline-items/dashboard-vertical-timeline-add-form', {
        ...template_config,
        nav: NAV_CONFIGS.timeline_add_form
    });
};

exports.get_dashboard_vertical_timeline_details = function (req, res) {
    res.render('dist/timeline-items/dashboard-vertical-timeline-details', {
        ...template_config,
        nav: NAV_CONFIGS.timeline_details
    });
};

exports.get_dashboard_vertical_timeline_edit_form = function (req, res) {
    res.render('dist/timeline-items/dashboard-vertical-timeline-edit-form', {
        ...template_config,
        nav: NAV_CONFIGS.timeline_edit_form
    });
};

exports.get_dashboard_vertical_timeline_item_media_add_form = function (req, res) {
    res.render('dist/timeline-items/dashboard-vertical-timeline-item-media-add-form', {
        ...template_config,
        nav: NAV_CONFIGS.timeline_item_form
    });
};

exports.get_dashboard_vertical_timeline_item_media_edit_form = function (req, res) {
    res.render('dist/timeline-items/dashboard-vertical-timeline-item-media-edit-form', {
        ...template_config,
        nav: NAV_CONFIGS.timeline_item_form
    });
};

exports.get_dashboard_vertical_timeline_item_text_add_form = function (req, res) {
    res.render('dist/timeline-items/dashboard-vertical-timeline-item-text-add-form', {
        ...template_config,
        nav: NAV_CONFIGS.timeline_item_form
    });
};

exports.get_dashboard_vertical_timeline_item_text_edit_form = function (req, res) {
    res.render('dist/timeline-items/dashboard-vertical-timeline-item-text-edit-form', {
        ...template_config,
        nav: NAV_CONFIGS.timeline_item_form
    });
};

exports.get_dashboard_vertical_timeline_item_media_details = function (req, res) {
    res.render('dist/timeline-items/dashboard-vertical-timeline-item-media-details', {
        ...template_config,
        nav: NAV_CONFIGS.timeline_item_details
    });
};

exports.get_dashboard_vertical_timeline_item_text_details = function (req, res) {
    res.render('dist/timeline-items/dashboard-vertical-timeline-item-text-details', {
        ...template_config,
        nav: NAV_CONFIGS.timeline_item_details
    });
};

exports.get_dashboard_item_timeline_items = function (req, res) {
    res.render('dist/timeline-items/dashboard-timeline-items', {
        ...template_config,
        nav: NAV_CONFIGS.timeline_items_list
    });
};

exports.get_dashboard_timeline_items_delete_form = function (req, res) {
    res.render('dist/timeline-items/dashboard-timeline-items-delete-form', {
        ...template_config,
        nav: NAV_CONFIGS.timeline_items_delete_form
    });
};

//======================== Auth ========================//
exports.get_dashboard_session_out = function (req, res) {
    res.render('dist/dashboard-session-out', {
        ...template_config,
        nav: NAV_CONFIGS.minimal
    });
};

exports.get_dashboard_logout = function (req, res) {
    template_config.sso_logout_url = SSO_CONFIG.sso_logout_url;
    res.render('dist/dashboard-logout', {
        ...template_config,
        nav: NAV_CONFIGS.minimal
    });
};

//======================== Users ========================//
exports.get_dashboard_users = function (req, res) {
    res.render('dist/users/dashboard-users', {
        ...template_config,
        nav: NAV_CONFIGS.users_list
    });
};

exports.get_dashboard_users_add_form = function (req, res) {
    res.render('dist/users/dashboard-add-user', {
        ...template_config,
        nav: NAV_CONFIGS.users_add_form
    });
};

exports.get_dashboard_users_edit_form = function (req, res) {
    res.render('dist/users/dashboard-edit-user', {
        ...template_config,
        nav: NAV_CONFIGS.users_edit_form
    });
};

exports.get_dashboard_users_delete_form = function (req, res) {
    res.render('dist/users/dashboard-delete-user-form', {
        ...template_config,
        nav: NAV_CONFIGS.users_edit_form
    });
};

exports.get_dashboard_access_denied = function (req, res) {
    res.render('dist/dashboard-access-denied', {
        ...template_config,
        nav: NAV_CONFIGS.access_denied
    });
};

exports.get_dashboard_recycle = function (req, res) {
    res.render('dist/dashboard-recycle', {
        ...template_config,
        nav: NAV_CONFIGS.minimal
    });
};

//======================== Media Library ========================//
exports.get_dashboard_media = function (req, res) {
    res.render('dist/media-library/dashboard-media-home.ejs', {
        ...template_config,
        nav: NAV_CONFIGS.media_library
    });
};

//======================== Styles ========================//
exports.get_dashboard_styles = function (req, res) {
    res.render('dist/exhibits/dashboard-styles-form.ejs', {
        ...template_config,
        nav: NAV_CONFIGS.styles_form
    });
};
