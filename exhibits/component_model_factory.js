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

/*
 * Component model factory.
 *
 * The four exhibit component types — standard item, heading, grid (+ grid
 * item) and timeline (+ timeline item) share six near-identical model
 * verticals. This module owns the shared shape; each model declares what
 * actually differs.
 *
 * WHAT IS SHARED (generated here)
 *   - the validate -> task -> build_response read wrapper
 *   - the create pipeline (uuid, membership, validate, styles, order, insert,
 *     exhibit timestamp)
 *   - the update pipeline (membership, is_published extraction, styles,
 *     update, coalesced republish, exhibit timestamp)
 *   - publish / suppress for a STANDALONE component, i.e. one with its own
 *     Elasticsearch doc
 *   - publish / suppress for a NESTED item, i.e. one embedded in its
 *     container's doc
 *   - the post-edit republish scheduler
 *   - the nested-item index-doc removal + delete
 *   - the reorder and unlock thin wrappers
 *
 * WHAT IS NOT SHARED (declared per type)
 *   `kind` is the one structural switch: 'standalone' components own an ES
 *   doc and are published/suppressed by writing or deleting it; 'nested'
 *   items live inside their container's doc and are published/suppressed by
 *   rewriting that doc's items[]. The divergence is real, so it is a named
 *   shape, not a flag.
 *
 *   Everything else that differs is either a message/status string or one of
 *   the `hooks`:
 *     prepare_create / prepare_update - mutate the payload and optionally
 *         refuse it (grid column counts, grid/timeline internal_name)
 *     validate_create                 - schema validation (headings only)
 *     publish_gate / suppress_gate    - refuse before anything is written
 *         (membership guard by default; the grid minimum-items rule replaces
 *          it for grids and grid items)
 *     delete_gate                     - refuse a nested-item delete (the grid
 *         minimum-items rule again)
 *     cascade_suppress                - suppress a container's children
 *
 * Every generated function keeps the exact name, arity, response envelope and
 * message text of the per-type function it stands in for.
 */

const LOGGER = require('../libs/log4');
const RTE_VOCABULARY = require('../libs/rte_vocabulary');
const {
    is_valid_uuid,
    is_valid_user_id,
    build_response,
    prepare_styles
} = require('./common_helper');

const STATUS_CODES = Object.freeze({
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    INTERNAL_SERVER_ERROR: 500
});

const PUBLICATION_STATUS = Object.freeze({
    PUBLISHED: 1,
    UNPUBLISHED: 0
});

const INVALID_UUID_MESSAGE = 'Invalid UUID provided';
const INVALID_EXHIBIT_UUID_MESSAGE = 'Invalid exhibit UUID provided';
const INVALID_DATA_MESSAGE = 'Invalid data provided';

/**
 * Logs a caught error with the module/function prefix every model uses.
 * @param {string} module_name - e.g. 'grid_model'
 * @param {string} fn_name - e.g. 'create_grid_record'
 * @param {Error} error - The caught error
 * @param {Object} context - Extra fields (the ids in scope)
 */
const log_error = (module_name, fn_name, error, context = {}) => {
    LOGGER.module().error(`ERROR: [/exhibits/${module_name} (${fn_name})] ${error.message}`, {
        ...context,
        stack: error.stack
    });
};

/**
 * Logs a failure that is not an exception (a task returning false, an index
 * write that did not take).
 * @param {string} module_name - e.g. 'grid_model'
 * @param {string} fn_name - e.g. 'publish_grid_record'
 * @param {string} message - What failed
 */
const log_failure = (module_name, fn_name, message) => {
    LOGGER.module().error(`ERROR: [/exhibits/${module_name} (${fn_name})] ${message}`);
};

/**
 * Bumps the parent exhibit's `updated` timestamp after a write. The log line
 * names the calling model, not a fixed one.
 *
 * @param {Object} ctx - Factory context
 * @param {string} exhibit_id - Exhibit UUID
 * @returns {Promise<void>}
 */
