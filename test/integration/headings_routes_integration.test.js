/**
 * Route-mounting Integration Tests for Heading Routes
 *
 * Mounts the REAL exhibits/headings_routes.js (real endpoints module,
 * real controller, real authorization chain) with the model mocked.
 * Verifies route registration, path-param mapping, and middleware
 * ordering for all four registered heading endpoints — the existing
 * headings_controller_integration.test.js invokes controller functions
 * on a hand-rolled app and never exercises the real registration.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

/*
 * The real endpoints modules build paths from APP_PATH at require time —
 * ensure it is defined before anything is loaded.
 */
process.env.APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

const express = require('express');
const request = require('supertest');

const TEST_EXHIBIT_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_HEADING_ID = '660e8400-e29b-41d4-a716-446655440100';
const TEST_USER_UID = '660e8400-e29b-41d4-a716-446655440001';

jest.mock('../../libs/log4', () => ({
    module: () => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    })
}));

jest.mock('../../libs/tokens', () => ({
    verify: jest.fn((req, res, next) => {
        req.decoded = { sub: TEST_USER_UID };
        next();
    })
}));

jest.mock('../../auth/authorize', () => ({
    check_permission: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../config/rate_limits_loader', () => ({
    rate_limits: {
        read_operations: (req, res, next) => next(),
        write_operations: (req, res, next) => next()
    }
}));

const mockHeadingsModel = {
    create_heading_record: jest.fn(),
    get_heading_record: jest.fn(),
    get_heading_edit_record: jest.fn(),
    update_heading_record: jest.fn(),
    unlock_heading_record: jest.fn()
};

jest.mock('../../exhibits/headings_model', () => mockHeadingsModel);

const ENDPOINTS = require('../../exhibits/endpoints/index')().exhibits;

const path_for = (template, params = {}) => {
    let path = template;
    for (const [key, value] of Object.entries(params)) {
        path = path.replace(new RegExp(`:${key}(?=/|$)`, 'g'), value);
    }
    return path;
};

const IDS = {
    exhibit_id: TEST_EXHIBIT_ID,
    heading_id: TEST_HEADING_ID
};

describe('Heading Routes Integration (real router)', () => {
    let app;
    let AUTHORIZE;
    let TOKEN;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        const routes = require('../../exhibits/headings_routes');
        routes(app);

        AUTHORIZE = require('../../auth/authorize');
        TOKEN = require('../../libs/tokens');
    });

    beforeEach(() => {
        jest.clearAllMocks();

        AUTHORIZE.check_permission.mockResolvedValue(true);
        TOKEN.verify.mockImplementation((req, res, next) => {
            req.decoded = { sub: TEST_USER_UID };
            next();
        });
    });

    // ==================== MIDDLEWARE ORDERING ====================

    describe('Token verification gate', () => {

        const routes_under_test = [
            ['post', path_for(ENDPOINTS.heading_records.post.endpoint, IDS)],
            ['get', path_for(ENDPOINTS.heading_records.get.endpoint, IDS)],
            ['put', path_for(ENDPOINTS.heading_records.put.endpoint, IDS)],
            ['post', path_for(ENDPOINTS.heading_unlock_record.post.endpoint, IDS)]
        ];

        test.each(routes_under_test)('%s %s rejects with 401 before reaching the model', async (method, path) => {
            TOKEN.verify.mockImplementation((req, res) => {
                res.status(401).send({ message: 'Unauthorized' });
            });

            const response = await request(app)[method](path).send({ text: 'x' });

            expect(response.status).toBe(401);
            for (const fn of Object.values(mockHeadingsModel)) {
                expect(fn).not.toHaveBeenCalled();
            }
        });
    });

    // ==================== HEADING CRUD ====================

    describe('Heading record routes', () => {

        test('POST heading passes exhibit id and body to the model', async () => {
            mockHeadingsModel.create_heading_record.mockResolvedValue({ status: 201, message: 'created', data: TEST_HEADING_ID });

            const response = await request(app)
                .post(path_for(ENDPOINTS.heading_records.post.endpoint, IDS))
                .send({ text: 'Section heading' });

            expect(response.status).toBe(201);
            expect(mockHeadingsModel.create_heading_record).toHaveBeenCalledWith(
                TEST_EXHIBIT_ID,
                expect.objectContaining({ text: 'Section heading' })
            );
        });

        test('POST heading returns 403 when authorization denies', async () => {
            AUTHORIZE.check_permission.mockResolvedValue(false);

            const response = await request(app)
                .post(path_for(ENDPOINTS.heading_records.post.endpoint, IDS))
                .send({ text: 'Section heading' });

            expect(response.status).toBe(403);
            expect(mockHeadingsModel.create_heading_record).not.toHaveBeenCalled();
        });

        test('GET heading maps path params through to the model', async () => {
            mockHeadingsModel.get_heading_record.mockResolvedValue({ status: 200, message: 'ok', data: {} });

            const response = await request(app)
                .get(path_for(ENDPOINTS.heading_records.get.endpoint, IDS));

            expect(response.status).toBe(200);
            expect(mockHeadingsModel.get_heading_record).toHaveBeenCalledWith(TEST_EXHIBIT_ID, TEST_HEADING_ID);
        });

        test('PUT heading maps params and body to the model', async () => {
            mockHeadingsModel.update_heading_record.mockResolvedValue({ status: 200, message: 'updated' });

            const response = await request(app)
                .put(path_for(ENDPOINTS.heading_records.put.endpoint, IDS))
                .send({ text: 'Renamed heading' });

            expect(response.status).toBe(200);
            expect(mockHeadingsModel.update_heading_record).toHaveBeenCalled();
        });

        test('PUT heading returns 403 when authorization denies', async () => {
            AUTHORIZE.check_permission.mockResolvedValue(false);

            const response = await request(app)
                .put(path_for(ENDPOINTS.heading_records.put.endpoint, IDS))
                .send({ text: 'Renamed heading' });

            expect(response.status).toBe(403);
            expect(mockHeadingsModel.update_heading_record).not.toHaveBeenCalled();
        });
    });

    // ==================== LOCK MANAGEMENT ====================

    describe('Heading unlock route', () => {

        test('POST unlock requires a uid query param', async () => {
            const response = await request(app)
                .post(path_for(ENDPOINTS.heading_unlock_record.post.endpoint, IDS));

            expect(response.status).toBe(400);
            expect(mockHeadingsModel.unlock_heading_record).not.toHaveBeenCalled();
        });

        test('POST unlock maps uid and heading id to the model', async () => {
            mockHeadingsModel.unlock_heading_record.mockResolvedValue({ status: 200, message: 'unlocked' });

            const response = await request(app)
                .post(path_for(ENDPOINTS.heading_unlock_record.post.endpoint, IDS))
                .query({ uid: TEST_USER_UID });

            expect(response.status).toBe(200);
            expect(mockHeadingsModel.unlock_heading_record).toHaveBeenCalledWith(
                TEST_USER_UID,
                TEST_HEADING_ID,
                expect.anything()
            );
        });
    });
});
