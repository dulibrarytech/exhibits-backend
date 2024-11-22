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
        about_the_curators: record.about_the_curators,
        alert_text: record.alert_text,
        hero_image: record.hero_image,
        thumbnail_image: record.thumbnail,
        description: record.description,
        page_layout: record.page_layout,
        exhibit_template: record.exhibit_template,
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
        styles: record.styles,
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
        pdf_open_to_page: record.pdf_open_to_page,
        styles: record.styles,
        order: record.order,
        is_published: record.is_published,
        is_embedded: record.is_embedded,
        is_repo_item: record.is_repo_item,
        is_kaltura_item: record.is_kaltura_item,
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
        title: record.title,
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
    const exhibit_record = await EXHIBIT_RECORD_TASK.get_exhibit_record(uuid);
    const heading_records = await HEADING_RECORD_TASK.get_heading_records(uuid);
    const item_records = await ITEM_RECORD_TASK.get_item_records(uuid);
    const grid_records = await GRID_RECORD_TASK.get_grid_records(uuid);
    const exhibit_index_record = construct_exhibit_index_record(exhibit_record.pop());
    const response = await INDEX_TASKS.index_record(exhibit_index_record);

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
            const response = await INDEX_TASKS.index_record(heading_index_record);

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
            const response = await INDEX_TASKS.index_record(item_index_record);

            if (response === true) {
                LOGGER.module().info('INFO: [/indexer/model (index_exhibit)] Item record ' + item_index_record.uuid + ' indexed.');
            }

        }, 100);
    }

    if (grid_records.length > 0) {

        // get grid items
        for (let i=0;i<grid_records.length;i++) {

            let items = await GRID_RECORD_TASK.get_grid_item_records(grid_records[i].is_member_of_exhibit, grid_records[i].uuid);

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
            const response = await INDEX_TASKS.index_record(grid_item_index_record);

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

    if (response.found === false) {

        return {
            status: 404,
            message: 'record not found.'
        };

    } else if (response.found === true) {

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

/**
 * Index record
 * @param exhibit_id
 * @param item_id
 */
exports.index_item_record = async function (exhibit_id, item_id) {

    const INDEX_TASKS = new INDEXER_INDEX_TASKS(DB, TABLES, CLIENT, ES_CONFIG.elasticsearch_index);
    const ITEM_RECORD_TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);
    const item_record = await ITEM_RECORD_TASK.get_item_record(exhibit_id, item_id);
    const item_index_record = construct_item_index_record(item_record.pop());
    const response = await INDEX_TASKS.index_record(item_index_record);

    if (response === true) {
        LOGGER.module().info('INFO: [/indexer/model (index_item_record)] Item record ' + item_index_record.uuid + ' indexed.');
        return true;
    } else {
        LOGGER.module().error('ERROR: [/indexer/model (index_item_record)] Unable to index item record ' + item_index_record.uuid + '.');
        return false;
    }
};

/**
 * Index heading record
 * @param exhibit_id
 * @param item_id
 */
exports.index_heading_record = async function (exhibit_id, item_id) {

    const INDEX_TASKS = new INDEXER_INDEX_TASKS(DB, TABLES, CLIENT, ES_CONFIG.elasticsearch_index);
    const ITEM_RECORD_TASK = new EXHIBIT_ITEM_RECORD_TASKS(DB, TABLES);
    const item_record = await ITEM_RECORD_TASK.get_heading_record(exhibit_id, item_id);
    const item_index_record = construct_heading_index_record(item_record.pop());
    const response = await INDEX_TASKS.index_record(item_index_record);

    if (response === true) {
        LOGGER.module().info('INFO: [/indexer/model (index_heading_record)] Heading record ' + item_index_record.uuid + ' indexed.');
        return true;
    } else {
        LOGGER.module().error('ERROR: [/indexer/model (index_heading_record)] Unable to index heading record ' + item_index_record.uuid + '.');
        return false;
    }
};

/**
 * Index grid record
 * @param exhibit_id
 * @param item_id
 */
exports.index_grid_record = async function (exhibit_id, item_id) {

    const INDEX_TASKS = new INDEXER_INDEX_TASKS(DB, TABLES, CLIENT, ES_CONFIG.elasticsearch_index);
    const GRID_RECORD_TASK = new EXHIBIT_GRID_RECORD_TASKS(DB, TABLES);
    const grid_records = await GRID_RECORD_TASK.get_grid_records(exhibit_id, item_id);
    let grid_index_records = [];
    let grid_items = [];

    // get grid items
    for (let i=0;i<grid_records.length;i++) {

        let items = await GRID_RECORD_TASK.get_grid_item_records(grid_records[i].is_member_of_exhibit, grid_records[i].uuid);

        for (let j=0;j<items.length;j++) {
            // console.log(items[j].is_published);
            items[j].is_published = 1;
            await GRID_RECORD_TASK.set_grid_item_to_publish(items[j].uuid);
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
            LOGGER.module().info('INFO: [/indexer/model (index_grid_record)] Grid item records indexed.');
            return false;
        }

        let grid_item_index_record = grid_index_records.pop();
        const response = await INDEX_TASKS.index_record(grid_item_index_record);

        if (response === true) {
            LOGGER.module().info('INFO: [/indexer/model (index_grid_record)] Grid item record ' + grid_item_index_record.uuid + ' indexed.');
        }

    }, 150);
};

/**
 * Indexes grid item
 * @param grid_id
 * @param grid_item_id
 * @param grid_item_record
 */
exports.index_grid_item_record = async function (grid_id, grid_item_id, grid_item_record) {

    let grid_item_index_record = construct_item_index_record(grid_item_record);
    let indexed_record = await this.get_indexed_record(grid_id);
    let items = indexed_record.data._source.items;
    let updated_items = [];

    for (let i=0;i<items.length;i++) {
        updated_items.push(items[i]);
    }

    grid_item_index_record.is_published = 1;
    updated_items.push(grid_item_index_record);

    indexed_record.data._source.items = updated_items.sort((a, b) => {
        return a.order - b.order;
    });

    const is_indexed = await this.index_record(indexed_record.data._source);

    if (is_indexed === true) {
        return true;
    } else {
        return false;
    }
};

/**
 * indexes record
 * @param record
 */
exports.index_record = async function (record) {

    const INDEX_TASKS = new INDEXER_INDEX_TASKS(DB, TABLES, CLIENT, ES_CONFIG.elasticsearch_index);
    const response = await INDEX_TASKS.index_record(record);

    if (response === true) {
        LOGGER.module().info('INFO: [/indexer/model (index_record)] Record ' + record.uuid + ' indexed.');
        return true;
    } else {
        LOGGER.module().error('ERROR: [/indexer/model (index_record)] Unable to index record ' + record.uuid + '.');
        return false;
    }
};
