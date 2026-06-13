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

const HTTP = require('http');
const EXPRESS = require('express');
const COMPRESS = require('compression');
const BODYPARSER = require('body-parser');
const METHODOVERRIDE = require('method-override');
const HELMET = require('helmet');
const HELMET_CONFIG = require('../config/helmet_config')();
const XSS = require('../libs/dom');
const LOGGER = require('../libs/log4');
const FS = require('fs');
const {rate_limits} = require('../config/rate_limits_loader');

module.exports = function() {

    const APP = EXPRESS(),
        SERVER = HTTP.createServer(APP);

    // The app runs behind a loopback reverse proxy (TRUSTED_PROXY, default
    // 'loopback'), so the real client IP is in X-Forwarded-For. Without this,
    // req.ip is the proxy address (127.0.0.1) for every request and all IP-keyed
    // rate limiters would share one bucket. 'loopback' trusts only the local proxy,
    // so X-Forwarded-For from the internet can't be spoofed past it. A numeric value
    // is treated as a proxy hop count.
    const TRUSTED_PROXY = process.env.TRUSTED_PROXY || 'loopback';
    APP.set('trust proxy', /^\d+$/.test(TRUSTED_PROXY) ? parseInt(TRUSTED_PROXY, 10) : TRUSTED_PROXY);

    if (process.env.NODE_ENV === 'development') {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
    } else if (process.env.NODE_ENV === 'production') {
        APP.use(COMPRESS());
    }

    APP.use(BODYPARSER.urlencoded({
        extended: true
    }));
    APP.use(BODYPARSER.json());
    APP.use(METHODOVERRIDE());
    APP.use(HELMET(HELMET_CONFIG));
    APP.use('/exhibits-dashboard/static', EXPRESS.static('./public'));
    APP.use(XSS.sanitize_req_query);
    APP.use(XSS.sanitize_req_body);
    APP.use(XSS.sanitize_req_params);

    // API/IIIF request access log — method, url, status, duration, IP. Applied
    // once globally here; the per-route copies in the *_routes.js files were
    // mounted at the wrong path and never fired. Scoped to /api/ and /iiif (what
    // those per-route loggers covered) so static assets and page renders aren't logged.
    APP.use(function (req, res, next) {
        if (req.path.indexOf('/api/') !== -1 || req.path.indexOf('/iiif') !== -1) {
            const start = Date.now();
            res.on('finish', function () {
                LOGGER.module().info(`INFO: [${req.method}] ${req.originalUrl} - ${res.statusCode} - ${Date.now() - start}ms - ${req.ip}`);
            });
        }
        next();
    });

    APP.set('views', './views');
    APP.set('view engine', 'ejs');

    // Global rate-limit backstop: a generous per-client ceiling so any route that
    // doesn't attach its own limiter (auth, users, indexer, dashboard, future
    // routes) still has a baseline. Mounted after static assets so they aren't
    // counted; per-route limiters below still apply on top of this.
    APP.use(rate_limits.general_operations);

    require('../auth/routes')(APP);
    require('../dashboard/routes')(APP);
    require('../exhibits/exhibits_routes')(APP);
    require('../exhibits/headings_routes')(APP);
    require('../exhibits/items_routes')(APP);
    require('../exhibits/grid_routes')(APP);
    require('../exhibits/timelines_routes')(APP);
    require('../exhibits/share_routes')(APP);
    require('../indexer/routes')(APP);
    require('../users/routes')(APP);
    require('../exhibits/recycle_routes')(APP);
    require('../media-library/routes')(APP);
    require('../media-library/uploads')(APP);
    // require('../exhibits/uploads')(APP);

    if (!FS.existsSync(`./storage`)){
        FS.mkdirSync(`./storage`);
    }

    if (!FS.existsSync(`./logs`)){
        FS.mkdirSync(`./logs`);
    }

    // 404 — JSON for API paths, plain text elsewhere (replaces the per-route 404
    // handlers that never fired). Covers all methods, not just GET.
    APP.use(function (req, res) {
        if (req.path.indexOf('/api/') !== -1) {
            return res.status(404).json({ success: false, message: 'Endpoint not found', data: null });
        }
        res.status(404).send('Resource Not Found');
    });

    // Global error handler (must be last; the 4-arg signature is what makes Express
    // treat it as one). Consolidates the per-route handlers that never ran: a JSON
    // 400 for a malformed request body, then JSON 500s for API paths and plain text
    // elsewhere. Error details are hidden in production.
    // eslint-disable-next-line no-unused-vars
    APP.use(function (err, req, res, next) {
        if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
            LOGGER.module().warn(`WARNING: [JSON parse error] ${req.method} ${req.originalUrl}`);
            return res.status(400).json({ success: false, message: 'Invalid JSON in request body', data: null });
        }
        LOGGER.module().error(`ERROR: [global error handler] ${err.message} - ${req.method} ${req.originalUrl}`);
        const error_message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
        if (req.path.indexOf('/api/') !== -1) {
            return res.status(err.status || 500).json({ success: false, message: error_message, data: null });
        }
        res.status(err.status || 500).send(error_message);
    });

    SERVER.listen(process.env.APP_PORT);

    return APP;
};