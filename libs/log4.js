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

/*
 * OWASP A09 — log injection.
 *
 * Express decodes path parameters, so `%0A` in a URL arrives as a real newline.
 * Every handler that logs a REJECTED identifier logs a value that failed
 * validation, by definition unvalidated — `/iiif/%0AWARNING:%20forged/...` would
 * otherwise write a second, attacker-authored line into the log.
 *
 * Fixed here rather than at the call sites: there are ~940 log statements and
 * the handful that log unvalidated input is not a stable set, so a per-site
 * wrapper would have to be remembered by every future handler. One choke point
 * cannot be forgotten.
 *
 * Control characters are ESCAPED, not stripped, so the log still shows exactly
 * what was sent — `evil\nWARNING: forged` reads as one line containing a
 * literal `\n`. Only top-level string arguments are escaped; an object argument
 * (the `{ stack: error.stack }` metadata form used by 128 call sites) is passed
 * through untouched, and log4js already renders those through util.inspect,
 * which escapes newlines itself. The net effect is that a stack trace looks the
 * same whether it is inlined in the message or passed as metadata, and one log
 * event is always one line.
 */

// C0 controls (includes CR/LF), DEL, and the C1 range some terminals act on.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;

/**
 * Escapes control characters in a log message so a value taken from a request
 * cannot forge a log line. Non-strings are returned unchanged.
 * @param {*} message - Value about to be logged
 * @returns {*} The value with control characters escaped, if it was a string
 */
const sanitize_log_message = (message) => {

    if (typeof message !== 'string') {
        return message;
    }

    return message.replace(CONTROL_CHARACTERS, (character) => {

        if (character === '\n') {
            return '\\n';
        }

        if (character === '\r') {
            return '\\r';
        }

        if (character === '\t') {
            return '\\t';
        }

        return `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`;
    });
};

// Every level method log4js exposes, not only the four this app currently
// calls — a level added by a future caller must not bypass the escaping.
const LEVEL_METHODS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'mark'];

/**
 * Wraps a log4js logger so every string argument is escaped on the way in.
 * Inherits from the logger, so anything not overridden (level checks,
 * properties) keeps working.
 * @param {Object} logger - log4js logger
 * @returns {Object} Logger with escaping level methods
 */
const build_safe_logger = (logger) => {

    const safe_logger = Object.create(logger);

    LEVEL_METHODS.forEach((level) => {

        if (typeof logger[level] !== 'function') {
            return;
        }

        /* logger[level] is resolved per call, so the underlying method stays
           swappable (which is how the unit test observes what was passed). */
        safe_logger[level] = (...args) => logger[level](...args.map(sanitize_log_message));
    });

    return safe_logger;
};

// Built once — module() is called at every log statement.
const SAFE_LOGGER = build_safe_logger(LOG4JS.getLogger());

exports.module = function () {
    return SAFE_LOGGER;
};

// Exported for direct unit testing of the escaping rule.
exports.sanitize_log_message = sanitize_log_message;