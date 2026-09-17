/**
 * Guard: no client module builds a URL that carries the session JWT.
 *
 * The workspace rule is that JWTs never appear in URLs. Every dashboard route
 * that serves an <img src> (media thumbnails, staged-upload thumbnails, repo
 * thumbnails) authenticates from the HttpOnly `exhibits_token` cookie, and
 * `verify_with_query` reads that cookie BEFORE any query parameter — so a
 * `?token=` on those URLs was never consulted for a signed-in user and only
 * leaked the token into access logs and browser history.
 *
 * Eight sites did exactly that as of 2026-09-17, spread across six modules,
 * three of them missed by the DRY review's count. Per-function unit tests pin
 * the modules that had them; this scans every client source so a new module
 * cannot quietly bring the pattern back. It runs as part of `npm test`.
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CLIENT_ROOT = path.resolve(__dirname, '..', '..', 'public', 'app');

/*
 * A query-string token assignment, in either of the two shapes the client
 * has used: a template literal (`?token=${...}`) or concatenation
 * ('&token=' + encodeURIComponent(...)). Both start with the delimiter and
 * the literal key, which is what this matches.
 */
const TOKEN_IN_QUERY = /[?&]token=/;

const client_sources = (dir) => {

    const out = [];

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {

        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            if (entry.name === 'dist') {
                continue;
            }
            out.push(...client_sources(full));
            continue;
        }

        if (entry.name.endsWith('.js') && !entry.name.endsWith('.min.js')) {
            out.push(full);
        }
    }

    return out;
};

describe('client modules never put the session JWT in a URL', () => {

    const sources = client_sources(CLIENT_ROOT);

    test('finds the client sources to scan', () => {
        expect(sources.length).toBeGreaterThan(20);
    });

    test.each(sources.map((file) => [path.relative(CLIENT_ROOT, file), file]))(
        '%s',
        (_rel, file) => {

            const offenders = fs.readFileSync(file, 'utf8')
                .split('\n')
                .map((line, index) => ({ line, number: index + 1 }))
                .filter(({ line }) => TOKEN_IN_QUERY.test(line));

            expect(
                offenders.map(({ number, line }) => `${number}: ${line.trim()}`),
                'session JWT written into a URL; the routes read the auth cookie — drop the query parameter'
            ).toEqual([]);
        }
    );
});
