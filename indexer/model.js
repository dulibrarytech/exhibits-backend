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
const INDEX_TIMER = 1000;
const ES_CONFIG = require('../config/elasticsearch_config')();
const DB = require('../config/db_config')();
const EXHIBIT_RECORD_TASKS = require('../exhibits/tasks/exhibit_record_tasks');
const EXHIBIT_ITEM_RECORD_TASKS = require('../exhibits/tasks/exhibit_item_record_tasks');
const EXHIBIT_HEADING_RECORD_TASKS = require('../exhibits/tasks/exhibit_heading_record_tasks');
const EXHIBIT_GRID_RECORD_TASKS = require('../exhibits/tasks/exhibit_grid_record_tasks');
const INDEXER_INDEX_TASKS = require('../indexer/tasks/indexer_index_tasks');
const DB_TABLES = require('../config/db_tables_config')();
const TABLES = DB_TABLES.exhibits;
const LOGGER = require('../libs/log4');
const CLIENT = new Client({
    node: ES_CONFIG.elasticsearch_host
});

/**
 * Constructs exhibit index record
 * @param record
 * @return Object
 */
const construct_exhibit_index_record = function (record) {

    return {
        uuid: record.uuid,
        type: record.type,
        title: record.title,
        subtitle: record.subtitle,
        banner_template: record.banner_template,
        hero_image: record.hero_image,
        thumbnail_image: record.thumbnail,
        description: record.description,
        page_layout: record.page_layout,
        template: record.template,
        styles: record.styles,
        is_published: record.is_published,
        is_featured: record.is_featured,
        is_preview: record.is_preview,
        created: record.created
    };
};

/**
 * Constructs heading index record
 * @param record
 * @return Object
 */
const construct_heading_index_record = function (record) {

    return {
        is_member_of_exhibit: record.is_member_of_exhibit,
        uuid: record.uuid,
        type: record.type,
        text: record.text,
        order: record.order,
        is_visible: record.is_visible,
        is_anchor: record.is_anchor,
        is_published: record.is_published,
        created: record.created
    };
};

/**
 * Constructs item index record
 * @param record
 * @return Object
 */
const construct_item_index_record = function (record) {

    return {
        is_member_of_exhibit: record.is_member_of_exhibit,
        uuid: record.uuid,
        type: record.type,
        date: record.date,
        title: record.title,
        description: record.description,
        caption: record.caption,
        thumbnail: record.thumbnail,
        media: record.media,
        media_width: record.media_width,
        item_type: record.item_type,
        text: record.text,
        layout: record.layout,
        styles: record.styles,
        order: record.order,
        is_published: record.is_published,
        created: record.created
    };
};

/**
 * Constructs grid index record
 * @param record
 * @return Object
 */
const construct_grid_index_record = function (record) {

    return {
        is_member_of_exhibit: record.is_member_of_exhibit,
        uuid: record.uuid,
        type: record.type,
        columns: record.columns,
        order: record.order,
        styles: record.styles,
        is_published: record.is_published,
        created: record.created,
        items: record.items
    };
};

/**
 * Indexes exhibit (publish and preview)
 * @param uuid
 */
