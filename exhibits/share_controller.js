/**

 Copyright 2025 University of Denver

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

const WEBSERVICES_CONFIG = require('../config/webservices_config')();
const EXHIBITS_MODEL = require('../exhibits/exhibits_model');
const TOKEN = require('../libs/tokens');
const APP_PATH = '/exhibits-dashboard';

exports.create_shared_exhibit_preview_url = async function (req, res) {

    try {

        const uuid = req.query.uuid;

        if (uuid === undefined || uuid.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        const t = TOKEN.create_shared(uuid);
        const shared_url = `${req.protocol}://${req.hostname}${APP_PATH}/shared?uuid=${uuid}&t=${t}`;

        res.status(201).send({
            shared_url: shared_url
        });

    } catch (error) {
        res.status(500).send({message: `Unable to create shared exhibit preview URL. ${error.message}`});
    }
};

exports.share_exhibit_preview = async function (req, res) {

    try {

        const uuid = req.query.uuid;

        if (uuid === undefined || uuid.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        const response = await EXHIBITS_MODEL.check_preview(uuid);

        if (response === true) {

            const preview_url = `${WEBSERVICES_CONFIG.exhibit_preview_url}${uuid}?key=${WEBSERVICES_CONFIG.exhibit_preview_api_key}`;

            res.render('share', {
                preview_url: preview_url
            });

        } else {

            setTimeout(async () => {

                const result = await EXHIBITS_MODEL.build_exhibit_preview(uuid);

                if (result.status === true) {

                    const preview_url = `${WEBSERVICES_CONFIG.exhibit_preview_url}${uuid}?key=${WEBSERVICES_CONFIG.exhibit_preview_api_key}`;

                    res.render('share', {
                        preview_url: preview_url
                    });
                }
            }, 2000);
        }

        /*
        const response = await EXHIBITS_MODEL.check_preview(uuid);

        if (response === true) {

            console.log('Tearing down old preview');

            const result = await EXHIBITS_MODEL.delete_exhibit_preview(uuid);

            if (result.status === false) {

                res.status(200).send({message: `Unable to unset exhibit preview.`});
                return false;
            }
        }
         */

        /*
        setTimeout(async () => {

            const result = await EXHIBITS_MODEL.build_exhibit_preview(uuid);

            if (result.status === true) {

                const preview_url = `${WEBSERVICES_CONFIG.exhibit_preview_url}${uuid}?key=${WEBSERVICES_CONFIG.exhibit_preview_api_key}`;

                res.render('share', {
                    preview_url: preview_url
                });
            }
        }, 2000);

         */

    } catch (error) {
        res.status(500).send({message: `Unable to share exhibit preview. ${error.message}`});
    }
};
