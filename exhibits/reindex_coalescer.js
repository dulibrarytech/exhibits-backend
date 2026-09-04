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

 Design history and rationale: NOTES/EXHIBITS_BACKEND_CODE_NOTES.md

 */

'use strict';

const LOGGER = require('../libs/log4');

/**
 * Coalesces (debounces) fire-and-forget re-index tasks by key.
 *
 * A per-key debounce: a burst of edits to the SAME component collapses to ONE
 * trailing re-index, run a short window after the burst settles. The app is
 * single-instance (no Redis), so an in-process Map is the coalescing surface.
 */

// Default debounce window. Short enough to feel near-instant publicly, long enough
// to coalesce rapid auto-saves / successive edits to the same component.
const DEFAULT_DEBOUNCE_MS = 1000;

// key -> pending Timeout. Keyed by the component being re-indexed (e.g. `item:<uuid>`).
const _timers = new Map();

/**
 * Debounce an async re-index task by key. A new call for the same key cancels the
 * pending one, so only the latest task runs — `delay` ms after the last call.
 * Errors thrown by `task` are logged, never propagated (callers are fire-and-forget
 * `setImmediate` handlers, so there is nothing to catch them).
 *
 * @param {string} key - coalescing key; same key => same debounced slot
 * @param {() => Promise<any>} task - the re-index to run when the burst settles
 * @param {number} [delay=DEFAULT_DEBOUNCE_MS] - debounce window in ms
 */
const schedule_reindex = (key, task, delay = DEFAULT_DEBOUNCE_MS) => {

    const existing = _timers.get(key);

    if (existing !== undefined) {
        clearTimeout(existing);
    }

    const timer = setTimeout(async () => {

        _timers.delete(key);

        try {
            await task();
        } catch (error) {
            LOGGER.module().error(`ERROR: [/exhibits/reindex_coalescer (schedule_reindex)] ${error.message}`, {
                key,
                stack: error.stack
            });
        }
    }, delay);

    // A pending re-index must never keep the Node process alive at shutdown.
    if (typeof timer.unref === 'function') {
        timer.unref();
    }

    _timers.set(key, timer);
};

module.exports = {
    schedule_reindex,
    DEFAULT_DEBOUNCE_MS,
    _timers // exposed for tests/diagnostics only
};
