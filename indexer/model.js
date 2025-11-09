/**

 Copyright 2023 University of Denver

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

const {Client} = require('@elastic/elasticsearch');
const ES_CONFIG = require('../config/elasticsearch_config')();
const DB = require('../config/db_config')();
const EXHIBIT_RECORD_TASKS = require('../exhibits/tasks/exhibit_record_tasks');
const EXHIBIT_ITEM_RECORD_TASKS = require('../exhibits/tasks/exhibit_item_record_tasks');
const EXHIBIT_HEADING_RECORD_TASKS = require('../exhibits/tasks/exhibit_heading_record_tasks');
const EXHIBIT_GRID_RECORD_TASKS = require('../exhibits/tasks/exhibit_grid_record_tasks');
const EXHIBIT_TIMELINE_RECORD_TASKS = require('../exhibits/tasks/exhibit_timeline_record_tasks');
const INDEXER_INDEX_TASKS = require('../indexer/tasks/indexer_index_tasks');
const DB_TABLES = require('../config/db_tables_config')();
const TABLES = DB_TABLES.exhibits;
const LOGGER = require('../libs/log4');

// Constants
const CONSTANTS = {
    STATUS_CODES: {
        OK: 200,
        CREATED: 201,
        NO_CONTENT: 204,
        NOT_FOUND: 404
    },
    BATCH_SIZE: 10, // Process records in batches to avoid overwhelming the system
    INDEX_TYPES: {
        PUBLISH: 'publish',
        PREVIEW: 'preview'
    }
};

// Initialize Elasticsearch client
const CLIENT = new Client({
    node: ES_CONFIG.elasticsearch_host
});

// Initialize task instances
const index_tasks = new INDEXER_INDEX_TASKS(CLIENT, ES_CONFIG.elasticsearch_index); // DB, TABLES,
const exhibit_record_task = new EXHIBIT_RECORD_TASKS(DB, TABLES);
const heading_record_task = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);
const item_record_task = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);
const grid_record_task = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
const timeline_record_task = new EXHIBIT_TIMELINE_RECORD_TASKS(DB, TABLES);

/**
 * Validates UUID format
 * @param {string} uuid - UUID to validate
 * @returns {boolean} True if valid
 */
const is_valid_uuid = (uuid) => {

    if (!uuid || typeof uuid !== 'string') {
        return false;
    }
    // Basic UUID validation - adjust regex based on your UUID format
    const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuid_regex.test(uuid) || uuid.length > 0; // Fallback for custom UUID formats
};

/**
 * Builds standardized response object
 * @param {number} status - HTTP status code
 * @param {string} message - Response message
 * @param {*} data - Optional response data
 * @returns {Object} Response object
 */
const build_response = (status, message, data = null) => {

    const response = {status, message};

    if (data !== null) {
        response.data = data;
    }
    return response;
};

/**
 * Processes subjects string into array
 * @param {string|null} subjects - Pipe-delimited subjects string
 * @returns {Array|string} Array of subjects or empty string
 */
const process_subjects = (subjects) => {
    if (subjects && typeof subjects === 'string' && subjects.length > 0) {
        return subjects.split('|').filter(s => s.trim().length > 0);
    }
    return '';
};

/**
 * Constructs exhibit index record
 * @param {Object} record - Exhibit record
 * @returns {Object} Formatted index record
 */
const construct_exhibit_index_record = (record) => {

    if (!record) {
        throw new Error('Invalid record provided');
    }

    const index_record = {
        uuid: record.uuid,
        type: record.type,
        title: record.title,
        subtitle: record.subtitle,
        banner_template: record.banner_template,
        about_the_curators: record.about_the_curators,
        alert_text: record.alert_text,
        hero_image: record.hero_image,
        thumbnail_image: record.thumbnail,
        description: record.description,
        page_layout: record.page_layout,
        exhibit_template: record.exhibit_template,
        subjects: process_subjects(record.exhibit_subjects),
        styles: record.styles,
        order: record.order,
        is_student_curated: record.is_student_curated,
        is_published: record.is_published,
        is_featured: record.is_featured,
        is_preview: record.is_preview,
        created: record.created
    };

    return index_record;
};

