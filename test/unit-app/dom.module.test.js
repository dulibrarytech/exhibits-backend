// @vitest-environment jsdom
//
// Unit coverage for the WCAG 2.2 Phase 0 a11y additions to dom.module.js:
//   - set_alert         (aria-live politeness + aria-atomic — WCAG 4.1.3)
//   - set_field_error   (aria-invalid + aria-describedby wiring — WCAG 3.3.1)
//   - clear_field_error (idempotent teardown that preserves sibling tokens)
//
// Loader pattern matches helper.module.test.js: read the IIFE source, rewrite
// the const assignment so the export survives eval, and evaluate inside the
// jsdom window. DOMPurify is referenced as a bare global by the module and
// is initialized on globalThis first.

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(__dirname, '../../public/app/utils/dom.module.js');

describe('domModule (Phase 0 a11y additions)', () => {

    beforeAll(() => {
        const createDOMPurify = require('dompurify');
        globalThis.DOMPurify = createDOMPurify(window);

        const src = readFileSync(MODULE_PATH, 'utf8');
        const patched = src.replace(/^const\s+domModule\s*=/m, 'globalThis.domModule =');
        // eslint-disable-next-line no-eval
        (0, eval)(patched);
    });

    beforeEach(() => {
        document.body.innerHTML = '';
    });

    // ───────────────────────────── set_alert ─────────────────────────────

    describe('set_alert', () => {

        it('sets aria-live="assertive" + aria-atomic="true" for danger', () => {
            const container = document.createElement('div');
            container.id = 'message';
            document.body.appendChild(container);

            globalThis.domModule.set_alert('#message', 'danger', 'Save failed');

            const alert = container.querySelector('.alert');
            expect(alert).not.toBeNull();
            expect(alert.getAttribute('role')).toBe('alert');
            expect(alert.getAttribute('aria-live')).toBe('assertive');
            expect(alert.getAttribute('aria-atomic')).toBe('true');
            expect(alert.classList.contains('alert-danger')).toBe(true);
            expect(alert.textContent).toContain('Save failed');
        });

        it('sets aria-live="assertive" for warning', () => {
            const container = document.createElement('div');
            container.id = 'message';
            document.body.appendChild(container);

            globalThis.domModule.set_alert('#message', 'warning', 'Heads up');

            expect(container.querySelector('.alert').getAttribute('aria-live')).toBe('assertive');
        });

        it('sets aria-live="polite" for success', () => {
            const container = document.createElement('div');
            container.id = 'message';
            document.body.appendChild(container);

            globalThis.domModule.set_alert('#message', 'success', 'Saved');

            const alert = container.querySelector('.alert');
            expect(alert.getAttribute('aria-live')).toBe('polite');
            expect(alert.classList.contains('alert-success')).toBe(true);
        });

        it('sets aria-live="polite" for info', () => {
            const container = document.createElement('div');
            container.id = 'message';
            document.body.appendChild(container);

            globalThis.domModule.set_alert('#message', 'info', 'FYI');

            expect(container.querySelector('.alert').getAttribute('aria-live')).toBe('polite');
        });

        it('falls back to assertive for an unknown type', () => {
            const container = document.createElement('div');
            container.id = 'message';
            document.body.appendChild(container);

            globalThis.domModule.set_alert('#message', 'mystery', 'who knows');

            expect(container.querySelector('.alert').getAttribute('aria-live')).toBe('assertive');
        });

        it('replaces (not appends) an existing alert in the same container', () => {
            const container = document.createElement('div');
            container.id = 'message';
            document.body.appendChild(container);

            globalThis.domModule.set_alert('#message', 'danger', 'first');
            globalThis.domModule.set_alert('#message', 'success', 'second');

            const alerts = container.querySelectorAll('.alert');
            expect(alerts.length).toBe(1);
            expect(alerts[0].getAttribute('aria-live')).toBe('polite');
            expect(alerts[0].textContent).toContain('second');
        });

        it('marks the icon aria-hidden so SRs do not announce its name', () => {
            const container = document.createElement('div');
            container.id = 'message';
            document.body.appendChild(container);

            globalThis.domModule.set_alert('#message', 'danger', 'fail');

            const icon = container.querySelector('.alert i');
            expect(icon.getAttribute('aria-hidden')).toBe('true');
        });

        it('is a no-op when target selector matches nothing', () => {
            expect(() => {
                globalThis.domModule.set_alert('#does-not-exist', 'danger', 'x');
            }).not.toThrow();
        });
    });

    // ──────────────────────────── set_field_error ────────────────────────

    describe('set_field_error', () => {

        function build_field() {
            const wrap = document.createElement('div');
            wrap.className = 'form-group';
            const input = document.createElement('input');
            input.id = 'exhibit-title';
            input.type = 'text';
            wrap.appendChild(input);
            document.body.appendChild(wrap);
            return input;
        }

        it('sets aria-invalid="true" on the field', () => {
            const input = build_field();
            globalThis.domModule.set_field_error('#exhibit-title', 'exhibit-title-error', 'Required');
            expect(input.getAttribute('aria-invalid')).toBe('true');
        });

        it('inserts a sibling message node with the supplied id and role="alert"', () => {
            const input = build_field();
            globalThis.domModule.set_field_error('#exhibit-title', 'exhibit-title-error', 'Required');

            const msg = document.getElementById('exhibit-title-error');
            expect(msg).not.toBeNull();
            expect(msg.getAttribute('role')).toBe('alert');
            expect(msg.textContent).toBe('Required');
            expect(msg.previousSibling).toBe(input);
        });

        it('wires the message id into aria-describedby', () => {
            const input = build_field();
            globalThis.domModule.set_field_error('#exhibit-title', 'exhibit-title-error', 'Required');
            expect(input.getAttribute('aria-describedby')).toBe('exhibit-title-error');
        });

        it('preserves pre-existing aria-describedby tokens (e.g. form-text hints)', () => {
            const input = build_field();
            input.setAttribute('aria-describedby', 'exhibit-title-help');

            globalThis.domModule.set_field_error('#exhibit-title', 'exhibit-title-error', 'Required');

            const tokens = input.getAttribute('aria-describedby').split(/\s+/);
            expect(tokens).toContain('exhibit-title-help');
            expect(tokens).toContain('exhibit-title-error');
        });

        it('is idempotent: a second call replaces the message in place without duplicating the node or aria-describedby token', () => {
            const input = build_field();
            globalThis.domModule.set_field_error('#exhibit-title', 'exhibit-title-error', 'Required');
            globalThis.domModule.set_field_error('#exhibit-title', 'exhibit-title-error', 'Title is required');

            expect(document.querySelectorAll('#exhibit-title-error').length).toBe(1);
            expect(document.getElementById('exhibit-title-error').textContent).toBe('Title is required');

            const tokens = input.getAttribute('aria-describedby').split(/\s+/);
            const occurrences = tokens.filter(function (t) { return t === 'exhibit-title-error'; }).length;
            expect(occurrences).toBe(1);
        });

        it('is a no-op when target is missing or message_id is falsy', () => {
            expect(() => {
                globalThis.domModule.set_field_error('#nope', 'x-error', 'x');
            }).not.toThrow();

            const input = build_field();
            globalThis.domModule.set_field_error('#exhibit-title', '', 'x');
            expect(input.hasAttribute('aria-invalid')).toBe(false);
        });
    });

    // ─────────────────────────── clear_field_error ───────────────────────

    describe('clear_field_error', () => {

        function build_field_with_error() {
            const wrap = document.createElement('div');
            wrap.className = 'form-group';
            const input = document.createElement('input');
            input.id = 'exhibit-title';
            input.type = 'text';
            wrap.appendChild(input);
            document.body.appendChild(wrap);
            globalThis.domModule.set_field_error('#exhibit-title', 'exhibit-title-error', 'Required');
            return input;
        }

        it('removes aria-invalid, aria-describedby (when only token), and the message node', () => {
            const input = build_field_with_error();
            globalThis.domModule.clear_field_error('#exhibit-title', 'exhibit-title-error');

            expect(input.hasAttribute('aria-invalid')).toBe(false);
            expect(input.hasAttribute('aria-describedby')).toBe(false);
            expect(document.getElementById('exhibit-title-error')).toBeNull();
        });

        it('preserves other aria-describedby tokens', () => {
            const input = build_field_with_error();
            // Add a pre-existing hint token alongside the error token.
            input.setAttribute(
                'aria-describedby',
                input.getAttribute('aria-describedby') + ' exhibit-title-help'
            );

            globalThis.domModule.clear_field_error('#exhibit-title', 'exhibit-title-error');

            expect(input.getAttribute('aria-describedby')).toBe('exhibit-title-help');
        });

        it('is a no-op when target is missing', () => {
            expect(() => {
                globalThis.domModule.clear_field_error('#nope', 'x-error');
            }).not.toThrow();
        });

        it('is safe to call when no error was previously set', () => {
            const wrap = document.createElement('div');
            const input = document.createElement('input');
            input.id = 'clean';
            wrap.appendChild(input);
            document.body.appendChild(wrap);

            expect(() => {
                globalThis.domModule.clear_field_error('#clean', 'clean-error');
            }).not.toThrow();
            expect(input.hasAttribute('aria-invalid')).toBe(false);
        });
    });
});
