'use strict';

/**
 * Client/server endpoint-map parity, plus the registry shape invariant.
 *
 * The client's endpoint map (public/app/utils/endpoints.templates.js) is
 * GENERATED from the server endpoint modules by
 * tools/generate-client-endpoints.js (part of `npm run build:js`). Since the
 * copy that used to ride along in the /api/v1/authenticate response was
 * removed, this artifact is the ONLY channel that ships the registry to the
 * browser — so a stale artifact is now a broken client, not just a drift.
 * The first block fails if someone edits a server endpoint module without
 * rebuilding.
 *
 * The second block pins the shape every registry is written in:
 *
 *     <resource>.<http_method>.{ endpoint, description, params?, body? }
 *
 * Anything else is a DEPRECATED alias kept alive for a client module that has
 * not migrated yet, and must be listed in LEGACY_ALIASES below. That list is
 * the removal checklist: when a client stops reading a path, delete the alias
 * from the registry and its row from here.
 */

const FS = require('fs');
const PATH = require('path');

const APP_PATH = '/exhibits-dashboard';
process.env.APP_PATH = APP_PATH;

const HTTP_METHODS = ['get', 'post', 'put', 'delete'];

const load = (module_path) => {
    const loaded = require(module_path);
    return typeof loaded === 'function' ? loaded() : loaded;
};

const read_client_templates = () => {
    const source = FS.readFileSync(
        PATH.join(__dirname, '..', '..', 'public', 'app', 'utils', 'endpoints.templates.js'),
        'utf8'
    );
    const match = source.match(/JSON\.parse\((".*")\)/s);
    if (!match) {
        throw new Error('Could not locate the JSON payload in endpoints.templates.js');
    }
    const json = JSON.parse(match[1]);
    return JSON.parse(json.split('__APP_PATH__').join(APP_PATH));
};

/*
 * Every path that still resolves a URL outside the canonical
 * <resource>.<method>.endpoint shape, with the client module that reads it.
 * Nothing may be added here without a reader; entries leave as the client
 * migrates.
 */
const LEGACY_ALIASES = [
    ['exhibits.exhibits.exhibit_records.endpoint', 'public/app/exhibits/exhibits.module.js'],
    ['exhibits.exhibits.exhibit_records.endpoints.get.endpoint', 'public/app/exhibits/exhibits.common.form.module.js'],
    ['exhibits.exhibits.exhibit_records.endpoints.post.endpoint', '(no reader; mirror of the alias block)'],
    ['exhibits.exhibits.exhibit_records.endpoints.put.endpoint', 'public/app/exhibits/exhibits.edit.form.module.js'],
    ['exhibits.exhibits.exhibit_records.endpoints.delete.endpoint', 'public/app/exhibits/exhibits.module.js'],
    ['exhibits.exhibits.item_records.endpoint', 'public/app/items.module.js'],
    ['exhibits.exhibits.item_records.item_publish.post.endpoint', 'public/app/items.module.js'],
    ['exhibits.exhibits.item_records.item_suppress.post.endpoint', 'public/app/items.module.js'],
    ['exhibits.exhibits.grid_item_records.grid_item_publish.post.endpoint', 'public/app/grid-items/items.grid.module.js'],
    ['exhibits.exhibits.grid_item_records.grid_item_suppress.post.endpoint', 'public/app/grid-items/items.grid.module.js'],
    ['exhibits.exhibits.timeline_item_records.timeline_item_publish.post.endpoint', 'public/app/timeline-items/items.timeline.module.js'],
    ['exhibits.exhibits.timeline_item_records.timeline_item_suppress.post.endpoint', 'public/app/timeline-items/items.timeline.module.js'],
    ['exhibits.exhibits.token_verify.endpoint', 'public/app/utils/auth.module.js'],
    ['exhibits.exhibits.recycled_records.empty.endpoint', '(no reader; recycle.module.js hardcodes its paths)'],
    ['users.users.endpoint', 'public/app/user.module.js'],
    ['users.users.get_user.endpoint', 'public/app/user.module.js'],
    ['users.users.update_user.put.endpoint', 'public/app/user.module.js'],
    ['users.users.delete_user.delete.endpoint', 'public/app/user.module.js'],
    ['users.users.user_status.endpoint', 'public/app/user.module.js']
];

/**
 * Collects every dot path that ends in an `endpoint` string.
 * @param {Object} node
 * @param {Array<string>} trail
 * @param {Array<string>} found
 * @returns {Array<string>}
 */
const collect_endpoint_paths = (node, trail = [], found = []) => {

    if (!node || typeof node !== 'object') {
        return found;
    }

    for (const key of Object.keys(node)) {

        const value = node[key];

        if (key === 'endpoint' && typeof value === 'string') {
            found.push(trail.concat('endpoint').join('.'));
            continue;
        }

        collect_endpoint_paths(value, trail.concat(key), found);
    }

    return found;
};

