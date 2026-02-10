/**

 Copyright 2026 University of Denver

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 */

'use strict';

const LOGGER = require('../../libs/log4');

/**
 * Object contains tasks used to search repository records in Elasticsearch
 * @param {Object} CLIENT - Elasticsearch client instance
 * @param {string} INDEX - Elasticsearch index name
 * @type {Repo_service_tasks}
 */
const Repo_service_tasks = class {

    constructor(CLIENT, INDEX) {
        this.CLIENT = CLIENT;
        this.INDEX = INDEX;

        // Configuration constants
        this.INDEX_TIMEOUT = 30000;  // 30 seconds for index operations
        this.GET_TIMEOUT = 10000;    // 10 seconds for get operations
        this.SEARCH_TIMEOUT = 15000; // 15 seconds for search operations
        this.DEFAULT_SIZE = 25;      // Default number of results
        this.MAX_SIZE = 100;         // Maximum results per request

        // Define searchable fields based on index mappings
        // Fields are organized by priority/boost level
        this.SEARCH_FIELDS = {
            // Highest priority - primary title fields (boost: 4)
            primary: [
                'title^4',
                'title.keyword^5',
                'display_record.title^4',
                'display_record.title.keyword^5'
            ],
            // High priority - descriptive fields (boost: 3)
            descriptive: [
                'abstract^3',
                'display_record.abstract^3',
                'display_record.tableOfContents^2'
            ],
            // Medium priority - creator/contributor fields (boost: 2)
            creator: [
                'creator^2',
                'display_record.name.namePart^2',
                'display_record.names.title^2',
                'display_record.originInfo.publisher^2'
            ],
            // Medium priority - subject fields (boost: 2)
            subject: [
                'subject^2',
                'f_subjects^2',
                'display_record.genre^2',
                'display_record.subject.topic^2',
                'display_record.subject.geographic^2',
                'display_record.subject.name^2',
                'display_record.subject.city^2',
                'display_record.subject.country^2',
                'display_record.subject.region^2',
                'display_record.subject.occupation^2'
            ],
            // Standard priority - identifier fields (boost: 1.5)
            identifier: [
                'pid^1.5',
                'handle^1.5',
                'display_record.identifier^1.5',
                'display_record.classification^1.5'
            ],
            // Standard priority - notes and content (boost: 1)
            content: [
                'display_record.note',
                'display_record.notes.content',
                'display_record.parts.title',
                'display_record.parts.caption',
                'display_record.physicalDescription.form',
                'display_record.physicalDescription.extent',
                'display_record.extents',
                'display_record.originInfo.place',
                'display_record.language',
                'display_record.typeOfResource'
            ],
            // Lower priority - child record fields
            children: [
                'children.title',
                'children.description'
            ]
        };

        // Validate dependencies on construction
        this._validate_dependencies();

        // Log initialization
        LOGGER.module().info('INFO: [/media-library/tasks/repo_service_tasks] Repo Service initialized', {
            index: this.INDEX
        });
    }

    // ==================== VALIDATION HELPERS ====================

    /**
     * Validates constructor dependencies
     * @private
     */
    _validate_dependencies() {

        if (!this.CLIENT) {
            throw new Error('Valid Elasticsearch client is required');
        }

        if (!this.INDEX || typeof this.INDEX !== 'string') {
            throw new Error('Valid index name is required');
        }
    }

    /**
     * Wraps a promise with a timeout
     * @param {Promise} promise - Promise to wrap
     * @param {number} timeout_ms - Timeout in milliseconds
     * @returns {Promise} Wrapped promise with timeout
     * @private
     */
    _with_timeout(promise, timeout_ms) {
        return Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Operation timed out after ${timeout_ms}ms`)), timeout_ms)
            )
        ]);
    }

    /**
     * Handles error logging with context
     * @param {Error} error - Error to handle
     * @param {string} method_name - Name of the method where error occurred
     * @param {Object} context - Additional context for logging
     * @private
     */
    _handle_error(error, method_name, context = {}) {
        const error_context = {
            method: method_name,
            index: this.INDEX,
            ...context,
            timestamp: new Date().toISOString(),
            message: error.message,
            error_type: error.name
        };

        // Extract Elasticsearch-specific error details
        if (error.meta) {
            error_context.status_code = error.meta.statusCode;
            error_context.elasticsearch_error = error.meta.body?.error?.type;
            error_context.reason = error.meta.body?.error?.reason;
        }

        // Add stack trace in non-production environments
        if (process.env.NODE_ENV !== 'production') {
            error_context.stack = error.stack;
        }

        LOGGER.module().error(
            `ERROR: [/media-library/tasks/repo_service_tasks (${method_name})] Failed to ${method_name.replace(/_/g, ' ')}`,
            error_context
        );
    }

    /**
     * Logs successful operation
     * @param {string} message - Success message
     * @param {Object} context - Context for logging
     * @private
     */
    _log_success(message, context = {}) {
        LOGGER.module().info(message, {
            index: this.INDEX,
            ...context,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Gets all search fields as a flat array
     * @returns {Array} Array of all search fields with boosts
     * @private
     */
    _get_all_search_fields() {
        return [
            ...this.SEARCH_FIELDS.primary,
            ...this.SEARCH_FIELDS.descriptive,
            ...this.SEARCH_FIELDS.creator,
            ...this.SEARCH_FIELDS.subject,
            ...this.SEARCH_FIELDS.identifier,
            ...this.SEARCH_FIELDS.content,
            ...this.SEARCH_FIELDS.children
        ];
    }

    /**
     * Builds Elasticsearch search query based on index mappings
     * @param {string} term - Search term
     * @returns {Object} Elasticsearch query object
     * @private
     */
    _build_search_query(term) {
        return {
            bool: {
                should: [
                    // Multi-match query across all mapped fields
                    {
                        multi_match: {
                            query: term,
                            fields: this._get_all_search_fields(),
                            type: 'best_fields',
                            fuzziness: 'AUTO',
                            prefix_length: 2,
                            operator: 'or'
                        }
                    },
                    // Cross-field matching for multi-word queries
                    {
                        multi_match: {
                            query: term,
                            fields: this._get_all_search_fields(),
                            type: 'cross_fields',
                            operator: 'and'
                        }
                    },
                    // Phrase prefix matching for title fields (autocomplete-style)
                    {
                        multi_match: {
                            query: term,
                            fields: [
                                'title^3',
                                'display_record.title^3',
                                'abstract^2',
                                'display_record.abstract^2'
                            ],
                            type: 'phrase_prefix',
                            boost: 2
                        }
                    }
                ],
                minimum_should_match: 1
            }
        };
    }

    /**
     * Builds highlight configuration based on search fields
     * @returns {Object} Elasticsearch highlight configuration
     * @private
     */
    _build_highlight_config() {
        return {
            fields: {
                'title': { number_of_fragments: 0 },
                'display_record.title': { number_of_fragments: 0 },
                'abstract': { number_of_fragments: 2, fragment_size: 150 },
                'display_record.abstract': { number_of_fragments: 2, fragment_size: 150 },
                'creator': { number_of_fragments: 0 },
                'display_record.name.namePart': { number_of_fragments: 0 },
                'subject': { number_of_fragments: 0 },
                'f_subjects': { number_of_fragments: 0 },
                'display_record.subject.topic': { number_of_fragments: 0 },
                'display_record.note': { number_of_fragments: 2, fragment_size: 150 },
                'display_record.notes.content': { number_of_fragments: 2, fragment_size: 150 },
                'children.title': { number_of_fragments: 0 },
                'children.description': { number_of_fragments: 2, fragment_size: 150 }
            },
            pre_tags: ['<em>'],
            post_tags: ['</em>']
        };
    }

    /**
     * Transforms Elasticsearch hits to standardized records
     * @param {Array} hits - Elasticsearch hits array
     * @returns {Array} Transformed records
     * @private
     */
    _transform_hits(hits) {
        return hits.map(hit => {
            const source = hit._source || {};
            const display_record = source.display_record || {};

            return {
                uuid: hit._id,
                pid: source.pid || null,
                score: hit._score,
                title: source.title || display_record.title || 'Untitled',
                abstract: source.abstract || display_record.abstract || '',
                creator: source.creator || null,
                subject: source.subject || source.f_subjects || null,
                thumbnail: source.thumbnail || null,
                object_type: source.object_type || null,
                mime_type: source.mime_type || null,
                handle: source.handle || null,
                type: source.type || null,
                is_member_of_collection: source.is_member_of_collection || null,
                created: source.created || null,
                // Include display_record for complete metadata access
                display_record: display_record,
                // Include children summary if present
                has_children: Array.isArray(source.children) && source.children.length > 0,
                children_count: Array.isArray(source.children) ? source.children.length : 0
            };
        });
    }

    // ==================== PUBLIC METHODS ====================

    /**
     * Searches records by term in the index
     * @param {string} term - Search term
     * @param {Object} [options={}] - Search options
     * @param {number} [options.size] - Number of results to return
     * @param {number} [options.from=0] - Starting offset for pagination
     * @param {string} [options.sort_field] - Field to sort by
     * @param {string} [options.sort_order='desc'] - Sort order (asc/desc)
     * @returns {Promise<Object>} Result object with search results
     */
    async search(term, options = {}) {

        try {

            // Validate term
            if (!term || typeof term !== 'string') {
                return {
                    success: false,
                    message: 'Valid search term is required',
                    records: [],
                    total: 0
                };
            }

            const trimmed_term = term.trim();

            if (trimmed_term.length === 0) {
                return {
                    success: false,
                    message: 'Search term cannot be empty',
                    records: [],
                    total: 0
                };
            }

            // Prepare search options with defaults
            const size = Math.min(
                Math.max(1, parseInt(options.size, 10) || this.DEFAULT_SIZE),
                this.MAX_SIZE
            );
            const from = Math.max(0, parseInt(options.from, 10) || 0);

            // Build search request
            const search_request = {
                index: this.INDEX,
                body: {
                    query: this._build_search_query(trimmed_term),
                    size: size,
                    from: from,
                    _source: true,
                    track_total_hits: true,
                    highlight: this._build_highlight_config()
                }
            };

            // Add sorting if specified
            if (options.sort_field) {
                search_request.body.sort = [
                    { [options.sort_field]: { order: options.sort_order || 'desc' } },
                    '_score'
                ];
            } else {
                // Default sort by relevance score
                search_request.body.sort = ['_score'];
            }

            LOGGER.module().info(`INFO: [/media-library/tasks/repo_service_tasks (search)] Executing search for: "${trimmed_term}"`, {
                size: size,
                from: from
            });

            // Perform search operation with timeout protection
            const response = await this._with_timeout(
                this.CLIENT.search(search_request),
                this.SEARCH_TIMEOUT
            );

            // Validate response
            if (!response || !response.hits) {
                return {
                    success: false,
                    message: 'Empty response from Elasticsearch',
                    records: [],
                    total: 0
                };
            }

            // Extract total count (handle both ES 7.x and 8.x formats)
            const total = typeof response.hits.total === 'object'
                ? response.hits.total.value
                : response.hits.total;

            // Transform hits to standardized records
            const records = this._transform_hits(response.hits.hits);

            // Add highlight information if available
            records.forEach((record, index) => {
                const hit = response.hits.hits[index];
                if (hit.highlight) {
                    record.highlight = hit.highlight;
                }
            });

            this._log_success('INFO: [/media-library/tasks/repo_service_tasks (search)] Search completed successfully', {
                term: trimmed_term,
                total: total,
                returned: records.length
            });

            return {
                success: true,
                message: `Found ${total} result(s)`,
                records: records,
                total: total,
                size: size,
                from: from
            };

        } catch (error) {

            // Handle index not found
            if (error.meta?.statusCode === 404) {
                LOGGER.module().warn(`WARNING: [/media-library/tasks/repo_service_tasks (search)] Index not found: ${this.INDEX}`);

                return {
                    success: false,
                    message: 'Search index not found',
                    records: [],
                    total: 0
                };
            }

            // Handle search parse errors (bad query)
            if (error.meta?.body?.error?.type === 'search_phase_execution_exception') {
                LOGGER.module().warn(`WARNING: [/media-library/tasks/repo_service_tasks (search)] Search query error`, {
                    term: term,
                    reason: error.meta.body.error.reason
                });

                return {
                    success: false,
                    message: 'Invalid search query',
                    records: [],
                    total: 0
                };
            }

            this._handle_error(error, 'search', { term });

            return {
                success: false,
                message: 'Search operation failed: ' + error.message,
                records: [],
                total: 0,
                error_type: error.name,
                status_code: error.meta?.statusCode
            };
        }
    }

    /**
     * Retrieves a single record by UUID from the index
     * @param {string} uuid - Record UUID
     * @param {Object} [options={}] - Get options
     * @returns {Promise<Object>} Result object with found status and document
     */
    async get_by_uuid(uuid, options = {}) {

        try {

            if (!uuid || typeof uuid !== 'string') {
                return {
                    success: false,
                    found: false,
                    message: 'Valid UUID is required'
                };
            }

            const uuid_trimmed = uuid.trim();

            // Prepare get options
            const get_options = {
                index: this.INDEX,
                id: uuid_trimmed
            };

            // Perform get operation with timeout protection
            const response = await this._with_timeout(
                this.CLIENT.get(get_options),
                this.GET_TIMEOUT
            );

            // Validate response
            if (!response) {
                return {
                    success: false,
                    found: false,
                    uuid: uuid_trimmed,
                    index: this.INDEX,
                    message: 'Empty response from Elasticsearch'
                };
            }

            if (response.found === true) {
                this._log_success('INFO: [/media-library/tasks/repo_service_tasks (get_by_uuid)] Record retrieved successfully', {
                    uuid: uuid_trimmed,
                    version: response._version
                });

                return {
                    success: true,
                    found: true,
                    source: response._source,
                    version: response._version,
                    index: response._index
                };
            }

            return {
                success: false,
                found: false,
                uuid: uuid_trimmed,
                index: this.INDEX,
                message: 'No results found'
            };

        } catch (error) {

            // Handle 404 errors gracefully (record not found)
            if (error.meta?.statusCode === 404) {
                LOGGER.module().info('INFO: [/media-library/tasks/repo_service_tasks (get_by_uuid)] Record not found in index', {
                    uuid: uuid,
                    index: this.INDEX
                });

                return {
                    success: false,
                    found: false,
                    uuid: uuid,
                    index: this.INDEX,
                    message: 'Record not found'
                };
            }

            this._handle_error(error, 'get_by_uuid', { uuid });

            return {
                success: false,
                found: false,
                uuid: uuid,
                index: this.INDEX,
                error: error.message,
                error_type: error.name,
                status_code: error.meta?.statusCode
            };
        }
    }

    /**
     * Retrieves all unique subjects from display_record.subjects across all documents,
     * grouped by term type (geographic, topical, genre_form, temporal, etc.)
     * Uses scroll API to paginate through all documents with subjects and extracts/deduplicates
     * terms in a single pass
     * @returns {Promise<Object>} Result object with subjects grouped by type
     */
    async get_subjects() {

        try {

            const subjects_by_type = {};
            const SCROLL_DURATION = '30s';
            const SCROLL_SIZE = 1000;

            // Initial search - get all documents that have subjects with terms
            // Note: display_record.subjects is not mapped as nested, so we fetch source
            // and filter/group in application code for accurate term-type correlation
            const initial_response = await this._with_timeout(
                this.CLIENT.search({
                    index: this.INDEX,
                    scroll: SCROLL_DURATION,
                    size: SCROLL_SIZE,
                    body: {
                        query: {
                            exists: {
                                field: 'display_record.subjects.terms.type'
                            }
                        },
                        _source: ['display_record.subjects']
                    }
                }),
                this.SEARCH_TIMEOUT
            );

            if (!initial_response || !initial_response.hits) {
                return {
                    success: false,
                    message: 'Empty response from Elasticsearch',
                    subjects: {},
                    total: 0
                };
            }

            // Process initial batch
            this._extract_subjects(initial_response.hits.hits, subjects_by_type);

            let scroll_id = initial_response._scroll_id;
            let hits = initial_response.hits.hits;

            // Continue scrolling until no more results
            while (hits.length > 0) {

                const scroll_response = await this._with_timeout(
                    this.CLIENT.scroll({
                        scroll_id: scroll_id,
                        scroll: SCROLL_DURATION
                    }),
                    this.SEARCH_TIMEOUT
                );

                hits = scroll_response.hits.hits;

                if (hits.length > 0) {
                    this._extract_subjects(hits, subjects_by_type);
                }

                scroll_id = scroll_response._scroll_id;
            }

            // Clear scroll context
            if (scroll_id) {
                try {
                    await this.CLIENT.clearScroll({ scroll_id: scroll_id });
                } catch (clear_error) {
                    LOGGER.module().warn(`WARNING: [/media-library/tasks/repo_service_tasks (get_subjects)] Failed to clear scroll: ${clear_error.message}`);
                }
            }

            // Convert each type's Map to a sorted array and calculate totals
            const grouped_subjects = {};
            let total = 0;

            for (const [type, type_map] of Object.entries(subjects_by_type)) {
                grouped_subjects[type] = Array.from(type_map.values())
                    .sort((a, b) => a.term.localeCompare(b.term));
                total += grouped_subjects[type].length;
            }

            this._log_success('INFO: [/media-library/tasks/repo_service_tasks (get_subjects)] Subjects retrieved successfully', {
                types: Object.keys(grouped_subjects),
                total: total
            });

            return {
                success: true,
                message: `Found ${total} unique subject(s) across ${Object.keys(grouped_subjects).length} type(s)`,
                subjects: grouped_subjects,
                total: total
            };

        } catch (error) {

            if (error.meta?.statusCode === 404) {
                LOGGER.module().warn(`WARNING: [/media-library/tasks/repo_service_tasks (get_subjects)] Index not found: ${this.INDEX}`);

                return {
                    success: false,
                    message: 'Search index not found',
                    subjects: {},
                    total: 0
                };
            }

            this._handle_error(error, 'get_subjects');

            return {
                success: false,
                message: 'Failed to retrieve subjects: ' + error.message,
                subjects: {},
                total: 0
            };
        }
    }

    /**
     * Extracts subjects from Elasticsearch hits, groups them by type, and deduplicates
     * Each type gets its own Map keyed by lowercase term for deduplication, preserving
     * original casing from the first occurrence
     * @param {Array} hits - Elasticsearch hits array
     * @param {Object} subjects_by_type - Object of Maps, keyed by subject type (e.g., 'geographic', 'topical')
     * @private
     */
    _extract_subjects(hits, subjects_by_type) {

        for (const hit of hits) {

            const source = hit._source || {};
            const subjects = source.display_record?.subjects;

            if (!Array.isArray(subjects)) {
                continue;
            }

            for (const subject of subjects) {

                if (!Array.isArray(subject.terms)) {
                    continue;
                }

                for (const term_entry of subject.terms) {

                    if (!term_entry.type || !term_entry.term) {
                        continue;
                    }

                    const type = term_entry.type.trim().toLowerCase();
                    const dedup_key = term_entry.term.toLowerCase().trim();

                    // Initialize Map for this type if not yet created
                    if (!subjects_by_type[type]) {
                        subjects_by_type[type] = new Map();
                    }

                    if (!subjects_by_type[type].has(dedup_key)) {
                        subjects_by_type[type].set(dedup_key, {
                            term: term_entry.term.trim(),
                            authority: subject.authority || null,
                            authority_id: subject.authority_id || null,
                            title: subject.title || term_entry.term.trim()
                        });
                    }
                }
            }
        }
    }

    /**
     * Retrieves all unique resource_type values from display_record across all documents
     * Uses scroll API to paginate through all documents with a resource_type field,
     * collecting and deduplicating values in a single pass
     * @returns {Promise<Object>} Result object with unique resource types
     */
    async get_resource_types() {

        try {

            const resource_types = new Map();
            const SCROLL_DURATION = '30s';
            const SCROLL_SIZE = 1000;

            // Initial search - get all documents that have a resource_type value
            const initial_response = await this._with_timeout(
                this.CLIENT.search({
                    index: this.INDEX,
                    scroll: SCROLL_DURATION,
                    size: SCROLL_SIZE,
                    body: {
                        query: {
                            exists: {
                                field: 'display_record.resource_type'
                            }
                        },
                        _source: ['display_record.resource_type']
                    }
                }),
                this.SEARCH_TIMEOUT
            );

            if (!initial_response || !initial_response.hits) {
                return {
                    success: false,
                    message: 'Empty response from Elasticsearch',
                    resource_types: [],
                    total: 0
                };
            }

            // Process initial batch
            this._extract_resource_types(initial_response.hits.hits, resource_types);

            let scroll_id = initial_response._scroll_id;
            let hits = initial_response.hits.hits;

            // Continue scrolling until no more results
            while (hits.length > 0) {

                const scroll_response = await this._with_timeout(
                    this.CLIENT.scroll({
                        scroll_id: scroll_id,
                        scroll: SCROLL_DURATION
                    }),
                    this.SEARCH_TIMEOUT
                );

                hits = scroll_response.hits.hits;

                if (hits.length > 0) {
                    this._extract_resource_types(hits, resource_types);
                }

                scroll_id = scroll_response._scroll_id;
            }

            // Clear scroll context
            if (scroll_id) {
                try {
                    await this.CLIENT.clearScroll({ scroll_id: scroll_id });
                } catch (clear_error) {
                    LOGGER.module().warn(`WARNING: [/media-library/tasks/repo_service_tasks (get_resource_types)] Failed to clear scroll: ${clear_error.message}`);
                }
            }

            // Convert Map to sorted array
            const types = Array.from(resource_types.values())
                .sort((a, b) => a.resource_type.localeCompare(b.resource_type));

            this._log_success('INFO: [/media-library/tasks/repo_service_tasks (get_resource_types)] Resource types retrieved successfully', {
                total: types.length
            });

            return {
                success: true,
                message: `Found ${types.length} unique resource type(s)`,
                resource_types: types,
                total: types.length
            };

        } catch (error) {

            if (error.meta?.statusCode === 404) {
                LOGGER.module().warn(`WARNING: [/media-library/tasks/repo_service_tasks (get_resource_types)] Index not found: ${this.INDEX}`);

                return {
                    success: false,
                    message: 'Search index not found',
                    resource_types: [],
                    total: 0
                };
            }

            this._handle_error(error, 'get_resource_types');

            return {
                success: false,
                message: 'Failed to retrieve resource types: ' + error.message,
                resource_types: [],
                total: 0
            };
        }
    }

    /**
     * Extracts resource_type values from Elasticsearch hits and adds them to the resource_types Map
     * Deduplicates by lowercase value, preserving the original casing from the first occurrence
     * @param {Array} hits - Elasticsearch hits array
     * @param {Map} resource_types - Map to collect unique resource types (keyed by lowercase value)
     * @private
     */
    _extract_resource_types(hits, resource_types) {

        for (const hit of hits) {

            const source = hit._source || {};
            const resource_type = source.display_record?.resource_type;

            if (!resource_type || typeof resource_type !== 'string') {
                continue;
            }

            const dedup_key = resource_type.toLowerCase().trim();

            if (dedup_key.length > 0 && !resource_types.has(dedup_key)) {
                resource_types.set(dedup_key, {
                    resource_type: resource_type.trim()
                });
            }
        }
    }
};

module.exports = Repo_service_tasks;
