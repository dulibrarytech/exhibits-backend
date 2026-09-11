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

const Base_tasks = require('../../exhibits/tasks/tasks_helper');

/*
 * Cross-table lookups that answer two questions about media library records:
 *
 *   - which exhibit content still references THIS media record?
 *     (media delete guard — a referenced record must not be soft-deleted)
 *   - which content in THIS exhibit references media that has been deleted?
 *     (exhibit publish gate — deleted media can never be served by the IIIF
 *     routes, so publishing such an item ships a broken viewer)
 *
 * Both read the item and exhibit tables directly. tbl_media_library.exhibits
 * is a client-maintained convenience column, not a reference count, and is
 * never consulted here.
 */

/*
 * Item tables that bind media through media_uuid / thumbnail_media_uuid.
 * `container` names the parent table for grid and timeline items; its
 * internal_name is what staff see in the dashboard.
 */
const ITEM_SOURCES = [
    {
        table: 'item_records',
        record_type: 'item',
        container: null
    },
    {
        table: 'grid_item_records',
        record_type: 'grid_item',
        container: {table: 'grid_records', fk: 'is_member_of_grid'}
    },
    {
        table: 'timeline_item_records',
        record_type: 'timeline_item',
        container: {table: 'timeline_records', fk: 'is_member_of_timeline'}
    }
];

const ROLE_COLUMNS = {
    media: 'media_uuid',
    thumbnail: 'thumbnail_media_uuid'
};

const EXHIBIT_ROLES = {
    hero_image: 'hero_image_media_uuid',
    thumbnail: 'thumbnail_media_uuid'
};

