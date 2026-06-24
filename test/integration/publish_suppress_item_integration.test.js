/**
 * Integration tests — publish/suppress of nested grid/timeline items return
 * CONSISTENT HTTP statuses on failure (Routes -> Controller).
 *
 * Guards the fix for the publish/suppress slice of the "errors returned as a
 * success status" problem. Before the fix these four handlers each mishandled
 * failure differently:
 *   - suppress_grid_item_record    checked `!result`, so a {status:false} body
 *                                  fell through to **200** (success);
 *   - publish/suppress_timeline_item mapped failure to **204** (a 2xx success code);
 *   - publish_grid_item_record     used 500 (inconsistent with the 422 the
 *                                  top-level item dispatcher uses).
 * All four now return **200** on success and **422** on a graceful failure,
 * tolerant of both the `{status:bool}` and raw-boolean model return shapes.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const express = require('express');
const request = require('supertest');

const EX = '550e8400-e29b-41d4-a716-446655440000';
const PID = '660e8400-e29b-41d4-a716-446655440001'; // grid_id / timeline_id
const IID = '770e8400-e29b-41d4-a716-446655440002'; // grid_item_id / timeline_item_id

jest.mock('../../libs/log4', () => ({
    module: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() })
}));

const mockGridModel = {
    publish_grid_item_record: jest.fn(),
    suppress_grid_item_record: jest.fn()
};
jest.mock('../../exhibits/grid_model', () => mockGridModel);

const mockTimelinesModel = {
    publish_timeline_item_record: jest.fn(),
    suppress_timeline_item_record: jest.fn()
};
jest.mock('../../exhibits/timelines_model', () => mockTimelinesModel);

// Bypass auth/validation; let handle_error resolve to a 500 so a thrown error
// still produces a response (none of these tests trip it — models resolve).
jest.mock('../../exhibits/grid_helper', () => ({
    validate_id: jest.fn(() => true),
    check_authorization: jest.fn().mockResolvedValue(true),
    handle_error: jest.fn((res) => res.status(500).send({ message: 'error' }))
}));
jest.mock('../../exhibits/timelines_helper', () => ({
    validate_param: jest.fn(() => true),
    check_authorization: jest.fn().mockResolvedValue(true),
    handle_error: jest.fn((res) => res.status(500).send({ message: 'error' }))
}));

describe('Publish/Suppress item endpoints — consistent error statuses', () => {

    let app;

    beforeAll(() => {
        const GRID = require('../../exhibits/grid_controller');
        const TL = require('../../exhibits/timelines_controller');

        app = express();
        app.use(express.json());
        app.post('/grid/:exhibit_id/:grid_id/:grid_item_id/publish', GRID.publish_grid_item_record);
        app.post('/grid/:exhibit_id/:grid_id/:grid_item_id/suppress', GRID.suppress_grid_item_record);
        app.post('/timeline/:exhibit_id/:timeline_id/:timeline_item_id/publish', TL.publish_timeline_item_record);
        app.post('/timeline/:exhibit_id/:timeline_id/:timeline_item_id/suppress', TL.suppress_timeline_item_record);
    });

    beforeEach(() => jest.clearAllMocks());

    describe('grid item', () => {

        test('publish success -> 200', async () => {
            mockGridModel.publish_grid_item_record.mockResolvedValue({ status: true, message: 'ok' });
            const r = await request(app).post(`/grid/${EX}/${PID}/${IID}/publish`);
            expect(r.status).toBe(200);
        });

        test('publish failure -> 422 (was 500) with the model message', async () => {
            mockGridModel.publish_grid_item_record.mockResolvedValue({ status: false, message: 'Unable to publish grid item. Grid must be published first' });
            const r = await request(app).post(`/grid/${EX}/${PID}/${IID}/publish`);
            expect(r.status).toBe(422);
            expect(r.body.message).toMatch(/Unable to publish grid item/);
        });

        test('suppress success -> 200', async () => {
            mockGridModel.suppress_grid_item_record.mockResolvedValue({ status: true, message: 'ok' });
            const r = await request(app).post(`/grid/${EX}/${PID}/${IID}/suppress`);
            expect(r.status).toBe(200);
        });

        test('suppress failure -> 422 (was 200-on-error: the !result bug)', async () => {
            mockGridModel.suppress_grid_item_record.mockResolvedValue({ status: false, message: 'Unable to suppress grid item' });
            const r = await request(app).post(`/grid/${EX}/${PID}/${IID}/suppress`);
            expect(r.status).toBe(422);
            expect(r.body.message).toMatch(/Unable to suppress grid item/);
        });

        test('suppress null model response -> 500 (invalid-response guard preserved)', async () => {
            mockGridModel.suppress_grid_item_record.mockResolvedValue(null);
            const r = await request(app).post(`/grid/${EX}/${PID}/${IID}/suppress`);
            expect(r.status).toBe(500);
        });
    });

    describe('timeline item', () => {

        test('publish success -> 200', async () => {
            mockTimelinesModel.publish_timeline_item_record.mockResolvedValue({ status: true });
            const r = await request(app).post(`/timeline/${EX}/${PID}/${IID}/publish`);
            expect(r.status).toBe(200);
        });

        test('publish failure -> 422 (was 204)', async () => {
            mockTimelinesModel.publish_timeline_item_record.mockResolvedValue({ status: false, message: 'Unable to publish timeline item' });
            const r = await request(app).post(`/timeline/${EX}/${PID}/${IID}/publish`);
            expect(r.status).toBe(422);
        });

        test('suppress success -> 200 (raw boolean true)', async () => {
            mockTimelinesModel.suppress_timeline_item_record.mockResolvedValue(true);
            const r = await request(app).post(`/timeline/${EX}/${PID}/${IID}/suppress`);
            expect(r.status).toBe(200);
        });

        test('suppress failure -> 422 (was 204; raw boolean false)', async () => {
            mockTimelinesModel.suppress_timeline_item_record.mockResolvedValue(false);
            const r = await request(app).post(`/timeline/${EX}/${PID}/${IID}/suppress`);
            expect(r.status).toBe(422);
        });
    });
});