const touch_exhibit = async (ctx, exhibit_id) => {

    const is_updated = await ctx.exhibit_task.update_exhibit_timestamp(exhibit_id);

    if (is_updated === true) {
        LOGGER.module().info(`INFO: [/exhibits/${ctx.module_name}] Exhibit timestamp updated successfully.`);
    }
};

/**
 * Builds the {name: value} log context for a positional id list.
 * @param {Array<string>} params - Parameter names, in order
 * @param {Array} args - The call's arguments
 * @returns {Object} Log context
 */
const id_context = (params, args) => {
    const context = {};
    params.forEach((param, index) => {
        context[param] = args[index];
    });
    return context;
};

/**
 * Validates a positional id list. A parameter named `uid` is a numeric user
 * id (the record-lock owner); everything else is a UUID.
 * @param {Array<string>} params - Parameter names, in order
 * @param {Array} args - The call's arguments
 * @returns {boolean} True when every id is valid
 */
const ids_are_valid = (params, args) => {
    return params.every((param, index) => {
        return param === 'uid' ? is_valid_user_id(args[index]) : is_valid_uuid(args[index]);
    });
};

/* ==================== READS ==================== */

/**
 * Generates a read wrapper: validate ids -> await the task -> 200 envelope;
 * any throw becomes a 400 carrying the error message.
 *
 * @param {Object} ctx - Factory context
 * @param {Object} spec - {name, task_method, label, params}
 * @returns {Function} The read function
 */
const make_read = (ctx, spec) => {

    const {name, task_method, label, params} = spec;

    return async (...args) => {

        try {

            if (!ids_are_valid(params, args)) {
                return build_response(STATUS_CODES.BAD_REQUEST, INVALID_UUID_MESSAGE);
            }

            const record = await ctx.task[task_method](...params.map((param, index) => args[index]));

            return build_response(STATUS_CODES.OK, label, record);

        } catch (error) {
            log_error(ctx.module_name, name, error, id_context(params, args));
            return build_response(STATUS_CODES.BAD_REQUEST, error.message);
        }
    };
};

/* ==================== CREATE ==================== */

/**
 * Generates the create pipeline.
 *
 * Order of operations: validate ids and body, stamp uuid + membership, run
 * the schema validator (headings only), run the prepare hook (grid columns,
 * container internal_name), serialize styles, compute `order`, insert, bump
 * the exhibit timestamp.
 *
 * @param {Object} ctx - Factory context
 * @returns {Function} The create function
 */
const make_create = (ctx) => {

    const {label, module_name, messages, hooks, order_fn, rte_profiles} = ctx;
    const name = ctx.task_methods.create_public_name;
    const params = ctx.parent_params;
    const invalid_id_message = params.length === 1
        ? INVALID_EXHIBIT_UUID_MESSAGE
        : INVALID_UUID_MESSAGE;

    return async (...args) => {

        const data = args[params.length];

        RTE_VOCABULARY.apply(data, rte_profiles);

        try {

            if (!ids_are_valid(params, args)) {
                return build_response(STATUS_CODES.BAD_REQUEST, invalid_id_message);
            }

            if (!data || typeof data !== 'object') {
                return build_response(STATUS_CODES.BAD_REQUEST, INVALID_DATA_MESSAGE);
            }

            data.uuid = ctx.helper.create_uuid();
            data.is_member_of_exhibit = args[0];

            if (ctx.parent_key) {
                data[ctx.parent_key] = args[1];
            }

            if (hooks.validate_create) {
                const validation_error = hooks.validate_create(data);

                if (validation_error !== null) {
                    return validation_error;
                }
            }

            if (hooks.prepare_create) {
                const prepare_error = hooks.prepare_create(data);

                if (prepare_error !== null) {
                    return prepare_error;
                }
            }

            data.styles = prepare_styles(data.styles);
            data.order = await order_fn(data);

            const result = await ctx.task[ctx.task_methods.create](data);

            if (result === false) {
                log_failure(module_name, name, 'Database operation failed');
                return build_response(
                    STATUS_CODES.INTERNAL_SERVER_ERROR,
                    `Unable to create ${label.toLowerCase()} record`
                );
            }

            await touch_exhibit(ctx, args[0]);

            return build_response(
                STATUS_CODES.CREATED,
                `${label} record created`,
                data.uuid
            );

        } catch (error) {
            log_error(module_name, name, error, id_context(params, args));

            return build_response(
                STATUS_CODES.INTERNAL_SERVER_ERROR,
                `${messages.create_error_prefix}: ${error.message}`
            );
        }
    };
};

