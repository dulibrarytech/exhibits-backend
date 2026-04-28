// @vitest-environment jsdom
//
// Unit tests for public/app/exhibits/exhibits.module.js — limited to the
// public methods whose behavior can be characterized without standing up
// jQuery DataTables and a full network mock.
//
// Covered:
//   - obj.get_exhibit_title (httpModule contract + status-code branches)
//   - obj.set_exhibit_title (delegates to get_exhibit_title + domModule.set_text)
//   - obj.open_preview (scroll + flash + setTimeout → window.open + clear)
//   - obj.close_preview (closes the cached window reference)
//
// Deferred to integration coverage (require DataTables init or full http
// state machines): display_exhibits, delete_exhibit, copy,
// create_shared_preview_url, init.

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(
    __dirname,
    '../../public/app/exhibits/exhibits.module.js',
);

const ENDPOINT_TEMPLATE = '/api/exhibits/:exhibit_id';

function build_dom() {
    document.body.innerHTML = `
        <div id="message"></div>
        <div id="exhibit-title"></div>
    `;
}

describe('exhibitsModule', () => {

    beforeAll(() => {
        // The module reads window.localStorage.getItem at IIFE-def time.
        // vitest's jsdom env exposes window.localStorage as a bare {}, so
        // install a real getItem before evaling.
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            value: {
                getItem: () => null,
                setItem: () => {},
                removeItem: () => {},
                clear: () => {},
            },
        });

        const src = readFileSync(MODULE_PATH, 'utf8');
        const patched = src.replace(
            /^const\s+exhibitsModule\s*=/m,
            'globalThis.exhibitsModule =',
        );
        // eslint-disable-next-line no-eval
        (0, eval)(patched);
    });

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Re-stub the bare-name dependencies on every test so individual
        // tests can override per-call behavior.
        globalThis.endpointsModule = {
            get_exhibits_endpoints: () => ({
                exhibits: {
                    exhibit_records: {
                        endpoints: {
                            get: { endpoint: ENDPOINT_TEMPLATE },
                        },
                    },
                },
            }),
        };
        globalThis.authModule = {
            get_user_token: () => 'test-token',
        };
        globalThis.httpModule = { req: vi.fn() };
        globalThis.domModule = {
            set_alert: vi.fn(),
            empty: vi.fn(),
            set_text: vi.fn(),
        };
        globalThis.helperModule = {
            strip_html: (s) => s,
            unescape: (s) => s,
        };

        build_dom();
    });

    describe('get_exhibit_title', () => {

        it('returns the title from a 200 response, after strip_html(unescape(...))', async () => {
            globalThis.httpModule.req.mockResolvedValue({
                status: 200,
                data: { data: { title: '&lt;b&gt;Real Title&lt;/b&gt;' } },
            });
            globalThis.helperModule.unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            globalThis.helperModule.strip_html = (s) => s.replace(/<[^>]+>/g, '');

            const result = await globalThis.exhibitsModule.get_exhibit_title('abc-123');
            expect(result).toBe('Real Title');
        });

        it('passes the resolved endpoint and auth token to httpModule.req', async () => {
            globalThis.httpModule.req.mockResolvedValue({
                status: 200,
                data: { data: { title: 'X' } },
            });

            await globalThis.exhibitsModule.get_exhibit_title('uuid-42');

            expect(globalThis.httpModule.req).toHaveBeenCalledTimes(1);
            const args = globalThis.httpModule.req.mock.calls[0][0];
            expect(args.method).toBe('GET');
            expect(args.url).toBe('/api/exhibits/uuid-42');
            expect(args.headers['x-access-token']).toBe('test-token');
            // validateStatus accepts every status in [200, 600)
            expect(args.validateStatus(404)).toBe(true);
            expect(args.validateStatus(600)).toBe(false);
        });

        it('returns undefined and shows a permission alert on 403', async () => {
            globalThis.httpModule.req.mockResolvedValue({ status: 403 });

            const result = await globalThis.exhibitsModule.get_exhibit_title('uuid');

            expect(result).toBeUndefined();
            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
                document.querySelector('#message'),
                'danger',
                'You do not have permission to view this exhibit',
            );
        });

        it('returns undefined and shows a network alert when the response is undefined', async () => {
            globalThis.httpModule.req.mockResolvedValue(undefined);

            const result = await globalThis.exhibitsModule.get_exhibit_title('uuid');

            expect(result).toBeUndefined();
            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
                expect.anything(),
                'danger',
                expect.stringContaining('Unable to load exhibit title'),
            );
        });

        it('returns undefined silently for non-200 / non-403 / non-undefined responses', async () => {
            globalThis.httpModule.req.mockResolvedValue({ status: 500 });

            const result = await globalThis.exhibitsModule.get_exhibit_title('uuid');

            expect(result).toBeUndefined();
            expect(globalThis.domModule.set_alert).not.toHaveBeenCalled();
        });
    });

    describe('set_exhibit_title', () => {

        it('writes the resolved title into #exhibit-title via domModule.set_text', async () => {
            globalThis.httpModule.req.mockResolvedValue({
                status: 200,
                data: { data: { title: 'Resolved Title' } },
            });

            const result = await globalThis.exhibitsModule.set_exhibit_title('uuid');

            expect(result).toBe(false);
            expect(globalThis.domModule.set_text).toHaveBeenCalledWith(
                '#exhibit-title',
                'Resolved Title',
            );
        });

        it('forwards undefined when get_exhibit_title resolves to undefined', async () => {
            globalThis.httpModule.req.mockResolvedValue({ status: 500 });

            await globalThis.exhibitsModule.set_exhibit_title('uuid');

            expect(globalThis.domModule.set_text).toHaveBeenCalledWith(
                '#exhibit-title',
                undefined,
            );
        });
    });

    describe('open_preview / close_preview', () => {

        beforeEach(() => {
            vi.useFakeTimers();
            // scrollTo isn't implemented in jsdom; stub on window so the
            // module's `scrollTo(0, 0)` call doesn't blow up.
            window.scrollTo = vi.fn();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('scrolls to top and shows the "Building..." alert immediately', () => {
            globalThis.exhibitsModule.open_preview('https://preview.example/abc');

            expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
            expect(globalThis.domModule.set_alert).toHaveBeenCalledWith(
                document.querySelector('#message'),
                'info',
                'Building Exhibit Preview...',
            );
        });

        it('opens the preview window and clears #message after a 900ms delay', () => {
            const fake_window = { close: vi.fn() };
            const open_spy = vi.fn(() => fake_window);
            window.open = open_spy;

            globalThis.exhibitsModule.open_preview('https://preview.example/abc');

            // Nothing fires before the timer elapses.
            expect(open_spy).not.toHaveBeenCalled();
            expect(globalThis.domModule.empty).not.toHaveBeenCalled();

            vi.advanceTimersByTime(900);

            expect(open_spy).toHaveBeenCalledWith(
                'https://preview.example/abc',
                '_blank',
                'location=yes,scrollbars=yes,status=yes',
            );
            expect(globalThis.domModule.empty).toHaveBeenCalledWith('#message');
        });

        it('closes the previously opened window when open_preview is called twice', () => {
            const first_window = { close: vi.fn() };
            const second_window = { close: vi.fn() };
            window.open = vi.fn().mockReturnValueOnce(first_window).mockReturnValueOnce(second_window);

            globalThis.exhibitsModule.open_preview('https://preview.example/a');
            vi.advanceTimersByTime(900);

            // Second call sees the cached link reference and closes it.
            globalThis.exhibitsModule.open_preview('https://preview.example/b');
            expect(first_window.close).toHaveBeenCalledTimes(1);
        });

        it('close_preview invokes .close() on the cached window reference', () => {
            const fake_window = { close: vi.fn() };
            window.open = vi.fn(() => fake_window);

            globalThis.exhibitsModule.open_preview('https://preview.example/abc');
            vi.advanceTimersByTime(900);

            globalThis.exhibitsModule.close_preview();
            expect(fake_window.close).toHaveBeenCalledTimes(1);
        });
    });
});
