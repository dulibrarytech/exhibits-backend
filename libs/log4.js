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

const LOG4JS = require('log4js');

// OWASP A09 — log verbosity should not be pinned to 'debug' in production
// (security events get buried in model-layer chatter and PII risk rises).
// Default to 'info' in production, 'debug' elsewhere; override with LOG_LEVEL.
const LOG_LEVEL = process.env.LOG_LEVEL
    || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// OWASP A09 — the dateFile default keeps only ~2 rolled files (streamroller
// numToKeep default), so an incident older than ~2 days is uninvestigable.
// Keep a bounded but meaningful window (default 90 daily backups); ship logs
// off-host for anything longer. Override with LOG_RETENTION_DAYS.
const LOG_RETENTION = parseInt(process.env.LOG_RETENTION_DAYS || '90', 10);

LOG4JS.configure({
    appenders: {
        out: { type: 'stdout' },
        exhibits: {
            type: 'dateFile',
            filename: './logs/exhibits.log',
            compress: true,
            keepFileExt: true,
            numBackups: Number.isFinite(LOG_RETENTION) && LOG_RETENTION > 0 ? LOG_RETENTION : 90
        }
    },
    categories: {
        default: {
            appenders: ['out', 'exhibits'],
            level: LOG_LEVEL
        }
    }
});

exports.module = function () {
    return LOG4JS.getLogger();
};