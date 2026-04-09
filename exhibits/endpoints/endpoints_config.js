'use strict';

const APP_CONFIG = require('../../config/app_config')();
const APP_PATH = APP_CONFIG.app_path;
const PREFIX = '/api/';
const VERSION = 'v1';
const ENDPOINT = '/exhibits';

module.exports = {
    APP_PATH,
    PREFIX,
    VERSION,
    ENDPOINT
};
