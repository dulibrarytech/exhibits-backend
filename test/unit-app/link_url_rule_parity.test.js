// @vitest-environment jsdom
//
// helperModule.is_valid_link_url (dashboard client) must stay a verbatim copy
// of the link rule behind normalize_href in libs/rte_vocabulary.js: the same
// two regex literals, and the same verdict for every input.

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const SERVER_PATH = resolve(__dirname, '../../libs/rte_vocabulary.js');
const CLIENT_PATH = resolve(__dirname, '../../public/app/utils/helper.module.js');

const ACCEPTED = [
    'https://library.du.edu',
    'HTTP://LIBRARY.DU.EDU/Path?q=1#frag',
    '  https://library.du.edu/  ',
    'mailto:someone@du.edu',
    'tel:+13038712007',
    '/exhibits/abc',
    '#section-2',
    'library.du.edu',
    'library.du.edu:8443/search?q=a&b=c',
    'sub.domain.example.org/path'
];

const REJECTED = [
    '',
    '   ',
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'vbscript:msgbox',
    'data:text/html,<script>alert(1)</script>',
    '//evil.example.com',
    'ftp://files.example.com',
    'localhost:8004',
    'library',
    '192.168.1.10',
    'du.edu library',
    'exämple.com',
    '-bad.example.com',
    'example.com:123456'
];

function server_regex_literals() {
    const src = readFileSync(SERVER_PATH, 'utf8');
    return ['ALLOWED_URI_REGEX', 'BARE_HOST_REGEX'].map((name) => {
        const match = src.match(new RegExp(`^const ${name} = (.+);\\s*$`, 'm'));
        if (match === null) {
            throw new Error(`${name} not found in libs/rte_vocabulary.js`);
        }
        return match[1];
    });
}

function client_regex_literals() {
    const src = readFileSync(CLIENT_PATH, 'utf8');
    const start = src.indexOf('obj.is_valid_link_url = function');
    if (start === -1) {
        throw new Error('is_valid_link_url not found in helper.module.js');
    }
    const body = src.slice(start, src.indexOf('\n    };', start));
    return Array.from(body.matchAll(/(\/\^.+?\/i)\.test\(link\)/g), (match) => match[1]);
}

function load_client_helper() {
    const createDOMPurify = require('dompurify');
    globalThis.DOMPurify = createDOMPurify(window);
    const patched = readFileSync(CLIENT_PATH, 'utf8').replace(/^const\s+helperModule\s*=/m, 'globalThis.helperModule =');
    // eslint-disable-next-line no-eval
    (0, eval)(patched);
    return globalThis.helperModule;
}

describe('link URL rule parity (client is_valid_link_url vs server normalize_href)', () => {

    let is_valid_link_url;
    let normalize_href;

    beforeAll(() => {
        is_valid_link_url = load_client_helper().is_valid_link_url;
        normalize_href = require(SERVER_PATH).normalize_href;
    });

    it('uses the same two regex literals as libs/rte_vocabulary.js', () => {
        const server = server_regex_literals();
        const client = client_regex_literals();
        expect(client).toHaveLength(2);
        expect(client).toEqual(server);
    });

    it.each(ACCEPTED)('accepts %j on both sides', (value) => {
        expect(is_valid_link_url(value)).toBe(true);
        expect(normalize_href(value)).not.toBeNull();
    });

    it.each(REJECTED)('rejects %j on both sides', (value) => {
        expect(is_valid_link_url(value)).toBe(false);
        expect(normalize_href(value)).toBeNull();
    });
});