/**
 * Constructs heading index record
 * @param {Object} record - Heading record
 * @returns {Object} Formatted index record
 */
const construct_heading_index_record = (record) => {

    if (!record) {
        throw new Error('Invalid record provided');
    }

    const index_record = {
        is_member_of_exhibit: record.is_member_of_exhibit,
        uuid: record.uuid,
        type: record.type,
        text: record.text,
        order: record.order,
        styles: record.styles,
        is_visible: record.is_visible,
        is_anchor: record.is_anchor,
        is_published: record.is_published,
        created: record.created
    };

    return index_record;
};

/**
 * Constructs item index record
 * @param {Object} record - Item record
 * @returns {Object} Formatted index record
 */
const construct_item_index_record = (record) => {

    if (!record) {
        throw new Error('Invalid record provided');
    }

    // Build the base record
    const index_record = {
        uuid: record.uuid,
        is_member_of_exhibit: record.is_member_of_exhibit,
        thumbnail: record.thumbnail,
        title: record.title,
        caption: record.caption,
        item_type: record.item_type,
        media: record.media,
        text: record.text,
        wrap_text: record.wrap_text,
        description: record.description,
        type: record.type,
        layout: record.layout,
        media_width: record.media_width,
        media_padding: record.media_padding,
        alt_text: record.alt_text,
        is_alt_text_decorative: record.is_alt_text_decorative,
        pdf_open_to_page: record.pdf_open_to_page,
        date: record.date,
        styles: record.styles,
        subjects: process_subjects(record.item_subjects),
        order: record.order,
        is_published: record.is_published,
        is_embedded: record.is_embedded,
        is_repo_item: record.is_repo_item,
        is_kaltura_item: record.is_kaltura_item,
        created: record.created
    };

    // Only add date field if it has a value (Elasticsearch date fields can't be empty strings)
    if (record.date && record.date.length > 0) {
        index_record.date = record.date;
    } else {
        index_record.date = null;
    }

    return index_record;
};

/**
 * Constructs grid index record
 * @param {Object} record - Grid record
 * @returns {Object} Formatted index record
 */
const construct_grid_index_record = (record) => {

    if (!record) {
        throw new Error('Invalid record provided');
    }

    const index_record = {
        is_member_of_exhibit: record.is_member_of_exhibit,
        uuid: record.uuid,
        type: record.type,
        columns: record.columns,
        title: record.title,
        text: record.text,
        styles: record.styles,
        subjects: process_subjects(record.item_subjects),
        order: record.order,
        is_published: record.is_published,
        created: record.created,
        items: record.items
    };

    return index_record;
};

/**
 * Constructs timeline index record
 * @param {Object} record - Timeline record
 * @returns {Object} Formatted index record
 */
const construct_timeline_index_record = (record) => {

    if (!record) {
        throw new Error('Invalid record provided');
    }

    const index_record = {
        is_member_of_exhibit: record.is_member_of_exhibit,
        uuid: record.uuid,
        type: record.type,
        title: record.title,
        text: record.text,
        styles: record.styles,
        subjects: process_subjects(record.item_subjects),
        order: record.order,
        is_published: record.is_published,
        created: record.created,
        items: record.items
    };

    return index_record;
};

/**
 * Indexes records in batches with error handling
 * @param {Array} records - Array of records to index
 * @param {string} record_type - Type of records being indexed
 * @returns {Promise<Object>} Result summary
 */
