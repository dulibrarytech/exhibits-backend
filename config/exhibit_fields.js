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
 * Field whitelists for the exhibit task classes. Everything a request is
 * allowed to write lives here — one file answers "can a client set this
 * column?".
 *
 * TWO RULES GOVERN THIS FILE:
 *
 * 1. Lock and recycle-bin state (`is_locked`, `locked_by_user`, `locked_at`,
 *    `is_deleted`) is SERVER-OWNED. It must never appear in a CREATE list.
 *    `test/tasks/exhibit_{grid,timeline,heading}_record_tasks.test.js`
 *    each pin that, and `exhibit_fields.test.js` pins it for every list here.
 *    The one exception that remains is called out inline below.
 *
 * 2. `internal_name` is dashboard-only: stored and listed, never indexed.
 *    See the indexer whitelist and its pin test.
 */

/* Lock/recycle state. UPDATE lists only — never a CREATE list. */
const LOCK_STATE_FIELDS = Object.freeze([
    'is_locked', 'locked_by_user', 'locked_at'
]);

/*
 * Content fields shared by grid items and timeline items. Both create lists
 * (which differ only in the parent key) and both update lists derive from
 * this one list.
 */
const CONTAINER_ITEM_CONTENT_FIELDS = Object.freeze([
    'thumbnail', 'thumbnail_media_uuid', 'title', 'caption', 'item_type',
    'mime_type', 'media', 'media_uuid', 'text', 'wrap_text', 'description',
    'type', 'layout', 'media_width', 'media_padding', 'alt_text',
    'is_alt_text_decorative', 'pdf_open_to_page', 'item_subjects', 'styles',
    'order', 'date', 'is_repo_item', 'is_kaltura_item', 'is_embedded'
]);

/**
 * Create whitelist for a container item (grid item / timeline item).
 * @param {string} parent_key - 'is_member_of_grid' or 'is_member_of_timeline'
 * @returns {Array<string>} Frozen field list
 */
const container_item_create_fields = (parent_key) => Object.freeze([
    'uuid', parent_key, 'is_member_of_exhibit',
    ...CONTAINER_ITEM_CONTENT_FIELDS,
    'is_published', 'owner'
]);

/* Update whitelist shared by grid items and timeline items. */
const CONTAINER_ITEM_UPDATE_FIELDS = Object.freeze([
    ...CONTAINER_ITEM_CONTENT_FIELDS,
    'is_published',
    ...LOCK_STATE_FIELDS,
    'owner'
]);

/*
 * Standard items are container items minus `title` and `date` (they carry
 * neither column) plus the margin/alignment pair.
 */
const STANDARD_ITEM_CONTENT_FIELDS = Object.freeze(
    CONTAINER_ITEM_CONTENT_FIELDS.filter((field) => field !== 'title' && field !== 'date')
);

const ITEM_UPDATE_FIELDS = Object.freeze([
    ...STANDARD_ITEM_CONTENT_FIELDS,
    'is_published',
    ...LOCK_STATE_FIELDS,
    'owner', 'margins', 'text_alignment'
]);

/*
 * Standard-item CREATE does not sanitize against a whitelist: it builds an
 * explicit record then lets the request override this subset (the columns a
 * client may choose at create time). Listed here so the create surface is
 * auditable alongside every other one.
 */
const ITEM_CREATE_OPTIONAL_FIELDS = Object.freeze([
    'wrap_text', 'media_width', 'media_padding', 'is_alt_text_decorative',
    'pdf_open_to_page', 'order', 'is_repo_item', 'is_kaltura_item',
    'is_embedded', 'is_published', 'owner', 'type', 'layout', 'margins',
    'text_alignment'
]);

/* Headings carry no media and no date. */
const HEADING_CONTENT_FIELDS = Object.freeze([
    'type', 'text', 'order', 'styles', 'is_visible', 'is_anchor'
]);

const HEADING_CREATE_FIELDS = Object.freeze([
    'is_member_of_exhibit', 'uuid',
    ...HEADING_CONTENT_FIELDS,
    'is_published', 'is_indexed', 'owner', 'margins', 'text_alignment'
]);