/* ==================== UPDATE ==================== */

/**
 * Generates the update pipeline.
 *
 * `is_published` is a publish-state flag, not an editable column: where a
 * type schedules a post-edit republish (everything but the two containers)
 * it is pulled out of the payload before the write and used afterwards to
 * decide whether the live index copy needs refreshing.
 *
 * @param {Object} ctx - Factory context
 * @param {Function} handle_republish - The generated republish scheduler, or null
 * @returns {Function} The update function
 */
const make_update = (ctx, handle_republish) => {

    const {label, module_name, messages, hooks, rte_profiles} = ctx;
    const name = ctx.task_methods.update_public_name;
    /* the update path takes the record's own uuid as its last id */
    const params = [...ctx.parent_params, ctx.uuid_param];

    return async (...args) => {

        const data = args[params.length];

        RTE_VOCABULARY.apply(data, rte_profiles);

        try {

            if (!ids_are_valid(params, args)) {
                return build_response(STATUS_CODES.BAD_REQUEST, INVALID_UUID_MESSAGE);
            }

            if (!data || typeof data !== 'object') {
                return build_response(STATUS_CODES.BAD_REQUEST, INVALID_DATA_MESSAGE);
            }

            data.is_member_of_exhibit = args[0];

            if (ctx.parent_key) {
                data[ctx.parent_key] = args[1];
            }

            data.uuid = args[params.length - 1];

            let is_published;

            if (handle_republish) {
                is_published = data.is_published;
                delete data.is_published;
            }

            if (hooks.validate_update) {
                const validation_error = hooks.validate_update(data);

                if (validation_error !== null) {
                    return validation_error;
                }
            }

            if (hooks.prepare_update) {
                const prepare_error = hooks.prepare_update(data);

                if (prepare_error !== null) {
                    return prepare_error;
                }
            }

            data.styles = prepare_styles(data.styles);

            const result = await ctx.task[ctx.task_methods.update](data);

            if (result === false) {
                return build_response(
                    messages.update_failure_status,
                    `Unable to update ${label.toLowerCase()} record`
                );
            }

            if (handle_republish
                && (is_published === 'true' || is_published === true || is_published === 1)) {
                setImmediate(() => handle_republish(...args.slice(0, params.length)));
            }

            await touch_exhibit(ctx, args[0]);

            return build_response(
                STATUS_CODES.CREATED,
                `${label} record updated`,
                messages.update_returns_uuid ? data.uuid : null
            );

        } catch (error) {
            log_error(module_name, name, error, id_context(params, args));

            return build_response(
                messages.update_failure_status,
                `${messages.update_error_prefix}: ${error.message}`
            );
        }
    };
};

/* ==================== REPUBLISH SCHEDULER ==================== */

/**
 * Generates the post-edit republish scheduler.
 *
 * Re-indexes the edited record in place — no suppress. Elasticsearch upserts
 * by id, so re-indexing overwrites; suppressing would only blank the record
 * from public search for the debounce window. Coalesced per record, so a
 * burst of edits collapses to one near-real-time re-index.
 *
 * @param {Object} ctx - Factory context
 * @param {Function} publish_fn - The generated publish function
 * @returns {Function} The scheduler (fire and forget)
 */
