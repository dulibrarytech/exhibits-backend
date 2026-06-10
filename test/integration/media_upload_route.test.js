/**
 * Integration tests for the media upload route's security wiring.
 *
 * Verifies POST /media/library/uploads enforces, in order:
 *   rate limit  ->  TOKEN.verify (auth)  ->  can_create_media (authz)  ->  multer  ->  handler
 *
 * i.e. an unauthenticated/unauthorized request is rejected BEFORE any file is
 * parsed or written. Auth/authz internals are tested elsewhere; here we assert
 * the route actually applies them (and in the right order). Heavy media deps
 * are mocked so no native libs, DB, or real JWTs are needed.
 */

'use strict';

const express = require('express');
const request = require('supertest');

// ==================== MOCKS ====================

jest.mock('../../libs/log4', () => ({
    module: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() })
}));

jest.mock('../../config/app_config', () => () => ({ app_path: '/exhibits-dashboard' }));

jest.mock('../../media-library/storage_config', () => () => ({
    storage_path: require('os').tmpdir(),
    upload_max: 100 * 1024 * 1024,
    thumbnail: { width: 400, height: 400, quality: 80 },
    permissions: { file: 0o640, directory: 0o750 },
    media_type_dirs: { image: 'images', pdf: 'documents', thumbnails: 'thumbnails' }
}));

// Native media deps are only touched while processing real files — stub them so
// requiring uploads.js does not load libvips / spawn ExifTool.
jest.mock('sharp', () => jest.fn());
jest.mock('exiftool-vendored', () => ({ exiftool: { read: jest.fn(), end: jest.fn() } }));

// Rate limiter -> pass-through middleware for any limiter name.
jest.mock('../../config/rate_limits_loader', () => ({
    rate_limits: new Proxy({}, { get: () => (req, res, next) => next() })
}));

// TOKEN.verify simulates the real contract: 401 unless an x-access-token is present.
jest.mock('../../libs/tokens', () => ({
    verify: (req, res, next) => {
        if (req.headers['x-access-token']) {
            req.decoded = { sub: 'curator' };
            return next();
        }
        return res.status(401).json({ message: 'Unauthorized request' });
    }
}));

// Controllable authorization. (jest requires mock-factory vars to be `mock`-prefixed.)
const mockCheckPermission = jest.fn();
jest.mock('../../auth/authorize', () => ({ check_permission: (...args) => mockCheckPermission(...args) }));

const register_upload_route = require('../../media-library/uploads');

// ==================== FIXTURE ====================

const URL = '/exhibits-dashboard/media/library/uploads';
let app;

beforeAll(() => {
    app = express();
    register_upload_route(app);
});

beforeEach(() => jest.clearAllMocks());

// ==================== TESTS ====================

describe('POST /media/library/uploads — auth + rate limit + permission', () => {

    test('401 when no auth token, and authorization is never reached', async () => {
        mockCheckPermission.mockResolvedValue(true);

        const res = await request(app).post(URL);

        expect(res.status).toBe(401);
        // auth runs before authz: check_permission must not have been consulted
        expect(mockCheckPermission).not.toHaveBeenCalled();
    });

    test('403 when authenticated but lacking can_create_media', async () => {
        mockCheckPermission.mockResolvedValue(false);

        const res = await request(app).post(URL).set('x-access-token', 'jwt');

        expect(res.status).toBe(403);
        expect(mockCheckPermission).toHaveBeenCalledTimes(1);
        // the gate is specifically the can_create_media permission on a media record
        expect(mockCheckPermission.mock.calls[0][0]).toMatchObject({
            permissions: ['can_create_media'],
            record_type: 'media'
        });
    });

    test('authorized request passes the guards and reaches the handler (400 NO_FILES with no files)', async () => {
        mockCheckPermission.mockResolvedValue(true);

        const res = await request(app).post(URL).set('x-access-token', 'jwt');

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('NO_FILES');
        expect(mockCheckPermission).toHaveBeenCalledTimes(1);
    });
});
