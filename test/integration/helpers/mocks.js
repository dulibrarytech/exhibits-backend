/**
 * Shared scaffolding for the Jest integration suite (test/integration).
 *
 * Every export is a plain factory so it can be called from inside a hoisted
 * `jest.mock(path, factory)` call:
 *
 *     jest.mock('../../libs/log4', () => require('./helpers/mocks').log4_factory());
 *
 * Jest hoists `jest.mock` above the file's imports and only lets the factory
 * reference `mock`-prefixed locals or things it requires itself — hence the
 * inline `require` in the pattern above. The factory runs lazily, the first
 * time the mocked module is required, so by then the test file's own
 * top-level constants (e.g. a `mockCheckPermission` spy) already exist.
 *
 * Requiring this module also pins `process.env.APP_PATH` (the real endpoints
 * modules build their paths from it at require time), so require it before
 * any source module in files that mount real routers.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

/*
 * ==================== CONSTANTS ====================
 *
 * These replaced the `global.TEST_UUID` / `global.TEST_USER_UID` globals that
 * jest.integration.setup.js used to define: every suite re-declared them
 * locally anyway, so an explicit import is both greppable and lint-friendly.
 */
process.env.APP_PATH = process.env.APP_PATH || '/exhibits-dashboard';

const APP_PATH = process.env.APP_PATH;
const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_UID = '660e8400-e29b-41d4-a716-446655440001';

/* Express middleware that always continues. */
const passthrough = (req, res, next) => next();

/*
 * ==================== MODULE FACTORIES ====================
 */

/**
 * `libs/log4` replacement: `module()` returns a logger whose four methods are
 * silent spies.
 */
function log4_factory() {
    return {
        module: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() })
    };
}

/**
 * `libs/tokens` replacement.
 *
 * @param {object} [options]
 * @param {object|null} [options.decoded={ sub: TEST_USER_UID }] value assigned
 *   to `req.decoded`; pass `null` to leave the request untouched
 * @param {object} [options.user] when given, assigned to `req.user` INSTEAD of
 *   setting `req.decoded`
 * @param {boolean} [options.require_header=false] when true the middleware
 *   answers 401 `{ message: 'Unauthorized request' }` unless an
 *   `x-access-token` header is present (mirrors the real verify)
 * @param {string[]} [options.methods=['verify']] middleware names to expose
 *   (e.g. `['verify', 'verify_with_query']`); all share one behaviour
 * @param {boolean} [options.wrap=true] wrap each middleware in `jest.fn` so
 *   tests can `mockImplementation` it; `false` yields plain functions
 * @param {object} [options.extra] additional members merged into the module
 *   (e.g. `create`, `set_auth_cookie`, `verify_shared`, `create_shared`)
 */
function tokens_factory(options = {}) {

    const {
        decoded = { sub: TEST_USER_UID },
        user,
        require_header = false,
        methods = ['verify'],
        wrap = true,
        extra = {}
    } = options;

    const middleware = (req, res, next) => {

        if (require_header && !req.headers['x-access-token']) {
            return res.status(401).json({ message: 'Unauthorized request' });
        }

        if (user !== undefined) {
            req.user = user;
        } else if (decoded !== null) {
            req.decoded = decoded;
        }

        return next();
    };

    const module = {};

    for (const name of methods) {
        module[name] = wrap ? jest.fn(middleware) : middleware;
    }

    return Object.assign(module, extra);
}

/**
 * `auth/authorize` replacement.
 *
 * @param {object} [options]
 * @param {boolean} [options.allow=true] resolved value of the default
 *   `check_permission` spy
 * @param {Function} [options.check_permission] custom implementation — use
 *   `(...args) => mockCheckPermission(...args)` to delegate to a file-local
 *   spy the tests drive per case
 * @param {object} [options.extra] additional members (e.g. `get_actor_id`)
 */
function authorize_factory(options = {}) {

    const { allow = true, check_permission, extra = {} } = options;

    return {
        check_permission: check_permission || jest.fn().mockResolvedValue(allow),
        ...extra
    };
}

/**
 * `config/rate_limits_loader` replacement whose limiters are all
 * pass-through.
 *
 * With `names`, only those limiters exist (so a route that references an
 * unlisted limiter still fails registration, as it would have with the
 * original explicit map). Without `names`, a Proxy answers every key.
 *
 * @param {string[]} [names]
 */
function rate_limits_factory(names) {

    if (!Array.isArray(names)) {
        return { rate_limits: new Proxy({}, { get: () => passthrough }) };
    }

    const rate_limits = {};

    for (const name of names) {
        rate_limits[name] = passthrough;
    }

    return { rate_limits };
}

/**
 * `config/db_tables_config` replacement: the module exports a function
 * returning `{ exhibits: <map> }`.
 *
 * @param {object} exhibits_map task-name -> physical table name
 */
function db_tables_factory(exhibits_map) {
    return () => ({ exhibits: exhibits_map });
}

/*
 * ==================== TEST-SIDE HELPERS ====================
 */

/**
 * Builds a request path from a registered endpoint template so the tests
 * exercise exactly the strings the router was mounted with.
 *
 * The replacement anchors on the following segment boundary so a short key
 * never corrupts a longer one (":grid_id" vs ":grid_item_id").
 *
 * @param {string} template e.g. '/exhibits-dashboard/api/v1/exhibits/:exhibit_id'
 * @param {object} [params] param name -> value
 */
function path_for(template, params = {}) {

    let path = template;

    for (const [key, value] of Object.entries(params)) {
        path = path.replace(new RegExp(`:${key}(?=/|$)`, 'g'), value);
    }

    return path;
}

/**
 * Builds a model/task stand-in: one `jest.fn()` per method name.
 *
 *     mock_model(['get_record', 'update_record'])
 *     mock_model(['get_record'], { update_record: true })
 *     mock_model({ get_record: null, update_record: true })
 *
 * @param {string[]|object} methods method names, each becoming a bare
 *   `jest.fn()`; when an object is passed instead it is taken as `resolves`
 *   (every method resolves) and the remaining arguments shift left
 * @param {object} [resolves] method name -> value the spy resolves with
 *   (`jest.fn().mockResolvedValue(value)`); names need not repeat in `methods`
 * @param {object} [returns] method name -> value the spy returns
 *   synchronously (`jest.fn().mockReturnValue(value)`)
 */
function mock_model(methods, resolves = {}, returns = {}) {

    if (!Array.isArray(methods)) {
        [methods, resolves, returns] = [[], methods, resolves];
    }

    const model = {};
    const has = (map, name) => Object.prototype.hasOwnProperty.call(map, name);

    for (const name of methods) {

        if (has(resolves, name)) {
            model[name] = jest.fn().mockResolvedValue(resolves[name]);
        } else if (has(returns, name)) {
            model[name] = jest.fn().mockReturnValue(returns[name]);
        } else {
            model[name] = jest.fn();
        }
    }

    for (const name of Object.keys(resolves)) {
        if (!has(model, name)) {
            model[name] = jest.fn().mockResolvedValue(resolves[name]);
        }
    }

    for (const name of Object.keys(returns)) {
        if (!has(model, name)) {
            model[name] = jest.fn().mockReturnValue(returns[name]);
        }
    }

    return model;
}

module.exports = {
    APP_PATH,
    TEST_UUID,
    TEST_USER_UID,
    passthrough,
    log4_factory,
    tokens_factory,
    authorize_factory,
    rate_limits_factory,
    db_tables_factory,
    path_for,
    mock_model
};