const make_handle_republish = (ctx, publish_fn) => {

    const {module_name, label, republish_key} = ctx;
    const name = `handle_${republish_key}_republish`;
    /* the record's own uuid is the last id and the coalescer key */
    const params = [...ctx.parent_params, ctx.uuid_param];

    return async (...args) => {

        const record_id = args[params.length - 1];

        try {

            ctx.coalescer.schedule_reindex(`${republish_key}:${record_id}`, async () => {

                const publish_result = await publish_fn(...args.slice(0, params.length));

                if (publish_result && publish_result.status === true) {
                    LOGGER.module().info(`INFO: [/exhibits/${module_name} (${name})] ${label} re-indexed after edit.`);
                } else {
                    log_failure(module_name, name, `Failed to re-index ${label.toLowerCase()}`);
                }
            });

        } catch (error) {
            log_error(module_name, name, error, id_context(params, args));
        }
    };
};

/* ==================== PUBLISH / SUPPRESS — STANDALONE ==================== */

/**
 * Default gate for both publish and suppress: the record must belong to THIS
 * exhibit before it is flagged, indexed or removed from the index. The
 * publish/suppress task methods key on uuid alone, so this gate is the only
 * thing binding the operation to the exhibit in the URL.
 *
 * @param {Object} ctx - Factory context
 * @returns {Function} (exhibit_id, uuid) => failure envelope | null
 */
const make_membership_gate = (ctx) => {

    return async (exhibit_id, uuid) => {

        const record = await ctx.task[ctx.task_methods.get](exhibit_id, uuid);

        if (!record) {
            return {
                status: false,
                message: `${ctx.label} not found in exhibit`
            };
        }

        return null;
    };
};

/**
 * Generates publish for a standalone component (one that owns an ES doc):
 * the exhibit must be published, the gate must pass, then flag the row and
 * index it.
 *
 * @param {Object} ctx - Factory context
 * @returns {Function} (exhibit_id, uuid) => {status, message}
 */
const make_publish = (ctx) => {

    const {label, module_name, messages, hooks} = ctx;
    const name = ctx.task_methods.publish_public_name;
    const lower = label.toLowerCase();
    const gate = hooks.publish_gate || make_membership_gate(ctx);

    return async (exhibit_id, uuid) => {

        try {

            if (!is_valid_uuid(exhibit_id) || !is_valid_uuid(uuid)) {
                return {status: false, message: INVALID_UUID_MESSAGE};
            }

            const exhibit_record = await ctx.exhibit_task.get_exhibit_record(exhibit_id);

            if (!exhibit_record || exhibit_record.is_published === PUBLICATION_STATUS.UNPUBLISHED) {
                log_failure(module_name, name, 'Exhibit not published');

                return {
                    status: false,
                    message: `Unable to publish ${lower}. Exhibit must be published first`
                };
            }

            const gate_result = await gate(exhibit_id, uuid);

            if (gate_result !== null) {
                return gate_result;
            }

            /*
             * Flag first, then index: a record whose DB flag failed must not
             * reach the public index.
             */
            const is_flagged = await ctx.task[ctx.task_methods.set_publish](uuid);

            if (is_flagged === false) {
                log_failure(module_name, name, `Unable to set ${lower} to published`);
                return {status: false, message: `Unable to publish ${lower}`};
            }

            const is_indexed = await ctx.index_fn(exhibit_id, uuid);

            if (is_indexed === false) {
                log_failure(module_name, name, `Unable to index ${lower}`);
                return {status: false, message: `Unable to publish ${lower}`};
            }

            return {status: true, message: `${label} published`};

        } catch (error) {
            log_error(module_name, name, error, {exhibit_id, uuid});
            return {status: false, message: error.message};
        }
    };
};

/**
 * Generates suppress for a standalone component: gate, drop the ES doc, flag
 * the row (and, for containers, cascade to the children).
 *
 * @param {Object} ctx - Factory context
 * @returns {Function} (exhibit_id, uuid) => {status, message}
 */
