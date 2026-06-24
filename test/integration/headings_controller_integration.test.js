/**
 * Integration tests — headings controller returns HTTP 500 (not 408) on a
 * server-side exception (Routes -> Controller).
 *
 * Guards the fix for "one controller uses 408 as a generic failure code": the
 * create/get/update heading catch blocks returned **408 Request Timeout** for a
 * thrown error — semantically wrong (it signals the client to retry, and some
 * clients auto-retry 408, risking a duplicate create). They now return **500**,
 * matching the already-correct unlock_heading_record catch.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const express = require('express');
const request = require('supertest');

const EX = '550e8400-e29b-41d4-a716-446655440000';
const HID = '660e8400-e29b-41d4-a716-446655440001';

jest.mock('../../libs/log4', () => ({
    module: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() })
}));

const mockHeadingsModel = {
    create_heading_record: jest.fn(),
    get_heading_record: jest.fn(),
    get_heading_edit_record: jest.fn(),
    update_heading_record: jest.fn()
};
jest.mock('../../exhibits/headings_model', () => mockHeadingsModel);

const mockAuthorize = { check_permission: jest.fn().mockResolvedValue(true) };
jest.mock('../../auth/authorize', () => mockAuthorize);

describe('Headings controller — exceptions return 500 (was 408)', () => {

    let app;

    beforeAll(() => {
        const CTRL = require('../../exhibits/headings_controller');
        app = express();
        app.use(express.json());
        app.post('/heading/:exhibit_id', CTRL.create_heading_record);
        app.get('/heading/:exhibit_id/:heading_id', CTRL.get_heading_record);
        app.put('/heading/:exhibit_id/:heading_id', CTRL.update_heading_record);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthorize.check_permission.mockResolvedValue(true);
    });

    test('create: model throws -> 500 (was 408)', async () => {
        mockHeadingsModel.create_heading_record.mockRejectedValue(new Error('db down'));
        const r = await request(app).post(`/heading/${EX}`).send({ text: 'H' });
        expect(r.status).toBe(500);
        expect(r.body.message).toMatch(/Unable to create heading record/);
    });

    test('get: model throws -> 500 (was 408)', async () => {
        mockHeadingsModel.get_heading_record.mockRejectedValue(new Error('boom'));
        const r = await request(app).get(`/heading/${EX}/${HID}`);
        expect(r.status).toBe(500);
        expect(r.body.message).toMatch(/Unable to get heading record/);
    });

    test('update: model throws -> 500 (was 408)', async () => {
        mockHeadingsModel.update_heading_record.mockRejectedValue(new Error('boom'));
        const r = await request(app).put(`/heading/${EX}/${HID}`).send({ text: 'H2' });
        expect(r.status).toBe(500);
        expect(r.body.message).toMatch(/Unable to update heading record/);
    });

    test('create: happy path forwards the model status (201) — no regression', async () => {
        mockHeadingsModel.create_heading_record.mockResolvedValue({ status: 201, message: 'Heading record created' });
        const r = await request(app).post(`/heading/${EX}`).send({ text: 'H' });
        expect(r.status).toBe(201);
    });
});
