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

const FS = require('fs');
const ES_MAPPINGS = './indexer/mappings.json';
const LOGGER = require('../../libs/log4');

/**
 * Object contains tasks used to create ES index
 * @param DB
 * @param TABLE
 * @type {Indexer_index_utils_tasks}
 */
const Indexer_index_utils_tasks = class {

    constructor(INDEX_NAME, CLIENT, CONFIG) {
        this.INDEX_NAME = INDEX_NAME;
        this.CLIENT = CLIENT;
        this.CONFIG = CONFIG;
    }

    /**
     * Checks if index exists
     */
    async check_index() {

        try {

            const response = await this.CLIENT.indices.exists({
                index: this.INDEX_NAME
            });

            if (response.statusCode !== 404) {
                LOGGER.module().info('INFO: [/indexer/tasks (check_index)] index exists');
                return true;
            } else {
                LOGGER.module().error('ERROR: [/indexer/tasks (check_index)] index does not exist');
                return false;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/indexer/tasks (check_index)] unable to check index ' + error.message);
        }
    }

    /**
     * Creates ES index
     */
   async create_index() {

       try {

           const response = await this.CLIENT.indices.create({
               index: this.INDEX_NAME,
               body: {
                   'settings': {
                       'index': {
                           'number_of_shards': this.CONFIG.number_of_shards,
                           'number_of_replicas': this.CONFIG.number_of_replicas
                       }
                   }
               }
           });

           if (response.acknowledged === true && response.shards_acknowledged === true) {
               LOGGER.module().info('INFO: [/indexer/tasks (create_index)] new index created');
               return true;
           } else {
               LOGGER.module().error('ERROR: [/indexer/tasks (create_index)] unable to create new index');
               return false;
           }

       } catch (error) {
           LOGGER.module().error('ERROR: [/indexer/tasks (create_index)] unable to create new index ' + error.message);
       }
    }

    /**
     * Creates ES index mappings
     */
    async create_mappings() {

        try {

            let mappings_obj = this.get_mappings(),
                body = {
                    properties: mappings_obj
                };

            const response = await this.CLIENT.indices.putMapping({
                index: this.INDEX_NAME,
                body: body
            });

            if (response.acknowledged === true) {
                LOGGER.module().info('INFO: [/indexer/tasks (create_mappings)] mappings created');
                return true;
            } else {
                LOGGER.module().error('ERROR: [/indexer/tasks (create_mappings)] unable to create mappings');
                return true;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/indexer/tasks (create_mappings)] unable to create mappings ' + error.message);
        }
    }

    /**
     *  Gets field mappings
     */
    get_mappings() {
        return JSON.parse(FS.readFileSync(ES_MAPPINGS, 'utf8'));
    }

    /**
     * Deletes index
     */
    async delete_index() {

        try {

            const response = await this.CLIENT.indices.delete({
                index: this.INDEX_NAME
            });

            if (response.statusCode === 200) {
                LOGGER.module().info('INFO: [/indexer/service module (delete_index)] index deleted');
                return true;
            }

        } catch(error) {
            LOGGER.module().error('ERROR: [/indexer/service module (delete_index)] unable to delete index ' + error.message );
        }
    };
};

module.exports = Indexer_index_utils_tasks;
