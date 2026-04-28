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

const itemsListDisplayModule = (function() {

    'use strict';

    /**
     * Get app path safely
     */
    const get_app_path = () => {
        try {
            const app_path = window.localStorage.getItem('exhibits_app_path');
            if (!app_path) {
                console.error('App path not found in localStorage');
                return '';
            }
            return app_path;
        } catch (error) {
            console.error('Error accessing localStorage:', error);
            return '';
        }
    };

    /**
     * Get exhibits endpoints safely
     */
    const get_exhibits_endpoints = () => {
        try {
            return endpointsModule.get_exhibits_endpoints();
        } catch (error) {
            console.error('Error getting exhibits endpoints:', error);
            return null;
        }
    };

    const APP_PATH = get_app_path();
    const EXHIBITS_ENDPOINTS = get_exhibits_endpoints();

    let obj = {};

    /**
     * Display error message (XSS-safe)
     */
    const display_error_message = (error_message) => {
        const message_element = document.querySelector('#message');

        if (!message_element) {
            console.error('Message element not found:', error_message);
            return;
        }

        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-danger';
        alert_div.setAttribute('role', 'alert');

        const icon = document.createElement('i');
        icon.className = 'fa fa-exclamation';
        icon.setAttribute('aria-hidden', 'true');
        alert_div.appendChild(icon);

        const text = document.createTextNode(` ${error_message}`);
        alert_div.appendChild(text);

        message_element.textContent = '';
        message_element.appendChild(alert_div);
    };

    /**
     * Create table cell element
     */
    const create_table_cell = (class_name = '', content = null) => {
        const td = document.createElement('td');
        if (class_name) {
            td.className = class_name;
        }
        if (content) {
            if (typeof content === 'string') {
                td.textContent = content;
            } else {
                td.appendChild(content);
            }
        }
        return td;
    };

    /**
     * Create icon element
     */
    const create_icon = (icon_class, title = '', aria_label = '', color = '') => {
        const icon = document.createElement('i');
        icon.className = icon_class;
        icon.setAttribute('aria-hidden', 'true');

        if (title) {
            icon.setAttribute('title', title);
        }

        if (aria_label) {
            icon.setAttribute('aria-label', aria_label);
        }

        if (color) {
            icon.style.color = color;
        }

        return icon;
    };

    /**
     * Create publish/suppress status button
     */
    const create_status_button = (item_id, is_published) => {

        const link = document.createElement('a');
        link.href = '#';
        link.id = item_id;
        link.setAttribute('aria-label', 'Toggle publication status');

        const span = document.createElement('span');

        if (is_published === 1) {
            link.className = 'suppress-item';
            span.id = `suppress-${item_id}`;
            span.setAttribute('title', 'Published - click to unpublish');

            const icon = create_icon('fa fa-cloud', '', '', 'green');
            span.appendChild(icon);
            span.appendChild(document.createElement('br'));

            const text = document.createElement('small');
            text.textContent = 'Published';
            span.appendChild(text);
        } else {
            link.className = 'publish-item';
            span.id = `publish-${item_id}`;
            span.setAttribute('title', 'Unpublished - click to publish');

            const icon = create_icon('fa fa-cloud-upload', '', '', 'darkred');
            span.appendChild(icon);
            span.appendChild(document.createElement('br'));

            const text = document.createElement('small');
            text.textContent = 'Unpublished';
            span.appendChild(text);
        }

        link.appendChild(span);
        return link;
    };

    /**
     * Create order cell with drag handle
     */
    const create_order_cell = (order_number) => {
        const td = document.createElement('td');
        td.className = 'grabbable item-order';

        const icon = create_icon('fa fa-reorder');
        td.appendChild(icon);

        const span = document.createElement('span');
        span.style.paddingLeft = '4px';
        span.setAttribute('aria-label', `Item order ${order_number}`);
        span.textContent = order_number.toString();
        td.appendChild(span);

        return td;
    };

    /**
     * Get icon for item type
     */
    const get_item_type_icon = (item_type) => {
        const icon_map = {
            'text': 'fa fa-file-text-o',
            'image': 'fa fa-image',
            'video': 'fa fa-file-video-o',
            'audio': 'fa fa-file-audio-o',
            'pdf': 'fa fa-file-pdf-o'
        };

        const icon_class = icon_map[item_type] || 'fa fa-file-o';
        return create_icon(icon_class);
    };

    /**
     * Get thumbnail URL for media type
     */
    const get_thumbnail_url = (media_type) => {
        const thumbnail_map = {
            'video': `${APP_PATH}/static/images/video-tn.png`,
            'audio': `${APP_PATH}/static/images/audio-tn.png`,
            'pdf': `${APP_PATH}/static/images/pdf-tn.png`,
            'default': `${APP_PATH}/static/images/image-tn.png`
        };

        return thumbnail_map[media_type] || thumbnail_map['default'];
    };

    /**
     * Decodes HTML entities in a string (XSS middleware encodes at input time)
     */
    const decode_html_entities = (str) => {
        if (!str || typeof str !== 'string') return str;
        const textarea = document.createElement('textarea');
        textarea.innerHTML = str;
        return textarea.value;
    };

    /**
     * Build a thumbnail URL for a media library asset based on its ingest method.
     * Mirrors the routing logic in build_thumbnail_url from the common module.
     * @param {Object} opts
     * @param {string} opts.uuid - Media library asset UUID
     * @param {string} opts.ingest_method - 'upload' | 'repository' | 'kaltura'
     * @param {string} opts.kaltura_thumbnail_url - Kaltura thumbnail URL (if any)
     * @param {string} opts.repo_uuid - Repository UUID (if any)
     * @param {string} opts.thumbnail_path - Physical thumbnail path (if any)
     * @returns {string|null} Thumbnail URL or null
     */
    const build_media_library_thumbnail_url = (opts) => {
        if (!opts || !opts.uuid) return null;

        const token = authModule.get_user_token();
        if (!token) return null;

        // Kaltura assets use their own thumbnail URL
        if (opts.ingest_method === 'kaltura' && opts.kaltura_thumbnail_url) {
            let url = decode_html_entities(opts.kaltura_thumbnail_url);
            if (url.startsWith('http://')) {
                url = url.replace('http://', 'https://');
            }
            return url;
        }

        // Repository imports: repo thumbnail endpoint
        if (opts.ingest_method === 'repository' && opts.repo_uuid) {
            return `${APP_PATH}/api/v1/media/library/repo/thumbnail?uuid=${encodeURIComponent(opts.repo_uuid)}&token=${encodeURIComponent(token)}`;
        }

        // Uploaded files: media library thumbnail endpoint
        if (opts.thumbnail_path) {
            return `${APP_PATH}/api/v1/media/library/thumbnail/${encodeURIComponent(opts.uuid)}?token=${encodeURIComponent(token)}`;
        }

        return null;
    };

    /**
     * Create thumbnail image element with error handling
     */
    const create_thumbnail_image = (src, alt_text, width = 75, height = 75) => {
        const para = document.createElement('p');
        const img = document.createElement('img');

        // Determine default fallback image
        const default_image_url = `${APP_PATH}/static/images/image-tn.png`;

        img.src = src;
        img.alt = alt_text;
        img.width = width;
        img.height = height;

        // Handle broken images (404 errors)
        img.addEventListener('error', function() {
            if (this.src !== default_image_url) {
                console.warn(`Thumbnail failed to load: ${src}, using default image`);
                this.src = default_image_url;
            }
        });

        para.appendChild(img);
        return para;
    };

    /**
     * Display standard items
     */
    obj.display_standard_items = async function(item) {
        try {
            // Validate item
            if (!item || !item.uuid) {
                throw new Error('Invalid item data');
            }

            const tr = document.createElement('tr');
            tr.id = `${item.uuid}_${item.item_type}_${item.type}`;

            // Order cell with drag handle
            tr.appendChild(create_order_cell(item.order));

            // Resolve title and thumbnail
            let title = helperModule.strip_html(helperModule.unescape(item.title || ''));
            let thumbnail_element = null;

            if (item.item_type !== 'text') {

                // ── Media library asset path (preferred) ──
                if (item.thumbnail_media_uuid || item.media_uuid) {

                    if (item.thumbnail_media_uuid) {
                        const thumb_url = build_media_library_thumbnail_url({
                            uuid: item.thumbnail_media_uuid,
                            ingest_method: item.thumbnail_ingest_method,
                            kaltura_thumbnail_url: item.thumbnail_media_kaltura_thumbnail_url,
                            repo_uuid: item.thumbnail_media_repo_uuid,
                            thumbnail_path: item.thumbnail_media_thumbnail_path
                        });

                        if (thumb_url) {
                            thumbnail_element = create_thumbnail_image(thumb_url, title || 'Item thumbnail');
                        } else {
                            thumbnail_element = create_thumbnail_image(get_thumbnail_url(item.item_type), `${item.item_type} thumbnail`);
                        }
                    } else if (item.media_uuid) {
                        const media_thumb_url = build_media_library_thumbnail_url({
                            uuid: item.media_uuid,
                            ingest_method: item.media_ingest_method,
                            kaltura_thumbnail_url: item.media_kaltura_thumbnail_url,
                            repo_uuid: item.media_repo_uuid,
                            thumbnail_path: item.media_thumbnail_path
                        });

                        if (media_thumb_url) {
                            thumbnail_element = create_thumbnail_image(media_thumb_url, title || `${item.item_type} thumbnail`);
                        } else {
                            thumbnail_element = create_thumbnail_image(get_thumbnail_url(item.item_type), `${item.item_type} thumbnail`);
                        }
                    } else {
                        thumbnail_element = create_thumbnail_image(get_thumbnail_url(item.item_type), `${item.item_type} thumbnail`);
                    }
                }
                // ── Legacy: repository items ──
                else if (item.is_repo_item === 1 && item.media) {
                    thumbnail_element = create_thumbnail_image(get_thumbnail_url(item.item_type), `${item.item_type} thumbnail`);
                }
                // ── Legacy: Kaltura items ──
                else if (item.is_kaltura_item === 1) {
                    if (!title || title.length === 0) {
                        title = 'Kaltura Item';
                    }
                    const kaltura_thumbnail = get_thumbnail_url(item.item_type);
                    thumbnail_element = create_thumbnail_image(kaltura_thumbnail, item.item_type + ' thumbnail');
                }
                // ── Legacy: uploaded media with file paths ──
                else {
                    let thumbnail_url = null;

                    if (item.item_type === 'video') {
                        thumbnail_url = `${APP_PATH}/static/images/video-tn.png`;
                    } else if (item.item_type === 'audio') {
                        thumbnail_url = `${APP_PATH}/static/images/audio-tn.png`;
                    } else if (item.item_type === 'pdf') {
                        thumbnail_url = `${APP_PATH}/static/images/pdf-tn.png`;
                    } else if (item.item_type === 'image') {
                        if (item.thumbnail && item.thumbnail.length > 0) {
                            thumbnail_url = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint
                                .replace(':exhibit_id', encodeURIComponent(item.is_member_of_exhibit))
                                .replace(':media', encodeURIComponent(item.thumbnail));
                        } else if (item.media && item.media.length > 0) {
                            thumbnail_url = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint
                                .replace(':exhibit_id', encodeURIComponent(item.is_member_of_exhibit))
                                .replace(':media', encodeURIComponent(item.media));
                        } else {
                            thumbnail_url = `${APP_PATH}/static/images/image-tn.png`;
                        }
                    }

                    if (thumbnail_url) {
                        thumbnail_element = create_thumbnail_image(thumbnail_url, `${item.item_type || 'item'} thumbnail`);
                    }
                }
            }

            // Fallback title from text if needed
            if ((!title || title.length === 0) && item.text && item.text.length > 0) {
                title = helperModule.strip_html(helperModule.unescape(item.text));
                if (title.length > 200) {
                    title = title.substring(0, 200) + '...';
                }
            }

            // Final fallback: media library asset name
            if ((!title || title.length === 0) && item.media_name) {
                title = helperModule.strip_html(helperModule.unescape(item.media_name));
                if (title.length > 200) {
                    title = title.substring(0, 200) + '...';
                }
            }

            // Extract the <img> from the <p> wrapper created by create_thumbnail_image
            let thumbnail_img = null;
            if (thumbnail_element) {
                const img = thumbnail_element.querySelector('img');
                if (img) {
                    thumbnail_img = img;
                }
            }

            // Determine item type icon
            const icon_map = {
                'text': 'fa fa-file-text-o',
                'image': 'fa fa-image',
                'video': 'fa fa-file-video-o',
                'audio': 'fa fa-file-audio-o',
                'pdf': 'fa fa-file-pdf-o'
            };
            const type_icon_class = icon_map[item.item_type] || 'fa fa-file-o';

            // Compute detail URL (always details page regardless of publish status)
            const exhibit_id = encodeURIComponent(item.is_member_of_exhibit);
            const item_id = encodeURIComponent(item.uuid);
            const details_url = item.item_type === 'text'
                ? `${APP_PATH}/items/standard/text/details?exhibit_id=${exhibit_id}&item_id=${item_id}`
                : `${APP_PATH}/items/standard/media/details?exhibit_id=${exhibit_id}&item_id=${item_id}`;

            // Compact item cell
            tr.appendChild(build_compact_item_cell({
                title: title,
                type_label: 'item',
                type_icon_class: type_icon_class,
                thumbnail_img: thumbnail_img,
                is_locked: item.is_locked,
                details_url: details_url
            }));

            // Child items cell (empty for standard items)
            tr.appendChild(build_child_items_cell());

            // Status cell
            const status_td = create_table_cell('item-status', '');
            status_td.style.textAlign = 'center';
            const status_small = document.createElement('small');
            status_small.appendChild(create_status_button(item.uuid, item.is_published));
            status_td.appendChild(status_small);
            tr.appendChild(status_td);

            // Actions dropdown
            let edit_url;
            if (item.is_published === 1) {
                edit_url = item.item_type === 'text'
                    ? `${APP_PATH}/items/standard/text/details?exhibit_id=${exhibit_id}&item_id=${item_id}`
                    : `${APP_PATH}/items/standard/media/details?exhibit_id=${exhibit_id}&item_id=${item_id}`;
            } else {
                edit_url = item.item_type === 'text'
                    ? `${APP_PATH}/items/standard/text/edit?exhibit_id=${exhibit_id}&item_id=${item_id}`
                    : `${APP_PATH}/items/standard/media/edit?exhibit_id=${exhibit_id}&item_id=${item_id}`;
            }

            const delete_url = `${APP_PATH}/items/delete?exhibit_id=${exhibit_id}&item_id=${item_id}&type=item`;

            tr.appendChild(build_actions_cell({
                actions_id: `${item.uuid}-item-actions`,
                edit_url: edit_url,
                edit_label: item.is_published === 1 ? 'Details' : 'Edit',
                edit_icon: item.is_published === 1 ? 'fa-folder-open' : 'fa-edit',
                delete_url: delete_url,
                is_published: item.is_published
            }));

            const container = document.createElement('div');
            container.appendChild(tr);
            return container.innerHTML;

        } catch (error) {
            console.error('Error displaying standard item:', error);
            display_error_message(error.message || 'Unable to display standard item');
            return '';
        }
    };

    /**
     * Display heading items
     */
    obj.display_heading_items = async function(item) {

        try {
            const tr = document.createElement('tr');
            tr.id = `${item.uuid}_${item.type}`;

            // Order cell
            tr.appendChild(create_order_cell(item.order));

            // Compact item cell
            const title = helperModule.strip_html(helperModule.unescape(item.text || ''));
            const exhibit_id = encodeURIComponent(item.is_member_of_exhibit);
            const item_id = encodeURIComponent(item.uuid);
            const details_url = `${APP_PATH}/items/heading/details?exhibit_id=${exhibit_id}&item_id=${item_id}`;

            tr.appendChild(build_compact_item_cell({
                title: title,
                type_label: item.type,
                type_icon_class: 'fa fa-header',
                thumbnail_img: null,
                is_locked: item.is_locked,
                details_url: details_url
            }));

            // Child items cell (empty for headings)
            tr.appendChild(build_child_items_cell());

            // Status cell
            const status_td = create_table_cell('', '');
            status_td.style.textAlign = 'center';
            const status_small = document.createElement('small');
            status_small.appendChild(create_status_button(item.uuid, item.is_published));
            status_td.appendChild(status_small);
            tr.appendChild(status_td);

            // Actions dropdown
            const edit_url = item.is_published === 1
                ? `${APP_PATH}/items/heading/details?exhibit_id=${exhibit_id}&item_id=${item_id}`
                : `${APP_PATH}/items/heading/edit?exhibit_id=${exhibit_id}&item_id=${item_id}`;
            const delete_url = `${APP_PATH}/items/delete?exhibit_id=${exhibit_id}&item_id=${item_id}&type=heading`;

            tr.appendChild(build_actions_cell({
                actions_id: `${item.uuid}-item-actions`,
                edit_url: edit_url,
                edit_label: item.is_published === 1 ? 'Details' : 'Edit',
                edit_icon: item.is_published === 1 ? 'fa-folder-open' : 'fa-edit',
                delete_url: delete_url,
                is_published: item.is_published
            }));

            const container = document.createElement('div');
            container.appendChild(tr);
            return container.innerHTML;

        } catch (error) {
            console.error('Error displaying heading item:', error);
            display_error_message(error.message || 'Unable to display heading item');
            return '';
        }
    };

    /**
     * Display grid items
     */
    obj.display_grids = async function(item) {
        try {
            const tr = document.createElement('tr');
            tr.id = `${item.uuid}_${item.type}`;

            // Order cell
            tr.appendChild(create_order_cell(item.order));

            // Compact item cell
            const title = helperModule.strip_html(helperModule.unescape(item.title || ''));
            const exhibit_id = encodeURIComponent(item.is_member_of_exhibit);
            const item_id = encodeURIComponent(item.uuid);
            const details_url = `${APP_PATH}/items/grid/details?exhibit_id=${exhibit_id}&item_id=${item_id}`;

            tr.appendChild(build_compact_item_cell({
                title: title,
                type_label: 'grid',
                type_icon_class: 'fa fa-th',
                thumbnail_img: null,
                is_locked: item.is_locked,
                details_url: details_url
            }));

            // Child items cell (link to grid items)
            tr.appendChild(build_child_items_cell({
                url: `${APP_PATH}/items/grid/items?exhibit_id=${exhibit_id}&grid_id=${item_id}`,
                title: `View grid items for ${title}`
            }));

            // Status cell
            const status_td = create_table_cell('', '');
            status_td.style.textAlign = 'center';
            const status_small = document.createElement('small');
            status_small.appendChild(create_status_button(item.uuid, item.is_published));
            status_td.appendChild(status_small);
            tr.appendChild(status_td);

            // Actions dropdown
            const edit_url = item.is_published === 1
                ? `${APP_PATH}/items/grid/details?exhibit_id=${exhibit_id}&item_id=${item_id}`
                : `${APP_PATH}/items/grid/edit?exhibit_id=${exhibit_id}&item_id=${item_id}`;
            const delete_url = `${APP_PATH}/items/delete?exhibit_id=${exhibit_id}&item_id=${item_id}&type=grid`;

            tr.appendChild(build_actions_cell({
                actions_id: `${item.uuid}-item-actions`,
                edit_url: edit_url,
                edit_label: item.is_published === 1 ? 'Details' : 'Edit',
                edit_icon: item.is_published === 1 ? 'fa-folder-open' : 'fa-edit',
                delete_url: delete_url,
                is_published: item.is_published
            }));

            const container = document.createElement('div');
            container.appendChild(tr);
            return container.innerHTML;

        } catch (error) {
            console.error('Error displaying grid:', error);
            display_error_message(error.message || 'Unable to display grid');
            return '';
        }
    };

    /**
     * Display grid items (items within a grid container)
     */
    obj.display_grid_items = async function(item) {
        try {
            // Validate required data
            if (!item || !item.uuid) {
                throw new Error('Invalid grid item data');
            }

            item.type = 'griditem';

            const tr = document.createElement('tr');
            tr.id = `${item.uuid}_${item.type}_${item.item_type}`;

            // Order cell with drag handle
            tr.appendChild(create_order_cell(item.order));

            // Resolve title and thumbnail
            let title = helperModule.strip_html(helperModule.unescape(item.title || ''));
            let thumbnail_element = null;

            if (item.item_type !== 'text') {

                // ── Media library asset path (preferred) ──
                if (item.thumbnail_media_uuid || item.media_uuid) {

                    if (item.thumbnail_media_uuid) {
                        const thumb_url = build_media_library_thumbnail_url({
                            uuid: item.thumbnail_media_uuid,
                            ingest_method: item.thumbnail_ingest_method,
                            kaltura_thumbnail_url: item.thumbnail_media_kaltura_thumbnail_url,
                            repo_uuid: item.thumbnail_media_repo_uuid,
                            thumbnail_path: item.thumbnail_media_thumbnail_path
                        });

                        if (thumb_url) {
                            thumbnail_element = create_thumbnail_image(thumb_url, title || 'Grid item thumbnail');
                        } else {
                            thumbnail_element = create_thumbnail_image(get_thumbnail_url(item.item_type), `${item.item_type} thumbnail`);
                        }
                    } else if (item.media_uuid) {
                        const media_thumb_url = build_media_library_thumbnail_url({
                            uuid: item.media_uuid,
                            ingest_method: item.media_ingest_method,
                            kaltura_thumbnail_url: item.media_kaltura_thumbnail_url,
                            repo_uuid: item.media_repo_uuid,
                            thumbnail_path: item.media_thumbnail_path
                        });

                        if (media_thumb_url) {
                            thumbnail_element = create_thumbnail_image(media_thumb_url, title || `${item.item_type} thumbnail`);
                        } else {
                            thumbnail_element = create_thumbnail_image(get_thumbnail_url(item.item_type), `${item.item_type} thumbnail`);
                        }
                    } else {
                        thumbnail_element = create_thumbnail_image(get_thumbnail_url(item.item_type), `${item.item_type} thumbnail`);
                    }
                }
                // ── Legacy: repository items ──
                else if (item.is_repo_item === 1 && item.media) {
                    thumbnail_element = create_thumbnail_image(get_thumbnail_url(item.item_type), 'Repository item thumbnail');
                }
                // ── Legacy: Kaltura items ──
                else if (item.is_kaltura_item === 1) {
                    if (!title) {
                        title = 'Kaltura Item';
                    }
                    thumbnail_element = create_thumbnail_image(get_thumbnail_url(item.item_type), 'Kaltura item thumbnail');
                }
                // ── Legacy: uploaded media with file paths ──
                else if (item.item_type === 'image') {
                    let image_src = '';
                    if (item.thumbnail && item.thumbnail.length > 0) {
                        image_src = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint
                            .replace(':exhibit_id', encodeURIComponent(item.is_member_of_exhibit))
                            .replace(':media', encodeURIComponent(item.thumbnail));
                    } else if (item.media && item.media.length > 0) {
                        image_src = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint
                            .replace(':exhibit_id', encodeURIComponent(item.is_member_of_exhibit))
                            .replace(':media', encodeURIComponent(item.media));
                    } else {
                        image_src = get_thumbnail_url('default');
                    }
                    thumbnail_element = create_thumbnail_image(image_src, title || 'Item image');
                }
                // ── Legacy: non-image media types ──
                else {
                    thumbnail_element = create_thumbnail_image(get_thumbnail_url(item.item_type), `${item.item_type} thumbnail`);
                }
            }

            // Fallback title from text if needed
            if (!title && item.text && item.text.length > 0) {
                title = helperModule.strip_html(helperModule.unescape(item.text));
                if (title.length > 200) {
                    title = title.substring(0, 200) + '...';
                }
            }

            // Final fallback: media library asset name
            if ((!title || title.length === 0) && item.media_name) {
                title = helperModule.strip_html(helperModule.unescape(item.media_name));
                if (title.length > 200) {
                    title = title.substring(0, 200) + '...';
                }
            }

            // Extract the <img> from the <p> wrapper
            let thumbnail_img = null;
            if (thumbnail_element) {
                const img = thumbnail_element.querySelector('img');
                if (img) {
                    thumbnail_img = img;
                }
            }

            // Determine item type icon
            const icon_map = {
                'text': 'fa fa-file-text-o',
                'image': 'fa fa-image',
                'video': 'fa fa-file-video-o',
                'audio': 'fa fa-file-audio-o',
                'pdf': 'fa fa-file-pdf-o'
            };
            const type_icon_class = icon_map[item.item_type] || 'fa fa-file-o';

            // Compute detail URL (always details page regardless of publish status)
            const exhibit_id = encodeURIComponent(item.is_member_of_exhibit);
            const grid_id = encodeURIComponent(item.is_member_of_grid);
            const item_id = encodeURIComponent(item.uuid);
            const details_url = item.item_type === 'text'
                ? `${APP_PATH}/items/grid/item/text/details?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${item_id}`
                : `${APP_PATH}/items/grid/item/media/details?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${item_id}`;

            // Compact item cell
            tr.appendChild(build_compact_item_cell({
                title: title,
                type_label: 'grid item',
                type_icon_class: type_icon_class,
                thumbnail_img: thumbnail_img,
                is_locked: item.is_locked,
                details_url: details_url
            }));

            // Status cell
            const status_td = create_table_cell('', '');
            status_td.style.textAlign = 'center';
            const status_small = document.createElement('small');
            status_small.appendChild(create_status_button(item.uuid, item.is_published));
            status_td.appendChild(status_small);
            tr.appendChild(status_td);

            // Actions dropdown
            let edit_url;
            if (item.is_published === 1) {
                edit_url = item.item_type === 'text'
                    ? `${APP_PATH}/items/grid/item/text/details?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${item_id}`
                    : `${APP_PATH}/items/grid/item/media/details?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${item_id}`;
            } else {
                edit_url = item.item_type === 'text'
                    ? `${APP_PATH}/items/grid/item/text/edit?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${item_id}`
                    : `${APP_PATH}/items/grid/item/media/edit?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${item_id}`;
            }

            const delete_url = `${APP_PATH}/items/grid/item/delete?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${item_id}`;

            tr.appendChild(build_actions_cell({
                actions_id: `${item.uuid}-item-actions`,
                edit_url: edit_url,
                edit_label: item.is_published === 1 ? 'Details' : 'Edit',
                edit_icon: item.is_published === 1 ? 'fa-folder-open' : 'fa-edit',
                delete_url: delete_url,
                is_published: item.is_published
            }));

            const container = document.createElement('div');
            container.appendChild(tr);
            return container.innerHTML;

        } catch (error) {
            console.error('Error displaying grid item:', error);
            display_error_message(error.message || 'Unable to display grid item');
            return '';
        }
    };

    /**
     * Display timeline items
     */
    obj.display_timelines = async function(item) {

        try {
            const tr = document.createElement('tr');
            tr.id = `${item.uuid}_${item.type}`;

            // Order cell
            tr.appendChild(create_order_cell(item.order));

            // Compact item cell
            const title = helperModule.strip_html(helperModule.unescape(item.title || ''));
            const exhibit_id = encodeURIComponent(item.is_member_of_exhibit);
            const item_id = encodeURIComponent(item.uuid);
            const details_url = `${APP_PATH}/items/vertical-timeline/details?exhibit_id=${exhibit_id}&item_id=${item_id}`;

            tr.appendChild(build_compact_item_cell({
                title: title,
                type_label: 'timeline',
                type_icon_class: 'fa fa-clock-o',
                thumbnail_img: null,
                is_locked: item.is_locked,
                details_url: details_url
            }));

            // Child items cell (link to timeline items)
            tr.appendChild(build_child_items_cell({
                url: `${APP_PATH}/items/timeline/items?exhibit_id=${exhibit_id}&timeline_id=${item_id}`,
                title: `View timeline items for ${title}`
            }));

            // Status cell
            const status_td = create_table_cell('', '');
            status_td.style.textAlign = 'center';
            const status_small = document.createElement('small');
            status_small.appendChild(create_status_button(item.uuid, item.is_published));
            status_td.appendChild(status_small);
            tr.appendChild(status_td);

            // Actions dropdown
            const edit_url = item.is_published === 1
                ? `${APP_PATH}/items/vertical-timeline/details?exhibit_id=${exhibit_id}&item_id=${item_id}`
                : `${APP_PATH}/items/vertical-timeline/edit?exhibit_id=${exhibit_id}&item_id=${item_id}`;
            const delete_url = `${APP_PATH}/items/delete?exhibit_id=${exhibit_id}&item_id=${item_id}&type=vertical_timeline`;

            tr.appendChild(build_actions_cell({
                actions_id: `${item.uuid}-item-actions`,
                edit_url: edit_url,
                edit_label: item.is_published === 1 ? 'Details' : 'Edit',
                edit_icon: item.is_published === 1 ? 'fa-folder-open' : 'fa-edit',
                delete_url: delete_url,
                is_published: item.is_published
            }));

            const container = document.createElement('div');
            container.appendChild(tr);
            return container.innerHTML;

        } catch (error) {
            console.error('Error displaying timeline:', error);
            display_error_message(error.message || 'Unable to display timeline');
            return '';
        }
    };

    /**
     * Display timeline item events
     */
    obj.display_timeline_items = async function(item) {

        try {
            // Validate required data
            if (!item || !item.uuid) {
                throw new Error('Invalid timeline item data');
            }

            item.type = 'timelineitem';

            const tr = document.createElement('tr');
            tr.id = `${item.uuid}_${item.type}_${item.item_type}`;

            // Resolve title and thumbnail
            let title = helperModule.strip_html(helperModule.unescape(item.title || ''));
            let thumbnail_element = null;

            if (item.item_type !== 'text') {

                // ── Media library asset path (preferred) ──
                if (item.thumbnail_media_uuid || item.media_uuid) {

                    if (item.thumbnail_media_uuid) {
                        const thumb_url = build_media_library_thumbnail_url({
                            uuid: item.thumbnail_media_uuid,
                            ingest_method: item.thumbnail_ingest_method,
                            kaltura_thumbnail_url: item.thumbnail_media_kaltura_thumbnail_url,
                            repo_uuid: item.thumbnail_media_repo_uuid,
                            thumbnail_path: item.thumbnail_media_thumbnail_path
                        });

                        if (thumb_url) {
                            thumbnail_element = create_thumbnail_image(thumb_url, title || 'Timeline item thumbnail');
                        } else {
                            thumbnail_element = create_thumbnail_image(get_thumbnail_url(item.item_type), `${item.item_type} thumbnail`);
                        }
                    } else if (item.media_uuid) {
                        const media_thumb_url = build_media_library_thumbnail_url({
                            uuid: item.media_uuid,
                            ingest_method: item.media_ingest_method,
                            kaltura_thumbnail_url: item.media_kaltura_thumbnail_url,
                            repo_uuid: item.media_repo_uuid,
                            thumbnail_path: item.media_thumbnail_path
                        });

                        if (media_thumb_url) {
                            thumbnail_element = create_thumbnail_image(media_thumb_url, title || `${item.item_type} thumbnail`);
                        } else {
                            thumbnail_element = create_thumbnail_image(get_thumbnail_url(item.item_type), `${item.item_type} thumbnail`);
                        }
                    } else {
                        thumbnail_element = create_thumbnail_image(get_thumbnail_url(item.item_type), `${item.item_type} thumbnail`);
                    }
                }
                // ── Legacy: repository items ──
                else if (item.is_repo_item === 1 && item.media) {
                    thumbnail_element = create_thumbnail_image(get_thumbnail_url(item.item_type), 'Repository item thumbnail');
                }
                // ── Legacy: Kaltura items ──
                else if (item.is_kaltura_item === 1) {
                    if (!title) {
                        title = 'Kaltura Item';
                    }
                    thumbnail_element = create_thumbnail_image(get_thumbnail_url(item.item_type), 'Kaltura item thumbnail');
                }
                // ── Legacy: uploaded media with file paths ──
                else if (item.item_type === 'image') {
                    let image_src = '';
                    if (item.thumbnail && item.thumbnail.length > 0) {
                        image_src = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint
                            .replace(':exhibit_id', encodeURIComponent(item.is_member_of_exhibit))
                            .replace(':media', encodeURIComponent(item.thumbnail));
                    } else if (item.media && item.media.length > 0) {
                        image_src = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint
                            .replace(':exhibit_id', encodeURIComponent(item.is_member_of_exhibit))
                            .replace(':media', encodeURIComponent(item.media));
                    } else {
                        image_src = get_thumbnail_url('default');
                    }
                    thumbnail_element = create_thumbnail_image(image_src, title || 'Item image');
                }
                // ── Legacy: non-image media types ──
                else {
                    thumbnail_element = create_thumbnail_image(get_thumbnail_url(item.item_type), `${item.item_type} thumbnail`);
                }
            }

            // Fallback title from text if needed
            if (!title && item.text && item.text.length > 0) {
                title = helperModule.unescape(item.text);
                if (title.length > 200) {
                    title = title.substring(0, 200) + '...';
                }
            }

            // Final fallback: media library asset name
            if ((!title || title.length === 0) && item.media_name) {
                title = helperModule.strip_html(helperModule.unescape(item.media_name));
                if (title.length > 200) {
                    title = title.substring(0, 200) + '...';
                }
            }

            // Extract the <img> from the <p> wrapper
            let thumbnail_img = null;
            if (thumbnail_element) {
                const img = thumbnail_element.querySelector('img');
                if (img) {
                    thumbnail_img = img;
                }
            }

            // Determine item type icon
            const icon_map = {
                'text': 'fa fa-file-text-o',
                'image': 'fa fa-image',
                'video': 'fa fa-file-video-o',
                'audio': 'fa fa-file-audio-o',
                'pdf': 'fa fa-file-pdf-o'
            };
            const type_icon_class = icon_map[item.item_type] || 'fa fa-file-o';

            // Compute detail URL (always details page regardless of publish status)
            const exhibit_id = encodeURIComponent(item.is_member_of_exhibit);
            const timeline_id = encodeURIComponent(item.is_member_of_timeline);
            const item_id = encodeURIComponent(item.uuid);
            const details_url = item.item_type === 'text'
                ? `${APP_PATH}/items/vertical-timeline/item/text/details?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${item_id}`
                : `${APP_PATH}/items/vertical-timeline/item/media/details?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${item_id}`;

            // Compact item cell
            tr.appendChild(build_compact_item_cell({
                title: title,
                type_label: 'timeline item',
                type_icon_class: type_icon_class,
                thumbnail_img: thumbnail_img,
                is_locked: item.is_locked,
                details_url: details_url
            }));

            // Date cell (hidden column used for sorting)
            const date_td = create_table_cell('', '');
            date_td.style.textAlign = 'center';

            if (item.date) {
                const item_date = new Date(item.date);
                const year = item_date.getFullYear();
                const month = (item_date.getMonth() + 1).toString().padStart(2, '0');
                const day = item_date.getDate().toString().padStart(2, '0');
                const sort_date = `${year}-${month}-${day}`;

                const date_small = document.createElement('small');
                date_small.textContent = sort_date;
                date_td.appendChild(date_small);
            }

            tr.appendChild(date_td);

            // Status cell
            const status_td = create_table_cell('', '');
            status_td.style.textAlign = 'center';
            const status_small = document.createElement('small');
            status_small.appendChild(create_status_button(item.uuid, item.is_published));
            status_td.appendChild(status_small);
            tr.appendChild(status_td);

            // Actions dropdown
            let edit_url;
            if (item.is_published === 1) {
                edit_url = item.item_type === 'text'
                    ? `${APP_PATH}/items/vertical-timeline/item/text/details?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${item_id}`
                    : `${APP_PATH}/items/vertical-timeline/item/media/details?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${item_id}`;
            } else {
                edit_url = item.item_type === 'text'
                    ? `${APP_PATH}/items/vertical-timeline/item/text/edit?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${item_id}`
                    : `${APP_PATH}/items/vertical-timeline/item/media/edit?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${item_id}`;
            }

            const delete_url = `${APP_PATH}/items/timeline/item/delete?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${item_id}`;

            tr.appendChild(build_actions_cell({
                actions_id: `${item.uuid}-item-actions`,
                edit_url: edit_url,
                edit_label: item.is_published === 1 ? 'Details' : 'Edit',
                edit_icon: item.is_published === 1 ? 'fa-folder-open' : 'fa-edit',
                delete_url: delete_url,
                is_published: item.is_published
            }));

            const container = document.createElement('div');
            container.appendChild(tr);
            return container.innerHTML;

        } catch (error) {
            console.error('Error displaying timeline item:', error);
            display_error_message(error.message || 'Unable to display timeline item');
            return '';
        }
    };

    /**
     * Build dropdown HTML for item actions
     * @param {Object} opts - Options
     * @param {string} opts.edit_url - Edit/details URL
     * @param {string} opts.edit_label - 'Edit' or 'Details'
     * @param {string} opts.edit_icon - Icon class (e.g. 'fa-edit')
     * @param {string} opts.delete_url - Delete URL
     * @param {number} opts.is_published - 1 or 0
     * @returns {string} Dropdown HTML
     */
    const build_item_actions_dropdown_html = (opts) => {

        let delete_html;
        if (opts.is_published === 1) {
            delete_html = `
                    <a class="dropdown-item text-muted disabled"
                       href="#"
                       style="font-size: 0.875rem; pointer-events: none; opacity: 0.5;"
                       title="Can only delete if unpublished">
                        <i class="fa fa-trash mr-2" aria-hidden="true" style="width: 16px;"></i>
                        Delete
                    </a>`;
        } else {
            delete_html = `
                    <a class="dropdown-item text-danger"
                       href="${opts.delete_url}"
                       style="font-size: 0.875rem;">
                        <i class="fa fa-trash mr-2" aria-hidden="true" style="width: 16px;"></i>
                        Delete
                    </a>`;
        }

        return `
            <div class="dropdown" style="display: inline-block; position: relative;">
                <button type="button"
                        class="btn btn-link p-0 border-0 item-actions-toggle"
                        style="color: #6c757d; font-size: 1.25rem; line-height: 1; background: none;"
                        data-toggle="dropdown"
                        data-bs-toggle="dropdown"
                        aria-haspopup="true"
                        aria-expanded="false"
                        title="Actions">
                    <i class="fa fa-ellipsis-v" aria-hidden="true"></i>
                </button>
                <div class="dropdown-menu item-actions-menu">
                    <a class="dropdown-item"
                       href="${opts.edit_url}"
                       style="font-size: 0.875rem;">
                        <i class="fa ${opts.edit_icon} mr-2" aria-hidden="true" style="width: 16px;"></i>
                        ${opts.edit_label}
                    </a>
                    <div class="dropdown-divider"></div>
                    ${delete_html}
                </div>
            </div>
        `;
    };

    /**
     * Setup item action dropdown handlers
     * Called after HTML injection and on DataTable redraws
     */
    obj.setup_item_action_handlers = function() {

        // Initialize Bootstrap dropdowns (support both Bootstrap 4 and 5)
        document.querySelectorAll('.item-actions-toggle').forEach(toggle => {
            if (typeof bootstrap !== 'undefined' && bootstrap.Dropdown) {
                new bootstrap.Dropdown(toggle);
            } else if (typeof $ !== 'undefined' && typeof $.fn.dropdown !== 'undefined') {
                $(toggle).dropdown();
            }
        });

        // Close dropdowns when clicking outside
        document.removeEventListener('click', close_open_item_dropdowns);
        document.addEventListener('click', close_open_item_dropdowns);
    };

    /**
     * Close all open item dropdown menus
     * @param {Event} [e] - Optional click event
     */
    const close_open_item_dropdowns = (e) => {
        if (e && e.target.closest('.dropdown')) {
            return;
        }

        document.querySelectorAll('.item-actions-menu.dropdown-menu.show').forEach(menu => {
            menu.classList.remove('show');
            const toggle = menu.previousElementSibling;
            if (toggle) {
                toggle.setAttribute('aria-expanded', 'false');
            }
        });
    };

    /**
     * Build compact item metadata cell with optional thumbnail
     * @param {Object} opts
     * @param {string} opts.title - Item title
     * @param {string} opts.type_label - Type label (e.g. 'item', 'heading', 'grid', 'timeline')
     * @param {string} opts.type_icon_class - FA icon class for the type
     * @param {HTMLElement|null} [opts.thumbnail_img] - Optional thumbnail img element
     * @param {number} [opts.is_locked] - 1 if locked
     * @param {string} [opts.details_url] - Optional URL for title/thumbnail links
     * @returns {HTMLElement} Table cell
     */
    const build_compact_item_cell = (opts) => {
        const td = document.createElement('td');

        const flex_div = document.createElement('div');
        flex_div.className = 'item-title-cell';
        flex_div.style.cssText = 'display: flex; align-items: center;';

        // Thumbnail (50x50) or placeholder icon
        let thumbnail_element;
        if (opts.thumbnail_img) {
            const default_tn = `${APP_PATH}/static/images/image-tn.png`;
            opts.thumbnail_img.style.cssText = 'width: 50px; height: 50px; object-fit: cover; border-radius: 4px; margin-right: 10px; vertical-align: middle; flex-shrink: 0;';

            // Use inline onerror so the fallback survives innerHTML serialization
            opts.thumbnail_img.setAttribute('onerror', `this.onerror=null; this.src='${default_tn}';`);

            thumbnail_element = opts.thumbnail_img;
        } else {
            // No thumbnail - use a static type icon as placeholder
            const icon_placeholder = document.createElement('div');
            icon_placeholder.style.cssText = 'width: 50px; height: 50px; border-radius: 4px; margin-right: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #f0f0f0; color: #999;';
            const ph_icon = create_icon(opts.type_icon_class);
            ph_icon.style.fontSize = '1.2rem';
            icon_placeholder.appendChild(ph_icon);
            thumbnail_element = icon_placeholder;
        }

        // Wrap thumbnail in link if details_url provided
        if (opts.details_url) {
            const thumb_link = document.createElement('a');
            thumb_link.href = opts.details_url;
            thumb_link.className = 'item-thumbnail-link';
            thumb_link.setAttribute('aria-hidden', 'true');
            thumb_link.setAttribute('tabindex', '-1');
            thumb_link.appendChild(thumbnail_element);
            flex_div.appendChild(thumb_link);
        } else {
            flex_div.appendChild(thumbnail_element);
        }

        // Title + type wrapper
        const title_wrapper = document.createElement('div');

        // Title
        if (opts.title) {
            if (opts.details_url) {
                const title_link = document.createElement('a');
                title_link.href = opts.details_url;
                title_link.className = 'item-title-link';
                title_link.setAttribute('title', opts.title);

                const title_span = document.createElement('small');
                title_span.className = 'item-title';
                title_span.textContent = opts.title;
                title_span.style.fontWeight = 'bold';

                title_link.appendChild(title_span);
                title_wrapper.appendChild(title_link);
            } else {
                const title_span = document.createElement('small');
                title_span.className = 'item-title';
                title_span.textContent = opts.title;
                title_span.setAttribute('title', opts.title);
                title_span.style.fontWeight = 'bold';
                title_wrapper.appendChild(title_span);
            }
        }

        // Lock icon inline
        if (opts.is_locked === 1) {
            title_wrapper.appendChild(document.createTextNode('  '));
            const lock_icon = create_icon('fa fa-lock', 'Record is currently locked', 'exhibit-is-locked', '#BA8E23');
            title_wrapper.appendChild(lock_icon);
        }

        // Type label below
        const type_div = document.createElement('div');
        const type_small = document.createElement('small');
        type_small.style.color = '#6c757d';
        const type_icon = create_icon(opts.type_icon_class);
        type_icon.style.marginRight = '4px';
        type_small.appendChild(type_icon);
        type_small.appendChild(document.createTextNode(opts.type_label));
        type_div.appendChild(type_small);
        title_wrapper.appendChild(type_div);

        flex_div.appendChild(title_wrapper);
        td.appendChild(flex_div);
        return td;
    };

    /**
     * Build child items cell with optional clickable icon
     * @param {Object} [opts] - Options (omit or pass null for an empty cell)
     * @param {string} [opts.url] - URL to view child items
     * @param {string} [opts.title] - Tooltip / aria-label text
     * @returns {HTMLElement} Table cell
     */
    const build_child_items_cell = (opts) => {
        const td = document.createElement('td');
        td.style.cssText = 'text-align: center; vertical-align: middle;';

        if (opts && opts.url) {
            const link = document.createElement('a');
            link.href = opts.url;
            link.className = 'child-items-link';
            link.style.display = 'inline-block';
            link.setAttribute('title', opts.title || 'View child items');
            link.setAttribute('aria-label', opts.title || 'View child items');

            const icon = document.createElement('i');
            icon.className = 'fa fa-list';
            icon.setAttribute('aria-hidden', 'true');

            link.appendChild(icon);
            td.appendChild(link);
        }

        return td;
    };

    /**
     * Build compact actions cell with dropdown
     * @param {Object} opts - Same as build_item_actions_dropdown_html
     * @returns {HTMLElement} Table cell
     */
    const build_actions_cell = (opts) => {
        const td = document.createElement('td');
        td.id = opts.actions_id || '';
        td.className = 'text-center';
        td.innerHTML = build_item_actions_dropdown_html(opts);
        return td;
    };

    /**
     * Initialize module
     */
    obj.init = function() {
        console.debug('Items list displays module initialized');
        return true;
    };

    return obj;

}());
