'use strict';

process.env.APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

const express = require('express');
const request = require('supertest');
const CONTROLLER = require('../../dashboard/controller');
const CONFIG = require('../../config/app_config')();

const GRID_PAGE = `${CONFIG.app_path}/items/grid/items`;

function page_app() {
    const app = express();
    app.get('/old-grid-address', CONTROLLER.redirect_to_grid_page);
    return app;
}

describe('old grid edit and details addresses', () => {

    test('redirect to the Grid page, passing the grid id on as grid_id', async () => {
        const response = await request(page_app()).get('/old-grid-address?exhibit_id=exhibit-1&item_id=grid-1');

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`${GRID_PAGE}?exhibit_id=exhibit-1&grid_id=grid-1`);
    });

    test('encode the values they pass on', async () => {
        const response = await request(page_app())
            .get('/old-grid-address?exhibit_id=exhibit-1&item_id=' + encodeURIComponent('grid 1&status=403'));

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(`${GRID_PAGE}?exhibit_id=exhibit-1&grid_id=grid+1%26status%3D403`);
    });

    test('leave out a value that is missing or given more than once', async () => {
        const response = await request(page_app()).get('/old-grid-address?item_id=grid-1&item_id=grid-2');

        const target = new URL(response.headers.location, 'http://localhost');

        expect(response.status).toBe(302);
        expect(target.pathname).toBe(GRID_PAGE);
        expect(target.searchParams.has('grid_id')).toBe(false);
    });
});
