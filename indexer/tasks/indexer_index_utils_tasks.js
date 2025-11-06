'use strict';

const FS = require('fs').promises; // Use promises API for async operations
const FS_SYNC = require('fs'); // Keep sync for validation only
const PATH = require('path');
const LOGGER = require('../../libs/log4');

/**
 * Object contains tasks used to create and manage Elasticsearch indices
 * @param {string} INDEX_NAME - Name of the Elasticsearch index
 * @param {Object} CLIENT - Elasticsearch client instance
 * @param {Object} CONFIG - Index configuration object
 * @type {Indexer_index_utils_tasks}
 */
const Indexer_index_utils_tasks = class {

    constructor(INDEX_NAME, CLIENT, CONFIG) {
        this.INDEX_NAME = INDEX_NAME;
        this.CLIENT = CLIENT;
        this.CONFIG = CONFIG;

        // Configuration constants
        this.MAPPINGS_PATH = PATH.resolve(__dirname, '../../indexer/mappings.json');
        this.OPERATION_TIMEOUT = 30000; // 30 seconds
        this.INDEX_CHECK_TIMEOUT = 5000; // 5 seconds for index checks

        // Cache for mappings (loaded once, reused)
        this._mappings_cache = null;

        // Validate dependencies on construction
        this._validate_dependencies();
    }

    // ==================== VALIDATION HELPERS ====================

    /**
     * Validates constructor dependencies
     * @private
     */
    _validate_dependencies() {
        if (!this.INDEX_NAME || typeof this.INDEX_NAME !== 'string' || !this.INDEX_NAME.trim()) {
            throw new Error('Valid index name is required');
        }

        if (!this.CLIENT) {
            throw new Error('Valid Elasticsearch client is required');
        }

        if (!this.CLIENT.indices) {
            throw new Error('Elasticsearch client must have indices API');
        }

        if (!this.CONFIG || typeof this.CONFIG !== 'object') {
            throw new Error('Valid configuration object is required');
        }

        // Validate required config properties
        if (typeof this.CONFIG.number_of_shards !== 'number' || this.CONFIG.number_of_shards < 1) {
            throw new Error('CONFIG.number_of_shards must be a positive number');
        }

        if (typeof this.CONFIG.number_of_replicas !== 'number' || this.CONFIG.number_of_replicas < 0) {
            throw new Error('CONFIG.number_of_replicas must be a non-negative number');
        }

        // Validate index name format (Elasticsearch index naming rules)
        this._validate_index_name(this.INDEX_NAME);
    }

    /**
     * Validates index name format according to Elasticsearch rules
     * @param {string} index_name - Index name to validate
     * @private
     */
    _validate_index_name(index_name) {
        const trimmed_name = index_name.trim().toLowerCase();

        // Elasticsearch index naming rules
        if (trimmed_name.length === 0) {
            throw new Error('Index name cannot be empty');
        }

        if (trimmed_name.length > 255) {
            throw new Error('Index name cannot be longer than 255 characters');
        }

        // Cannot start with -, _, +
        if (/^[-_+]/.test(trimmed_name)) {
            throw new Error('Index name cannot start with -, _, or +');
        }

        // Cannot be . or ..
        if (trimmed_name === '.' || trimmed_name === '..') {
            throw new Error('Index name cannot be . or ..');
        }

        // Can only contain lowercase letters, numbers, -, _, and .
        if (!/^[a-z0-9._-]+$/.test(trimmed_name)) {
            throw new Error('Index name can only contain lowercase letters, numbers, -, _, and .');
        }

        // Cannot contain :, ", *, +, /, \, |, ?, #, >,
        if (/[:"\*+\/\\|?#><\s]/.test(trimmed_name)) {
            throw new Error('Index name contains invalid characters');
        }
    }

    /**
     * Wraps an Elasticsearch operation with timeout protection
     * @param {Promise} operation - Elasticsearch operation promise
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise} Operation result or timeout error
     * @private
     */
    async _with_timeout(operation, timeout) {
        return Promise.race([
            operation,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Elasticsearch operation timeout')), timeout)
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
            index: this.INDEX_NAME,
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
            `ERROR: [/indexer/indexer_index_utils_tasks (${method_name})] Failed to ${method_name.replace(/_/g, ' ')}`,
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
            index: this.INDEX_NAME,
            ...context,
            timestamp: new Date().toISOString()
        });
    }

    // ==================== MAPPINGS MANAGEMENT ====================

    /**
     * Gets field mappings from file (with caching)
     * @param {boolean} [force_reload=false] - Force reload from file
     * @returns {Promise<Object>} Mappings object
     */
    async get_mappings(force_reload = false) {
        try {
            // Return cached mappings if available and not forcing reload
            if (this._mappings_cache && !force_reload) {
                return this._mappings_cache;
            }

            // Validate file exists and is readable
            try {
                await FS.access(this.MAPPINGS_PATH, FS_SYNC.constants.R_OK);
            } catch (access_error) {
                throw new Error(`Mappings file not accessible: ${this.MAPPINGS_PATH}`);
            }

            // Read file asynchronously
            const file_content = await FS.readFile(this.MAPPINGS_PATH, 'utf8');

            // Validate file is not empty
            if (!file_content || file_content.trim().length === 0) {
                throw new Error('Mappings file is empty');
            }

            // Parse JSON with error handling
            let mappings_obj;
            try {
                mappings_obj = JSON.parse(file_content);
            } catch (parse_error) {
                throw new Error(`Invalid JSON in mappings file: ${parse_error.message}`);
            }

            // Validate mappings structure
            if (!mappings_obj || typeof mappings_obj !== 'object') {
                throw new Error('Mappings must be a valid object');
            }

            if (Object.keys(mappings_obj).length === 0) {
                throw new Error('Mappings object is empty');
            }

            // Cache the mappings
            this._mappings_cache = mappings_obj;

            this._log_success('Mappings loaded successfully', {
                path: this.MAPPINGS_PATH,
                field_count: Object.keys(mappings_obj).length,
                cached: true
            });

            return mappings_obj;

        } catch (error) {
            this._handle_error(error, 'get_mappings', {
                path: this.MAPPINGS_PATH,
                force_reload
            });
            throw error;
        }
    }

    /**
     * Validates mappings file exists synchronously (for quick checks)
     * @returns {boolean} True if file exists and is readable
     */
    validate_mappings_file() {
        try {
            FS_SYNC.accessSync(this.MAPPINGS_PATH, FS_SYNC.constants.R_OK);
            return true;
        } catch (error) {
            LOGGER.module().error('Mappings file validation failed', {
                path: this.MAPPINGS_PATH,
                error: error.message
            });
            return false;
        }
    }

    // ==================== INDEX OPERATIONS ====================

    /**
     * Checks if index exists
     * @param {Object} [options={}] - Check options
     * @param {string} [options.timeout='5s'] - Request timeout
     * @returns {Promise<Object>} Result object with exists status
     */
    async check_index(options = {}) {
        try {
            const check_options = {
                index: this.INDEX_NAME,
                timeout: options.timeout || '5s'
            };

            const response = await this._with_timeout(
                this.CLIENT.indices.exists(check_options),
                this.INDEX_CHECK_TIMEOUT
            );

            // Elasticsearch exists API returns boolean or response object
            const exists = response === true || response.statusCode === 200 || response.body === true;

            if (exists) {
                this._log_success('Index exists', {
                    index: this.INDEX_NAME
                });

                return {
                    success: true,
                    exists: true,
                    index: this.INDEX_NAME,
                    message: 'Index exists'
                };
            }

            LOGGER.module().info('Index does not exist', {
                index: this.INDEX_NAME
            });

            return {
                success: true,
                exists: false,
                index: this.INDEX_NAME,
                message: 'Index does not exist'
            };

        } catch (error) {
            // 404 means index doesn't exist (not an error condition)
            if (error.meta?.statusCode === 404) {
                return {
                    success: true,
                    exists: false,
                    index: this.INDEX_NAME,
                    message: 'Index does not exist'
                };
            }

            this._handle_error(error, 'check_index');

            return {
                success: false,
                exists: false,
                index: this.INDEX_NAME,
                error: error.message,
                error_type: error.name,
                status_code: error.meta?.statusCode
            };
        }
    }

    /**
     * Creates Elasticsearch index with settings
     * @param {Object} [options={}] - Create options
     * @param {Object} [options.settings] - Additional index settings
     * @param {string} [options.timeout='30s'] - Request timeout
     * @returns {Promise<Object>} Result object with creation status
     */
    async create_index(options = {}) {
        try {
            // Build index settings
            const index_settings = {
                index: {
                    number_of_shards: this.CONFIG.number_of_shards,
                    number_of_replicas: this.CONFIG.number_of_replicas,
                    ...options.settings // Allow additional settings
                }
            };

            const create_options = {
                index: this.INDEX_NAME,
                body: {
                    settings: index_settings
                },
                timeout: options.timeout || '30s'
            };

            const response = await this._with_timeout(
                this.CLIENT.indices.create(create_options),
                this.OPERATION_TIMEOUT
            );

            // Validate response
            if (!response) {
                throw new Error('Empty response from Elasticsearch');
            }

            if (response.acknowledged === true && response.shards_acknowledged === true) {
                this._log_success('Index created successfully', {
                    index: this.INDEX_NAME,
                    shards: this.CONFIG.number_of_shards,
                    replicas: this.CONFIG.number_of_replicas,
                    shards_acknowledged: response.shards_acknowledged
                });

                return {
                    success: true,
                    acknowledged: response.acknowledged,
                    shards_acknowledged: response.shards_acknowledged,
                    index: response.index || this.INDEX_NAME,
                    message: 'Index created successfully'
                };
            }

            // Partial success (acknowledged but shards not acknowledged)
            LOGGER.module().warn('Index created with warnings', {
                index: this.INDEX_NAME,
                acknowledged: response.acknowledged,
                shards_acknowledged: response.shards_acknowledged
            });

            return {
                success: false,
                acknowledged: response.acknowledged,
                shards_acknowledged: response.shards_acknowledged,
                index: this.INDEX_NAME,
                message: 'Index created but shards not fully acknowledged'
            };

        } catch (error) {
            // Handle "index already exists" error
            if (error.meta?.body?.error?.type === 'resource_already_exists_exception') {
                LOGGER.module().warn('Index already exists', {
                    index: this.INDEX_NAME
                });

                return {
                    success: false,
                    already_exists: true,
                    index: this.INDEX_NAME,
                    message: 'Index already exists'
                };
            }

            this._handle_error(error, 'create_index');

            return {
                success: false,
                index: this.INDEX_NAME,
                error: error.message,
                error_type: error.name,
                status_code: error.meta?.statusCode
            };
        }
    }

    /**
     * Creates Elasticsearch index mappings
     * @param {Object} [options={}] - Mapping options
     * @param {Object} [options.mappings] - Custom mappings (overrides file)
     * @param {string} [options.timeout='30s'] - Request timeout
     * @returns {Promise<Object>} Result object with mapping creation status
     */
    async create_mappings(options = {}) {
        try {
            // Get mappings from file or use provided mappings
            let mappings_obj;
            if (options.mappings) {
                mappings_obj = options.mappings;
            } else {
                mappings_obj = await this.get_mappings();
            }

            // Validate mappings object
            if (!mappings_obj || typeof mappings_obj !== 'object' || Object.keys(mappings_obj).length === 0) {
                throw new Error('Invalid or empty mappings object');
            }

            const body = {
                properties: mappings_obj
            };

            const mapping_options = {
                index: this.INDEX_NAME,
                body: body,
                timeout: options.timeout || '30s'
            };

            const response = await this._with_timeout(
                this.CLIENT.indices.putMapping(mapping_options),
                this.OPERATION_TIMEOUT
            );

            // Validate response
            if (!response) {
                throw new Error('Empty response from Elasticsearch');
            }

            if (response.acknowledged === true) {
                this._log_success('Mappings created successfully', {
                    index: this.INDEX_NAME,
                    field_count: Object.keys(mappings_obj).length
                });

                return {
                    success: true,
                    acknowledged: response.acknowledged,
                    index: this.INDEX_NAME,
                    field_count: Object.keys(mappings_obj).length,
                    message: 'Mappings created successfully'
                };
            }

            // Acknowledged but false
            LOGGER.module().warn('Mappings creation not acknowledged', {
                index: this.INDEX_NAME,
                acknowledged: response.acknowledged
            });

            return {
                success: false,
                acknowledged: response.acknowledged,
                index: this.INDEX_NAME,
                message: 'Mappings creation not acknowledged'
            };

        } catch (error) {
            this._handle_error(error, 'create_mappings');

            return {
                success: false,
                index: this.INDEX_NAME,
                error: error.message,
                error_type: error.name,
                status_code: error.meta?.statusCode
            };
        }
    }

    /**
     * Deletes the index
     * @param {Object} [options={}] - Delete options
     * @param {string} [options.timeout='30s'] - Request timeout
     * @returns {Promise<Object>} Result object with deletion status
     */
    async delete_index(options = {}) {
        try {
            const delete_options = {
                index: this.INDEX_NAME,
                timeout: options.timeout || '30s'
            };

            const response = await this._with_timeout(
                this.CLIENT.indices.delete(delete_options),
                this.OPERATION_TIMEOUT
            );

            // Validate response
            if (!response) {
                throw new Error('Empty response from Elasticsearch');
            }

            // Check for successful deletion (statusCode 200 or acknowledged true)
            const is_success = response.statusCode === 200 || response.acknowledged === true;

            if (is_success) {
                this._log_success('Index deleted successfully', {
                    index: this.INDEX_NAME,
                    acknowledged: response.acknowledged
                });

                return {
                    success: true,
                    acknowledged: response.acknowledged,
                    index: this.INDEX_NAME,
                    message: 'Index deleted successfully'
                };
            }

            // Unexpected response
            return {
                success: false,
                index: this.INDEX_NAME,
                message: 'Unexpected delete response',
                response
            };

        } catch (error) {
            // Handle 404 (index doesn't exist)
            if (error.meta?.statusCode === 404) {
                LOGGER.module().warn('Index does not exist for deletion', {
                    index: this.INDEX_NAME
                });

                return {
                    success: false,
                    not_found: true,
                    index: this.INDEX_NAME,
                    message: 'Index does not exist'
                };
            }

            this._handle_error(error, 'delete_index');

            return {
                success: false,
                index: this.INDEX_NAME,
                error: error.message,
                error_type: error.name,
                status_code: error.meta?.statusCode
            };
        }
    }

    /**
     * Gets index settings
     * @param {Object} [options={}] - Get options
     * @returns {Promise<Object>} Result object with settings
     */
    async get_index_settings(options = {}) {
        try {
            const get_options = {
                index: this.INDEX_NAME,
                timeout: options.timeout || '5s'
            };

            const response = await this._with_timeout(
                this.CLIENT.indices.getSettings(get_options),
                this.INDEX_CHECK_TIMEOUT
            );

            if (!response || !response[this.INDEX_NAME]) {
                throw new Error('Invalid settings response');
            }

            const settings = response[this.INDEX_NAME].settings;

            this._log_success('Index settings retrieved', {
                index: this.INDEX_NAME
            });

            return {
                success: true,
                index: this.INDEX_NAME,
                settings: settings,
                message: 'Settings retrieved successfully'
            };

        } catch (error) {
            this._handle_error(error, 'get_index_settings');

            return {
                success: false,
                index: this.INDEX_NAME,
                error: error.message,
                error_type: error.name
            };
        }
    }

    /**
     * Gets index mapping
     * @param {Object} [options={}] - Get options
     * @returns {Promise<Object>} Result object with mapping
     */
    async get_index_mapping(options = {}) {
        try {
            const get_options = {
                index: this.INDEX_NAME,
                timeout: options.timeout || '5s'
            };

            const response = await this._with_timeout(
                this.CLIENT.indices.getMapping(get_options),
                this.INDEX_CHECK_TIMEOUT
            );

            if (!response || !response[this.INDEX_NAME]) {
                throw new Error('Invalid mapping response');
            }

            const mappings = response[this.INDEX_NAME].mappings;

            this._log_success('Index mappings retrieved', {
                index: this.INDEX_NAME
            });

            return {
                success: true,
                index: this.INDEX_NAME,
                mappings: mappings,
                message: 'Mappings retrieved successfully'
            };

        } catch (error) {
            this._handle_error(error, 'get_index_mapping');

            return {
                success: false,
                index: this.INDEX_NAME,
                error: error.message,
                error_type: error.name
            };
        }
    }

    /**
     * Refreshes the index
     * @param {Object} [options={}] - Refresh options
     * @returns {Promise<Object>} Result object with refresh status
     */
    async refresh_index(options = {}) {
        try {
            const refresh_options = {
                index: this.INDEX_NAME,
                timeout: options.timeout || '30s'
            };

            const response = await this._with_timeout(
                this.CLIENT.indices.refresh(refresh_options),
                this.OPERATION_TIMEOUT
            );

            this._log_success('Index refreshed successfully', {
                index: this.INDEX_NAME,
                shards: response._shards
            });

            return {
                success: true,
                index: this.INDEX_NAME,
                shards: response._shards,
                message: 'Index refreshed successfully'
            };

        } catch (error) {
            this._handle_error(error, 'refresh_index');

            return {
                success: false,
                index: this.INDEX_NAME,
                error: error.message,
                error_type: error.name
            };
        }
    }

    /**
     * Complete index setup (create index + mappings)
     * @param {Object} [options={}] - Setup options
     * @returns {Promise<Object>} Result object with setup status
     */
    async setup_index(options = {}) {
        try {
            // Check if index already exists
            const check_result = await this.check_index();

            if (check_result.exists) {
                return {
                    success: false,
                    already_exists: true,
                    index: this.INDEX_NAME,
                    message: 'Index already exists'
                };
            }

            // Create index
            const create_result = await this.create_index(options);

            if (!create_result.success) {
                return {
                    success: false,
                    index: this.INDEX_NAME,
                    step: 'create_index',
                    error: create_result.error || 'Failed to create index',
                    message: 'Index creation failed'
                };
            }

            // Create mappings
            const mapping_result = await this.create_mappings(options);

            if (!mapping_result.success) {
                // Clean up - delete the index since mappings failed
                await this.delete_index();

                return {
                    success: false,
                    index: this.INDEX_NAME,
                    step: 'create_mappings',
                    error: mapping_result.error || 'Failed to create mappings',
                    message: 'Mapping creation failed, index rolled back'
                };
            }

            this._log_success('Index setup completed successfully', {
                index: this.INDEX_NAME,
                field_count: mapping_result.field_count
            });

            return {
                success: true,
                index: this.INDEX_NAME,
                create_result,
                mapping_result,
                message: 'Index setup completed successfully'
            };

        } catch (error) {
            this._handle_error(error, 'setup_index');

            return {
                success: false,
                index: this.INDEX_NAME,
                error: error.message,
                error_type: error.name
            };
        }
    }

    /**
     * Recreates index (delete + create + mappings)
     * WARNING: This deletes all data in the index
     * @param {Object} [options={}] - Recreate options
     * @returns {Promise<Object>} Result object with recreate status
     */
    async recreate_index(options = {}) {
        try {
            // Check if index exists
            const check_result = await this.check_index();

            if (check_result.exists) {
                // Delete existing index
                const delete_result = await this.delete_index();

                if (!delete_result.success && !delete_result.not_found) {
                    return {
                        success: false,
                        index: this.INDEX_NAME,
                        step: 'delete_index',
                        error: delete_result.error || 'Failed to delete existing index',
                        message: 'Index deletion failed'
                    };
                }
            }

            // Setup new index
            return await this.setup_index(options);

        } catch (error) {
            this._handle_error(error, 'recreate_index');

            return {
                success: false,
                index: this.INDEX_NAME,
                error: error.message,
                error_type: error.name
            };
        }
    }
};

module.exports = Indexer_index_utils_tasks;