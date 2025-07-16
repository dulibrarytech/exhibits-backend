/**

 Copyright 2023 University of Denver

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

const APP_PATH = '/exhibits-dashboard';
const PREFIX = '/api/';
const VERSION = 'v1';
const ENDPOINT = '/exhibits';
const ENDPOINTS = {
    exhibits: {
        exhibit_records: {
            description: 'Gets all exhibit records',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}`,
            endpoints: {
                get: {
                    description: 'Retrieves exhibit record by id',
                    endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id`,
                    params: 'token or api_key, gets all records by exhibit via uuid param - ?type=edit,index,title'
                },
                post: {
                    description: 'Creates exhibit record',
                    endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}`,
                    params: 'token or api_key',
                    body: 'is_member_of_exhibit, record data'
                },
                put: {
                    description: 'Updates exhibit record',
                    endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id`,
                    params: 'token or api_key, uuid',
                    body: 'record data'
                },
                delete: {
                    description: 'Deletes exhibit record',
                    endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id`,
                    params: 'token or api_key, uuid, delete_reason'
                }
            }
        },
        exhibit_media: {
            get: {
                description: 'Gets exhibit media',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/media/:media`
            },
            delete: {
                description: 'Deletes exhibit media',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/media/:media`
            }
        },
        item_media: {
           get: {
               description: 'Gets item media',
               endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/media/items/:media`,
           },
            delete: {
                description: 'Deletes item media',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/media/items/:item_id/:media`
            }
        },
        media: {
            get: {
                description: 'Gets media - hero and thumbnail images before they are part of an exhibit',
                endpoint: `${APP_PATH}/media`
            },
            delete: {
                description: 'Deletes media - hero and thumbnail images before they are part of an exhibit',
                endpoint: `${APP_PATH}/media`
            }
        },
        exhibit_preview: {
          get: {
              description: 'Previews exhibit',
              endpoint: `${APP_PATH}/preview`,
              params: 'token'
          }
        },
        exhibit_shared: {
            get: {
                description: 'Shares exhibit preview',
                endpoint: `${APP_PATH}/shared`,
                params: 'token'
            }
        },
        exhibit_publish: {
            post: {
                description: 'Publishes exhibit',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/publish`
            }
        },
        exhibit_suppress: {
            post: {
                description: 'Suppresses exhibit',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/suppress`
            }
        },
        grid_records: {
            get: {
                description: 'Retrieves all grid records by exhibit id and grid id',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/grids/:grid_id`,
                params: 'token or api_key, exhibit_id, grid_id'
            },
            post: {
                description: 'Creates grid record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/grids`,
                params: 'token or api_key',
                body: 'is_member_of_exhibit, record data'
            },
            put: {
                description: 'Updates grid record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/grids/:grid_id`,
                params: 'token or api_key',
                body: 'is_member_of_exhibit, grid_id, record data'
            }
        },
        grid_item_records: {
            get: {
                description: 'Retrieves all grid item records by exhibit id and grid id',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/grids/:grid_id/items`,
                params: 'token or api_key, gets all records by exhibit via uuid param'
            },
            post: {
                description: 'Creates grid item record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/grids/:grid_id/items`,
                params: 'token or api_key',
                body: 'is_member_of_exhibit, grid_id, record data'
            },
            put: {
                description: 'Creates grid item record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/grids/:grid_id/items/:item_id`,
                params: 'token or api_key',
                body: 'is_member_of_exhibit, grid_id, item_id, record data'
            },
            delete: {
                description: 'Deletes grid item record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/grids/:grid_id/items/:item_id`,
                params: 'token or api_key, uuid'
            },
            grid_item_publish: {
                post: {
                    description: 'Publishes grid item',
                    endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/publish/:grid_id/item/:grid_item_id`
                }
            },
            grid_item_suppress: {
                post: {
                    description: 'Suppresses grid item',
                    endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/suppress/:grid_id/item/:grid_item_id`
                }
            },
        },
        grid_item_record: {
            get: {
                description: 'Retrieves all grid item record by exhibit id and grid id',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/grids/:grid_id/items/:item_id`,
                params: 'token or api_key, is_member_of_exhibit, grid_id, item_id'
            }
        },
        grid_item_media: {
            delete: {
                description: 'Deletes grid item media',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/grids/:grid_id/items/:item_id/media/:media`
            }
        },
        item_records: {
            description: 'Gets all exhibit items',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/items`,
            get: {
                description: 'Retrieves all item records by exhibit',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/items/:item_id`,
                params: 'token or api_key, gets all records by exhibit via uuid param'
            },
            post: {
                description: 'Creates item record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/items`,
                params: 'token or api_key',
                body: 'is_member_of_exhibit, record data'
            },
            put: {
                description: 'Updates item record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/items/:item_id`,
                params: 'token or api_key',
                body: 'record data'
            },
            delete: {
                description: 'Deletes item record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/items/:item_id`,
                params: 'token or api_key, uuid'
            },
            item_publish: {
                post: {
                    description: 'Publishes item',
                    endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/publish/:item_id/item`
                }
            },
            item_suppress: {
                post: {
                    description: 'Suppresses item',
                    endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/suppress/:item_id/item`
                }
            }
        },
        heading_records: {
            get: {
                description: 'Retrieves all heading record by exhibit',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/headings/:heading_id`,
                params: 'token or api_key, gets all records by exhibit'
            },
            post: {
                description: 'Creates heading record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/headings`,
                params: 'token or api_key',
                body: 'record data'
            },
            put: {
                description: 'Updates heading record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/headings/:heading_id`,
                params: 'token or api_key',
                body: 'record data'
            },
            delete: {
                description: 'Deletes heading record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/headings/:heading_id`,
                params: 'token or api_key'
            }
        },
        timeline_records: {
            get: {
                description: 'Retrieves all timelines records by exhibit id and timeline id',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/:timeline_id`,
                params: 'token or api_key, exhibit_id, timeline_id'
            },
            post: {
                description: 'Creates timeline record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines`,
                params: 'token or api_key',
                body: 'is_member_of_exhibit, record data'
            },
            put: {
                description: 'Updates timeline record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/:timeline_id`,
                params: 'token or api_key',
                body: 'is_member_of_exhibit, timeline_id, record data'
            },
            delete: {
                description: 'Deletes timeline record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/:timeline_id`,
                params: 'token or api_key'
            }
        },
        timeline_item_records: {
            get: {
                description: 'Retrieves all timeline item records by exhibit id and timeline id',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/:timeline_id/items`,
                params: 'token or api_key, gets all records by exhibit via uuid param'
            },
            post: {
                description: 'Creates timeline item record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/:timeline_id/items`,
                params: 'token or api_key',
                body: 'is_member_of_exhibit, grid_id, record data'
            },
            put: {
                description: 'Creates timelines item record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/:timeline_id/items/:item_id`,
                params: 'token or api_key',
                body: 'is_member_of_exhibit, grid_id, item_id, record data'
            },
            delete: {
                description: 'Deletes timeline item record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/:timeline_id/items/:item_id`,
                params: 'token or api_key, uuid'
            },
            timeline_item_publish: {
                post: {
                    description: 'Publishes timeline item',
                    endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/publish/:timeline_id/item/:timeline_item_id`
                }
            },
            timeline_item_suppress: {
                post: {
                    description: 'Suppresses timeline item',
                    endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/suppress/:timeline_id/item/:timeline_item_id`
                }
            },
        },
        timeline_item_record: {
            get: {
                description: 'Retrieves all timeline item record by exhibit id and timeline id',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/:timeline_id/items/:item_id`,
                params: 'token or api_key, is_member_of_exhibit, timeline_id, item_id'
            }
        },
        timeline_item_media: {
            delete: {
                description: 'Deletes timeline item media',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/:timeline_id/items/:item_id/media/:media`
            }
        },
        repo_items: {
            description: 'Retrieves repository item metadata',
            endpoint: `${APP_PATH}/repo/:uuid`,
            params: 'token or api_key, gets repository item metadata'
        },
        reorder_exhibits_records: {
            post: {
                description: 'reorders exhibits',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/reorder`,
                params: 'token or api_key',
                body: 'item array of objects'
            }
        },
        reorder_records: { // items
            post: {
                description: 'reorders items in exhibit',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/items/reorder`,
                params: 'token or api_key',
                body: 'item array of objects'
            }
        },
        token_verify: {
            description: 'Verifies token',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/verify`,
            header: 'token',
        },
        recycled_records: {
            get: {
                description: 'Retrieves all records flagged as deleted',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}/recycle`,
                params: 'token or api_key'
            },
            delete: {
                description: 'Permanently deletes a record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}/recycle/:exhibit_id/:uuid/:type`,
                params: 'token or api_key'
            },
            post: {
                description: 'Permanently deletes all trash records',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}/recycle/:exhibit_id/:uuid/:type`,
                params: 'token or api_key'
            },
            put: {
                description: 'Restores trashed record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}/recycle/:exhibit_id/:uuid/:type`,
                params: 'token or api_key'
            }
        }
    }
};

module.exports = function() {
    return ENDPOINTS;
};
