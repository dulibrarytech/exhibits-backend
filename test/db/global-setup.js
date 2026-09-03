/**
 * Jest globalSetup for the database-backed task suites.
 *
 * Ensures the e2e database exists, is migrated to HEAD, and has the RBAC
 * catalogs seeded (roles, permissions, grants) — the same preparation the
 * live Playwright suite performs, so the two share one throwaway database.
 * Suites create their own fixture rows and remove them in afterAll.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const { create_knex, db_connection, E2E_DB_NAME } = require('./db');

module.exports = async function global_setup() {

    const mysql = require('mysql2/promise');
    const admin = await mysql.createConnection(db_connection());
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${E2E_DB_NAME}\``);
    await admin.end();

    const knex = create_knex();

    try {
        await knex.migrate.latest();

        const [{ role_count }] = await knex('tbl_user_roles').count({ role_count: '*' });
        if (Number(role_count) === 0) {
            await knex.seed.run();
        }
    } finally {
        await knex.destroy();
    }
};
