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

const ES_CONFIG = require('../config/elasticsearch_config')();
const INDEXER_UTILS_TASKS = require('./tasks/indexer_index_utils_tasks');
const INDEX = ES_CONFIG.elasticsearch_index;
const LOGGER = require('../libs/log4');
const {CLIENT} = require('../indexer/indexer_helper');

/**
 * Create new index and mapping
 * Delegates to recreate_index which handles check -> delete -> create -> map
 */
exports.create_index = async function () {

    try {

        const INDEX_UTILS_TASKS = new INDEXER_UTILS_TASKS(INDEX, CLIENT, ES_CONFIG);
        const result = await INDEX_UTILS_TASKS.recreate_index();

        if (result.success === true) {
            return {
                status: 201,
                data: 'Index created'
            };
        }

        LOGGER.module().error('ERROR: [/indexer/service module (create_index)] Unable to create index.', {
            step: result.step,
            error: result.error,
            message: result.message
        });

        return {
            status: 200,
            data: result.message || 'Unable to create index'
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/indexer/service module (create_index)] Unable to create index. ' + error.message);
        return {
            status: 200,
            data: 'Unable to create index'
        };
    }
};