const batch_index_records = async (records, record_type) => {

    if (!Array.isArray(records) || records.length === 0) {
        return {success: 0, failed: 0, total: 0};
    }

    const results = {
        success: 0,
        failed: 0,
        total: records.length
    };

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < records.length; i += CONSTANTS.BATCH_SIZE) {
        const batch = records.slice(i, i + CONSTANTS.BATCH_SIZE);

        const batch_promises = batch.map(async (record) => {
            try {
                const response = await index_tasks.index_record(record);

                if (!response || typeof response !== 'object' || response.success === true) {
                    results.success++;
                    LOGGER.module().info(
                        `INFO: [/indexer/model (batch_index_records)] ${record_type} record ${record.uuid} indexed.`
                    );
                    return true;
                } else {
                    results.failed++;
                    LOGGER.module().error(
                        `ERROR: [/indexer/model (batch_index_records)] Failed to index ${record_type} record ${record.uuid}`
                    );
                    return false;
                }
            } catch (error) {
                results.failed++;
                LOGGER.module().error(
                    `ERROR: [/indexer/model (batch_index_records)] ${error.message}`,
                    {record_type, uuid: record.uuid, stack: error.stack}
                );
                return false;
            }
        });

        await Promise.allSettled(batch_promises);
    }

    LOGGER.module().info(
        `INFO: [/indexer/model (batch_index_records)] ${record_type} indexing complete. ` +
        `Success: ${results.success}, Failed: ${results.failed}, Total: ${results.total}`
    );

    return results;
};

/**
 * Processes and indexes grid records with their items
 * @param {Array} grid_records - Grid records to process
 * @param {string} type - Index type (publish/preview)
 * @returns {Promise<Array>} Array of formatted grid records
 */
const process_grid_records = async (grid_records, type) => {

    if (!Array.isArray(grid_records) || grid_records.length === 0) {
        return [];
    }

    const processed_grids = await Promise.all(
        grid_records.map(async (grid_record) => {
            try {
                const items = await grid_record_task.get_grid_item_records(
                    grid_record.is_member_of_exhibit,
                    grid_record.uuid
                );

                const grid_items = [];

                if (items && items.length > 0) {
                    // Process grid items in parallel
                    const item_promises = items.map(async (item) => {
                        try {
                            if (type === CONSTANTS.INDEX_TYPES.PUBLISH) {
                                item.is_published = 1;
                                await grid_record_task.set_grid_item_to_publish(item.uuid);
                            }
                            return construct_item_index_record(item);
                        } catch (error) {
                            LOGGER.module().error(
                                `ERROR: [/indexer/model (process_grid_records)] ${error.message}`,
                                {grid_uuid: grid_record.uuid, item_uuid: item.uuid, stack: error.stack}
                            );
                            return null;
                        }
                    });

                    const processed_items = await Promise.all(item_promises);
                    grid_items.push(...processed_items.filter(item => item !== null));
                }

                grid_record.items = grid_items;
                return construct_grid_index_record(grid_record);

            } catch (error) {
                LOGGER.module().error(
                    `ERROR: [/indexer/model (process_grid_records)] ${error.message}`,
                    {grid_uuid: grid_record.uuid, stack: error.stack}
                );
                return null;
            }
        })
    );

    return processed_grids.filter(grid => grid !== null);
};

/**
 * Processes and indexes timeline records with their items
 * @param {Array} timeline_records - Timeline records to process
 * @param {string} type - Index type (publish/preview)
 * @returns {Promise<Array>} Array of formatted timeline records
 */
const process_timeline_records = async (timeline_records, type) => {

    if (!Array.isArray(timeline_records) || timeline_records.length === 0) {
        return [];
    }

    const processed_timelines = await Promise.all(
        timeline_records.map(async (timeline_record) => {
            try {
                const items = await timeline_record_task.get_timeline_item_records(
                    timeline_record.is_member_of_exhibit,
                    timeline_record.uuid
                );

                const timeline_items = [];

                if (items && items.length > 0) {
                    // Process timeline items in parallel
                    const item_promises = items.map(async (item) => {
                        try {
                            if (type === CONSTANTS.INDEX_TYPES.PUBLISH) {
                                item.is_published = 1;
                                await timeline_record_task.set_timeline_item_to_publish(item.uuid);
                            }
                            return construct_item_index_record(item);
                        } catch (error) {
                            LOGGER.module().error(
                                `ERROR: [/indexer/model (process_timeline_records)] ${error.message}`,
                                {timeline_uuid: timeline_record.uuid, item_uuid: item.uuid, stack: error.stack}
                            );
                            return null;
                        }
                    });

                    const processed_items = await Promise.all(item_promises);
                    timeline_items.push(...processed_items.filter(item => item !== null));
                }

                timeline_record.items = timeline_items;
                return construct_timeline_index_record(timeline_record);

            } catch (error) {
                LOGGER.module().error(
                    `ERROR: [/indexer/model (process_timeline_records)] ${error.message}`,
                    {timeline_uuid: timeline_record.uuid, stack: error.stack}
                );
                return null;
            }
        })
    );

    return processed_timelines.filter(timeline => timeline !== null);
};

