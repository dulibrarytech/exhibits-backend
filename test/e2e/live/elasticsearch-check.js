'use strict';

/*
 * Fail-fast Elasticsearch check for the live e2e suite.
 *
 * Live specs need the Elasticsearch at ELASTICSEARCH_HOST: publishing an
 * exhibit indexes it there, and the media forms load their subject and Item
 * Type lists from it. When it is down those specs fail late and misleadingly
 * (a bare 500 "Unable to publish exhibit", or a 30 s timeout on the media
 * forms), so this stops the run up front with one clear message instead.
 *
 * Runs two ways:
 *   - as the first live globalSetup (playwright.config.js), ahead of the
 *     database setup and every spec;
 *   - directly, `node test/e2e/live/elasticsearch-check.js`, as the first
 *     step of `npm run test:predeploy`, so the gate stops before its earlier
 *     stages rather than after them.
 */

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.join(__dirname, '..', '..', '..');
const CHECK_TIMEOUT_MS = 5000;

/*
 * The address the app server will use: ELASTICSEARCH_HOST from the
 * environment, else from the backend .env. The .env is parsed, never loaded
 * into process.env (see the note at the top of global-setup.js).
 */
function resolve_elasticsearch_host() {
    if (process.env.ELASTICSEARCH_HOST) {
        return process.env.ELASTICSEARCH_HOST;
    }
    const env_file = path.join(BACKEND_ROOT, '.env');
    if (!fs.existsSync(env_file)) {
        return undefined;
    }
    return require('dotenv').parse(fs.readFileSync(env_file)).ELASTICSEARCH_HOST;
}

module.exports = async function check_elasticsearch() {

    const host = resolve_elasticsearch_host();

    if (!host) {
        throw new Error('The live e2e tests need Elasticsearch, but ELASTICSEARCH_HOST is not set in the environment or in .env.');
    }

    /*
     * fetch() rejects URLs that carry credentials, so a user:password moves
     * into a Basic auth header, which also keeps it out of the messages below.
     */
    const url = new URL(host);
    const headers = {};

    if (url.username || url.password) {
        const credentials = `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`;
        headers.authorization = `Basic ${Buffer.from(credentials).toString('base64')}`;
        url.username = '';
        url.password = '';
    }

    let response;

    try {
        response = await fetch(url, { headers, signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
    } catch (error) {
        const reason = error.name === 'TimeoutError'
            ? `no answer within ${CHECK_TIMEOUT_MS / 1000} s`
            : (error.cause && (error.cause.code || error.cause.message)) || error.message;
        throw new Error(
            `Elasticsearch is not answering at ${url.href} (${reason}).\n` +
            'The live e2e tests need it: publishing an exhibit indexes it there, and the media forms load their subject and Item Type lists from it.\n' +
            'Start Elasticsearch, give it about 20 seconds to come up, then run the tests again.'
        );
    }

    if (!response.ok) {
        throw new Error(
            `Elasticsearch at ${url.href} answered HTTP ${response.status}, so the live e2e tests cannot use it. ` +
            'Check ELASTICSEARCH_HOST in .env.'
        );
    }

    const info = await response.json().catch(() => ({}));
    const version = info.version && info.version.number ? ` ${info.version.number}` : '';

    // eslint-disable-next-line no-console
    console.log(`[elasticsearch-check] Elasticsearch${version} is up at ${url.href}`);
};

if (require.main === module) {
    /*
     * Exit as soon as the message is written: after a timeout the abandoned
     * connection attempt would otherwise hold the process open for several
     * more seconds.
     */
    module.exports().catch((error) => {
        process.stderr.write(`\n${error.message}\n\n`, () => process.exit(1));
    });
}
