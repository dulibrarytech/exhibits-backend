'use strict';

/**
 * repo-service.get_repo_tn — regression pin.
 *
 * The repo thumbnail proxy once delegated to exhibits/items_model.get_repo_tn;
 * that function was removed as dead code while this live consumer still called
 * it, and every repository thumbnail 404'd ("ITEM_MODEL.get_repo_tn is not a
 * function"). The fetch now lives inside repo-service itself. These tests
 * exercise the full exported path with the HTTP layer mocked, so any future
 * severed dependency in this flow fails here instead of in production.
 */

jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../../libs/log4', () => ({
    module: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() })
}));

process.env.ELASTICSEARCH_HOST = process.env.ELASTICSEARCH_HOST || 'http://es.test:9200';
process.env.REPO_ELASTICSEARCH_INDEX = process.env.REPO_ELASTICSEARCH_INDEX || 'repo-test';
process.env.TN_SERVICE = 'http://tn.test/';
process.env.TN_SERVICE_API_KEY = 'test-key';

const HTTP = require('axios');
const REPO_SERVICE = require('../../media-library/repo-service');

const VALID_UUID = '2febd7d9-aca0-4f62-8201-62327c0f3cd0';

describe('repo-service get_repo_tn (repository thumbnail proxy)', () => {

    beforeEach(() => {
        HTTP.get.mockReset();
    });

    test('returns the thumbnail buffer when the TN service responds 200', async () => {
        const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
        HTTP.get.mockResolvedValue({ status: 200, data: bytes });

        const result = await REPO_SERVICE.get_repo_tn(VALID_UUID);

        expect(HTTP.get).toHaveBeenCalledTimes(1);
        const [url, opts] = HTTP.get.mock.calls[0];
        expect(url).toBe(`http://tn.test/datastream/${VALID_UUID}/tn?key=test-key`);
        expect(opts.responseType).toBe('arraybuffer');

        expect(result.success).toBe(true);
        expect(Buffer.isBuffer(result.thumbnail)).toBe(true);
        expect(result.thumbnail.length).toBe(4);
    });

    test('returns a failure response (thumbnail null) when the TN service errors', async () => {
        HTTP.get.mockRejectedValue(new Error('connect ECONNREFUSED'));

        const result = await REPO_SERVICE.get_repo_tn(VALID_UUID);

        expect(HTTP.get).toHaveBeenCalledTimes(1);
        expect(result.success).toBe(false);
        expect(result.thumbnail).toBeNull();
    });

    test('rejects an invalid UUID without calling the TN service', async () => {
        const result = await REPO_SERVICE.get_repo_tn('not-a-uuid');

        expect(HTTP.get).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(result.thumbnail).toBeNull();
    });
});