/**
 * Indexes exhibit and all its components
 * @param {string} uuid - Exhibit UUID
 * @param {string} type - Index type (publish/preview)
 * @returns {Promise<Object>} Response object
 */
exports.index_exhibit = async (uuid, type) => {

    try {
        // Validate input
        if (!is_valid_uuid(uuid)) {
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Invalid UUID provided'
            );
        }

        if (type !== CONSTANTS.INDEX_TYPES.PUBLISH && type !== CONSTANTS.INDEX_TYPES.PREVIEW) {
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Invalid index type provided'
            );
        }

        LOGGER.module().info(`INFO: [/indexer/model (index_exhibit)] Indexing exhibit ${uuid}...`);

        // Fetch all records in parallel
        const [
            exhibit_record,
            heading_records,
            item_records,
            grid_records,
            timeline_records
        ] = await Promise.all([
            exhibit_record_task.get_exhibit_record(uuid),
            heading_record_task.get_heading_records(uuid),
            item_record_task.get_item_records(uuid),
            grid_record_task.get_grid_records(uuid),
            timeline_record_task.get_timeline_records(uuid)
        ]);

        // Validate exhibit record exists
        if (!exhibit_record || !exhibit_record.uuid) {
            LOGGER.module().error(`ERROR: [/indexer/model (index_exhibit)] Exhibit ${uuid} not found`);
            return build_response(
                CONSTANTS.STATUS_CODES.NOT_FOUND,
                'Exhibit not found'
            );
        }
        console.log('EXHIBIT RECORD ', exhibit_record);
        // Index main exhibit record
        const exhibit_index_record = construct_exhibit_index_record(exhibit_record);
        const exhibit_response = await index_tasks.index_record(exhibit_index_record);

        if (exhibit_response === false) {
            LOGGER.module().error(`ERROR: [/indexer/model (index_exhibit)] Failed to index exhibit ${uuid}`);
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Unable to index exhibit'
            );
        }

        LOGGER.module().info(
            `INFO: [/indexer/model (index_exhibit)] Exhibit record ${exhibit_index_record.uuid} indexed.`
        );

        // Process all component types in parallel
        const [
            heading_index_records,
            item_index_records,
            grid_index_records,
            timeline_index_records
        ] = await Promise.all([
            // Process headings
            Promise.resolve(
                heading_records && heading_records.length > 0
                    ? heading_records.map(h => construct_heading_index_record(h))
                    : []
            ),
            // Process items
            Promise.resolve(
                item_records && item_records.length > 0
                    ? item_records.map(i => construct_item_index_record(i))
                    : []
            ),
            // Process grids with their items
            process_grid_records(grid_records, type),
            // Process timelines with their items
            process_timeline_records(timeline_records, type)
        ]);

        // Index all records in parallel batches
        await Promise.all([
            batch_index_records(heading_index_records, 'Heading'),
            batch_index_records(item_index_records, 'Item'),
            batch_index_records(grid_index_records, 'Grid'),
            batch_index_records(timeline_index_records, 'Timeline')
        ]);

        LOGGER.module().info(`INFO: [/indexer/model (index_exhibit)] Exhibit ${uuid} indexing complete.`);

        return build_response(
            CONSTANTS.STATUS_CODES.CREATED,
            'Exhibit indexed'
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/indexer/model (index_exhibit)] ${error.message}`, {
            uuid,
            type,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            `Unable to index exhibit: ${error.message}`
        );
    }
};

/**
 * Gets indexed record by UUID
 * @param {string} uuid - Record UUID
 * @returns {Promise<Object>} Response object
 */
exports.get_indexed_record = async (uuid) => {

    try {
        if (!is_valid_uuid(uuid)) {
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Invalid UUID provided'
            );
        }

        const response = await index_tasks.get_indexed_record(uuid);

        if (!response) {
            return build_response(
                CONSTANTS.STATUS_CODES.NOT_FOUND,
                'Record not found'
            );
        }

        if (response.found === false) {
            return build_response(
                CONSTANTS.STATUS_CODES.NOT_FOUND,
                'Record not found'
            );
        }

        if (response.found === true) {
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Record found',
                response
            );
        }

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Unexpected response format'
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/indexer/model (get_indexed_record)] ${error.message}`, {
            uuid,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            error.message
        );
    }
};

