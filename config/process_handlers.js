/**

 Copyright 2026 University of Denver

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

/**
 * Global process-level safety nets for otherwise-silent async faults.
 *
 * Without these, an unhandled promise rejection or an uncaught exception leaves
 * no entry in the application log, and on Node 15+ an unhandled rejection
 * terminates the process by default with only a bare stderr dump.
 *
 * Policy:
 *   - unhandledRejection -> log it and KEEP RUNNING. A stray rejection should
 *     not take the server down; registering a handler also overrides Node's
 *     default "throw and terminate" behavior.
 *   - uncaughtException  -> log it as FATAL, run a best-effort cleanup, then
 *     exit(1). Process state is unreliable after an uncaught exception (Node
 *     guidance is not to resume), so a supervisor should restart it. A hard
 *     timeout guarantees the exit even if cleanup hangs.
 */

const DEFAULT_LOGGER = require('../libs/log4');

/**
 * Builds the unhandledRejection handler.
 * @param {Object} logger - log4-style logger exposing module().error(msg, meta)
 * @returns {Function} handler(reason)
 */
const make_unhandled_rejection_handler = (logger) => (reason) => {

    const is_error = reason instanceof Error;
    const message = is_error ? reason.message : String(reason);

    logger.module().error(
        `ERROR: [/config/process_handlers (unhandledRejection)] Unhandled promise rejection: ${message}`,
        { stack: is_error ? reason.stack : undefined }
    );
};

/**
 * Builds the uncaughtException handler.
 * @param {Object} options
 * @param {Object} options.logger - log4-style logger
 * @param {Function} options.on_fatal - async best-effort cleanup run before exit
 * @param {Function} options.exit - exit function, called with code 1
 * @param {number} [options.exit_timeout_ms=2000] - hard fallback before forced exit
 * @returns {Function} handler(error)
 */
const make_uncaught_exception_handler = ({ logger, on_fatal, exit, exit_timeout_ms = 2000 }) => (error) => {

    logger.module().error(
        `FATAL: [/config/process_handlers (uncaughtException)] ${error && error.message}`,
        { stack: error && error.stack }
    );

    let exited = false;
    const do_exit = () => {
        if (!exited) {
            exited = true;
            exit(1);
        }
    };

    // Best-effort cleanup, then exit. The hard timeout guarantees the process
    // exits even if cleanup hangs — its state is no longer trustworthy here.
    Promise.resolve().then(on_fatal).then(do_exit, do_exit);
    setTimeout(do_exit, exit_timeout_ms).unref();
};

/**
 * Registers the global handlers on the current process.
 * @param {Object} [options]
 * @param {Function} [options.on_fatal] - async cleanup before a fatal exit (e.g. shutdown_exiftool)
 * @param {Object} [options.logger] - logger override (defaults to libs/log4)
 * @param {Function} [options.exit] - exit override (defaults to process.exit); for tests
 * @param {number} [options.exit_timeout_ms=2000] - hard fallback before forced exit
 */
const register_process_handlers = (options = {}) => {

    const logger = options.logger || DEFAULT_LOGGER;
    const exit = options.exit || ((code) => process.exit(code));
    const on_fatal = typeof options.on_fatal === 'function' ? options.on_fatal : async () => {};
    const exit_timeout_ms = options.exit_timeout_ms || 2000;

    process.on('unhandledRejection', make_unhandled_rejection_handler(logger));
    process.on('uncaughtException', make_uncaught_exception_handler({ logger, on_fatal, exit, exit_timeout_ms }));
};

module.exports = {
    register_process_handlers,
    make_unhandled_rejection_handler,
    make_uncaught_exception_handler
};