exports.index_exhibit = async function (uuid) {

    LOGGER.module().info('INFO: [/indexer/model (index_exhibit)] Indexing exhibit...');

    let heading_index_records = [];
    let item_index_records = [];
    let grid_index_records = [];
    let grid_items = [];

    const INDEX_TASKS = new INDEXER_INDEX_TASKS(DB, TABLES, CLIENT, ES_CONFIG.elasticsearch_index);
    const EXHIBIT_RECORD_TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES);
    const HEADING_RECORD_TASK = new EXHIBIT_HEADING_RECORD_TASKS(DB, TABLES);
    const ITEM_RECORD_TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);
    const GRID_RECORD_TASK = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
    const GRID_ITEM_RECORD_TASK = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);

    let exhibit_record = await EXHIBIT_RECORD_TASK.get_exhibit_record(uuid);
    let heading_records = await HEADING_RECORD_TASK.get_heading_records(uuid);
    let item_records = await ITEM_RECORD_TASK.get_item_records(uuid);
    let grid_records = await GRID_RECORD_TASK.get_grid_records(uuid);

    const exhibit_index_record = construct_exhibit_index_record(exhibit_record.pop());
    let response = await INDEX_TASKS.index_record(exhibit_index_record);

    if (response === false) {
        return {
            status: 200,
            message: 'Unable to index exhibit'
        };
    }

    LOGGER.module().info('INFO: [/indexer/model (index_exhibit)] Exhibit record ' + exhibit_index_record.uuid + ' indexed.');

    if (heading_records.length > 0) {

        for (let h=0;h<heading_records.length;h++) {
            heading_index_records.push(construct_heading_index_record(heading_records[h]));
        }

        let headings_timer = setInterval(async () => {

            if (heading_index_records.length === 0) {
                clearInterval(headings_timer);
                LOGGER.module().info('INFO: [/indexer/model (index_exhibit)] Heading records indexed.');
                return false;
            }

            let heading_index_record = heading_index_records.pop();
            let response = await INDEX_TASKS.index_record(heading_index_record);

            if (response === true) {
                LOGGER.module().info('INFO: [/indexer/model (index_exhibit)] Heading record ' + heading_index_record.uuid + ' indexed.');
            }

        }, 50);
    }

    if (item_records.length > 0) {

        for (let i=0;i<item_records.length;i++) {
            item_index_records.push(construct_item_index_record(item_records[i]));
        }

        let items_timer = setInterval(async () => {

            if (item_index_records.length === 0) {
                clearInterval(items_timer);
                LOGGER.module().info('INFO: [/indexer/model (index_exhibit)] Item records indexed.');
                return false;
            }

            let item_index_record = item_index_records.pop();
            let response = await INDEX_TASKS.index_record(item_index_record);

            if (response === true) {
                LOGGER.module().info('INFO: [/indexer/model (index_exhibit)] Item record ' + item_index_record.uuid + ' indexed.');
            }

        }, 100);
    }

    if (grid_records.length > 0) {

        // get grid items
        for (let i=0;i<grid_records.length;i++) {

            let items = await GRID_ITEM_RECORD_TASK.get_grid_item_records(grid_records[i].uuid);

            for (let j=0;j<items.length;j++) {
                grid_items.push(construct_item_index_record(items[j]));
            }

            grid_records[i].items = grid_items;
            grid_items = [];
        }

        for (let g=0;g<grid_records.length;g++) {
            grid_index_records.push(construct_grid_index_record(grid_records[g]));
        }

        let grid_items_timer = setInterval(async () => {

            if (grid_index_records.length === 0) {
                clearInterval(grid_items_timer);
                LOGGER.module().info('INFO: [/indexer/model (index_exhibit)] Grid item records indexed.');
                return false;
            }

            let grid_item_index_record = grid_index_records.pop();
            let response = await INDEX_TASKS.index_record(grid_item_index_record);

            if (response === true) {
                LOGGER.module().info('INFO: [/indexer/model (index_exhibit)] Grid item record ' + grid_item_index_record.uuid + ' indexed.');
            }

        }, 150);

    }

    return {
        status: 201,
        message: 'Exhibit indexed'
    };
};

/**
 * Gets indexed record
 * @param uuid
 */
exports.get_indexed_record = async function (uuid) {

    const INDEX_TASKS = new INDEXER_INDEX_TASKS(DB, TABLES, CLIENT, ES_CONFIG.elasticsearch_index);
    let response = await INDEX_TASKS.get_indexed_record(uuid);

    if (response === false) {

        return {
            status: 404,
            message: 'record not found.'
        };

    } else if (response.body.found === true) {

        return {
            status: 200,
            message: 'record found.',
            data: response
        };
    }
};

/**
 * Deletes record from index
 * @param uuid
 */
exports.delete_record = async function (uuid) {

    const INDEX_TASKS = new INDEXER_INDEX_TASKS(DB, TABLES, CLIENT, ES_CONFIG.elasticsearch_index);
    let is_deleted = await INDEX_TASKS.delete_record(uuid);

    if (is_deleted === true) {

        LOGGER.module().info('INFO: [/indexer/model (delete_record)] indexed record ' + uuid + ' deleted');

        return {
            status: 204,
            message: 'record deleted.'
        };
    }

    return {
        status: 200,
        message: 'Unable to delete record.'
    };
};



// TODO: index all exhibits
///////////////////////////////////////////////////////////////////////////
/** TODO: remove
 * Indexes all exhibit records

exports.index_all_records = function () {

    LOGGER.module().info('INFO: [/indexer/model (index_records)] indexing...');
    index_exhibit_records(ES_CONFIG.elasticsearch_index);
    index_heading_records(ES_CONFIG.elasticsearch_index);
    index_item_records(ES_CONFIG.elasticsearch_index);

    // TODO: index grids

    return {
        status: 201,
        message: 'Indexing records...'
    };
};
 */

/** TODO: remove
 * Indexes single record
 * @param uuid
 * @param type

exports.index_record = async function (uuid, type) {

    try {

        let table;
        let index_record;
        let response;
        let result = true;

        if (type === 'exhibit') {
            table = TABLES.exhibit_records;
        } else if (type === 'heading') {
            table = TABLES.heading_records;
        } else if (type === 'item') {
            table = TABLES.item_records;
        }

        const INDEX_TASKS = new INDEXER_INDEX_TASKS(DB, table, CLIENT, ES_CONFIG.elasticsearch_index);
        let record = await INDEX_TASKS.get_index_record(uuid);

        if (type === 'exhibit') {
            index_record = construct_exhibit_index_record(record);
        } else if (type === 'heading') {
            index_record = construct_heading_index_record(record);
        } else if (type === 'item') {
            index_record = construct_item_index_record(record);
        }

        response = await INDEX_TASKS.index_record(index_record);

        if (response === true) {

            LOGGER.module().info('INFO: [/indexer/model (index_admin_record)] ' + record.uuid + ' indexed.');

            result = await INDEX_TASKS.update_indexing_status(record.uuid);

            if (result !== true) {
                LOGGER.module().error('ERROR: [/indexer/model (index_admin_record)] index status update failed.');
            }

            return {
                status: 201,
                message: 'Record indexed'
            };
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/indexer/model (index_admin_record)] ' + error.message);
        return {
            status: 200,
            message: 'Unable to index record'
        };
    }
};
 */

