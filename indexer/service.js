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

const {Client} = require("@elastic/elasticsearch");
const ES_CONFIG = require('../config/elasticsearch_config')();
const INDEXER_UTILS_TASKS = require('./tasks/indexer_index_utils_tasks');
const INDEX = ES_CONFIG.elasticsearch_index;
const LOGGER = require('../libs/log4');
const CLIENT = new Client({
    node: ES_CONFIG.elasticsearch_host
});

/**
 * Checks if index exists.  If it does, it deletes it.
 */
const check_index = async () => {

    try {

        const INDEX_UTILS_TASKS = new INDEXER_UTILS_TASKS(INDEX, CLIENT, ES_CONFIG);
        let exists = await INDEX_UTILS_TASKS.check_index(INDEX);
        let is_deleted = false;

        if (exists === true) {
            is_deleted = delete_index(INDEX);
            if (is_deleted === true) {
                LOGGER.module().error('ERROR: [/indexer/service module (check_index)] Index checked and deleted.');
            }
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/indexer/service module (check_index)] Unable to check index.');
        return false;
    }
};

/**
 * Create new index and mapping
 */
exports.create_index = (callback) => {

    (async () => {

        try {

            await check_index(INDEX);
            const INDEX_UTILS_TASKS = new INDEXER_UTILS_TASKS(INDEX, CLIENT, ES_CONFIG);
            let is_index_created = await INDEX_UTILS_TASKS.create_index();

            if (is_index_created === true) {

                let is_mappings_created = await INDEX_UTILS_TASKS.create_mappings();

                if (is_mappings_created === true) {
                    return true;
                } else {
                    LOGGER.module().error('ERROR: [/indexer/service module (create_index)] Unable to create index.');
                    return false;
                }

            } else {
                LOGGER.module().error('ERROR: [/indexer/service module (create_index)] Unable to create index.');
                return false;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/indexer/service module (create_index)] Unable to create index. ' + error.message);
            return false;
        }

    })();

    callback({
        status: 201,
        data: 'Creating index...'
    });
};

/**
 * Deletes index
 */
const delete_index = () => {

    (async () => {

        try {

            const INDEX_UTILS_TASKS = new INDEXER_UTILS_TASKS(INDEX, CLIENT, ES_CONFIG);
            let is_index_deleted = await INDEX_UTILS_TASKS.delete_index();

            if (is_index_deleted === true) {
                return true;
            } else {
                return false;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/indexer/service module (delete_index)] Unable to delete index ' + error.message);
            return false;
        }

    })();
};
