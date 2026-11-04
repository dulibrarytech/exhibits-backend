/**
 * Integration tests — content blocks controller GET record (Routes -> Controller).
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const express = require('express');
const request = require('supertest');

const EX = '550e8400-e29b-41d4-a716-446655440000';
const BID = '660e8400-e29b-41d4-a716-446655440001';

jest.mock('../../libs/log4', () => ({
    module: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() })
}));

const mockModel = {
    create_content_block_record: jest.fn(),
    get_content_block_record: jest.fn(),
    get_content_block_edit_record: jest.fn(),
    update_content_block_record: jest.fn(),
    unlock_content_block_record: jest.fn()
};
jest.mock('../../exhibits/content_blocks_model', () => mockModel);

const mockAuthorize = { check_permission: jest.fn().mockResolvedValue(true) };
jest.mock('../../auth/authorize', () => mockAuthorize);

describe('Content blocks controller — GET record', () => {

    let app;

    beforeAll(() => {
        const CTRL = require('../../exhibits/content_blocks_controller');
        app = express();
        app.use(express.json());
        app.get('/block/:exhibit_id/:content_block_id', CTRL.get_content_block_record);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('no type and type=details forward the model response', async () => {
        mockModel.get_content_block_record.mockResolvedValue({ status: 200, message: 'content block record', data: { uuid: BID } });

        expect((await request(app).get(`/block/${EX}/${BID}`)).status).toBe(200);
        expect((await request(app).get(`/block/${EX}/${BID}?type=details`)).status).toBe(200);
        expect(mockModel.get_content_block_record).toHaveBeenCalledTimes(2);
    });

    test('type=edit requires uid and forwards the edit record', async () => {
        mockModel.get_content_block_edit_record.mockResolvedValue({ status: 200, message: 'content block edit record', data: {} });

        expect((await request(app).get(`/block/${EX}/${BID}?type=edit`)).status).toBe(400);
        expect((await request(app).get(`/block/${EX}/${BID}?type=edit&uid=1`)).status).toBe(200);
        expect(mockModel.get_content_block_edit_record).toHaveBeenCalledWith('1', EX, BID);
    });

    test('an unknown type answers 400 instead of leaving the request open', async () => {
        const r = await request(app).get(`/block/${EX}/${BID}?type=view`);

        expect(r.status).toBe(400);
        expect(mockModel.get_content_block_record).not.toHaveBeenCalled();
        expect(mockModel.get_content_block_edit_record).not.toHaveBeenCalled();
    });

    test('model throws -> 500', async () => {
        mockModel.get_content_block_record.mockRejectedValue(new Error('boom'));

        const r = await request(app).get(`/block/${EX}/${BID}`);

        expect(r.status).toBe(500);
        expect(r.body.message).toMatch(/Unable to get content block record/);
    });
});
