'use strict';

const { api_base } = require('../../libs/endpoints_config');

const BASE = api_base('/exhibits');

const ENDPOINTS = {
    timeline_records: {
        get: {
            description: 'Retrieves timeline record by exhibit id and timeline id',
            endpoint: `${BASE}/:exhibit_id/timelines/:timeline_id`,
            params: 'token or api_key, exhibit_id, timeline_id'
        },
        post: {
            description: 'Creates timeline record',
            endpoint: `${BASE}/:exhibit_id/timelines`,
            params: 'token or api_key',
            body: 'is_member_of_exhibit, record data'
        },
        put: {
            description: 'Updates timeline record',
            endpoint: `${BASE}/:exhibit_id/timelines/:timeline_id`,
            params: 'token or api_key',
            body: 'is_member_of_exhibit, timeline_id, record data'
        },
        delete: {
            description: 'Deletes timeline record',
            endpoint: `${BASE}/:exhibit_id/timelines/:timeline_id`,
            params: 'token or api_key'
        }
    },
    timeline_item_records: {
        get: {
            description: 'Retrieves all timeline item records by exhibit id and timeline id',
            endpoint: `${BASE}/:exhibit_id/timelines/:timeline_id/items`,
            params: 'token or api_key, gets all records by exhibit via uuid param'
        },
        post: {
            description: 'Creates timeline item record',
            endpoint: `${BASE}/:exhibit_id/timelines/:timeline_id/items`,
            params: 'token or api_key',
            body: 'is_member_of_exhibit, timeline_id, record data'
        },
        put: {
            description: 'Updates timeline item record',
            endpoint: `${BASE}/:exhibit_id/timelines/:timeline_id/items/:item_id`,
            params: 'token or api_key',
            body: 'is_member_of_exhibit, timeline_id, item_id, record data'
        },
        delete: {
            description: 'Deletes timeline item record',
            endpoint: `${BASE}/:exhibit_id/timelines/:timeline_id/items/:item_id`,
            params: 'token or api_key, uuid'
        }
    },
    timeline_item_record: {
        get: {
            description: 'Retrieves one timeline item record by exhibit id and timeline id',
            endpoint: `${BASE}/:exhibit_id/timelines/:timeline_id/items/:item_id`,
            params: 'token or api_key, is_member_of_exhibit, timeline_id, item_id'
        }
    },
    timeline_item_publish: {
        post: {
            description: 'Publishes timeline item',
            endpoint: `${BASE}/:exhibit_id/timelines/publish/:timeline_id/item/:timeline_item_id`
        }
    },
    timeline_item_suppress: {
        post: {
            description: 'Suppresses timeline item',
            endpoint: `${BASE}/:exhibit_id/timelines/suppress/:timeline_id/item/:timeline_item_id`
        }
    }
};

/*
 * DEPRECATED aliases — see exhibit-endpoints.js for the rationale.
 *
 *   timeline_item_records.timeline_item_publish   → timeline_item_publish
 *       public/app/timeline-items/items.timeline.module.js (338)
 *   timeline_item_records.timeline_item_suppress  → timeline_item_suppress
 *       public/app/timeline-items/items.timeline.module.js (401)
 */
ENDPOINTS.timeline_item_records.timeline_item_publish = ENDPOINTS.timeline_item_publish;
ENDPOINTS.timeline_item_records.timeline_item_suppress = ENDPOINTS.timeline_item_suppress;

module.exports = ENDPOINTS;