const HEADING_UPDATE_FIELDS = Object.freeze([
    ...HEADING_CONTENT_FIELDS,
    'is_published',
    ...LOCK_STATE_FIELDS,
    'is_indexed', 'owner', 'margins', 'text_alignment'
]);

/* Grid containers: `columns` is theirs alone; `internal_name` is staff-only. */
const GRID_CREATE_FIELDS = Object.freeze([
    'uuid', 'is_member_of_exhibit', 'type', 'columns', 'margins', 'text_alignment',
    'text', 'internal_name', 'styles', 'order', 'is_published', 'owner', 'created_by'
]);

/*
 * NOTE: this is an UPDATE list, so `is_deleted` does not violate rule 1 —
 * but it is the only container update that lets a request recycle (or
 * un-recycle) a row directly, and no model sends it: grid_model never writes
 * `is_deleted`.
 */
const GRID_UPDATE_FIELDS = Object.freeze([
    'type', 'columns', 'text', 'internal_name', 'styles', 'margins', 'text_alignment',
    'order', 'is_deleted', 'is_published', 'updated_by'
]);

/* Timeline containers carry no `title` and no `columns`. */
const TIMELINE_CREATE_FIELDS = Object.freeze([
    'uuid', 'is_member_of_exhibit', 'type', 'text', 'internal_name', 'styles', 'order',
    'is_published', 'owner', 'margins', 'text_alignment'
]);

const TIMELINE_UPDATE_FIELDS = Object.freeze([
    'type', 'text', 'internal_name', 'styles', 'order', 'is_published',
    'owner', 'margins', 'text_alignment'
]);

/*
 * Exhibit records use a third convention: the task class reads these off
 * `this` (FIELDS is a SELECT list, not a write whitelist).
 */
const EXHIBIT_SELECT_FIELDS = Object.freeze([
    'uuid', 'type', 'title', 'subtitle', 'banner_template', 'about_the_curators',
    'alert_text', 'hero_image', 'thumbnail', 'description', 'page_layout',
    'exhibit_template', 'exhibit_subjects', 'styles', 'order', 'is_published', 'is_preview',
    'is_featured', 'is_locked', 'locked_by_user', 'is_student_curated',
    'owner', 'created', 'updated', 'created_by', 'updated_by'
]);

const EXHIBIT_UPDATE_FIELDS = Object.freeze([
    'type', 'title', 'subtitle', 'banner_template', 'about_the_curators',
    'alert_text', 'hero_image', 'thumbnail', 'description', 'page_layout',
    'exhibit_template', 'exhibit_subjects', 'styles', 'order', 'is_published',
    'is_preview', 'is_featured', 'is_locked', 'is_student_curated', 'owner'
]);

/* Rejected outright by the exhibit sanitizer rather than merely ignored. */
const EXHIBIT_PROTECTED_FIELDS = Object.freeze([
    'uuid', 'created', 'created_by', 'is_deleted'
]);

module.exports = {
    LOCK_STATE_FIELDS,
    CONTAINER_ITEM_CONTENT_FIELDS,
    container_item_create_fields,
    GRID_ITEM_CREATE_FIELDS: container_item_create_fields('is_member_of_grid'),
    TIMELINE_ITEM_CREATE_FIELDS: container_item_create_fields('is_member_of_timeline'),
    CONTAINER_ITEM_UPDATE_FIELDS,
    STANDARD_ITEM_CONTENT_FIELDS,
    ITEM_CREATE_OPTIONAL_FIELDS,
    ITEM_UPDATE_FIELDS,
    HEADING_CONTENT_FIELDS,
    HEADING_CREATE_FIELDS,
    HEADING_UPDATE_FIELDS,
    GRID_CREATE_FIELDS,
    GRID_UPDATE_FIELDS,
    TIMELINE_CREATE_FIELDS,
    TIMELINE_UPDATE_FIELDS,
    EXHIBIT_SELECT_FIELDS,
    EXHIBIT_UPDATE_FIELDS,
    EXHIBIT_PROTECTED_FIELDS
};