/** TODO: refactor - use index_exhibit function
 * Index exhibit records

const index_exhibit_records = async function (INDEX) {

    const EXHIBITS_INDEX_TASKS = new INDEXER_INDEX_TASKS(DB, TABLES.exhibit_records, CLIENT, INDEX);
    let is_exhibits_reset = await EXHIBITS_INDEX_TASKS.reset_indexed_flags();

    if (is_exhibits_reset === false) {
        LOGGER.module().error('ERROR: [/indexer/model (index_records)] is_exhibits flag reset failed.');
        return false;
    }

    let exhibit_index_timer = setInterval(async () => {

        try {

            let response;
            let result;
            let record = await EXHIBITS_INDEX_TASKS.get_record();

            if (record === 0 || record === undefined) {
                clearInterval(exhibit_index_timer);
                LOGGER.module().info('INFO: [/indexer/model (index_exhibit_records)] Exhibit records indexing complete.');
                return false;
            }

            response = await EXHIBITS_INDEX_TASKS.index_record(construct_exhibit_index_record(record));

            if (response === true) {

                LOGGER.module().info('INFO: [/indexer/model (index_records)] ' + record.uuid + ' (' + record.title + ') indexed.');

                result = await EXHIBITS_INDEX_TASKS.update_indexing_status(record.uuid);

                if (result !== true) {
                    console.log('index status update failed.');
                    LOGGER.module().error('ERROR: [/indexer/model (index_records)] index status update failed.');
                }
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/indexer/model (index_records)] Unable to index record(s). ' + error.message);
        }

    }, INDEX_TIMER);
};
 */

/**
 * Index heading records
 * @param INDEX

const index_heading_records = async function (INDEX) {

    const HEADINGS_INDEX_TASKS = new INDEXER_INDEX_TASKS(DB, TABLES.heading_records, CLIENT, INDEX);
    let is_headings_reset = await HEADINGS_INDEX_TASKS.reset_indexed_flags();

    if (is_headings_reset === false) {
        LOGGER.module().error('ERROR: [/indexer/model (index_records)] is_headings flag reset failed.');
        return false;
    }

    let heading_index_timer = setInterval(async () => {

        try {

            let response;
            let result;
            let record = await HEADINGS_INDEX_TASKS.get_record();

            if (record === 0 || record === undefined) {
                clearInterval(heading_index_timer);
                LOGGER.module().info('INFO: [/indexer/model (index_heading_records)] Heading records indexing complete.');
                return false;
            }

            response = await HEADINGS_INDEX_TASKS.index_record(construct_heading_index_record(record));

            if (response === true) {

                LOGGER.module().info('INFO: [/indexer/model (index_heading_records)] ' + record.uuid + ' (' + record.text + ') indexed.');

                result = await HEADINGS_INDEX_TASKS.update_indexing_status(record.uuid);

                if (result !== true) {
                    LOGGER.module().error('ERROR: [/indexer/model (index_heading_records)] index status update failed.');
                }
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/indexer/model (index_heading_records)] Unable to index record(s). ' + error.message);
        }

    }, INDEX_TIMER);
};
 */

/** TODO: remove
 * Index item records
 * @param INDEX

const index_item_records = async function (INDEX) {

    const ITEMS_INDEX_TASKS = new INDEXER_INDEX_TASKS(DB, TABLES.item_records, CLIENT, INDEX);
    let is_items_reset = await ITEMS_INDEX_TASKS.reset_indexed_flags();

    if (is_items_reset === false) {
        LOGGER.module().error('ERROR: [/indexer/model (index_item_records)] is_items flag reset failed.');
        return false;
    }

    let item_index_timer = setInterval(async () => {

        try {

            let response;
            let result;
            let record = await ITEMS_INDEX_TASKS.get_record();

            if (record === 0 || record === undefined) {
                clearInterval(item_index_timer);
                LOGGER.module().info('INFO: [/indexer/model (index_item_records)] Item records indexing complete.');
                return false;
            }

            // TODO: check item type - item | grid
            // TODO: add construct_item_grid_record
            console.log(record);

            response = await ITEMS_INDEX_TASKS.index_record(construct_item_index_record(record));

            if (response === true) {

                LOGGER.module().info('INFO: [/indexer/model (index_item_records)] ' + record.uuid + ' (' + record.title + ') indexed.');

                result = await ITEMS_INDEX_TASKS.update_indexing_status(record.uuid);

                if (result !== true) {
                    LOGGER.module().error('ERROR: [/indexer/model (index_item_records)] index status update failed.');
                }
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/indexer/model (index_item_records)] Unable to index record(s). ' + error.message);
        }

    }, INDEX_TIMER);
};
 */