const make_suppress = (ctx) => {

    const {label, module_name, hooks} = ctx;
    const name = ctx.task_methods.suppress_public_name;
    const lower = label.toLowerCase();
    const gate = hooks.suppress_gate || make_membership_gate(ctx);

    return async (exhibit_id, uuid) => {

        try {

            if (!is_valid_uuid(exhibit_id) || !is_valid_uuid(uuid)) {
                return {status: false, message: INVALID_UUID_MESSAGE};
            }

            const gate_result = await gate(exhibit_id, uuid);

            if (gate_result !== null) {
                return gate_result;
            }

            const delete_result = await ctx.indexer.delete_record(uuid);

            if (delete_result.status !== STATUS_CODES.NO_CONTENT) {
                log_failure(module_name, name, 'Unable to delete from index');
                return {status: false, message: `Unable to suppress ${lower}`};
            }

            const is_flagged = await ctx.task[ctx.task_methods.set_suppress](uuid);

            /*
             * Containers suppress their OWN children here, keyed by the
             * container uuid. Runs before the flag check.
             */
            if (hooks.cascade_suppress) {
                await hooks.cascade_suppress(uuid);
            }

            if (is_flagged === false) {
                log_failure(module_name, name, `Unable to set ${lower} to suppressed`);
                return {status: false, message: `Unable to suppress ${lower}`};
            }

            return {status: true, message: `${label} suppressed`};

        } catch (error) {
            log_error(module_name, name, error, {exhibit_id, uuid});
            return {status: false, message: error.message};
        }
    };
};

/* ==================== PUBLISH / SUPPRESS — NESTED ==================== */

/**
 * Generates publish for a nested item (one embedded in its container's ES
 * doc): the container must be published, the item must exist, then upsert it
 * into the container doc and flag the row.
 *
 * @param {Object} ctx - Factory context
 * @returns {Function} (exhibit_id, container_id, item_id) => {status, message}
 */
const make_publish_nested = (ctx) => {

    const {label, container_label, module_name} = ctx;
    const name = ctx.task_methods.publish_public_name;
    const lower = label.toLowerCase();

    return async (exhibit_id, container_id, item_id) => {

        try {

            if (!is_valid_uuid(exhibit_id) ||
                !is_valid_uuid(container_id) ||
                !is_valid_uuid(item_id)) {
                return {status: false, message: INVALID_UUID_MESSAGE};
            }

            const container_record = await ctx.task[ctx.task_methods.get_container](exhibit_id, container_id);

            if (!container_record || container_record.is_published === PUBLICATION_STATUS.UNPUBLISHED) {
                log_failure(module_name, name, `${container_label} not published`);

                return {
                    status: false,
                    message: `Unable to publish item. ${container_label} must be published first`
                };
            }

            const item_record = await ctx.task[ctx.task_methods.get](exhibit_id, container_id, item_id);

            if (!item_record) {
                log_failure(module_name, name, `${label} not found`);
                return {status: false, message: `${label} not found`};
            }

            const is_indexed = await ctx.index_fn(container_id, item_id, item_record);

            if (is_indexed === false) {
                log_failure(module_name, name, `Unable to index ${lower}`);
                return {status: false, message: `Unable to publish ${lower}`};
            }

            await ctx.task[ctx.task_methods.update]({
                is_member_of_exhibit: exhibit_id,
                [ctx.parent_key]: container_id,
                uuid: item_id,
                is_published: PUBLICATION_STATUS.PUBLISHED
            });

            return {status: true, message: `${label} published`};

        } catch (error) {
            log_error(module_name, name, error, {exhibit_id, container_id, item_id});
            return {status: false, message: error.message};
        }
    };
};

/**
 * Generates suppress for a nested item.
 *
 * This is where the nested shape genuinely differs from the standalone one:
 * the item has no doc of its own, so it is removed by rewriting the
 * container doc's `items[]` and re-indexing that doc, in that order.
 *
 * @param {Object} ctx - Factory context
 * @returns {Function} (exhibit_id, container_id, item_id) => {status, message}
 */
