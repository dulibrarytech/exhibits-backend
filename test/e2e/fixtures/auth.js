'use strict';

const DEFAULT_APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

const DEFAULT_TOKEN = {
    token: 'pw-test-token',
    expires: Date.now() + 24 * 60 * 60 * 1000,
};

const DEFAULT_USER = {
    id: '660e8400-e29b-41d4-a716-446655440001',
    uid: '1',
    name: 'Playwright Tester',
    role: 'admin',
    permissions: [
        'add_item',
        'add_item_to_any_exhibit',
        'update_item',
        'update_any_item',
        'add_exhibit',
        'update_exhibit',
        'update_any_exhibit',
        'delete_exhibit',
        'publish_exhibit',
    ],
};

function buildExhibitsEndpoints(appPath) {
    const base = `${appPath}/api/v1/exhibits`;
    return {
        exhibits: {
            exhibit_records: {
                description: 'Gets all exhibit records',
                endpoint: base,
                endpoints: {
                    get: { endpoint: `${base}/:exhibit_id` },
                    post: { endpoint: base },
                    put: { endpoint: `${base}/:exhibit_id` },
                    delete: { endpoint: `${base}/:exhibit_id` },
                },
            },
            heading_records: {
                get: { endpoint: `${base}/:exhibit_id/headings/:heading_id` },
                post: { endpoint: `${base}/:exhibit_id/headings` },
                put: { endpoint: `${base}/:exhibit_id/headings/:heading_id` },
                delete: { endpoint: `${base}/:exhibit_id/headings/:heading_id` },
            },
            heading_unlock_record: {
                post: { endpoint: `${base}/:exhibit_id/headings/:heading_id/unlock` },
            },
            grid_records: {
                get: { endpoint: `${base}/:exhibit_id/grids/:grid_id` },
                post: { endpoint: `${base}/:exhibit_id/grids` },
                put: { endpoint: `${base}/:exhibit_id/grids/:grid_id` },
            },
            grid_item_records: {
                get: { endpoint: `${base}/:exhibit_id/grids/:grid_id/items` },
                post: { endpoint: `${base}/:exhibit_id/grids/:grid_id/items` },
                put: { endpoint: `${base}/:exhibit_id/grids/:grid_id/items/:item_id` },
                delete: { endpoint: `${base}/:exhibit_id/grids/:grid_id/items/:item_id` },
                grid_item_publish: {
                    post: { endpoint: `${base}/:exhibit_id/publish/:grid_id/item/:grid_item_id` },
                },
                grid_item_suppress: {
                    post: { endpoint: `${base}/:exhibit_id/suppress/:grid_id/item/:grid_item_id` },
                },
            },
            grid_item_record: {
                get: { endpoint: `${base}/:exhibit_id/grids/:grid_id/items/:item_id` },
            },
            item_records: {
                description: 'Gets all exhibit items',
                endpoint: `${base}/:exhibit_id/items`,
                get: { endpoint: `${base}/:exhibit_id/items/:item_id` },
                post: { endpoint: `${base}/:exhibit_id/items` },
                put: { endpoint: `${base}/:exhibit_id/items/:item_id` },
                delete: { endpoint: `${base}/:exhibit_id/items/:item_id` },
                item_publish: {
                    post: { endpoint: `${base}/:exhibit_id/publish/:item_id/item` },
                },
                item_suppress: {
                    post: { endpoint: `${base}/:exhibit_id/suppress/:item_id/item` },
                },
            },
            timeline_records: {
                get: { endpoint: `${base}/:exhibit_id/timelines/:timeline_id` },
                post: { endpoint: `${base}/:exhibit_id/timelines` },
                put: { endpoint: `${base}/:exhibit_id/timelines/:timeline_id` },
                delete: { endpoint: `${base}/:exhibit_id/timelines/:timeline_id` },
            },
            timeline_item_records: {
                get: { endpoint: `${base}/:exhibit_id/timelines/:timeline_id/items` },
                post: { endpoint: `${base}/:exhibit_id/timelines/:timeline_id/items` },
                put: { endpoint: `${base}/:exhibit_id/timelines/:timeline_id/items/:item_id` },
                delete: { endpoint: `${base}/:exhibit_id/timelines/:timeline_id/items/:item_id` },
                timeline_item_publish: {
                    post: { endpoint: `${base}/:exhibit_id/timelines/publish/:timeline_id/item/:timeline_item_id` },
                },
                timeline_item_suppress: {
                    post: { endpoint: `${base}/:exhibit_id/timelines/suppress/:timeline_id/item/:timeline_item_id` },
                },
            },
            timeline_item_record: {
                get: { endpoint: `${base}/:exhibit_id/timelines/:timeline_id/items/:item_id` },
            },
            reorder_records: {
                post: { endpoint: `${base}/:exhibit_id/items/reorder` },
            },
            exhibit_media_library: {
                get: { endpoint: `${base}/:exhibit_id/media-library` },
                post: { endpoint: `${base}/:exhibit_id/media-library` },
                delete: { endpoint: `${base}/:exhibit_id/media-library/:media_role` },
            },
            token_verify: { endpoint: `${base}/verify` },
        },
    };
}

