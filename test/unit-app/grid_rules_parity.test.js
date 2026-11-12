'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const read = (path) => readFileSync(resolve(__dirname, '../..', path), 'utf8');

const SERVER = read('exhibits/grid_model.js');
const PAGE = read('public/app/grid-items/grid.page.module.js');
const LIST = read('public/app/grid-items/items.grid.module.js');
const FORM = read('public/app/grid-items/items.common.grid.form.module.js');

function constant(source, name) {
    const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*([\\s\\S]*?);`));

    if (match === null) {
        throw new Error(`${name} is not defined`);
    }

    return new Function(`return (${match[1]});`)();
}

describe('grid rules repeated in the browser match the server', () => {

    const server_columns = constant(SERVER, 'ALLOWED_COLUMNS');

    test('the server offers at least one column count', () => {
        expect(Array.isArray(server_columns)).toBe(true);
        expect(server_columns.length).toBeGreaterThan(0);
    });

    test('the page, the list and the grid form allow the same column counts', () => {
        expect(constant(PAGE, 'ALLOWED_COLUMNS')).toEqual(server_columns);
        expect(constant(LIST, 'ALLOWED_COLUMN_COUNTS')).toEqual(server_columns);
        expect(constant(FORM, 'ALLOWED_COLUMN_VALUES')).toEqual(server_columns.map(String));
    });

    test.each([
        'MINIMUM_ITEMS_DELETE_MESSAGE',
        'MINIMUM_ITEMS_DELETE_ADD_ITEMS_MESSAGE',
    ])('the page says %s in the server\'s words', (name) => {
        expect(constant(PAGE, name)).toBe(constant(SERVER, name));
    });
});