const make_suppress_nested = (ctx) => {

    const {label, container_label, module_name, messages, hooks} = ctx;
    const name = ctx.task_methods.suppress_public_name;
    const lower = label.toLowerCase();

    return async (exhibit_id, container_id, item_id) => {

        try {

            if (!is_valid_uuid(exhibit_id) ||
                !is_valid_uuid(container_id) ||
                !is_valid_uuid(item_id)) {
                log_failure(module_name, name, INVALID_UUID_MESSAGE);
                return {status: false, message: INVALID_UUID_MESSAGE};
            }

            const gate_result = await hooks.suppress_gate(exhibit_id, container_id, item_id);

            if (gate_result !== null) {
                return gate_result;
            }

            const indexed_record = await ctx.indexer.get_indexed_record(container_id);

            if (!indexed_record || indexed_record.status !== STATUS_CODES.OK) {
                log_failure(module_name, name, `${container_label} ${container_id} not found in index`);
                return {status: false, message: `${container_label} not found in index`};
            }

            if (!indexed_record.data || !indexed_record.data.source) {
                log_failure(module_name, name, messages.index_invalid_message);
                return {status: false, message: messages.index_invalid_message};
            }

            const source = indexed_record.data.source;
            const items = source.items || [];

            source.items = items.filter((item) => item.uuid !== item_id);

            const delete_result = await ctx.indexer.delete_record(container_id);

            if (delete_result.status !== STATUS_CODES.NO_CONTENT) {
                log_failure(module_name, name, `Unable to delete ${container_label.toLowerCase()} from index`);
                return {status: false, message: `Unable to suppress ${lower}`};
            }

            await ctx.task[ctx.task_methods.update]({
                is_member_of_exhibit: exhibit_id,
                [ctx.parent_key]: container_id,
                uuid: item_id,
                is_published: PUBLICATION_STATUS.UNPUBLISHED
            });

            const is_indexed = await ctx.indexer.index_record(source);

            if (is_indexed === true) {
                return {status: true, message: `${label} suppressed`};
            }

            return {status: false, message: `Unable to suppress ${lower}`};

        } catch (error) {
            log_error(module_name, name, error, {exhibit_id, container_id, item_id});
            return {status: false, message: error.message};
        }
    };
};

/* ==================== NESTED ITEM DELETE ==================== */

/**
 * Generates the "drop one item from its container's PUBLIC index doc"
 * helper. No-op when the container is not indexed. Upserts the doc in place
 * so there is no delete gap.
 *
 * @param {Object} ctx - Factory context
 * @returns {Function} (container_id, item_id) => Promise<boolean> — false only
 *          when the doc exists and the upsert failed
 */
const make_remove_from_container_index = (ctx) => {

    return async (container_id, item_id) => {

        const indexed = await ctx.indexer.get_indexed_record(container_id);

        if (!indexed || indexed.status !== STATUS_CODES.OK || !indexed.data || !indexed.data.source) {
            return true;
        }

        const source = indexed.data.source;
        const items = Array.isArray(source.items) ? source.items : [];

        if (!items.some((item) => item.uuid === item_id)) {
            return true;
        }

        source.items = items.filter((item) => item.uuid !== item_id);

        return await ctx.indexer.index_record(source) === true;
    };
};

/**
 * Generates the nested-item delete.
 *
 * The index write happens BEFORE the row delete: if the DB delete then fails
 * the item is merely missing from the public container until its next
 * publish, whereas the reverse order would leave a deleted item live.
 *
 * @param {Object} ctx - Factory context
 * @returns {Function} (exhibit_id, container_id, item_id) => response envelope
 */
