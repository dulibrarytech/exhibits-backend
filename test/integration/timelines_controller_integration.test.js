/**
 * Integration tests — timelines controller GET timeline item (Routes -> Controller).
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const express = require('express');
const request = require('supertest');

const EX = '550e8400-e29b-41d4-a716-446655440000';
const TL = '660e8400-e29b-41d4-a716-446655440001';
const TI = '770e8400-e29b-41d4-a716-446655440002';

jest.mock('../../libs/log4', () => ({
    module: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() })
}));

const mockModel = {
    get_timeline_item_record: jest.fn(),
    get_timeline_item_details_record: jest.fn(),
    get_timeline_item_edit_record: jest.fn()
};
jest.mock('../../exhibits/timelines_model', () => mockModel);

const mockAuthorize = { check_permission: jest.fn().mockResolvedValue(true) };
jest.mock('../../auth/authorize', () => mockAuthorize);

describe('Timelines controller — GET timeline item', () => {

    let app;

    beforeAll(() => {
        const CTRL = require('../../exhibits/timelines_controller');
        app = express();
        app.use(express.json());
        app.get('/timeline/:exhibit_id/:timeline_id/:item_id', CTRL.get_timeline_item_record);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockModel.get_timeline_item_record.mockResolvedValue({ status: 200, message: 'record', data: {} });
        mockModel.get_timeline_item_details_record.mockResolvedValue({ status: 200, message: 'details', data: {} });
        mockModel.get_timeline_item_edit_record.mockResolvedValue({ status: 200, message: 'edit', data: {} });
    });

    test('no type answers once with the record', async () => {
        const r = await request(app).get(`/timeline/${EX}/${TL}/${TI}`);

        expect(r.status).toBe(200);
        expect(r.body.message).toBe('record');
        expect(mockModel.get_timeline_item_record).toHaveBeenCalledTimes(1);
    });

    test('type=details and type=edit forward their model responses', async () => {
        expect((await request(app).get(`/timeline/${EX}/${TL}/${TI}?type=details`)).body.message).toBe('details');
        expect((await request(app).get(`/timeline/${EX}/${TL}/${TI}?type=edit`)).status).toBe(400);
        expect((await request(app).get(`/timeline/${EX}/${TL}/${TI}?type=edit&uid=1`)).body.message).toBe('edit');
    });

    test('an unknown type answers 400 instead of leaving the request open', async () => {
        const r = await request(app).get(`/timeline/${EX}/${TL}/${TI}?type=view`);

        expect(r.status).toBe(400);
        expect(mockModel.get_timeline_item_record).not.toHaveBeenCalled();
        expect(mockModel.get_timeline_item_details_record).not.toHaveBeenCalled();
        expect(mockModel.get_timeline_item_edit_record).not.toHaveBeenCalled();
    });
});
