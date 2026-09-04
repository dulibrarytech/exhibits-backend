/**
 * Mocked-knex scaffolding for the task-class unit suites (test/tasks).
 *
 * Modelled on test/db/db.js, but nothing here touches a database: the task
 * classes receive a `jest.fn` standing in for the knex instance plus a query
 * builder whose chain methods return the builder and whose terminal methods
 * resolve.
 *
 * Which methods chain and which resolve differs per task class (some call
 * `.timeout()` as the terminal, others await `.update()` directly), so every
 * suite states its own chain explicitly rather than inheriting one shape.
 *
 * `jest` is the `vi` alias installed by test/setup.js — this file is
 * required from Vitest test files, and Vitest refuses a direct
 * `require('vitest')` from CommonJS.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

/* Chain methods shared by the exhibit_*_record_tasks classes. */
const DEFAULT_CHAIN = Object.freeze([
    'select', 'where', 'first', 'insert', 'update', 'delete', 'orderBy', 'count'
]);

/**
 * Builds a fresh query builder.
 *
 * @param {object} [spec]
 * @param {string[]} [spec.chain=DEFAULT_CHAIN] methods that return the
 *   builder (`jest.fn().mockReturnThis()`)
 * @param {object} [spec.resolves] method name -> value the method resolves
 *   with (`jest.fn().mockResolvedValue(value)`); a name present here and in
 *   `chain` resolves
 */
function make_query(spec = {}) {

    const { chain = DEFAULT_CHAIN, resolves = {} } = spec;
    const query = {};

    for (const name of chain) {
        query[name] = jest.fn().mockReturnThis();
    }

    for (const [name, value] of Object.entries(resolves)) {
        query[name] = jest.fn().mockResolvedValue(value);
    }

    return query;
}

/**
 * Builds the knex stand-in: a `jest.fn` that hands back `query` for every
 * table, with `fn.now()` attached unless disabled.
 *
 * @param {object} query builder returned for every `DB(table)` call
 * @param {object} [options]
 * @param {string|false} [options.fn_now='NOW()'] value `DB.fn.now()`
 *   returns; `false` omits `DB.fn` entirely
 */
function make_db(query, options = {}) {

    const { fn_now = 'NOW()' } = options;
    const db = jest.fn(() => query);

    if (fn_now !== false) {
        db.fn = { now: jest.fn(() => fn_now) };
    }

    return db;
}

/*
 * The table map the exhibit_*_record_tasks suites assert against. These are
 * deliberately NOT the physical names (see test/db/db.js for those) so a
 * test that leaks a hard-coded production table name fails loudly.
 */
const TABLES = Object.freeze({
    exhibit_records: 'tbl_exhibit_records',
    heading_records: 'tbl_heading_records',
    item_records: 'tbl_item_records',
    grid_records: 'tbl_grid_records',
    grid_item_records: 'tbl_grid_item_records',
    timeline_records: 'tbl_timeline_records',
    timeline_item_records: 'tbl_timeline_item_records'
});

module.exports = { DEFAULT_CHAIN, make_query, make_db, TABLES };