const make_delete_nested = (ctx) => {

    const {label, module_name, hooks} = ctx;
    const name = ctx.task_methods.delete_public_name;
    const remove_from_index = make_remove_from_container_index(ctx);

    return async (exhibit_id, container_id, item_id) => {

        try {

            if (!is_valid_uuid(exhibit_id) ||
                !is_valid_uuid(container_id) ||
                !is_valid_uuid(item_id)) {
                return build_response(STATUS_CODES.BAD_REQUEST, INVALID_UUID_MESSAGE);
            }

            if (hooks.delete_gate) {
                const gate_result = await hooks.delete_gate(exhibit_id, container_id, item_id);

                if (gate_result !== null) {
                    return gate_result;
                }
            }

            const index_updated = await remove_from_index(container_id, item_id);

            if (index_updated === false) {
                return build_response(
                    STATUS_CODES.INTERNAL_SERVER_ERROR,
                    `Unable to remove the ${label.toLowerCase()} from the public index; item not deleted`
                );
            }

            const result = await ctx.task[ctx.task_methods.delete](exhibit_id, container_id, item_id);

            await ctx.exhibit_task.update_exhibit_timestamp(exhibit_id);

            return build_response(STATUS_CODES.NO_CONTENT, 'Record deleted', result);

        } catch (error) {
            log_error(module_name, name, error, {exhibit_id, container_id, item_id});
            return build_response(STATUS_CODES.BAD_REQUEST, error.message);
        }
    };
};

/* ==================== REORDER / UNLOCK ==================== */

/**
 * Generates a reorder wrapper: validate the scope uuid and the payload
 * object, then delegate to the task. Any failure resolves false.
 *
 * @param {Object} ctx - Factory context
 * @param {Object} spec - {name, task_method, id_label, data_label}
 * @returns {Function} (scope_id, payload) => Promise<*>
 */
const make_reorder = (ctx, spec) => {

    const {name, task_method, id_label, data_label} = spec;

    return async (scope_id, payload) => {

        try {

            if (!is_valid_uuid(scope_id)) {
                log_failure(ctx.module_name, name, `Invalid ${id_label} UUID provided`);
                return false;
            }

            if (!payload || typeof payload !== 'object') {
                log_failure(ctx.module_name, name, `Invalid ${data_label} data provided`);
                return false;
            }

            return await ctx.task[task_method](scope_id, payload);

        } catch (error) {
            log_error(ctx.module_name, name, error, {[`${id_label}_id`]: scope_id});
            return false;
        }
    };
};

/**
 * Generates an unlock wrapper over the shared lock helper.
 *
 * @param {Object} ctx - Factory context
 * @param {Object} spec - {name, table}
 * @returns {Function} (uid, uuid, options) => Promise<*>
 */
const make_unlock = (ctx, spec) => {

    const {name, table} = spec;

    return async (uid, uuid, options) => {

        try {

            if (!is_valid_user_id(uid) || !is_valid_uuid(uuid)) {
                log_failure(ctx.module_name, name, INVALID_UUID_MESSAGE);
                return false;
            }

            return await ctx.helper.unlock_record(uid, uuid, ctx.db, table, options);

        } catch (error) {
            log_error(ctx.module_name, name, error, {uid, uuid});
            return false;
        }
    };
};

/* ==================== FACTORY ==================== */

