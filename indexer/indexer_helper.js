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
const LOGGER = require('../libs/log4');

// ─── Shared Elasticsearch client ────────────────────────────────────────────

const CLIENT = new Client({
    node: ES_CONFIG.elasticsearch_host
});

// ─── Constants ──────────────────────────────────────────────────────────────

const CONSTANTS = {
    STATUS_CODES: {
        OK: 200,
        CREATED: 201,
        NO_CONTENT: 204,
        NOT_FOUND: 404
    },
    BATCH_SIZE: 10,
    INDEX_TYPES: {
        PUBLISH: 'publish',
        PREVIEW: 'preview'
    }
};

const VALID_RECORD_TYPES = ['exhibit', 'collection', 'object', 'item'];

// ─── Validation helpers ─────────────────────────────────────────────────────

/**
 * Validates UUID format
 * @param {string} uuid - UUID to validate
 * @returns {boolean}
 */
const is_valid_uuid = (uuid) => {
    if (!uuid || typeof uuid !== 'string') {
        return false;
    }
    const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuid_regex.test(uuid) || uuid.length > 0;
};

/**
 * Validates record type against allowed list
 * @param {string} type - Record type to validate
 * @returns {boolean}
 */
const is_valid_record_type = (type) => {
    return type && typeof type === 'string' && VALID_RECORD_TYPES.includes(type.toLowerCase());
};

// ─── Response helpers ───────────────────────────────────────────────────────

/**
 * Builds standardized response object
 * @param {number} status - HTTP status code
 * @param {string} message - Response message
 * @param {*} data - Optional response data
 * @returns {Object}
 */
const build_response = (status, message, data = null) => {
    const response = {status, message};
    if (data !== null) {
        response.data = data;
    }
    return response;
};

// ─── Data transform helpers ─────────────────────────────────────────────────

/**
 * Processes pipe-delimited subjects string into array
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
 * Extracts IIIF URLs from a stored manifest JSON string
 * @param {string|null} iiif_manifest_json - JSON manifest string from media library
 * @returns {Object|null} Extracted URLs or null
 */
const resolve_iiif_urls = (iiif_manifest_json) => {

    if (!iiif_manifest_json) {
        return null;
    }

    try {
        const manifest = typeof iiif_manifest_json === 'string'
            ? JSON.parse(iiif_manifest_json)
            : iiif_manifest_json;

        return {
            manifest_url: manifest.id || null,
            image_url: manifest.items?.[0]?.items?.[0]?.items?.[0]?.body?.id || null,
            service_url: manifest.items?.[0]?.items?.[0]?.items?.[0]?.body?.service?.[0]?.id || null,
            thumbnail_url: manifest.thumbnail?.[0]?.id || null
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/indexer/indexer_helper (resolve_iiif_urls)] ' + error.message);
        return null;
    }
};

/**
 * Builds Kaltura streaming data from media library fields
 * @param {string|null} entry_id - Kaltura entry ID
 * @param {string|null} thumbnail_url - Kaltura thumbnail URL
 * @returns {Object|null} Kaltura data or null
 */
const resolve_kaltura = (entry_id, thumbnail_url) => {

    if (!entry_id) {
        return null;
    }

    return {
        kaltura_id: entry_id,
        kaltura_stream_url: entry_id,
        kaltura_thumbnail: thumbnail_url || null
    };
};

/**
 * Merges media-library-bound subject fields into a structured object
 * @param {Object} record - Record with media_topics_subjects, media_genre_form_subjects, media_places_subjects
 * @returns {Object} Structured subjects object with topics, genre_form, places arrays
 */
const merge_media_subjects = (record) => {
    return {
        topics: process_subjects(record.media_topics_subjects),
        genre_form: process_subjects(record.media_genre_form_subjects),
        places: process_subjects(record.media_places_subjects)
    };
};

// ─── Index record constructors ──────────────────────────────────────────────

/**
 * Constructs exhibit index record
 * @param {Object} record - Exhibit record
 * @returns {Object} Formatted index record
 */
