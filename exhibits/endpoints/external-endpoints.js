'use strict';

const { APP_PATH } = require('./endpoints_config');

module.exports = {
    repo_items: {
        description: 'Retrieves repository item metadata',
        endpoint: `${APP_PATH}/repo/:uuid`,
        params: 'token or api_key, gets repository item metadata'
    },
    kaltura_items: {
        description: 'Retrieves Kaltura item metadata',
        endpoint: `${APP_PATH}/kaltura/:entry_id`,
        params: 'token or api_key, gets Kaltura item metadata'
    },
    item_subjects: {
        description: 'Retrieves Subject terms',
        endpoint: `${APP_PATH}/subjects`,
        params: 'token or api_key, gets subject terms from specialcollections.du.edu'
    }
};