/**
 * Deletes record from index
 * @param {string} uuid - Record UUID
 * @returns {Promise<Object>} Response object
 */
exports.delete_record = async (uuid) => {

    try {
        if (!is_valid_uuid(uuid)) {
            return build_response(
                CONSTANTS.STATUS_CODES.OK,
                'Invalid UUID provided'
            );
        }

        const is_deleted = await index_tasks.delete_record(uuid);

        if (is_deleted.success === true) {
            LOGGER.module().info(`INFO: [/indexer/model (delete_record)] Indexed record ${uuid} deleted`);

            return build_response(
                CONSTANTS.STATUS_CODES.NO_CONTENT,
                'Record deleted'
            );
        }

        LOGGER.module().error(`ERROR: [/indexer/model (delete_record)] Unable to delete record ${uuid}`);

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            'Unable to delete record'
        );

    } catch (error) {
        LOGGER.module().error(`ERROR: [/indexer/model (delete_record)] ${error.message}`, {
            uuid,
            stack: error.stack
        });

        return build_response(
            CONSTANTS.STATUS_CODES.OK,
            error.message
        );
    }
};

/**
 * Indexes a single item record
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} item_id - Item UUID
 * @returns {Promise<boolean>} Success status
 */
exports.index_item_record = async (exhibit_id, item_id) => {

    try {
        if (!is_valid_uuid(exhibit_id) || !is_valid_uuid(item_id)) {
            LOGGER.module().error('ERROR: [/indexer/model (index_item_record)] Invalid UUID provided');
            return false;
        }

        const item_record = await item_record_task.get_item_record(exhibit_id, item_id);

        if (!item_record) {
            LOGGER.module().error(
                `ERROR: [/indexer/model (index_item_record)] Item record not found: ${item_id}`
            );
            return false;
        }

        const item_index_record = construct_item_index_record(item_record);
        const response = await index_tasks.index_record(item_index_record);

        if (response.success === true) {
            LOGGER.module().info(
                `INFO: [/indexer/model (index_item_record)] Item record ${item_index_record.uuid} indexed.`
            );
            return true;
        }

        LOGGER.module().error(
            `ERROR: [/indexer/model (index_item_record)] Unable to index item record ${item_index_record.uuid}.`
        );
        return false;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/indexer/model (index_item_record)] ${error.message}`, {
            exhibit_id,
            item_id,
            stack: error.stack
        });
        return false;
    }
};

/**
 * Indexes a single heading record
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} heading_id - Heading UUID
 * @returns {Promise<boolean>} Success status
 */
exports.index_heading_record = async (exhibit_id, heading_id) => {

    try {
        if (!is_valid_uuid(exhibit_id) || !is_valid_uuid(heading_id)) {
            LOGGER.module().error('ERROR: [/indexer/model (index_heading_record)] Invalid UUID provided');
            return false;
        }

        const heading_record = await heading_record_task.get_heading_record(exhibit_id, heading_id);

        if (!heading_record) {
            LOGGER.module().error(
                `ERROR: [/indexer/model (index_heading_record)] Heading record not found: ${heading_id}`
            );
            return false;
        }

        const heading_index_record = construct_heading_index_record(heading_record);
        const response = await index_tasks.index_record(heading_index_record);

        if (response.success === true) {
            LOGGER.module().info(
                `INFO: [/indexer/model (index_heading_record)] Heading record ${heading_index_record.uuid} indexed.`
            );
            return true;
        }

        LOGGER.module().error(
            `ERROR: [/indexer/model (index_heading_record)] Unable to index heading record ${heading_index_record.uuid}.`
        );
        return false;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/indexer/model (index_heading_record)] ${error.message}`, {
            exhibit_id,
            heading_id,
            stack: error.stack
        });
        return false;
    }
};

