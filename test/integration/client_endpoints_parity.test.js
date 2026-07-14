'use strict';

/**
 * Client/server endpoint-map parity.
 *
 * The client's endpoint map (public/app/utils/endpoints.templates.js) is
 * GENERATED from the server endpoint modules by
 * tools/generate-client-endpoints.js (part of `npm run build:js`). This test
 * fails if the committed artifact drifts from the server modules — i.e., if
 * someone edits a server endpoint module and does not rebuild.
 */

const FS = require('fs');
const PATH = require('path');

const APP_PATH = '/exhibits-dashboard';
process.env.APP_PATH = APP_PATH;

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
});