const construct_exhibit_index_record = (record) => {

    if (!record) {
        throw new Error('Invalid record provided');
    }

    // Resolve IIIF URLs from hero and thumbnail media library manifests
    const hero_iiif = resolve_iiif_urls(record.hero_iiif_manifest);
    const thumb_iiif = resolve_iiif_urls(record.thumb_iiif_manifest);
    const hero_kaltura = resolve_kaltura(record.hero_kaltura_entry_id, record.hero_kaltura_thumbnail_url);

    return {
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
        created: record.created,
        // v2: resolved hero image IIIF/Kaltura
        media_iiif: hero_iiif ? {
            manifest_url: hero_iiif.manifest_url,
            image_url: hero_iiif.image_url,
            service_url: hero_iiif.service_url
        } : null,
        kaltura: hero_kaltura,
        // v2: resolved thumbnail IIIF
        thumbnail_iiif: thumb_iiif ? {
            manifest_url: thumb_iiif.manifest_url,
            thumbnail_url: thumb_iiif.thumbnail_url
        } : null,
        // v2: media-bound subjects from hero image
        media_subjects: {
            topics: process_subjects(record.hero_topics_subjects),
            genre_form: process_subjects(record.hero_genre_form_subjects),
            places: process_subjects(record.hero_places_subjects)
        },
        // v2: media dimensions
        media_width: record.hero_media_width || null,
        media_height: record.hero_media_height || null
    };
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

    return {
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
};

/**
 * Constructs item index record (used for standard items, grid items, and timeline items)
 * @param {Object} record - Item record
 * @returns {Object} Formatted index record
 */
const construct_item_index_record = (record) => {

    if (!record) {
        throw new Error('Invalid record provided');
    }

    // Resolve IIIF URLs from media library manifests
    const media_iiif = resolve_iiif_urls(record.media_iiif_manifest);
    const thumb_iiif = resolve_iiif_urls(record.thumb_iiif_manifest);
    const kaltura = resolve_kaltura(record.kaltura_entry_id, record.media_kaltura_thumbnail_url);

    const index_record = {
        uuid: record.uuid,
        is_member_of_exhibit: record.is_member_of_exhibit,
        title: record.title,
        caption: record.caption,
        item_type: record.item_type,
        text: record.text,
        wrap_text: record.wrap_text,
        description: record.description,
        type: record.type,
        layout: record.layout,
        media_padding: record.media_padding,
        pdf_open_to_page: record.pdf_open_to_page,
        styles: record.styles,
        order: record.order,
        is_published: record.is_published,
        is_embedded: record.is_embedded,
        is_repo_item: record.is_repo_item,
        is_kaltura_item: record.is_kaltura_item,
        created: record.created,
        // Legacy media filename preserved for backward compatibility
        media: record.media,
        // v2: resolved media IIIF URLs
        media_iiif: media_iiif ? {
            manifest_url: media_iiif.manifest_url,
            image_url: media_iiif.image_url,
            service_url: media_iiif.service_url
        } : null,
        // v2: resolved thumbnail — prefer IIIF thumbnail URL, fall back to legacy
        thumbnail: thumb_iiif?.thumbnail_url || record.thumbnail,
        thumbnail_iiif: thumb_iiif ? {
            manifest_url: thumb_iiif.manifest_url,
            thumbnail_url: thumb_iiif.thumbnail_url
        } : null,
        // v2: Kaltura streaming data
        kaltura: kaltura,
        // v2: prefer media library alt_text over item-level
        alt_text: record.media_alt_text || record.alt_text,
        is_alt_text_decorative: record.media_is_alt_text_decorative ?? record.is_alt_text_decorative,
        // v2: media dimensions from library (fall back to item-level)
        media_width: record.ml_media_width || record.media_width,
        media_height: record.ml_media_height || null,
        // v2: item-level subjects + media-bound subjects
        subjects: process_subjects(record.item_subjects),
        media_subjects: merge_media_subjects(record),
        // Date — Elasticsearch date fields can't be empty strings
        date: (record.date && record.date.length > 0) ? record.date : null
    };

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

    return {
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

    return {
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
};

// ─── Batch indexing ─────────────────────────────────────────────────────────

/**
 * Indexes records in batches with error handling
 * @param {Array} records - Array of records to index
 * @param {string} record_type - Type label for logging (e.g. 'Grid', 'Heading')
 * @param {Object} index_tasks - INDEXER_INDEX_TASKS instance
 * @returns {Promise<Object>} Result summary {success, failed, total}
 */
const batch_index_records = async (records, record_type, index_tasks) => {

    if (!Array.isArray(records) || records.length === 0) {
        return {success: 0, failed: 0, total: 0};
    }

    const results = {
        success: 0,
        failed: 0,
        total: records.length
    };

    for (let i = 0; i < records.length; i += CONSTANTS.BATCH_SIZE) {
        const batch = records.slice(i, i + CONSTANTS.BATCH_SIZE);

        const batch_promises = batch.map(async (record) => {
            try {
                const response = await index_tasks.index_record(record);

                if (response && typeof response === 'object' && response.success === true) {
                    results.success++;
                    LOGGER.module().info(
                        `INFO: [/indexer/indexer_helper (batch_index_records)] ${record_type} record ${record.uuid} indexed.`
                    );
                    return true;
                } else {
                    results.failed++;
                    LOGGER.module().error(
                        `ERROR: [/indexer/indexer_helper (batch_index_records)] Failed to index ${record_type} record ${record.uuid}`
                    );
                    return false;
                }
            } catch (error) {
                results.failed++;
                LOGGER.module().error(
                    `ERROR: [/indexer/indexer_helper (batch_index_records)] ${error.message}`,
                    {record_type, uuid: record.uuid, stack: error.stack}
                );
                return false;
            }
        });

        await Promise.allSettled(batch_promises);
    }

    LOGGER.module().info(
        `INFO: [/indexer/indexer_helper (batch_index_records)] ${record_type} indexing complete. ` +
        `Success: ${results.success}, Failed: ${results.failed}, Total: ${results.total}`
    );

    return results;
};

// ─── Unified container (grid/timeline) processing ───────────────────────────

/**
 * Processes container records (grid or timeline) with their child items.
 * Replaces the formerly duplicated process_grid_records / process_timeline_records.
 *
 * @param {Object} config
 * @param {Array}  config.records              - Parent container records
 * @param {string} config.type                 - Index type ('publish' | 'preview')
 * @param {Object} config.record_task          - Task instance (grid_record_task or timeline_record_task)
 * @param {string} config.get_items_method     - Method name to fetch child items (e.g. 'get_grid_item_records')
 * @param {string} config.set_publish_method   - Method name to set child publish flag (e.g. 'set_grid_item_to_publish')
 * @param {Function} config.construct_parent   - Constructor for parent index record
 * @param {string} config.label                - Label for logging (e.g. 'grid', 'timeline')
 * @returns {Promise<Array>} Array of formatted parent index records with nested items
 */
const process_container_records = async (config) => {

    const {
        records,
        type,
        record_task,
        get_items_method,
        set_publish_method,
        construct_parent,
        label
    } = config;

    if (!Array.isArray(records) || records.length === 0) {
        return [];
    }

    const processed = await Promise.all(
        records.map(async (parent_record) => {
            try {
                const items = await record_task[get_items_method](
                    parent_record.is_member_of_exhibit,
                    parent_record.uuid
                );

                const child_items = [];

                if (items && items.length > 0) {
                    const item_promises = items.map(async (item) => {
                        try {
                            if (type === CONSTANTS.INDEX_TYPES.PUBLISH) {
                                item.is_published = 1;
                                await record_task[set_publish_method](item.uuid);
                            }
                            return construct_item_index_record(item);
                        } catch (error) {
                            LOGGER.module().error(
                                `ERROR: [/indexer/indexer_helper (process_container_records)] ${error.message}`,
                                {[`${label}_uuid`]: parent_record.uuid, item_uuid: item.uuid, stack: error.stack}
                            );
                            return null;
                        }
                    });

                    const processed_items = await Promise.all(item_promises);
                    child_items.push(...processed_items.filter(item => item !== null));
                }

                parent_record.items = child_items;
                return construct_parent(parent_record);

            } catch (error) {
                LOGGER.module().error(
                    `ERROR: [/indexer/indexer_helper (process_container_records)] ${error.message}`,
                    {[`${label}_uuid`]: parent_record.uuid, stack: error.stack}
                );
                return null;
            }
        })
    );

    return processed.filter(record => record !== null);
};

/**
 * Indexes a child item within a container record (grid or timeline) that is already in the index.
 * Replaces the formerly duplicated index_grid_item_record / index_timeline_item_record.
 *
 * @param {Object} config
 * @param {string} config.parent_id        - Parent container UUID
 * @param {string} config.child_id         - Child item UUID
 * @param {Object} config.child_record     - Child item DB record
 * @param {string} config.label            - Label for logging (e.g. 'grid', 'timeline')
 * @param {Function} config.get_indexed_record - Bound reference to model.get_indexed_record
 * @param {Function} config.index_record       - Bound reference to model.index_record
 * @returns {Promise<boolean>} Success status
 */
const index_container_child_record = async (config) => {

    const {
        parent_id,
        child_id,
        child_record,
        label,
        get_indexed_record,
        index_record
    } = config;

    try {
        if (!is_valid_uuid(parent_id) || !is_valid_uuid(child_id)) {
            LOGGER.module().error(`ERROR: [/indexer/indexer_helper (index_container_child_record)] Invalid UUID provided (${label})`);
            return false;
        }

        if (!child_record || typeof child_record !== 'object') {
            LOGGER.module().error(`ERROR: [/indexer/indexer_helper (index_container_child_record)] Invalid ${label} item record`);
            return false;
        }

        const child_index_record = construct_item_index_record(child_record);
        const indexed_record = await get_indexed_record(parent_id);

        if (!indexed_record.data || !indexed_record.data.source) {
            LOGGER.module().error(
                `ERROR: [/indexer/indexer_helper (index_container_child_record)] ${label} ${parent_id} not found in index`
            );
            return false;
        }

        const items = indexed_record.data.source.items || [];
        child_index_record.is_published = 1;

        const updated_items = [...items, child_index_record].sort((a, b) => {
            return (a.order || 0) - (b.order || 0);
        });

        indexed_record.data.source.items = updated_items;

        const is_indexed = await index_record(indexed_record.data.source);

        if (is_indexed === true) {
            LOGGER.module().info(
                `INFO: [/indexer/indexer_helper (index_container_child_record)] ${label} item ${child_id} indexed in ${label} ${parent_id}.`
            );
            return true;
        }

        return false;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/indexer/indexer_helper (index_container_child_record)] ${error.message}`, {
            parent_id,
            child_id,
            label,
            stack: error.stack
        });
        return false;
    }
};

/**
 * Fetches, constructs, and indexes a single standalone record (item or heading).
 * Replaces the formerly duplicated index_item_record / index_heading_record.
 *
 * @param {Object} config
 * @param {string} config.exhibit_id        - Exhibit UUID
 * @param {string} config.record_id         - Record UUID
 * @param {Object} config.record_task       - Task instance (item_record_task or heading_record_task)
 * @param {string} config.get_record_method - Method name to fetch the record (e.g. 'get_item_record')
 * @param {Function} config.construct_fn    - Constructor function for the index record
 * @param {Object} config.index_tasks       - INDEXER_INDEX_TASKS instance
 * @param {string} config.label             - Label for logging (e.g. 'Item', 'Heading')
 * @returns {Promise<boolean>} Success status
 */
const index_standalone_record = async (config) => {

    const {
        exhibit_id,
        record_id,
        record_task,
        get_record_method,
        construct_fn,
        index_tasks,
        label
    } = config;

    try {
        if (!is_valid_uuid(exhibit_id) || !is_valid_uuid(record_id)) {
            LOGGER.module().error(`ERROR: [/indexer/indexer_helper (index_standalone_record)] Invalid UUID provided (${label})`);
            return false;
        }

        const record = await record_task[get_record_method](exhibit_id, record_id);

        if (!record) {
            LOGGER.module().error(
                `ERROR: [/indexer/indexer_helper (index_standalone_record)] ${label} record not found: ${record_id}`
            );
            return false;
        }

        const index_record = construct_fn(record);
        const response = await index_tasks.index_record(index_record);

        if (response.success === true) {
            LOGGER.module().info(
                `INFO: [/indexer/indexer_helper (index_standalone_record)] ${label} record ${index_record.uuid} indexed.`
            );
            return true;
        }

        LOGGER.module().error(
            `ERROR: [/indexer/indexer_helper (index_standalone_record)] Unable to index ${label} record ${index_record.uuid}.`
        );
        return false;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/indexer/indexer_helper (index_standalone_record)] ${error.message}`, {
            exhibit_id,
            record_id,
            label,
            stack: error.stack
        });
        return false;
    }
};

/**
 * Fetches container records, processes them with child items, and batch-indexes.
 * Replaces the formerly duplicated index_grid_record / index_timeline_record.
 *
 * @param {Object} config
 * @param {string} config.exhibit_id           - Exhibit UUID
 * @param {string|null} config.container_id    - Optional specific container UUID
 * @param {Object} config.record_task          - Task instance
 * @param {string} config.get_records_method   - Method name to fetch container records
 * @param {string} config.get_items_method     - Method name to fetch child items
 * @param {string} config.set_publish_method   - Method name to set child publish flag
 * @param {Function} config.construct_parent   - Constructor for parent index record
 * @param {Object} config.index_tasks          - INDEXER_INDEX_TASKS instance
 * @param {string} config.label                - Label for logging (e.g. 'Grid', 'Timeline')
 * @returns {Promise<boolean>} Success status
 */
const index_container_records = async (config) => {

    const {
        exhibit_id,
        container_id,
        record_task,
        get_records_method,
        get_items_method,
        set_publish_method,
        construct_parent,
        index_tasks,
        label
    } = config;

    try {
        if (!is_valid_uuid(exhibit_id)) {
            LOGGER.module().error(`ERROR: [/indexer/indexer_helper (index_container_records)] Invalid exhibit UUID provided (${label})`);
            return false;
        }

        const records = await record_task[get_records_method](exhibit_id, container_id);

        if (!records || records.length === 0) {
            LOGGER.module().info(`INFO: [/indexer/indexer_helper (index_container_records)] No ${label} records found`);
            return true;
        }

        const index_records = await process_container_records({
            records,
            type: CONSTANTS.INDEX_TYPES.PUBLISH,
            record_task,
            get_items_method,
            set_publish_method,
            construct_parent,
            label: label.toLowerCase()
        });

        const results = await batch_index_records(index_records, label, index_tasks);

        return results.failed === 0;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/indexer/indexer_helper (index_container_records)] ${error.message}`, {
            exhibit_id,
            container_id,
            label,
            stack: error.stack
        });
        return false;
    }
};

module.exports = {
    CLIENT,
    CONSTANTS,
    is_valid_uuid,
    is_valid_record_type,
    build_response,
    process_subjects,
    resolve_iiif_urls,
    resolve_kaltura,
    merge_media_subjects,
    construct_exhibit_index_record,
    construct_heading_index_record,
    construct_item_index_record,
    construct_grid_index_record,
    construct_timeline_index_record,
    batch_index_records,
    process_container_records,
    index_container_child_record,
    index_standalone_record,
    index_container_records
};
