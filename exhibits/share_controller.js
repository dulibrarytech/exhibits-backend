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

const VALIDATOR = require('validator');
const APP_CONFIG = require('../config/app_config')();
const WEBSERVICES_CONFIG = require('../config/webservices_config')();
const EXHIBITS_MODEL = require('../exhibits/exhibits_model');
const TOKEN = require('../libs/tokens');
const AUTHORIZE = require('../auth/authorize');
const LOGGER = require('../libs/log4');
const { send_error, send_ok } = require('../libs/http');
const APP_PATH = APP_CONFIG.app_path;

/*
 * The share flow:
 *
 *   1. An authenticated editor of the exhibit mints a share URL. The preview
 *      is (re)built HERE, behind authentication and a permission check, so
 *      the anonymous path below never writes anything.
 *   2. Anyone holding the URL renders the preview. The share token's subject
 *      is the exhibit uuid it was minted for, and it is honoured ONLY for
 *      that uuid.
 */

const INVALID_SHARE_MESSAGE = 'Exhibit preview URL has expired or is invalid.';

function is_valid_uuid(uuid) {
    return typeof uuid === 'string' && VALIDATOR.isUUID(uuid.trim());
}

function build_preview_url(uuid) {
    return `${WEBSERVICES_CONFIG.exhibit_preview_url}${uuid}?key=${WEBSERVICES_CONFIG.exhibit_preview_api_key}`;
}

/**
 * Mints a share URL for an exhibit preview (authenticated: TOKEN.verify).
 * Requires edit rights on the exhibit; builds the preview if none exists.
 */
exports.create_shared_exhibit_preview_url = async function (req, res) {

    try {

        const uuid = typeof req.query.uuid === 'string' ? req.query.uuid.trim() : '';

        if (!is_valid_uuid(uuid)) {
            return send_error(res, 400, 'Bad request.');
        }

        const is_authorized = await AUTHORIZE.check_permission({
            req,
            permissions: ['update_exhibit', 'update_any_exhibit'],
            record_type: 'exhibit',
            parent_id: uuid,
            child_id: null
        });

        if (!is_authorized) {
            LOGGER.module().warn(
                `WARNING: [/exhibits/share_controller (create_shared_exhibit_preview_url)] unauthorized share attempt for exhibit ${uuid} by ${req.decoded?.sub || 'unknown'}`
            );
            return send_error(res, 403, 'Unauthorized request');
        }

        const preview_exists = await EXHIBITS_MODEL.check_preview(uuid);

        if (preview_exists !== true) {

            const build_result = await EXHIBITS_MODEL.build_exhibit_preview(uuid);

            if (!build_result || build_result.status !== true) {
                LOGGER.module().error(
                    `ERROR: [/exhibits/share_controller (create_shared_exhibit_preview_url)] unable to build preview for exhibit ${uuid}`
                );
                return send_error(res, 500, 'Unable to build exhibit preview.');
            }
        }

        const t = TOKEN.create_shared(uuid);

        if (!t) {
            return send_error(res, 500, 'Unable to create shared exhibit preview URL.');
        }

        const shared_url = `${req.protocol}://${req.hostname}${APP_PATH}/shared?uuid=${uuid}&t=${t}`;

        LOGGER.module().info(
            `INFO: [/exhibits/share_controller (create_shared_exhibit_preview_url)] share URL minted for exhibit ${uuid} by ${req.decoded?.sub || 'unknown'}`
        );

        send_ok(res, { shared_url: shared_url }, 'Shared exhibit preview URL created', 201);

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/exhibits/share_controller (create_shared_exhibit_preview_url)] ${error.message}`
        );
        send_error(res, 500, 'Unable to create shared exhibit preview URL.');
    }
};

/**
 * Renders a shared exhibit preview (anonymous: TOKEN.verify_shared).
 * Read-only: the token must have been minted for exactly this exhibit, and a
 * preview must already exist — nothing is built from this path.
 */
exports.share_exhibit_preview = async function (req, res) {

    try {

        const uuid = typeof req.query.uuid === 'string' ? req.query.uuid.trim() : '';

        if (!is_valid_uuid(uuid)) {
            return send_error(res, 400, 'Bad request.');
        }

        if (!req.decoded || req.decoded.sub !== uuid) {
            LOGGER.module().warn(
                `WARNING: [/exhibits/share_controller (share_exhibit_preview)] share token for ${req.decoded?.sub || 'unknown'} presented for exhibit ${uuid}`
            );
            return send_error(res, 403, INVALID_SHARE_MESSAGE);
        }

        const preview_exists = await EXHIBITS_MODEL.check_preview(uuid);

        if (preview_exists !== true) {
            return send_error(res, 404, 'Exhibit preview is not available.');
        }

        res.render('share', {
            preview_url: build_preview_url(uuid)
        });

    } catch (error) {
        LOGGER.module().error(
            `ERROR: [/exhibits/share_controller (share_exhibit_preview)] ${error.message}`
        );
        send_error(res, 500, 'Unable to share exhibit preview.');
    }
};
