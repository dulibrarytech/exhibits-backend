/**
 Copyright 2023

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

const {v4: uuidv4} = require('uuid');
const LOGGER = require('../libs/log4');

/**
 * Object
 * @type {Uuid}
 */
const Uuid = class {

    constructor() {}

    /**
     * Generates uuid
     * @returns Promise string
     */
    create_uuid = () => {

        let promise = new Promise((resolve, reject) => {

            try {
                resolve(uuidv4());
            } catch (error) {
                LOGGER.module().error('ERROR: [/libs/ (create_uuid)] unable to generate uuid ' + error.message);
                reject(false);
            }

        });

        return promise.then((uuid) => {
            return uuid;
        }).catch((error) => {
            return error;
        });
    }
};

module.exports = Uuid;
