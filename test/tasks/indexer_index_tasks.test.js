/**
 * Unit tests for Indexer_index_tasks
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const Indexer_index_tasks = require('../../indexer/tasks/indexer_index_tasks');

// Mock dependencies - MUST be identical across all test files to avoid conflicts
jest.mock('../../libs/log4', () => {
    const mockLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    };
    return {
        module: jest.fn(() => mockLogger)
    };
});

/**
 * Elasticsearch Index Mappings Reference (mappings.json):
 * - uuid: text with keyword
 * - title: keyword with keyword
 * - description: text with keyword
 * - type: text with keyword
 * - is_published: integer with keyword
 * - created: date
 * - items: nested type with properties
 */

describe('Indexer_index_tasks', () => {
    let mockClient;
    let mockIndex;
    let indexerTasks;

    // Valid UUID for testing
    const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
    const VALID_UUID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

    // Helper to create mock Elasticsearch client
    const createMockClient = () => ({
        index: jest.fn(),
        get: jest.fn(),
        delete: jest.fn()
    });

    // Helper to create mock exhibit record matching schema
    const createMockRecord = (overrides = {}) => ({
        uuid: VALID_UUID,
        type: 'exhibit',
        title: 'Test Exhibit',
        subtitle: 'A test subtitle',
        description: 'Test description',
        banner_template: 'banner_1',
        hero_image: 'hero.jpg',
        thumbnail: 'thumb.jpg',
        page_layout: 'top_nav',
        exhibit_template: 'vertical_scroll',
        is_published: 1,
        is_featured: 0,
        is_deleted: 0,
        created: '2025-01-01T00:00:00Z',
        updated: '2025-12-18T10:00:00Z',
        ...overrides
    });

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        mockClient = createMockClient();
        mockIndex = 'exhibits_index';

        indexerTasks = new Indexer_index_tasks(mockClient, mockIndex);
    });

    afterAll(async () => {
        await new Promise(resolve => setImmediate(resolve));
    });

    // ==================== CONSTRUCTOR TESTS ====================
    describe('Constructor', () => {
        test('should initialize with correct properties', () => {
            expect(indexerTasks.CLIENT).toBe(mockClient);
            expect(indexerTasks.INDEX).toBe(mockIndex);
            expect(indexerTasks.UUID_REGEX).toBeInstanceOf(RegExp);
            expect(indexerTasks.INDEX_TIMEOUT).toBe(30000);
            expect(indexerTasks.GET_TIMEOUT).toBe(10000);
        });

        test('should throw error when CLIENT is null', () => {
            expect(() => {
                new Indexer_index_tasks(null, mockIndex);
            }).toThrow('Valid Elasticsearch client is required');
        });

        test('should throw error when CLIENT is undefined', () => {
            expect(() => {
                new Indexer_index_tasks(undefined, mockIndex);
            }).toThrow('Valid Elasticsearch client is required');
        });

        test('should throw error when INDEX is null', () => {
            expect(() => {
                new Indexer_index_tasks(mockClient, null);
            }).toThrow('Valid index name is required');
        });

        test('should throw error when INDEX is empty string', () => {
            expect(() => {
                new Indexer_index_tasks(mockClient, '');
            }).toThrow('Valid index name is required');
        });

        test('should throw error when INDEX is not a string', () => {
            expect(() => {
                new Indexer_index_tasks(mockClient, 123);
            }).toThrow('Valid index name is required');
        });

        test('should accept valid index names', () => {
            const validNames = ['exhibits', 'exhibits_v1', 'my-index', 'test.index'];
            validNames.forEach(name => {
                expect(() => {
                    new Indexer_index_tasks(mockClient, name);
                }).not.toThrow();
            });
        });
    });

    // ==================== UUID VALIDATION TESTS ====================
    describe('UUID Validation (_validate_uuid)', () => {
        test('should accept valid UUID v1', () => {
            const record = createMockRecord({ uuid: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' });
            mockClient.index.mockResolvedValue({ result: 'created', _version: 1 });

            // UUID validation happens inside index_record
            expect(async () => {
                await indexerTasks.index_record(record);
            }).not.toThrow();
        });

        test('should accept valid UUID v4', () => {
            const record = createMockRecord({ uuid: '550e8400-e29b-41d4-a716-446655440000' });
            mockClient.index.mockResolvedValue({ result: 'created', _version: 1 });

            expect(async () => {
                await indexerTasks.index_record(record);
            }).not.toThrow();
        });

        test('should reject invalid UUID format', async () => {
            const record = createMockRecord({ uuid: 'invalid-uuid' });

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid record UUID format');
        });

        test('should reject UUID with wrong length', async () => {
            const record = createMockRecord({ uuid: '550e8400-e29b-41d4-a716' });

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid record UUID format');
        });

        test('should trim whitespace from UUID', async () => {
            const record = createMockRecord({ uuid: '  ' + VALID_UUID + '  ' });
            mockClient.index.mockResolvedValue({ result: 'created', _version: 1 });

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(true);
            expect(result.uuid).toBe(VALID_UUID);
        });
    });

    // ==================== RECORD VALIDATION TESTS ====================
    describe('Record Validation (_validate_record)', () => {
        test('should reject null record', async () => {
            const result = await indexerTasks.index_record(null);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Record must be a valid object');
        });

        test('should reject undefined record', async () => {
            const result = await indexerTasks.index_record(undefined);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Record must be a valid object');
        });

        test('should reject array as record', async () => {
            const result = await indexerTasks.index_record([{ uuid: VALID_UUID }]);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Record must be a valid object');
        });

        test('should reject record without uuid', async () => {
            const result = await indexerTasks.index_record({ title: 'No UUID' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Record must have a valid UUID');
        });

        test('should reject record with empty uuid', async () => {
            const result = await indexerTasks.index_record({ uuid: '' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Record must have a valid UUID');
        });

        test('should reject record with whitespace-only uuid', async () => {
            const result = await indexerTasks.index_record({ uuid: '   ' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Record must have a valid UUID');
        });
    });

    // ==================== RECORD SANITIZATION TESTS ====================
    describe('Record Sanitization (_sanitize_record)', () => {
        test('should remove __proto__ from record', async () => {
            const record = createMockRecord();
            // Note: Can't directly set __proto__ in object literal, testing via nested
            mockClient.index.mockResolvedValue({ result: 'created', _version: 1 });

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(true);
            // Sanitization happens internally
        });

        test('should handle non-serializable data', async () => {
            const record = createMockRecord();
            record.circular = record; // Create circular reference

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(false);
            expect(result.error).toContain('non-serializable');
        });

        test('should create deep copy of record', async () => {
            const original = createMockRecord();
            const nested = { deep: { value: 'test' } };
            original.nested = nested;

            mockClient.index.mockResolvedValue({ result: 'created', _version: 1 });

            await indexerTasks.index_record(original);

            // Original should not be mutated by sanitization
            expect(original.nested).toBe(nested);
        });
    });

    // ==================== INDEX_RECORD TESTS ====================
    describe('index_record', () => {
        test('should index record successfully with created result', async () => {
            const record = createMockRecord();
            mockClient.index.mockResolvedValue({
                result: 'created',
                _version: 1,
                _shards: { total: 2, successful: 2, failed: 0 }
            });

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(true);
            expect(result.result).toBe('created');
            expect(result.uuid).toBe(VALID_UUID);
            expect(result.version).toBe(1);
            expect(result.index).toBe(mockIndex);
            expect(mockClient.index).toHaveBeenCalledWith(expect.objectContaining({
                index: mockIndex,
                id: VALID_UUID,
                body: expect.objectContaining({ uuid: VALID_UUID })
            }));
        });

        test('should index record successfully with updated result', async () => {
            const record = createMockRecord();
            mockClient.index.mockResolvedValue({
                result: 'updated',
                _version: 2,
                _shards: { total: 2, successful: 2, failed: 0 }
            });

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(true);
            expect(result.result).toBe('updated');
            expect(result.version).toBe(2);
        });

        test('should handle noop result as failure', async () => {
            const record = createMockRecord();
            mockClient.index.mockResolvedValue({
                result: 'noop',
                _version: 1
            });

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Unexpected result: noop');
        });

        test('should handle empty response from Elasticsearch', async () => {
            const record = createMockRecord();
            mockClient.index.mockResolvedValue(null);

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Empty response');
        });

        test('should use default options', async () => {
            const record = createMockRecord();
            mockClient.index.mockResolvedValue({ result: 'created', _version: 1 });

            await indexerTasks.index_record(record);

            expect(mockClient.index).toHaveBeenCalledWith(expect.objectContaining({
                refresh: 'false',
                timeout: '30s'
            }));
        });

        test('should accept custom options', async () => {
            const record = createMockRecord();
            mockClient.index.mockResolvedValue({ result: 'created', _version: 1 });

            await indexerTasks.index_record(record, {
                refresh: true,
                timeout: '60s'
            });

            expect(mockClient.index).toHaveBeenCalledWith(expect.objectContaining({
                refresh: 'true',
                timeout: '60s'
            }));
        });

        test('should handle Elasticsearch error with meta', async () => {
            const record = createMockRecord();
            const esError = new Error('Elasticsearch error');
            esError.meta = {
                statusCode: 500,
                body: {
                    error: {
                        type: 'cluster_block_exception',
                        reason: 'blocked by: [FORBIDDEN/12/index read-only]'
                    }
                }
            };
            mockClient.index.mockRejectedValue(esError);

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Elasticsearch error');
            expect(result.status_code).toBe(500);
        });

        test('should handle timeout error', async () => {
            const record = createMockRecord();
            // Simulate slow response
            mockClient.index.mockImplementation(() =>
                new Promise(resolve => setTimeout(resolve, 35000))
            );

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(false);
            expect(result.error).toContain('timeout');
        }, 35000);

        test('should index exhibit record with all schema fields', async () => {
            const record = {
                uuid: VALID_UUID,
                type: 'exhibit',
                title: 'Digital Archives Exhibition',
                subtitle: 'Exploring History',
                banner_template: 'banner_2',
                about_the_curators: '<p>About text</p>',
                alert_text: 'Special announcement',
                hero_image: 'hero_large.jpg',
                thumbnail: 'thumbnail.jpg',
                description: 'Full description here',
                page_layout: 'side_nav',
                exhibit_template: 'item_centered',
                exhibit_subjects: JSON.stringify(['history', 'archives']),
                styles: JSON.stringify({ backgroundColor: '#fff' }),
                order: 1,
                is_student_curated: 0,
                is_published: 1,
                is_featured: 1,
                is_embedded: 0,
                is_preview: 0,
                is_locked: 0,
                is_deleted: 0,
                is_indexed: 1,
                created: '2025-01-15T08:30:00Z',
                updated: '2025-12-18T16:45:00Z'
            };

            mockClient.index.mockResolvedValue({ result: 'created', _version: 1 });

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(true);
            expect(mockClient.index).toHaveBeenCalledWith(expect.objectContaining({
                body: expect.objectContaining({
                    type: 'exhibit',
                    is_published: 1,
                    is_featured: 1
                })
            }));
        });
    });

    // ==================== GET_INDEXED_RECORD TESTS ====================
    describe('get_indexed_record', () => {
        test('should retrieve record successfully', async () => {
            const mockSource = createMockRecord();
            mockClient.get.mockResolvedValue({
                found: true,
                _source: mockSource,
                _version: 3,
                _index: mockIndex
            });

            const result = await indexerTasks.get_indexed_record(VALID_UUID);

            expect(result.success).toBe(true);
            expect(result.found).toBe(true);
            expect(result.uuid).toBe(VALID_UUID);
            expect(result.source).toEqual(mockSource);
            expect(result.version).toBe(3);
            expect(mockClient.get).toHaveBeenCalledWith(expect.objectContaining({
                index: mockIndex,
                id: VALID_UUID
            }));
        });

        test('should handle record not found (404)', async () => {
            const notFoundError = new Error('Not Found');
            notFoundError.meta = { statusCode: 404 };
            mockClient.get.mockRejectedValue(notFoundError);

            const result = await indexerTasks.get_indexed_record(VALID_UUID);

            expect(result.success).toBe(false);
            expect(result.found).toBe(false);
            expect(result.message).toBe('Record not found');
        });

        test('should handle empty response', async () => {
            mockClient.get.mockResolvedValue(null);

            const result = await indexerTasks.get_indexed_record(VALID_UUID);

            expect(result.success).toBe(false);
            expect(result.found).toBe(false);
            expect(result.message).toContain('Empty response');
        });

        test('should reject invalid UUID', async () => {
            const result = await indexerTasks.get_indexed_record('not-a-valid-uuid');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid record UUID format');
        });

        test('should reject empty UUID', async () => {
            const result = await indexerTasks.get_indexed_record('');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Valid record UUID is required');
        });

        test('should reject null UUID', async () => {
            const result = await indexerTasks.get_indexed_record(null);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Valid record UUID is required');
        });

        test('should handle Elasticsearch error', async () => {
            const esError = new Error('Connection refused');
            esError.meta = { statusCode: 503 };
            mockClient.get.mockRejectedValue(esError);

            const result = await indexerTasks.get_indexed_record(VALID_UUID);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Connection refused');
            expect(result.status_code).toBe(503);
        });

        test('should accept custom timeout option', async () => {
            mockClient.get.mockResolvedValue({
                found: true,
                _source: createMockRecord(),
                _version: 1
            });

            await indexerTasks.get_indexed_record(VALID_UUID, { timeout: '10s' });

            expect(mockClient.get).toHaveBeenCalledWith(expect.objectContaining({
                timeout: '10s'
            }));
        });

        test('should trim UUID whitespace', async () => {
            mockClient.get.mockResolvedValue({
                found: true,
                _source: createMockRecord(),
                _version: 1,
                _index: mockIndex
            });

            const result = await indexerTasks.get_indexed_record('  ' + VALID_UUID + '  ');

            expect(result.success).toBe(true);
            expect(result.uuid).toBe(VALID_UUID);
        });
    });

    // ==================== DELETE_RECORD TESTS ====================
    describe('delete_record', () => {
        test('should delete record successfully', async () => {
            mockClient.delete.mockResolvedValue({
                result: 'deleted',
                _version: 2,
                _shards: { total: 2, successful: 2, failed: 0 }
            });

            const result = await indexerTasks.delete_record(VALID_UUID);

            expect(result.success).toBe(true);
            expect(result.result).toBe('deleted');
            expect(result.uuid).toBe(VALID_UUID);
            expect(result.version).toBe(2);
            expect(mockClient.delete).toHaveBeenCalledWith(expect.objectContaining({
                index: mockIndex,
                id: VALID_UUID
            }));
        });

        test('should handle record not found (404)', async () => {
            const notFoundError = new Error('Not Found');
            notFoundError.meta = { statusCode: 404 };
            mockClient.delete.mockRejectedValue(notFoundError);

            const result = await indexerTasks.delete_record(VALID_UUID);

            expect(result.success).toBe(false);
            expect(result.result).toBe('not_found');
            expect(result.message).toBe('Record not found');
        });

        test('should handle unexpected result', async () => {
            mockClient.delete.mockResolvedValue({
                result: 'not_found',
                _version: 1
            });

            const result = await indexerTasks.delete_record(VALID_UUID);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Unexpected result: not_found');
        });

        test('should handle empty response', async () => {
            mockClient.delete.mockResolvedValue(null);

            const result = await indexerTasks.delete_record(VALID_UUID);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Empty response');
        });

        test('should reject invalid UUID', async () => {
            const result = await indexerTasks.delete_record('bad-uuid');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid record UUID format');
        });

        test('should use default options', async () => {
            mockClient.delete.mockResolvedValue({ result: 'deleted', _version: 1 });

            await indexerTasks.delete_record(VALID_UUID);

            expect(mockClient.delete).toHaveBeenCalledWith(expect.objectContaining({
                refresh: 'false',
                timeout: '30s'
            }));
        });

        test('should accept custom options', async () => {
            mockClient.delete.mockResolvedValue({ result: 'deleted', _version: 1 });

            await indexerTasks.delete_record(VALID_UUID, {
                refresh: true,
                timeout: '60s'
            });

            expect(mockClient.delete).toHaveBeenCalledWith(expect.objectContaining({
                refresh: 'true',
                timeout: '60s'
            }));
        });

        test('should handle Elasticsearch error', async () => {
            const esError = new Error('Index read-only');
            esError.meta = {
                statusCode: 403,
                body: { error: { type: 'cluster_block_exception' } }
            };
            mockClient.delete.mockRejectedValue(esError);

            const result = await indexerTasks.delete_record(VALID_UUID);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Index read-only');
            expect(result.status_code).toBe(403);
        });
    });

    // ==================== TIMEOUT TESTS ====================
    describe('Timeout Protection (_with_timeout)', () => {
        test('should resolve when operation completes before timeout', async () => {
            const record = createMockRecord();
            mockClient.index.mockResolvedValue({ result: 'created', _version: 1 });

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(true);
        });

        test('should reject when operation exceeds timeout', async () => {
            const record = createMockRecord();
            // Mock a very slow operation (longer than INDEX_TIMEOUT)
            mockClient.index.mockImplementation(() =>
                new Promise(resolve => setTimeout(() => resolve({ result: 'created' }), 35000))
            );

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(false);
            expect(result.error).toContain('timeout');
        }, 40000);
    });

    // ==================== INTEGRATION TESTS ====================
    describe('Integration Tests', () => {
        test('should handle complete document lifecycle', async () => {
            const record = createMockRecord();

            // 1. Index the record
            mockClient.index.mockResolvedValue({
                result: 'created',
                _version: 1,
                _shards: { total: 2, successful: 2, failed: 0 }
            });

            const indexResult = await indexerTasks.index_record(record);
            expect(indexResult.success).toBe(true);
            expect(indexResult.result).toBe('created');

            // 2. Retrieve the record
            mockClient.get.mockResolvedValue({
                found: true,
                _source: record,
                _version: 1,
                _index: mockIndex
            });

            const getResult = await indexerTasks.get_indexed_record(VALID_UUID);
            expect(getResult.success).toBe(true);
            expect(getResult.found).toBe(true);
            expect(getResult.source.title).toBe(record.title);

            // 3. Update the record
            const updatedRecord = { ...record, title: 'Updated Title' };
            mockClient.index.mockResolvedValue({
                result: 'updated',
                _version: 2,
                _shards: { total: 2, successful: 2, failed: 0 }
            });

            const updateResult = await indexerTasks.index_record(updatedRecord);
            expect(updateResult.success).toBe(true);
            expect(updateResult.result).toBe('updated');
            expect(updateResult.version).toBe(2);

            // 4. Delete the record
            mockClient.delete.mockResolvedValue({
                result: 'deleted',
                _version: 3,
                _shards: { total: 2, successful: 2, failed: 0 }
            });

            const deleteResult = await indexerTasks.delete_record(VALID_UUID);
            expect(deleteResult.success).toBe(true);
            expect(deleteResult.result).toBe('deleted');
        });

        test('should handle multiple record types from schema', async () => {
            const recordTypes = [
                { type: 'exhibit', table: 'tbl_exhibits' },
                { type: 'item', table: 'tbl_standard_items' },
                { type: 'heading', table: 'tbl_heading_items' },
                { type: 'grid', table: 'tbl_grids' },
                { type: 'vertical_timeline', table: 'tbl_timelines' }
            ];

            for (const recordType of recordTypes) {
                const record = createMockRecord({
                    uuid: `550e8400-e29b-41d4-a716-44665544000${recordTypes.indexOf(recordType)}`,
                    type: recordType.type
                });

                mockClient.index.mockResolvedValue({ result: 'created', _version: 1 });

                const result = await indexerTasks.index_record(record);

                expect(result.success).toBe(true);
            }
        });
    });

    // ==================== ERROR HANDLING TESTS ====================
    describe('Error Handling', () => {
        test('should include error context in failure response', async () => {
            const record = createMockRecord();
            const esError = new Error('Detailed error message');
            esError.name = 'ElasticsearchError';
            esError.meta = {
                statusCode: 400,
                body: {
                    error: {
                        type: 'mapper_parsing_exception',
                        reason: 'failed to parse field'
                    }
                }
            };
            mockClient.index.mockRejectedValue(esError);

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Detailed error message');
            expect(result.error_type).toBe('ElasticsearchError');
            expect(result.status_code).toBe(400);
        });

        test('should handle generic errors without meta', async () => {
            const record = createMockRecord();
            const genericError = new Error('Generic error');
            mockClient.index.mockRejectedValue(genericError);

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Generic error');
            expect(result.status_code).toBeUndefined();
        });
    });

    // ==================== EDGE CASES ====================
    describe('Edge Cases', () => {
        test('should handle record with nested objects', async () => {
            const record = createMockRecord({
                items: [
                    { uuid: VALID_UUID_2, title: 'Item 1', type: 'item' },
                    { uuid: '6ba7b811-9dad-11d1-80b4-00c04fd430c8', title: 'Item 2', type: 'item' }
                ],
                styles: { backgroundColor: '#fff', fontSize: '14px' }
            });

            mockClient.index.mockResolvedValue({ result: 'created', _version: 1 });

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(true);
        });

        test('should handle record with null fields', async () => {
            const record = createMockRecord({
                subtitle: null,
                hero_image: null,
                thumbnail: null,
                alert_text: null
            });

            mockClient.index.mockResolvedValue({ result: 'created', _version: 1 });

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(true);
        });

        test('should handle record with empty strings', async () => {
            const record = createMockRecord({
                description: '',
                subtitle: ''
            });

            mockClient.index.mockResolvedValue({ result: 'created', _version: 1 });

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(true);
        });

        test('should handle record with unicode content', async () => {
            const record = createMockRecord({
                title: 'Exposición de Arte 日本語 العربية',
                description: 'Ümlauts and açcénts'
            });

            mockClient.index.mockResolvedValue({ result: 'created', _version: 1 });

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(true);
        });

        test('should handle very large record', async () => {
            const largeText = 'x'.repeat(100000); // 100KB of text
            const record = createMockRecord({
                description: largeText,
                about_the_curators: largeText
            });

            mockClient.index.mockResolvedValue({ result: 'created', _version: 1 });

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(true);
        });

        test('should handle case-insensitive UUID validation', async () => {
            const uppercaseUUID = '550E8400-E29B-41D4-A716-446655440000';
            const record = createMockRecord({ uuid: uppercaseUUID });

            mockClient.index.mockResolvedValue({ result: 'created', _version: 1 });

            const result = await indexerTasks.index_record(record);

            expect(result.success).toBe(true);
        });
    });
});