function buildMediaLibraryEndpoints(appPath) {
    const base = `${appPath}/api/v1/media/library`;
    return {
        media_records: {
            get: { endpoint: base },
            post: { endpoint: base },
            put: { endpoint: `${base}/record/:media_id` },
            delete: { endpoint: `${base}/record/:media_id` },
        },
        media_record: {
            get: { endpoint: `${base}/record/:media_id` },
        },
        media_file: {
            get: { endpoint: `${base}/file/:media_id` },
        },
        media_thumbnail: {
            get: { endpoint: `${base}/thumbnail/:media_id` },
        },
        media_duplicate_check: {
            get: { endpoint: `${base}/duplicate-check` },
        },
        repo_media_search: {
            get: { endpoint: `${base}/repo/search` },
        },
        repo_thumbnail: {
            get: { endpoint: `${base}/repo/thumbnail` },
        },
        repo_subjects: {
            get: { endpoint: `${base}/repo/subjects` },
        },
        repo_resource_types: {
            get: { endpoint: `${base}/repo/resource-types` },
        },
        kaltura_media: {
            get: { endpoint: `${base}/kaltura/:entry_id` },
        },
        kaltura_config: {
            get: { endpoint: `${base}/kaltura/config/player` },
        },
        media_exhibits: {
            // Mirrors the canonical shape in media-library/endpoints.js.
            put: { endpoint: `${base}/record/:media_id/exhibits` },
        },
    };
}

// Mirrors users/endpoints.js. user.module.js reads the result of
// `endpointsModule.get_users_endpoints()` which in turn reads the
// `exhibits_endpoints_users` localStorage key directly (i.e., the
// stored value is the object below — *not* wrapped under an
// `endpoints` property like the seed for other modules sometimes is).
function buildUsersEndpoints(appPath) {
    const base = `${appPath}/api/v1/users`;
    return {
        users: {
            endpoint: base,
            get_user: { endpoint: `${base}/:user_id` },
            update_user: { put: { endpoint: `${base}/:user_id` } },
            delete_user: { delete: { endpoint: `${base}/:user_id` } },
            user_status: { endpoint: `${base}/status/:id/:is_active` },
        },
    };
}

async function seedAuth(page, opts = {}) {
    const appPath = opts.appPath ?? DEFAULT_APP_PATH;
    const token = JSON.stringify(opts.token ?? DEFAULT_TOKEN);
    const user = JSON.stringify(opts.user ?? DEFAULT_USER);
    const endpoints = JSON.stringify(
        opts.exhibitsEndpoints ?? buildExhibitsEndpoints(appPath)
    );
    const mediaEndpoints = JSON.stringify(
        opts.mediaLibraryEndpoints ?? buildMediaLibraryEndpoints(appPath)
    );
    const usersEndpoints = JSON.stringify(
        opts.usersEndpoints ?? buildUsersEndpoints(appPath)
    );

    await page.addInitScript(({ appPath, token, user, endpoints, mediaEndpoints, usersEndpoints }) => {
        try {
            window.localStorage.setItem('exhibits_app_path', appPath);
            window.localStorage.setItem('exhibits_endpoints', endpoints);
            window.localStorage.setItem('exhibits_endpoints_media_library', mediaEndpoints);
            window.localStorage.setItem('exhibits_endpoints_users', usersEndpoints);
        } catch (_) {}
        try {
            window.sessionStorage.setItem('exhibits_token', token);
            window.sessionStorage.setItem('exhibits_user', user);
        } catch (_) {}
    }, { appPath, token, user, endpoints, mediaEndpoints, usersEndpoints });
}

module.exports = {
    seedAuth,
    DEFAULT_TOKEN,
    DEFAULT_USER,
    buildExhibitsEndpoints,
    buildMediaLibraryEndpoints,
    buildUsersEndpoints,
};
