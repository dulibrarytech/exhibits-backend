/**
 * Guards for config/exhibit_fields.js — the single home for the field
 * whitelists the exhibit task classes write with.
 *
 * The nine lists used to be method-local consts in five files, which made
 * "can a client set this column?" a nine-file review (DRY review 2026-09-03,
 * cluster S7 and bug #6). These tests state the rule once, over every list at
 * once, so a future edit that reintroduces server-owned state into a create
 * surface fails here rather than in production.
 *
 * The per-class create-whitelist pin tests in
 * exhibit_{grid,heading,timeline}_record_tasks.test.js are kept as well: they
 * assert the task METHOD passes the right list to the sanitizer, which is the
 * other half of the guarantee.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const FIELDS = require('../../config/exhibit_fields');

/* Owned by the server; a create request must never be able to set it. */
const SERVER_OWNED_STATE = ['is_locked', 'locked_by_user', 'locked_at', 'is_deleted'];

describe('config/exhibit_fields', () => {

    describe('create whitelists exclude server-owned lock and recycle state', () => {

        const CREATE_LISTS = {
            GRID_ITEM_CREATE_FIELDS: FIELDS.GRID_ITEM_CREATE_FIELDS,
            TIMELINE_ITEM_CREATE_FIELDS: FIELDS.TIMELINE_ITEM_CREATE_FIELDS,
            HEADING_CREATE_FIELDS: FIELDS.HEADING_CREATE_FIELDS,
            GRID_CREATE_FIELDS: FIELDS.GRID_CREATE_FIELDS,
            TIMELINE_CREATE_FIELDS: FIELDS.TIMELINE_CREATE_FIELDS,
            ITEM_CREATE_OPTIONAL_FIELDS: FIELDS.ITEM_CREATE_OPTIONAL_FIELDS
        };

        for (const [name, list] of Object.entries(CREATE_LISTS)) {
            test(`${name}`, () => {
                for (const field of SERVER_OWNED_STATE) {
                    expect(list).not.toContain(field);
                }
            });
        }

    });

    describe('derived lists', () => {

        test('grid-item and timeline-item create lists differ only by the parent key', () => {
            const grid = FIELDS.GRID_ITEM_CREATE_FIELDS.filter((f) => f !== 'is_member_of_grid');
            const timeline = FIELDS.TIMELINE_ITEM_CREATE_FIELDS.filter((f) => f !== 'is_member_of_timeline');

            expect(grid).toEqual(timeline);
            expect(grid).toHaveLength(29);
        });

        test('container-item update adds lock state to the create content set', () => {
            for (const field of FIELDS.CONTAINER_ITEM_CONTENT_FIELDS) {
                expect(FIELDS.CONTAINER_ITEM_UPDATE_FIELDS).toContain(field);
            }
            for (const field of FIELDS.LOCK_STATE_FIELDS) {
                expect(FIELDS.CONTAINER_ITEM_UPDATE_FIELDS).toContain(field);
            }
        });

        test('standard items carry neither title nor date', () => {
            expect(FIELDS.STANDARD_ITEM_CONTENT_FIELDS).not.toContain('title');
            expect(FIELDS.STANDARD_ITEM_CONTENT_FIELDS).not.toContain('date');
            expect(FIELDS.ITEM_UPDATE_FIELDS).not.toContain('title');
            expect(FIELDS.ITEM_UPDATE_FIELDS).not.toContain('date');
            /* …but do carry the margin/alignment pair container items lack. */
            expect(FIELDS.ITEM_UPDATE_FIELDS).toContain('margins');
            expect(FIELDS.ITEM_UPDATE_FIELDS).toContain('text_alignment');
            expect(FIELDS.CONTAINER_ITEM_UPDATE_FIELDS).not.toContain('margins');
        });

        test('container_item_create_fields is parameterized by the parent key', () => {
            expect(FIELDS.container_item_create_fields('is_member_of_grid'))
                .toEqual([...FIELDS.GRID_ITEM_CREATE_FIELDS]);
        });
    });

    describe('immutability', () => {

        test('every exported list is frozen', () => {
            for (const [name, value] of Object.entries(FIELDS)) {
                if (Array.isArray(value)) {
                    expect(Object.isFrozen(value)).toBe(true);
                    expect(name).toBeTruthy();
                }
            }
        });
    });

    describe('the exhibit task class reads its lists from here', () => {

        test('FIELDS / UPDATE_FIELDS / PROTECTED_FIELDS are the config lists', () => {
            const Exhibit_record_tasks = require('../../exhibits/tasks/exhibit_record_tasks');
            const task = new Exhibit_record_tasks(jest.fn(), {exhibit_records: 'tbl_exhibits'});

            expect(task.FIELDS).toBe(FIELDS.EXHIBIT_SELECT_FIELDS);
            expect(task.UPDATE_FIELDS).toBe(FIELDS.EXHIBIT_UPDATE_FIELDS);
            expect(task.PROTECTED_FIELDS).toBe(FIELDS.EXHIBIT_PROTECTED_FIELDS);
        });

        test('uuid, created, created_by and is_deleted stay protected', () => {
            for (const field of ['uuid', 'created', 'created_by', 'is_deleted']) {
                expect(FIELDS.EXHIBIT_PROTECTED_FIELDS).toContain(field);
                expect(FIELDS.EXHIBIT_UPDATE_FIELDS).not.toContain(field);
            }
        });
    });
});
