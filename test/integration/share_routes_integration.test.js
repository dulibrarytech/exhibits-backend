/**
 * Route-mounting Integration Tests for the exhibit share routes
 *
 * Mounts the REAL exhibits/share_routes.js (real endpoints module, real
 * controller) with the model, tokens, authorize and rate limits mocked.
 * Pins the share contract from code review 2026-09-02 (C4):
 *
 *   POST /shared?uuid=   — editor-only; builds the preview if missing; mints t=
 *   GET  /shared?uuid=&t= — anonymous; token subject MUST equal uuid;
 *                          renders only an EXISTING preview, never builds one
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const express = require('express');
const request = require('supertest');

/*
 * Requiring the shared mocks pins APP_PATH before any endpoints module is
 * loaded; the jest.mock factories below are hoisted and resolve it lazily.
 */
const { mock_model } = require('./helpers/mocks');

const EXHIBIT_A = '550e8400-e29b-41d4-a716-446655440000';
const EXHIBIT_B = '660e8400-e29b-41d4-a716-446655440001';
const SHARED_TOKEN = 'header.payload.signature';

jest.mock('../../libs/log4', () => require('./helpers/mocks').log4_factory());

jest.mock('../../config/app_config', () => () => ({ app_path: process.env.APP_PATH }));

jest.mock('../../config/webservices_config', () => () => ({
    exhibit_preview_url: 'https://frontend.test/preview/',
    exhibit_preview_api_key: 'preview-key'
}));

jest.mock('../../libs/tokens', () => require('./helpers/mocks').tokens_factory({
    decoded: { sub: 'editor.user', type: 'session' },
    extra: {
        verify_shared: jest.fn((req, res, next) => {
            /* Default: a share token minted for EXHIBIT_A. */
            req.decoded = { sub: '550e8400-e29b-41d4-a716-446655440000', type: 'shared' };
            next();
        }),
        create_shared: jest.fn(() => 'header.payload.signature')
    }
}));

jest.mock('../../auth/authorize', () => require('./helpers/mocks').authorize_factory());

jest.mock('../../config/rate_limits_loader', () => require('./helpers/mocks').rate_limits_factory([
    'public_media_access', 'write_operations'
]));

const mockExhibitsModel = mock_model(['check_preview', 'build_exhibit_preview']);

jest.mock('../../exhibits/exhibits_model', () => mockExhibitsModel);

const ENDPOINTS = require('../../exhibits/endpoints/index')();
const SHARE_PATH = ENDPOINTS.exhibits.exhibit_shared.get.endpoint;

