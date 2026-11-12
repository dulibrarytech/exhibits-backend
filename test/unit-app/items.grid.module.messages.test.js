// @vitest-environment jsdom

'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(__dirname, '../../public/app/grid-items/items.grid.module.js');

const text_of = (selector) => document.querySelector(selector).textContent;

describe('itemsGridModule.show_message', () => {

    beforeAll(() => {
        globalThis.endpointsModule = {
            get_app_path: () => '/exhibits-dashboard',
            get_exhibits_endpoints: () => ({}),
        };

        const src = readFileSync(MODULE_PATH, 'utf8');
        (0, eval)(src.replace(/^const\s+itemsGridModule\s*=/m, 'globalThis.itemsGridModule ='));
    });

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '<div id="message"></div><div id="grid-items-message"></div>';
        globalThis.domModule = {
            set_alert: (target, type, text) => {
                target.textContent = `${type}: ${text}`;
            },
            empty: (target) => {
                target.textContent = '';
            },
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('writes above the list unless it is told where', () => {
        itemsGridModule.show_message('warning', 'About the list');
        itemsGridModule.show_message('danger', 'About the page', 0, '#message');

        expect(text_of('#grid-items-message')).toBe('warning: About the list');
        expect(text_of('#message')).toBe('danger: About the page');
    });

    it('removes a message after the time it is given and leaves the others', () => {
        itemsGridModule.show_message('success', 'Saved', 3000);
        itemsGridModule.show_message('danger', 'Stays', 0, '#message');

        vi.advanceTimersByTime(2999);
        expect(text_of('#grid-items-message')).toBe('success: Saved');

        vi.advanceTimersByTime(1);
        expect(text_of('#grid-items-message')).toBe('');

        vi.advanceTimersByTime(60000);
        expect(text_of('#message')).toBe('danger: Stays');
    });

    it('does not let an earlier message take a later one away with it', () => {
        itemsGridModule.show_message('success', 'First', 3000);
        vi.advanceTimersByTime(1000);
        itemsGridModule.show_message('warning', 'Second');

        vi.advanceTimersByTime(5000);

        expect(text_of('#grid-items-message')).toBe('warning: Second');
    });

    it('still removes a message when a later one is shown somewhere else', () => {
        itemsGridModule.show_message('success', 'About the list', 3000);
        itemsGridModule.show_message('danger', 'About the page', 0, '#message');

        vi.advanceTimersByTime(3000);

        expect(text_of('#grid-items-message')).toBe('');
        expect(text_of('#message')).toBe('danger: About the page');
    });

    it('does nothing when the place for the message is missing', () => {
        document.body.innerHTML = '';

        expect(() => itemsGridModule.show_message('danger', 'Nowhere to go')).not.toThrow();
    });
});