describe('client endpoint templates parity with server endpoint modules', () => {

    const client = read_client_templates();

    test('exhibits section matches exhibits/endpoints/index.js', () => {
        expect(client.exhibits).toEqual(load('../../exhibits/endpoints/index'));
    });

    test('users section matches users/endpoints.js', () => {
        expect(client.users).toEqual(load('../../users/endpoints'));
    });

    test('indexer section matches indexer/endpoints.js', () => {
        expect(client.indexer).toEqual(load('../../indexer/endpoints'));
    });

    test('media_library section matches media-library/endpoints.js', () => {
        expect(client.media_library).toEqual(load('../../media-library/endpoints'));
    });

    /* auth was hardcoded in the client (endpoints.module.js) until the
     * generator started emitting it. */
    test('auth section matches auth/endpoints.js', () => {
        expect(client.auth).toEqual(load('../../auth/endpoints'));
    });

    test('every section the client reads is present', () => {
        expect(Object.keys(client).sort()).toEqual(
            ['auth', 'exhibits', 'indexer', 'media_library', 'users']
        );
    });
});

describe('endpoint registry shape', () => {

    const registries = {
        exhibits: load('../../exhibits/endpoints/index'),
        users: load('../../users/endpoints'),
        indexer: load('../../indexer/endpoints'),
        media_library: load('../../media-library/endpoints'),
        auth: load('../../auth/endpoints')
    };

    const paths = collect_endpoint_paths(registries);
    const legacy = LEGACY_ALIASES.map((row) => row[0]);

    test('every endpoint sits at <resource>.<http_method>.endpoint, or is a listed alias', () => {

        const offenders = paths.filter((path) => {

            if (legacy.includes(path)) {
                return false;
            }

            const parts = path.split('.');
            return !HTTP_METHODS.includes(parts[parts.length - 2]);
        });

        expect(offenders).toEqual([]);
    });

    test('every listed alias still exists (delete the row when the alias goes)', () => {
        const missing = legacy.filter((path) => !paths.includes(path));
        expect(missing).toEqual([]);
    });

    test('no resource mixes an alias-only shape into a fresh registry', () => {
        /* media_library and auth were canonical from the start and must stay
         * free of aliases. */
        const tainted = legacy.filter((path) => path.startsWith('media_library.') || path.startsWith('auth.'));
        expect(tainted).toEqual([]);
    });

    /*
     * DELIBERATE, pinned so it cannot be "tidied up": the per-record indexer
     * routes are mounted WITHOUT APP_PATH, unlike every other registry entry.
     * Only /exhibits-dashboard is proxied publicly, so these answer on the app
     * port only. Their consumers are the live e2e specs
     * (test/e2e/live/exhibit-delete-index.live.spec.js and
     * container-item-delete-index.live.spec.js), which call
     * `/api/v1/indexer/${uuid}` directly. index_utils IS browser-facing and
     * therefore DOES carry APP_PATH.
     */
    test('indexer index_records omits APP_PATH; index_utils keeps it', () => {

        const records = registries.indexer.indexer.index_records;

        for (const method of ['get', 'post', 'delete']) {
            expect(records[method].endpoint).toBe('/api/v1/indexer/:uuid');
        }

        expect(registries.indexer.indexer.index_utils.get.endpoint)
            .toBe(`${APP_PATH}/api/v1/indexer/manage`);
        expect(registries.indexer.indexer.index_utils.post.endpoint)
            .toBe(`${APP_PATH}/api/v1/indexer/manage`);
    });

    /*
     * Aliases must be references to the canonical node, never second copies —
     * otherwise a URL would have two definitions to keep in sync, which is the
     * drift this refactor removed.
     */
    test('aliases resolve to the same string as their canonical path', () => {

        const exhibits = registries.exhibits.exhibits;
        const users = registries.users.users;

        expect(exhibits.exhibit_records.endpoint).toBe(exhibits.exhibit_records_list.get.endpoint);
        expect(exhibits.exhibit_records.endpoints.get).toBe(exhibits.exhibit_records.get);
        expect(exhibits.exhibit_records.endpoints.put).toBe(exhibits.exhibit_records.put);
        expect(exhibits.exhibit_records.endpoints.delete).toBe(exhibits.exhibit_records.delete);
        expect(exhibits.item_records.endpoint).toBe(exhibits.item_records_list.get.endpoint);
        expect(exhibits.item_records.item_publish).toBe(exhibits.item_publish);
        expect(exhibits.item_records.item_suppress).toBe(exhibits.item_suppress);
        expect(exhibits.grid_item_records.grid_item_publish).toBe(exhibits.grid_item_publish);
        expect(exhibits.grid_item_records.grid_item_suppress).toBe(exhibits.grid_item_suppress);
        expect(exhibits.timeline_item_records.timeline_item_publish).toBe(exhibits.timeline_item_publish);
        expect(exhibits.timeline_item_records.timeline_item_suppress).toBe(exhibits.timeline_item_suppress);
        expect(exhibits.token_verify.endpoint).toBe(exhibits.token_verify.get.endpoint);
        expect(exhibits.recycled_records.empty).toBe(exhibits.recycled_records_all.delete);
        expect(users.endpoint).toBe(users.user_records.get.endpoint);
        expect(users.get_user.endpoint).toBe(users.user_record.get.endpoint);
        expect(users.update_user.put).toBe(users.user_records.put);
        expect(users.delete_user.delete).toBe(users.user_records.delete);
        expect(users.user_status.endpoint).toBe(users.user_status.put.endpoint);
    });
});