describe('Share Routes Integration (real router)', () => {
    let app;
    let AUTHORIZE;
    let TOKEN;

    beforeAll(() => {
        app = express();
        /* Capture res.render instead of needing the EJS view tree. */
        app.use((req, res, next) => {
            res.render = (view, locals) => res.status(200).json({ rendered: view, locals });
            next();
        });
        require('../../exhibits/share_routes')(app);
        AUTHORIZE = require('../../auth/authorize');
        TOKEN = require('../../libs/tokens');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        AUTHORIZE.check_permission.mockResolvedValue(true);
        TOKEN.create_shared.mockReturnValue(SHARED_TOKEN);
        mockExhibitsModel.check_preview.mockResolvedValue(true);
        mockExhibitsModel.build_exhibit_preview.mockResolvedValue({ status: true });
    });

    describe('POST /shared (mint)', () => {

        test('mints a share URL bound to the exhibit for an authorized editor', async () => {
            const response = await request(app).post(`${SHARE_PATH}?uuid=${EXHIBIT_A}`);

            expect(response.status).toBe(201);
            expect(response.body.shared_url).toContain(`${SHARE_PATH}?uuid=${EXHIBIT_A}&t=${SHARED_TOKEN}`);
            expect(TOKEN.create_shared).toHaveBeenCalledWith(EXHIBIT_A);
            expect(AUTHORIZE.check_permission).toHaveBeenCalledWith(expect.objectContaining({
                permissions: ['update_exhibit', 'update_any_exhibit'],
                record_type: 'exhibit',
                parent_id: EXHIBIT_A
            }));
        });

        test('returns 403 when the caller may not edit the exhibit, and mints nothing', async () => {
            AUTHORIZE.check_permission.mockResolvedValue(false);

            const response = await request(app).post(`${SHARE_PATH}?uuid=${EXHIBIT_A}`);

            expect(response.status).toBe(403);
            expect(TOKEN.create_shared).not.toHaveBeenCalled();
            expect(mockExhibitsModel.build_exhibit_preview).not.toHaveBeenCalled();
        });

        test('builds the preview at mint time when none exists', async () => {
            mockExhibitsModel.check_preview.mockResolvedValue(false);

            const response = await request(app).post(`${SHARE_PATH}?uuid=${EXHIBIT_A}`);

            expect(response.status).toBe(201);
            expect(mockExhibitsModel.build_exhibit_preview).toHaveBeenCalledWith(EXHIBIT_A);
        });

        test('returns 500 (not a URL with t=null) when the preview build fails', async () => {
            mockExhibitsModel.check_preview.mockResolvedValue(false);
            mockExhibitsModel.build_exhibit_preview.mockResolvedValue({ status: false });

            const response = await request(app).post(`${SHARE_PATH}?uuid=${EXHIBIT_A}`);

            expect(response.status).toBe(500);
            expect(TOKEN.create_shared).not.toHaveBeenCalled();
        });

        test('returns 500 when the token cannot be minted', async () => {
            TOKEN.create_shared.mockReturnValue(null);

            const response = await request(app).post(`${SHARE_PATH}?uuid=${EXHIBIT_A}`);

            expect(response.status).toBe(500);
            expect(response.body.shared_url).toBeUndefined();
        });

        test('rejects a malformed uuid with 400 before authorizing', async () => {
            const response = await request(app).post(`${SHARE_PATH}?uuid=not-a-uuid`);

            expect(response.status).toBe(400);
            expect(AUTHORIZE.check_permission).not.toHaveBeenCalled();
        });
    });

    describe('GET /shared (anonymous render)', () => {

        test('renders the preview when the token was minted for this exhibit', async () => {
            const response = await request(app).get(`${SHARE_PATH}?uuid=${EXHIBIT_A}&t=${SHARED_TOKEN}`);

            expect(response.status).toBe(200);
            expect(response.body.rendered).toBe('share');
            expect(response.body.locals.preview_url).toBe(`https://frontend.test/preview/${EXHIBIT_A}?key=preview-key`);
        });

        test('returns 403 when the token was minted for a DIFFERENT exhibit', async () => {
            const response = await request(app).get(`${SHARE_PATH}?uuid=${EXHIBIT_B}&t=${SHARED_TOKEN}`);

            expect(response.status).toBe(403);
            expect(mockExhibitsModel.check_preview).not.toHaveBeenCalled();
        });

        test('never builds a preview from the anonymous path (404 when none exists)', async () => {
            mockExhibitsModel.check_preview.mockResolvedValue(false);

            const response = await request(app).get(`${SHARE_PATH}?uuid=${EXHIBIT_A}&t=${SHARED_TOKEN}`);

            expect(response.status).toBe(404);
            expect(mockExhibitsModel.build_exhibit_preview).not.toHaveBeenCalled();
        });

        test('rejects a malformed uuid with 400', async () => {
            const response = await request(app).get(`${SHARE_PATH}?uuid=nope&t=${SHARED_TOKEN}`);

            expect(response.status).toBe(400);
        });

        test('is gated by verify_shared', async () => {
            TOKEN.verify_shared.mockImplementationOnce((req, res) => {
                res.status(403).send({ message: 'Exhibit preview URL has expired or is invalid.' });
            });

            const response = await request(app).get(`${SHARE_PATH}?uuid=${EXHIBIT_A}`);

            expect(response.status).toBe(403);
            expect(mockExhibitsModel.check_preview).not.toHaveBeenCalled();
        });
    });
});