/**
 * Indexes grid records with their items
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} grid_id - Grid UUID (optional, if not provided indexes all grids)
 * @returns {Promise<boolean>} Success status
 */
exports.index_grid_record = async (exhibit_id, grid_id = null) => {

    try {
        if (!is_valid_uuid(exhibit_id)) {
            LOGGER.module().error('ERROR: [/indexer/model (index_grid_record)] Invalid exhibit UUID provided');
            return false;
        }

        const grid_records = await grid_record_task.get_grid_records(exhibit_id, grid_id);

        if (!grid_records || grid_records.length === 0) {
            LOGGER.module().info('INFO: [/indexer/model (index_grid_record)] No grid records found');
            return true;
        }

        const grid_index_records = await process_grid_records(grid_records, CONSTANTS.INDEX_TYPES.PUBLISH);

        const results = await batch_index_records(grid_index_records, 'Grid');

        return results.failed === 0;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/indexer/model (index_grid_record)] ${error.message}`, {
            exhibit_id,
            grid_id,
            stack: error.stack
        });
        return false;
    }
};

/**
 * Indexes a single grid item within a grid
 * @param {string} grid_id - Grid UUID
 * @param {string} grid_item_id - Grid item UUID
 * @param {Object} grid_item_record - Grid item record
 * @returns {Promise<boolean>} Success status
 */
exports.index_grid_item_record = async (grid_id, grid_item_id, grid_item_record) => {

    try {
        if (!is_valid_uuid(grid_id) || !is_valid_uuid(grid_item_id)) {
            LOGGER.module().error('ERROR: [/indexer/model (index_grid_item_record)] Invalid UUID provided');
            return false;
        }

        if (!grid_item_record || typeof grid_item_record !== 'object') {
            LOGGER.module().error('ERROR: [/indexer/model (index_grid_item_record)] Invalid grid item record');
            return false;
        }

        const grid_item_index_record = construct_item_index_record(grid_item_record);
        const indexed_record = await this.get_indexed_record(grid_id);
        console.log('INDEXED GRID ', indexed_record);
        if (!indexed_record.data || !indexed_record.data.source) {
            LOGGER.module().error(
                `ERROR: [/indexer/model (index_grid_item_record)] Grid ${grid_id} not found in index`
            );
            return false;
        }

        const items = indexed_record.data.source.items || [];
        grid_item_index_record.is_published = 1;

        // Add new item and sort by order
        const updated_items = [...items, grid_item_index_record].sort((a, b) => {
            return (a.order || 0) - (b.order || 0);
        });

        indexed_record.data.source.items = updated_items;

        const is_indexed = await this.index_record(indexed_record.data.source);

        if (is_indexed === true) {
            LOGGER.module().info(
                `INFO: [/indexer/model (index_grid_item_record)] Grid item ${grid_item_id} indexed in grid ${grid_id}.`
            );
            return true;
        }

        return false;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/indexer/model (index_grid_item_record)] ${error.message}`, {
            grid_id,
            grid_item_id,
            stack: error.stack
        });
        return false;
    }
};

/**
 * Indexes timeline records with their items
 * @param {string} exhibit_id - Exhibit UUID
 * @param {string} timeline_id - Timeline UUID (optional, if not provided indexes all timelines)
 * @returns {Promise<boolean>} Success status
 */
