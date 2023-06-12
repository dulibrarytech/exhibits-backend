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

const LOGGER = require('../../libs/log4');

/**
 * Object contains tasks used to index record(s)
 * @param DB
 * @param TABLE
 * @param CLIENT
 * @param INDEX
 * @type {Indexer_index_tasks}
 */
const Indexer_index_tasks = class {

    constructor(DB, TABLE, CLIENT, INDEX) {
        this.DB = DB;
        this.TABLE = TABLE;
        this.CLIENT = CLIENT;
        this.INDEX = INDEX;
    }

    /**
     * Indexes record
     * @param record
     */
    index_record = (record) => {

        let promise = new Promise((resolve, reject) => {

            (async () => {

                try {

                    let response = await this.CLIENT.index({
                        index: this.INDEX,
                        id: record.uuid,
                        body: record,
                        refresh: true
                    });

                    if (response.statusCode === 201 || response.statusCode === 200) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }

                } catch (error) {
                    LOGGER.module().error('ERROR: [/indexer/indexer_index_tasks (index_record)] unable to index record ' + error.message);
                    reject(false);
                }

            })();
        });

        return promise.then((response) => {
            return response;
        }).catch(() => {
            return false;
        });
    }

    /**
     * Deletes record from admin index
     * @param uuid
     * @return {Promise<unknown | boolean>}
     */
    delete_record = (uuid) => {

        let promise = new Promise((resolve, reject) => {

            (async () => {

                try {

                    let response = await this.CLIENT.delete({
                        index: this.INDEX,
                        id: uuid,
                        refresh: true
                    });

                    if (response.statusCode === 200) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }

                } catch (error) {
                    LOGGER.module().error('ERROR: [/indexer/indexer_index_tasks (delete_record)] unable to index record ' + error.message);
                    reject(false);
                }

            })();
        });

        return promise.then((response) => {
            return response;
        }).catch(() => {
            return false;
        });
    }

    /**
     * Gets record full indexing
     * returns Promise string
     */
    get_record = () => {

        let promise = new Promise((resolve, reject) => {

            this.DB(this.TABLE)
                .select('*')
                .where({
                    is_active: 1,
                    is_indexed: 0
                })
                .limit(1)
                .then((data) => {

                    if (data === undefined || data.length === 0) {
                        resolve(0);
                    }

                    resolve(data[0]);
                })
                .catch((error) => {
                    LOGGER.module().error('ERROR: [/indexer/indexer_index_tasks (get_record)] unable to get record ' + error.message);
                    reject(false);
                });
        });

        return promise.then((record) => {
            return record;
        }).catch(() => {
            return false;
        });
    }

    /**
     * Gets record for single record index
     * @param uuid
     * @return {Promise<unknown | boolean>}
     */
    get_index_record = (uuid) => {

        let promise = new Promise((resolve, reject) => {

            this.DB(this.TABLE)
            .select('*')
            .where({
                uuid: uuid,
                is_active: 1
            })
            .limit(1)
            .then((data) => {

                if (data === undefined || data.length === 0) {
                    resolve(0);
                }

                resolve(data[0]);
            })
            .catch((error) => {
                LOGGER.module().error('ERROR: [/indexer/indexer_index_tasks (get_index_record)] unable to get record ' + error.message);
                reject(false);
            });
        });

        return promise.then((record) => {
            return record;
        }).catch(() => {
            return false;
        });
    }

    /**
     * Updates is_indexed status flag after a successful record index
     * @param uuid
     * @returns {Promise<unknown>}
     */
    update_indexing_status = (uuid) => {

        let promise = new Promise((resolve, reject) => {

            this.DB(this.TABLE)
                .where({
                    uuid: uuid
                })
                .update({
                    is_indexed: 1
                })
                .then((data) => {

                    if (data === 1) {
                        resolve(true);
                    } else {
                        LOGGER.module().error('ERROR: [/indexer/model module (index_records)] more than one record was updated');
                        reject(false);
                    }

                })
                .catch((error) => {
                    LOGGER.module().error('ERROR: [/indexer/model module (index_records)] unable to update is_indexed field ' + error.message);
                    reject(false);
                });
        });

        return promise.then((result) => {
            return result;
        }).catch(() => {
            return false;
        });
    }

    /**
     * Resets is_indexed DB flags
     * returns Promise string
     */
    reset_indexed_flags = () => {

        let promise = new Promise((resolve, reject) => {

            this.DB(this.TABLE)
                .where({
                    is_indexed: 1,
                    is_active: 1
                })
                .update({
                    is_indexed: 0
                })
                .then((data) => {
                    resolve(true);
                })
                .catch((error) => {
                    LOGGER.module().error('ERROR: [/indexer/model module (index_records)] unable to reset is_indexed fields ' + error.message);
                    reject(false);
                });
        });

        return promise.then((result) => {
            return result;
        }).catch(() => {
            return false;
        });
    }
};

module.exports = Indexer_index_tasks;
