/**
 * Integration Tests for the staged-upload thumbnail endpoint.
 *
 * GET /api/v1/media/library/upload/thumbnail?path=<rel>&token=<jwt>
 *
 * Drives the real media-library routes -> controller, with heavy deps
 * mocked. The upload modal needs this because the record-keyed thumbnail
 * endpoint 404s before Save (no media record yet).
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const express = require('express');
const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ==================== MOCKS ====================

jest.mock('../../libs/log4', () => ({
    module: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() })
}));

// App path drives the endpoint URL deterministically.
jest.mock('../../config/app_config', () => () => ({ app_path: '/exhibits-dashboard' }));
jest.mock('../../config/kaltura_config', () => () => ({}));

// Auth + rate limiting → pass-through middleware.
jest.mock('../../libs/tokens', () => ({
    verify_with_query: (req, res, next) => next(),
    verify: (req, res, next) => next()
}));
jest.mock('../../config/rate_limits_loader', () => ({
    rate_limits: new Proxy({}, { get: () => (req, res, next) => next() })
}));

jest.mock('../../auth/authorize', () => ({ check_permission: jest.fn().mockResolvedValue(true) }));

// Heavy services the controller require()s — intercepted before they load.
jest.mock('../../media-library/model', () => ({}));
jest.mock('../../media-library/repo-service', () => ({}));
jest.mock('../../media-library/kaltura-service', () => ({}));
jest.mock('../../media-library/iiif-service', () => ({
    derive_iiif_base: () => '', derive_file_base: () => ''
}));

// The one dependency the new handler actually uses.
const mockResolve = jest.fn();
jest.mock('../../media-library/uploads', () => ({
    resolve_storage_path: (...a) => mockResolve(...a)
}));

const ROUTES = require('../../media-library/routes');

// ==================== FIXTURE ====================

const BASE = '/exhibits-dashboard/api/v1/media/library/upload/thumbnail';
let app;
let tmpThumb;
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);

beforeAll(() => {
    tmpThumb = path.join(os.tmpdir(), 'staged_thumb_' + Date.now() + '.jpg');
    fs.writeFileSync(tmpThumb, JPEG_BYTES);

    app = express();
    app.use(express.json());
    ROUTES(app);
});

afterAll(() => {
    try { fs.unlinkSync(tmpThumb); } catch { /* already gone */ }
});

beforeEach(() => {
    jest.clearAllMocks();
});

// ==================== TESTS ====================

describe('GET /upload/thumbnail (staged thumbnail)', () => {

    test('serves the staged thumbnail bytes as image/jpeg on success', async () => {
        mockResolve.mockResolvedValue(tmpThumb);

        const res = await request(app)
            .get(BASE)
            .query({ path: 'thumbnails/a3/f7/uuid_thumb.jpg', token: 't' });

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/image\/jpeg/);
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['content-length']).toBe(String(JPEG_BYTES.length));
        expect(mockResolve).toHaveBeenCalledWith('thumbnails/a3/f7/uuid_thumb.jpg');
    });

    test('400 when the path query param is missing or blank', async () => {
        for (const q of [{}, { path: '' }, { path: '   ' }]) {
            const res = await request(app).get(BASE).query(q);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        }
        expect(mockResolve).not.toHaveBeenCalled();
    });

    test('400 for hostile paths (traversal / absolute) without hitting storage', async () => {
        for (const p of ['../../etc/passwd', 'a/../../secret', '/etc/passwd']) {
            const res = await request(app).get(BASE).query({ path: p });
            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/invalid path/i);
        }
        expect(mockResolve).not.toHaveBeenCalled();
    });

    test('404 when resolve_storage_path rejects (missing / out of root)', async () => {
        mockResolve.mockRejectedValue(new Error('Path traversal attempt detected'));

        const res = await request(app)
            .get(BASE)
            .query({ path: 'thumbnails/a3/f7/missing_thumb.jpg', token: 't' });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/not found/i);
    });

    test('500 when the resolved file cannot be read', async () => {
        mockResolve.mockResolvedValue(path.join(os.tmpdir(), 'definitely_not_here_' + Date.now() + '.jpg'));

        const res = await request(app)
            .get(BASE)
            .query({ path: 'thumbnails/a3/f7/uuid_thumb.jpg', token: 't' });

        // statSync throws -> outer catch -> 500
        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
    });
});
