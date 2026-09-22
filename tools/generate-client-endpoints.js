#!/usr/bin/env node

'use strict';

/**
 * Generates public/app/utils/endpoints.templates.js — the client-side endpoint
 * map — from the server's own endpoint modules, so the two can never drift.
 *
 * This is the ONLY channel that ships the registry to the client — nothing
 * else may send a second copy, or the map can lag the bundle that reads it.
 * APP_PATH comes from .env — the same build constant endpoints.module.js
 * carries — so the generated URLs are final. Documentation keys
 * (description, params, body) are stripped; the client reads `endpoint` only.
 *
 * Runs automatically as part of `npm run build:js`. A parity test
 * (test/integration/client_endpoints_parity.test.js) fails CI if the committed
 * artifact goes stale.
 */

require('dotenv').config();

const FS = require('fs');
const PATH = require('path');
const { strip_registry_docs } = require('../libs/endpoints_config');

const load = (module_path) => {
    const loaded = require(module_path);
    return typeof loaded === 'function' ? loaded() : loaded;
};

const templates = {
    exhibits: load('../exhibits/endpoints/index'),
    users: load('../users/endpoints'),
    indexer: load('../indexer/endpoints'),
    media_library: load('../media-library/endpoints'),
    auth: load('../auth/endpoints')
};

/* The client reads `endpoint` only; the doc strings stay in the server modules. */
const json = JSON.stringify(strip_registry_docs(templates));

const banner = [
    "'use strict';",
    '',
    '/**',
    ' * GENERATED FILE — do not edit by hand.',
    ' * Built from the server endpoint modules by tools/generate-client-endpoints.js',
    ' * (runs inside `npm run build:js`) with APP_PATH from .env in place.',
    ' */',
    '',
    ''
].join('\n');

const out = `${banner}const ENDPOINT_TEMPLATES = Object.freeze(JSON.parse(${JSON.stringify(json)}));\n`;

const target = PATH.join(__dirname, '..', 'public', 'app', 'utils', 'endpoints.templates.js');
FS.writeFileSync(target, out);
console.log(`endpoints.templates.js generated (${json.length} bytes of map)`);
