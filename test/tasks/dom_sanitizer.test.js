'use strict';

/**
 * Unit tests for the libs/dom request sanitizers.
 *
 * Regression for "XSS sanitizer doesn't recurse": the sanitizers used to walk only
 * the TOP-LEVEL keys and only act on string values, so a payload nested inside an
 * object or array (JSON bodies, qs bracket-notation queries) bypassed sanitization.
 * These tests assert the sanitizers now recurse into nested objects and arrays, keep
 * the top-level `is_active` exception, leave non-strings intact, and don't overflow
 * the call stack on deeply nested input.
 */

const dom = require('../../libs/dom');

// Run a sanitizer middleware over a container and return the (mutated) container.
function run(middleware, key, container) {
    const req = { [key]: container };
    const next = vi.fn();
    middleware(req, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
    return req[key];
}

describe('libs/dom request sanitizers — recursion', () => {

    test('recurses into nested objects (body)', () => {
        const body = run(dom.sanitize_req_body, 'body', {
            user: { name: '<script>alert(1)</script>Ada' }
        });
        expect(body.user.name).not.toContain('<script');
        expect(body.user.name).toContain('Ada');
    });

    test('recurses into arrays and arrays of objects (body)', () => {
        const body = run(dom.sanitize_req_body, 'body', {
            tags: ['<script>x</script>', '<img src=x onerror=alert(1)>'],
            items: [{ title: '<script>y</script>keep' }]
        });
        expect(body.tags[0]).not.toContain('<script');
        expect(body.tags[1]).not.toContain('onerror');
        expect(body.items[0].title).not.toContain('<script');
        expect(body.items[0].title).toContain('keep');
    });

    test('still sanitizes top-level strings', () => {
        const body = run(dom.sanitize_req_body, 'body', { name: '<script>a</script>b' });
        expect(body.name).not.toContain('<script');
    });

    test('leaves the top-level is_active key untouched (preserved exception)', () => {
        const body = run(dom.sanitize_req_body, 'body', { is_active: '<script>z</script>' });
        expect(body.is_active).toBe('<script>z</script>');
    });

    test('the is_active skip is top-level only — a nested is_active IS sanitized', () => {
        const body = run(dom.sanitize_req_body, 'body', {
            nested: { is_active: '<script>z</script>' }
        });
        expect(body.nested.is_active).not.toContain('<script');
    });

    test('leaves non-string values intact', () => {
        const body = run(dom.sanitize_req_body, 'body', { count: 5, active: true, empty: null });
        expect(body).toEqual({ count: 5, active: true, empty: null });
    });

    test('recurses nested query params (qs bracket notation)', () => {
        const query = run(dom.sanitize_req_query, 'query', {
            filter: { q: '<script>x</script>' }
        });
        expect(query.filter.q).not.toContain('<script');
    });

    test('sanitizes route params', () => {
        const params = run(dom.sanitize_req_params, 'params', { id: '<script>x</script>abc' });
        expect(params.id).not.toContain('<script');
        expect(params.id).toContain('abc');
    });

    test('is a no-op that still calls next() when the container is undefined', () => {
        const next = vi.fn();
        dom.sanitize_req_body({}, {}, next); // req.body === undefined
        expect(next).toHaveBeenCalledTimes(1);
    });

    test('handles very deep nesting without overflowing the call stack', () => {
        let body = { v: '<script>x</script>deep' };
        for (let i = 0; i < 20000; i++) {
            body = { child: body };
        }
        const req = { body };
        const next = vi.fn();

        expect(() => dom.sanitize_req_body(req, {}, next)).not.toThrow();
        expect(next).toHaveBeenCalledTimes(1);

        let node = req.body;
        while (node.child) {
            node = node.child;
        }
        expect(node.v).not.toContain('<script');
    });
});