exports.index_timeline_record = async (exhibit_id, timeline_id = null) => {

    try {
        if (!is_valid_uuid(exhibit_id)) {
            LOGGER.module().error('ERROR: [/indexer/model (index_timeline_record)] Invalid exhibit UUID provided');
            return false;
        }

        const timeline_records = await timeline_record_task.get_timeline_records(exhibit_id, timeline_id);

        if (!timeline_records || timeline_records.length === 0) {
            LOGGER.module().info('INFO: [/indexer/model (index_timeline_record)] No timeline records found');
            return true;
        }

        const timeline_index_records = await process_timeline_records(
            timeline_records,
            CONSTANTS.INDEX_TYPES.PUBLISH
        );

        const results = await batch_index_records(timeline_index_records, 'Timeline');

        return results.failed === 0;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/indexer/model (index_timeline_record)] ${error.message}`, {
            exhibit_id,
            timeline_id,
            stack: error.stack
        });
        return false;
    }
};

/**
 * Indexes a single timeline item within a timeline
 * @param {string} timeline_id - Timeline UUID
 * @param {string} timeline_item_id - Timeline item UUID
 * @param {Object} timeline_item_record - Timeline item record
 * @returns {Promise<boolean>} Success status
 */
exports.index_timeline_item_record = async (timeline_id, timeline_item_id, timeline_item_record) => {

    try {
        if (!is_valid_uuid(timeline_id) || !is_valid_uuid(timeline_item_id)) {
            LOGGER.module().error('ERROR: [/indexer/model (index_timeline_item_record)] Invalid UUID provided');
            return false;
        }

        if (!timeline_item_record || typeof timeline_item_record !== 'object') {
            LOGGER.module().error(
                'ERROR: [/indexer/model (index_timeline_item_record)] Invalid timeline item record'
            );
            return false;
        }

        const timeline_item_index_record = construct_item_index_record(timeline_item_record);
        const indexed_record = await this.get_indexed_record(timeline_id);

        if (!indexed_record.data || !indexed_record.data.source) {
            LOGGER.module().error(
                `ERROR: [/indexer/model (index_timeline_item_record)] Timeline ${timeline_id} not found in index`
            );
            return false;
        }

        const items = indexed_record.data.source.items || [];
        timeline_item_index_record.is_published = 1;

        // Add new item and sort by order
        const updated_items = [...items, timeline_item_index_record].sort((a, b) => {
            return (a.order || 0) - (b.order || 0);
        });

        indexed_record.data.source.items = updated_items;

        const is_indexed = await this.index_record(indexed_record.data.source);

        if (is_indexed === true) {
            LOGGER.module().info(
                `INFO: [/indexer/model (index_timeline_item_record)] Timeline item ${timeline_item_id} indexed in timeline ${timeline_id}.`
            );
            return true;
        }

        return false;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/indexer/model (index_timeline_item_record)] ${error.message}`, {
            timeline_id,
            timeline_item_id,
            stack: error.stack
        });
        return false;
    }
};

/**
 * Indexes a single record
 * @param {Object} record - Record to index
 * @returns {Promise<boolean>} Success status
 */
exports.index_record = async (record) => {

    try {
        if (!record || typeof record !== 'object' || !record.uuid) {
            LOGGER.module().error('ERROR: [/indexer/model (index_record)] Invalid record provided');
            return false;
        }

        const response = await index_tasks.index_record(record);

        if (response.success === true) {
            LOGGER.module().info(
                `INFO: [/indexer/model (index_record)] Record ${record.uuid} indexed.`
            );
            return true;
        }

        LOGGER.module().error(
            `ERROR: [/indexer/model (index_record)] Unable to index record ${record.uuid}.`
        );
        return false;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/indexer/model (index_record)] ${error.message}`, {
            uuid: record ? record.uuid : 'unknown',
            stack: error.stack
        });
        return false;
    }
};
