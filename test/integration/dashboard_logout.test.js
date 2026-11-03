/**
 * GET /logout — expires the session cookie.
 *
 * The logout page clears the browser's stored token and moves on to the
 * SSO logout URL, but nothing expired the HttpOnly exhibits_token cookie,
 * so verify() and verify_page() kept accepting it until the JWT itself
 * expired. Mounts the REAL dashboard routes, controller and token library;
 * only the view render is captured.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

/*
 * dashboard/routes.js builds its paths from APP_PATH at require time.
 */
process.env.APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

const express = require('express');
const request = require('supertest');

const APP_PATH = process.env.APP_PATH;
const SSO_LOGOUT_URL = 'https://sso.test.du.edu/logout';

jest.mock('../../libs/log4', () => ({
    module: () => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    })
}));

jest.mock('../../config/webservices_config', () => () => ({
    sso_url: 'https://sso.test.du.edu/login',
    sso_response_url: 'https://app.test.du.edu/exhibits-dashboard/auth/sso',
    sso_logout_url: 'https://sso.test.du.edu/logout'
}));

describe('GET /logout', () => {

    let app;

    beforeAll(() => {
        app = express();

        /*
         * Capture the render call instead of running EJS (views/dist only
         * exists after a build).
         */
        app.use((req, res, next) => {
            res.render = (view, data) => res.status(200).json({ view, data });
            next();
        });

        require('../../dashboard/routes')(app);
    });

    test('sends an expired exhibits_token cookie', async () => {
        const response = await request(app)
            .get(`${APP_PATH}/logout`)
            .set('Cookie', 'exhibits_token=signed.session.jwt');

        expect(response.status).toBe(200);

        const cleared = (response.headers['set-cookie'] || [])
            .filter((cookie) => cookie.startsWith('exhibits_token='));

        expect(cleared).toHaveLength(1);
        expect(cleared[0]).toMatch(/^exhibits_token=;/);
        expect(cleared[0]).toContain('Path=/');
        expect(cleared[0]).toContain('Max-Age=0');
    });

    test('still renders the logout page with the SSO logout URL', async () => {
        const response = await request(app).get(`${APP_PATH}/logout`);

        expect(response.body.view).toBe('dist/dashboard-logout');
        expect(response.body.data.sso_logout_url).toBe(SSO_LOGOUT_URL);
    });
});