/**
 * Builds one component type's model functions.
 *
 * @param {Object} config
 * @param {string} config.module_name - Log prefix, e.g. 'grid_model'
 * @param {string} config.label - User-facing noun, e.g. 'Grid item'. Every
 *        default message is derived from it.
 * @param {string} [config.kind='standalone'] - 'standalone' (owns an ES doc)
 *        or 'nested' (embedded in its container's doc)
 * @param {string} [config.container_label] - nested only, e.g. 'Grid'
 * @param {string} [config.parent_key] - nested only, e.g. 'is_member_of_grid'
 * @param {string} [config.uuid_param='uuid'] - Name of the record's own id
 *        parameter, for log context only
 * @param {Object} config.db - Knex instance (unlock)
 * @param {Object} config.helper - libs/helper instance
 * @param {Object} config.task - The type's task instance
 * @param {Object} config.exhibit_task - Exhibit record task instance
 * @param {Object} config.indexer - indexer/model
 * @param {Object} [config.coalescer] - exhibits/reindex_coalescer
 * @param {Object} [config.rte_profiles={}] - field -> RTE profile
 * @param {string} [config.republish_key] - Coalescer key prefix; its presence
 *        is what makes update extract `is_published` and schedule a republish
 * @param {Function} [config.order_fn] - (data) => Promise<number>
 * @param {Function} [config.index_fn] - standalone: (exhibit_id, uuid);
 *        nested: (container_id, item_id, record)
 * @param {Object} config.task_methods - Task method names plus the public
 *        names the generated functions log under
 * @param {Object} [config.messages={}] - Overrides for the derived messages
 * @param {Object} [config.hooks={}] - prepare_create, prepare_update,
 *        validate_create, validate_update, publish_gate, suppress_gate,
 *        delete_gate, cascade_suppress
 * @param {Array<Object>} [config.reads=[]] - Read specs
 * @param {Array<Object>} [config.reorder=[]] - Reorder specs
 * @param {Array<Object>} [config.unlock=[]] - Unlock specs
 * @returns {Object} {create_record, update_record, publish_record,
 *          suppress_record, delete_record, handle_republish, reads, reorder,
 *          unlock}
 */
const make_component_model = (config) => {

    const label = config.label;

    const ctx = {
        module_name: config.module_name,
        label,
        kind: config.kind || 'standalone',
        container_label: config.container_label || null,
        parent_key: config.parent_key || null,
        uuid_param: config.uuid_param || 'uuid',
        parent_params: config.parent_params || ['is_member_of_exhibit'],
        db: config.db,
        helper: config.helper,
        task: config.task,
        exhibit_task: config.exhibit_task,
        indexer: config.indexer,
        coalescer: config.coalescer || null,
        rte_profiles: config.rte_profiles || {},
        republish_key: config.republish_key || null,
        order_fn: config.order_fn || null,
        index_fn: config.index_fn || null,
        task_methods: config.task_methods || {},
        hooks: config.hooks || {},
        messages: {
            create_error_prefix: `Unable to create ${label.toLowerCase()} record`,
            update_error_prefix: `Unable to update ${label.toLowerCase()} record`,
            update_failure_status: STATUS_CODES.INTERNAL_SERVER_ERROR,
            update_returns_uuid: true,
            index_invalid_message: 'Invalid indexed record',
            ...(config.messages || {})
        }
    };

    const model = {reads: {}, reorder: {}, unlock: {}};

    if (ctx.task_methods.publish_public_name) {
        model.publish_record = ctx.kind === 'nested' ? make_publish_nested(ctx) : make_publish(ctx);
    }

    if (ctx.task_methods.suppress_public_name) {
        model.suppress_record = ctx.kind === 'nested' ? make_suppress_nested(ctx) : make_suppress(ctx);
    }

    if (ctx.republish_key) {
        model.handle_republish = make_handle_republish(ctx, model.publish_record);
    }

    if (ctx.task_methods.create) {
        model.create_record = make_create(ctx);
    }

    if (ctx.task_methods.update) {
        model.update_record = make_update(ctx, model.handle_republish || null);
    }

    if (ctx.task_methods.delete) {
        model.delete_record = make_delete_nested(ctx);
    }

    for (const spec of config.reads || []) {
        model.reads[spec.name] = make_read(ctx, spec);
    }

    for (const spec of config.reorder || []) {
        model.reorder[spec.name] = make_reorder(ctx, spec);
    }

    for (const spec of config.unlock || []) {
        model.unlock[spec.name] = make_unlock(ctx, spec);
    }

    return model;
};

module.exports = {
    STATUS_CODES,
    PUBLICATION_STATUS,
    INVALID_UUID_MESSAGE,
    INVALID_EXHIBIT_UUID_MESSAGE,
    INVALID_DATA_MESSAGE,
    make_component_model
};