const Media_reference_tasks = class extends Base_tasks {

    constructor(DB, TABLE) {
        super(DB, TABLE);
    }

    _validate_reference_tables() {
        this._validate_database();
        [
            'item_records',
            'grid_item_records',
            'grid_records',
            'timeline_item_records',
            'timeline_records',
            'exhibit_records',
            'exhibit_media_records',
            'media_library_records'
        ].forEach((table) => this._validate_table(table));
    }

    /**
     * Base query for one item table and one media role: live item rows joined
     * to their exhibit (and container, for grid/timeline items) and to the
     * media library row bound in that role. Callers add the WHERE that selects
     * which media rows are of interest.
     * @param {Object} source - ITEM_SOURCES entry
     * @param {string} role - 'media' | 'thumbnail'
     * @returns {Object} Knex query builder
     * @private
     */
    _item_reference_query(source, role) {

        const db = this.DB;
        const T = this.TABLE;
        const has_title = source.record_type !== 'item';
        const container = source.container;

        let query = db(`${T[source.table]} as i`)
            .select(
                'i.uuid',
                'i.is_member_of_exhibit as exhibit_uuid',
                'i.is_published',
                'i.order',
                'i.item_type',
                has_title ? 'i.title as item_title' : db.raw('NULL as item_title'),
                db.raw('? as record_type', [source.record_type]),
                db.raw('? as role', [role]),
                'm.uuid as media_uuid',
                'm.name as media_name',
                'm.is_deleted as media_is_deleted',
                'e.title as exhibit_title',
                'e.is_deleted as exhibit_is_deleted',
                container ? 'c.uuid as container_uuid' : db.raw('NULL as container_uuid'),
                container ? 'c.internal_name as container_name' : db.raw('NULL as container_name'),
                container ? 'c.is_deleted as container_is_deleted' : db.raw('0 as container_is_deleted')
            )
            .join(`${T.media_library_records} as m`, 'm.uuid', `i.${ROLE_COLUMNS[role]}`)
            .leftJoin(`${T.exhibit_records} as e`, 'e.uuid', 'i.is_member_of_exhibit')
            .where('i.is_deleted', 0);

        if (container) {
            query = query.leftJoin(`${T[container.table]} as c`, 'c.uuid', `i.${container.fk}`);
        }

        return query;
    }

    /**
     * Base query for one exhibit-level media role (hero image or thumbnail).
     * Mirrors the read path in exhibit_record_tasks: the active tbl_exhibit_media
     * binding wins, the legacy tbl_exhibits column is the fallback.
     * @param {string} role - 'hero_image' | 'thumbnail'
     * @returns {Object} Knex query builder
     * @private
     */
    _exhibit_reference_query(role) {

        const db = this.DB;
        const T = this.TABLE;
        const bound_uuid = db.raw('COALESCE(b.media_uuid, ??)', [`e.${EXHIBIT_ROLES[role]}`]);

        return db(`${T.exhibit_records} as e`)
            .select(
                'e.uuid',
                'e.uuid as exhibit_uuid',
                'e.is_published',
                db.raw('NULL as `order`'),
                db.raw('NULL as item_type'),
                db.raw('NULL as item_title'),
                db.raw("'exhibit' as record_type"),
                db.raw('? as role', [role]),
                'm.uuid as media_uuid',
                'm.name as media_name',
                'm.is_deleted as media_is_deleted',
                'e.title as exhibit_title',
                'e.is_deleted as exhibit_is_deleted',
                db.raw('NULL as container_uuid'),
                db.raw('NULL as container_name'),
                db.raw('0 as container_is_deleted')
            )
            .leftJoin(`${T.exhibit_media_records} as b`, function () {
                this.on('b.exhibit_uuid', '=', 'e.uuid')
                    .andOnVal('b.media_role', '=', role)
                    .andOnVal('b.is_deleted', '=', 0);
            })
            .join(`${T.media_library_records} as m`, 'm.uuid', '=', bound_uuid);
    }

    /**
     * Every non-deleted item row and every exhibit that still binds the given
     * media record, in any role. Items inside recycled grids/timelines and
     * items of recycled exhibits are included (restoring the container would
     * bring the reference back); their container/exhibit deleted flags say so.
     * @param {string} media_uuid - Media library record UUID
     * @returns {Promise<Array>} Reference rows (empty when unreferenced)
     */
    async get_media_references(media_uuid) {

        try {

            this._validate_reference_tables();
            const uuid = this._validate_uuid(media_uuid, 'media UUID');

            const queries = [];

            for (const source of ITEM_SOURCES) {
                for (const role of Object.keys(ROLE_COLUMNS)) {
                    queries.push(
                        this._item_reference_query(source, role)
                            .where(`i.${ROLE_COLUMNS[role]}`, uuid)
                    );
                }
            }

            for (const role of Object.keys(EXHIBIT_ROLES)) {
                queries.push(
                    this._exhibit_reference_query(role)
                        .where('m.uuid', uuid)
                );
            }

            const results = await Promise.all(queries.map((query) => this._with_timeout(query)));
            const references = results.flat();

            this._log_success('Media references retrieved', {
                media_uuid: uuid,
                count: references.length
            });

            return references;

        } catch (error) {
            this._handle_error(error, 'get_media_references', {media_uuid});
        }
    }

    /**
     * Content in one exhibit that is bound to soft-deleted media: live standard
     * items, grid/timeline items in live containers, and the exhibit's own hero
     * image / thumbnail. Used by the publish gate, so recycled containers are
     * skipped — they are not published with the exhibit.
     * @param {string} exhibit_uuid - Exhibit UUID
     * @returns {Promise<Array>} Reference rows (empty when nothing is bound to deleted media)
     */
    async get_deleted_media_references(exhibit_uuid) {

        try {

            this._validate_reference_tables();
            const uuid = this._validate_uuid(exhibit_uuid, 'exhibit UUID');

            const queries = [];

            for (const source of ITEM_SOURCES) {
                for (const role of Object.keys(ROLE_COLUMNS)) {
                    let query = this._item_reference_query(source, role)
                        .where('i.is_member_of_exhibit', uuid)
                        .where('m.is_deleted', 1);

                    if (source.container) {
                        query = query.where('c.is_deleted', 0);
                    }

                    queries.push(query);
                }
            }

            for (const role of Object.keys(EXHIBIT_ROLES)) {
                queries.push(
                    this._exhibit_reference_query(role)
                        .where('e.uuid', uuid)
                        .where('m.is_deleted', 1)
                );
            }

            const results = await Promise.all(queries.map((query) => this._with_timeout(query)));
            const references = results.flat();

            this._log_success('Deleted media references retrieved', {
                exhibit_uuid: uuid,
                count: references.length
            });

            return references;

        } catch (error) {
            this._handle_error(error, 'get_deleted_media_references', {exhibit_uuid});
        }
    }
};

module.exports = Media_reference_tasks;
