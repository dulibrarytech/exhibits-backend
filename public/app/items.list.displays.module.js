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
     * Create link element
     */
    const create_link = (href, title, aria_label, icon_class, additional_content = '') => {
        const link = document.createElement('a');
        link.href = href;
        link.setAttribute('title', title);
        link.setAttribute('aria-label', aria_label);

        const icon = create_icon(icon_class);
        link.appendChild(icon);

        if (additional_content) {
            const text = document.createTextNode(additional_content);
            link.appendChild(text);
        }

        return link;
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
            span.appendChild(document.createTextNode('Published'));
        } else {
            link.className = 'publish-item';
            span.id = `publish-${item_id}`;
            span.setAttribute('title', 'Unpublished - click to publish');

            const icon = create_icon('fa fa-cloud-upload', '', '', 'darkred');
            span.appendChild(icon);
            span.appendChild(document.createElement('br'));
            span.appendChild(document.createTextNode('Unpublished'));
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
     * Create edit link based on item type
     */
    const create_edit_link = (item, item_route, is_published) => {
        const exhibit_id = encodeURIComponent(item.is_member_of_exhibit);
        const item_id = encodeURIComponent(item.uuid);
        let url = '';
        let title = '';
        let icon_class = '';

        if (is_published === 1) {
            // Published items - view details
            if (item.item_type === 'text') {
                url = `${APP_PATH}/items/${item_route}/text/details?exhibit_id=${exhibit_id}&item_id=${item_id}`;
            } else if (item.type === 'heading' || item.type === 'grid' || item.type === 'vertical_timeline') {
                // Heading, grid, and timeline items use /items/{route}/details
                url = `${APP_PATH}/items/${item_route}/details?exhibit_id=${exhibit_id}&item_id=${item_id}`;
            } else {
                url = `${APP_PATH}/items/${item_route}/media/details?exhibit_id=${exhibit_id}&item_id=${item_id}`;
            }
            title = 'View details';
            icon_class = 'fa fa-folder-open pr-1';
        } else {
            // Unpublished items - edit
            if (item.item_type === 'text') {
                url = `${APP_PATH}/items/${item_route}/text/edit?exhibit_id=${exhibit_id}&item_id=${item_id}`;
            } else if (item.type === 'heading' || item.type === 'grid' || item.type === 'vertical_timeline') {
                // Heading, grid, and timeline items use /items/{route}/edit
                url = `${APP_PATH}/items/${item_route}/edit?exhibit_id=${exhibit_id}&item_id=${item_id}`;
            } else {
                url = `${APP_PATH}/items/${item_route}/media/edit?exhibit_id=${exhibit_id}&item_id=${item_id}`;
            }
            title = 'Edit item';
            icon_class = 'fa fa-edit pr-1';
        }

        return create_link(url, title, `${title.toLowerCase().replace(' ', '-')}`, icon_class);
    };

    /**
     * Create delete button
     */
    const create_delete_button = (item, is_published) => {
        if (is_published === 1) {
            // Published items cannot be deleted
            const icon = create_icon('fa fa-trash pr-1', 'Can only delete if unpublished', 'delete-disabled', '#d3d3d3');
            return icon;
        } else {
            // Unpublished items can be deleted
            const exhibit_id = encodeURIComponent(item.is_member_of_exhibit);
            const item_id = encodeURIComponent(item.uuid);
            const type = encodeURIComponent(item.type);
            const url = `${APP_PATH}/items/delete?exhibit_id=${exhibit_id}&item_id=${item_id}&type=${type}`;

            return create_link(url, 'Delete item', 'delete-item', 'fa fa-trash pr-1');
        }
    };

    /**
     * Create table row for standard items
     */
    const create_standard_item_row = (item, item_route) => {
        const tr = document.createElement('tr');
        tr.id = `${item.uuid}_${item.item_type}_${item.type}`;

        // Order cell
        tr.appendChild(create_order_cell(item.order));

        // Metadata cell
        const metadata_td = create_item_metadata_cell(item);
        tr.appendChild(metadata_td);

        // Status cell
        const status_td = create_table_cell('', '');
        status_td.style.width = '5%';
        status_td.style.textAlign = 'center';
        const status_button = create_status_button(item.uuid, item.is_published);
        status_td.appendChild(status_button);
        tr.appendChild(status_td);

        // Actions cell
        const actions_td = document.createElement('td');
        actions_td.id = `${item.uuid}-item-actions`;
        actions_td.style.width = '10%';

        const actions_div = document.createElement('div');
        actions_div.className = 'card-text text-sm-center';

        const edit_link = create_edit_link(item, item_route, item.is_published);
        actions_div.appendChild(edit_link);
        actions_div.appendChild(document.createTextNode('\u00A0'));

        const delete_button = create_delete_button(item, item.is_published);
        actions_div.appendChild(delete_button);

        actions_td.appendChild(actions_div);
        tr.appendChild(actions_td);

        return tr;
    };

    /**
     * Create metadata cell content
     */
    const create_item_metadata_cell = (item) => {
        const td = document.createElement('td');
        td.className = 'item-metadata';

        // Type button
        const type_para = document.createElement('p');
        const type_button = document.createElement('button');
        type_button.className = 'btn btn-default';
        type_button.setAttribute('type', 'button');
        type_button.setAttribute('aria-label', `${item.item_type || 'standard'} item`);

        const type_icon = get_item_type_icon(item.item_type);
        type_button.appendChild(type_icon);
        type_button.appendChild(document.createTextNode(' '));

        const type_small = document.createElement('small');
        type_small.textContent = 'standard item';
        type_button.appendChild(type_small);

        type_para.appendChild(type_button);

        // Lock icon if locked
        if (item.is_locked === 1) {
            type_para.appendChild(document.createTextNode('\u00A0\u00A0'));
            const lock_icon = create_icon('fa fa-lock', 'Record is currently locked', 'exhibit-is-locked', '#BA8E23');
            type_para.appendChild(lock_icon);
        }

        td.appendChild(type_para);

        // Title
        const title = helperModule.strip_html(helperModule.unescape(item.title || ''));
        if (title) {
            const title_para = document.createElement('p');
            const title_strong = document.createElement('strong');
            title_strong.textContent = title;
            title_para.appendChild(title_strong);
            td.appendChild(title_para);
        }

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

            // Order cell with drag handle (always show, even for published items)
            tr.appendChild(create_order_cell(item.order));

            // Metadata cell
            const metadata_td = document.createElement('td');
            metadata_td.className = 'item-metadata';

            // Type button
            const type_para = document.createElement('p');
            const type_button = document.createElement('button');
            type_button.className = 'btn btn-default';
            type_button.setAttribute('type', 'button');
            type_button.setAttribute('aria-label', `${item.item_type || 'standard'} item`);

            const type_icon = get_item_type_icon(item.item_type);
            type_button.appendChild(type_icon);
            type_button.appendChild(document.createTextNode(' '));

            const type_small = document.createElement('small');
            type_small.textContent = 'item';
            type_button.appendChild(type_small);

            type_para.appendChild(type_button);

            // Lock icon if locked
            if (item.is_locked === 1) {
                type_para.appendChild(document.createTextNode('\u00A0\u00A0'));
                const lock_icon = create_icon('fa fa-lock', 'Record is currently locked', 'exhibit-is-locked', '#BA8E23');
                type_para.appendChild(lock_icon);
            }

            metadata_td.appendChild(type_para);

            // Title
            let title = helperModule.strip_html(helperModule.unescape(item.title || ''));

            // Handle thumbnails and media
            let thumbnail_element = null;
            let media_text = item.media || '';

            if (item.item_type !== 'text') {
                // Handle repository items
                if (item.is_repo_item === 1 && item.media) {
                    const repo_record = await helperMediaModule.get_repo_item_data(item.media);
                    if (repo_record) {
                        if (!title || title.length === 0) {
                            title = repo_record.title;
                        }
                        const thumbnail_url = helperMediaModule.render_repo_thumbnail(repo_record.thumbnail.data);
                        thumbnail_element = create_thumbnail_image(thumbnail_url, item.uuid);
                    }
                } else if (item.is_kaltura_item === 1) {
                    // Kaltura items
                    if (!title || title.length === 0) {
                        title = 'Kaltura Item';
                    }
                    const kaltura_thumbnail = get_thumbnail_url(item.item_type);
                    thumbnail_element = create_thumbnail_image(kaltura_thumbnail, item.item_type + ' thumbnail');
                } else {
                    // Regular uploaded media
                    let thumbnail_url = null;

                    // Determine thumbnail based on media type
                    if (item.item_type === 'video') {
                        thumbnail_url = `${APP_PATH}/static/images/video-tn.png`;
                        thumbnail_element = create_thumbnail_image(thumbnail_url, 'video-thumbnail');
                    } else if (item.item_type === 'audio') {
                        thumbnail_url = `${APP_PATH}/static/images/audio-tn.png`;
                        thumbnail_element = create_thumbnail_image(thumbnail_url, 'audio-thumbnail');
                    } else if (item.item_type === 'pdf') {
                        thumbnail_url = `${APP_PATH}/static/images/pdf-tn.png`;
                        thumbnail_element = create_thumbnail_image(thumbnail_url, 'pdf-thumbnail');
                    } else if (item.item_type === 'image') {
                        // Images - check for thumbnail or use media file
                        if (!thumbnail_element) {
                            if (item.thumbnail && item.thumbnail.length > 0) {
                                thumbnail_url = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint
                                    .replace(':exhibit_id', encodeURIComponent(item.is_member_of_exhibit))
                                    .replace(':media', encodeURIComponent(item.thumbnail));
                                thumbnail_element = create_thumbnail_image(thumbnail_url, item.uuid + '-thumbnail');
                            } else if (item.media && item.media.length > 0) {
                                thumbnail_url = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint
                                    .replace(':exhibit_id', encodeURIComponent(item.is_member_of_exhibit))
                                    .replace(':media', encodeURIComponent(item.media));
                                thumbnail_element = create_thumbnail_image(thumbnail_url, item.uuid + '-media');
                            } else {
                                thumbnail_url = `${APP_PATH}/static/images/image-tn.png`;
                                thumbnail_element = create_thumbnail_image(thumbnail_url, 'no-thumbnail');
                            }
                        }
                    }
                }
            } else {
                // Text only items
                media_text = 'Text only';
            }

            // Fallback title from text if needed
            if ((!title || title.length === 0) && item.text && item.text.length > 0) {
                title = helperModule.strip_html(helperModule.unescape(item.text));
                if (title.length > 200) {
                    title = title.substring(0, 200) + '...';
                }
            }

            // Add title
            if (title) {
                const title_para = document.createElement('p');
                const strong = document.createElement('strong');
                strong.textContent = title;
                title_para.appendChild(strong);
                metadata_td.appendChild(title_para);
            }

            // Add thumbnail
            if (thumbnail_element) {
                metadata_td.appendChild(thumbnail_element);
            }

            // Add media filename
            if (media_text) {
                const media_small = document.createElement('small');
                const media_em = document.createElement('em');
                media_em.textContent = media_text;
                media_small.appendChild(media_em);
                metadata_td.appendChild(media_small);
            }

            tr.appendChild(metadata_td);

            // Status cell
            const status_td = create_table_cell('item-status', '');
            const status_small = document.createElement('small');
            const status_button = create_status_button(item.uuid, item.is_published);
            status_small.appendChild(status_button);
            status_td.appendChild(status_small);
            tr.appendChild(status_td);

            // Actions cell
            const actions_td = document.createElement('td');
            actions_td.id = `${item.uuid}-item-actions`;
            actions_td.style.width = '10%';

            const actions_div = document.createElement('div');
            actions_div.className = 'card-text text-sm-center';

            const edit_link = create_edit_link(item, 'standard', item.is_published);
            actions_div.appendChild(edit_link);
            actions_div.appendChild(document.createTextNode('\u00A0'));

            const delete_button = create_delete_button(item, item.is_published);
            actions_div.appendChild(delete_button);

            actions_td.appendChild(actions_div);
            tr.appendChild(actions_td);

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

            // Metadata cell
            const metadata_td = document.createElement('td');
            metadata_td.className = 'item-metadata';

            const type_para = document.createElement('p');
            const type_button = document.createElement('button');
            type_button.className = 'btn btn-default';
            type_button.setAttribute('type', 'button');
            type_button.setAttribute('aria-label', 'heading item');

            const icon = create_icon('fa fa-header');
            type_button.appendChild(icon);
            type_button.appendChild(document.createTextNode(' '));

            const small = document.createElement('small');
            small.textContent = 'heading';
            type_button.appendChild(small);

            type_para.appendChild(type_button);

            // Lock icon if locked
            if (item.is_locked === 1) {
                type_para.appendChild(document.createTextNode('\u00A0\u00A0'));
                const lock_icon = create_icon('fa fa-lock', 'Record is currently locked', 'exhibit-is-locked', '#BA8E23');
                type_para.appendChild(lock_icon);
            }

            metadata_td.appendChild(type_para);

            // Title
            const text = helperModule.strip_html(helperModule.unescape(item.text || ''));
            if (text) {
                const text_para = document.createElement('p');
                const strong = document.createElement('strong');
                strong.textContent = text;
                text_para.appendChild(strong);
                metadata_td.appendChild(text_para);
            }

            tr.appendChild(metadata_td);

            // Status cell - FIXED: Added <small> wrapper for consistent font size
            const status_td = create_table_cell('', '');
            status_td.style.width = '5%';
            status_td.style.textAlign = 'center';
            const status_small = document.createElement('small');
            const status_button = create_status_button(item.uuid, item.is_published);
            status_small.appendChild(status_button);
            status_td.appendChild(status_small);
            tr.appendChild(status_td);

            // Actions cell
            const actions_td = document.createElement('td');
            actions_td.id = `${item.uuid}-item-actions`;
            actions_td.style.width = '10%';

            const actions_div = document.createElement('div');
            actions_div.className = 'card-text text-sm-center';

            const edit_link = create_edit_link(item, 'heading', item.is_published);
            actions_div.appendChild(edit_link);
            actions_div.appendChild(document.createTextNode('\u00A0'));

            const delete_button = create_delete_button(item, item.is_published);
            actions_div.appendChild(delete_button);

            actions_td.appendChild(actions_div);
            tr.appendChild(actions_td);

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

            // Metadata cell
            const metadata_td = document.createElement('td');
            metadata_td.className = 'item-metadata';

            const type_para = document.createElement('p');
            const type_button = document.createElement('button');
            type_button.className = 'btn btn-default';
            type_button.setAttribute('type', 'button');
            type_button.setAttribute('aria-label', 'grid item');

            const icon = create_icon('fa fa-th');
            type_button.appendChild(icon);
            type_button.appendChild(document.createTextNode(' '));

            const small = document.createElement('small');
            small.textContent = 'grid';
            type_button.appendChild(small);

            type_para.appendChild(type_button);

            // Lock icon if locked
            if (item.is_locked === 1) {
                type_para.appendChild(document.createTextNode('\u00A0\u00A0'));
                const lock_icon = create_icon('fa fa-lock', 'Record is currently locked', 'exhibit-is-locked', '#BA8E23');
                type_para.appendChild(lock_icon);
            }

            metadata_td.appendChild(type_para);

            // Title
            const title = helperModule.strip_html(helperModule.unescape(item.title || ''));
            if (title) {
                const title_para = document.createElement('p');
                const strong = document.createElement('strong');
                strong.textContent = title;
                title_para.appendChild(strong);
                metadata_td.appendChild(title_para);
            }

            tr.appendChild(metadata_td);

            // Status cell - FIXED: Added <small> wrapper for consistent font size
            const status_td = create_table_cell('', '');
            status_td.style.width = '5%';
            status_td.style.textAlign = 'center';
            const status_small = document.createElement('small');
            const status_button = create_status_button(item.uuid, item.is_published);
            status_small.appendChild(status_button);
            status_td.appendChild(status_small);
            tr.appendChild(status_td);

            // Actions cell
            const actions_td = document.createElement('td');
            actions_td.id = `${item.uuid}-item-actions`;
            actions_td.style.width = '10%';

            const actions_div = document.createElement('div');
            actions_div.className = 'card-text text-sm-center';

            // View grid items link
            const exhibit_id = encodeURIComponent(item.is_member_of_exhibit);
            const grid_id = encodeURIComponent(item.uuid);
            const view_url = `${APP_PATH}/items/grid/items?exhibit_id=${exhibit_id}&grid_id=${grid_id}`;
            const view_link = create_link(view_url, 'View grid items', 'view-grid-items', 'fa fa-list pr-1');
            actions_div.appendChild(view_link);
            actions_div.appendChild(document.createTextNode('\u00A0'));

            const edit_link = create_edit_link(item, 'grid', item.is_published);
            actions_div.appendChild(edit_link);
            actions_div.appendChild(document.createTextNode('\u00A0'));

            const delete_button = create_delete_button(item, item.is_published);
            actions_div.appendChild(delete_button);

            actions_td.appendChild(actions_div);
            tr.appendChild(actions_td);

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

            // Order cell with drag handle (always show, even for published items)
            tr.appendChild(create_order_cell(item.order));

            // Metadata cell
            const metadata_td = document.createElement('td');
            metadata_td.className = 'item-metadata';

            // Type button
            const type_para = document.createElement('p');
            const type_button = document.createElement('button');
            type_button.className = 'btn btn-default';
            type_button.setAttribute('type', 'button');
            type_button.setAttribute('aria-label', `${item.item_type || 'grid'} item`);

            const type_icon = get_item_type_icon(item.item_type);
            type_button.appendChild(type_icon);
            type_button.appendChild(document.createTextNode(' '));

            const small = document.createElement('small');
            small.textContent = 'grid item';
            type_button.appendChild(small);

            type_para.appendChild(type_button);

            // Lock icon if locked
            if (item.is_locked === 1) {
                type_para.appendChild(document.createTextNode('\u00A0\u00A0'));
                const lock_icon = create_icon('fa fa-lock', 'Record is currently locked', 'exhibit-is-locked', '#BA8E23');
                type_para.appendChild(lock_icon);
            }

            metadata_td.appendChild(type_para);

            // Title
            let title = helperModule.unescape(item.title || '');

            // Get thumbnail based on item type
            let thumbnail_element = null;
            let media_text = '';

            if (item.item_type !== 'text') {
                // Handle repository items
                if (item.is_repo_item === 1) {
                    const repo_record = await helperMediaModule.get_repo_item_data(item.media);
                    if (repo_record) {
                        if (!title) {
                            title = repo_record.title;
                        }
                        const thumbnail_url = helperMediaModule.render_repo_thumbnail(repo_record.thumbnail.data);
                        thumbnail_element = create_thumbnail_image(thumbnail_url, 'Repository item thumbnail');
                    }
                } else if (item.is_kaltura_item === 1) {
                    if (!title) {
                        title = 'Kaltura Item';
                    }
                    const kaltura_thumbnail = get_thumbnail_url(item.item_type);
                    thumbnail_element = create_thumbnail_image(kaltura_thumbnail, 'Kaltura item thumbnail');
                } else if (item.item_type === 'image') {
                    // Image items
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
                } else {
                    // Other media types (video, audio, pdf)
                    const thumbnail_url = get_thumbnail_url(item.item_type);
                    thumbnail_element = create_thumbnail_image(thumbnail_url, `${item.item_type} thumbnail`);
                }

                if (item.media && item.media.length > 0) {
                    media_text = item.media;
                }
            } else {
                // Text only items
                media_text = 'Text only';
            }

            // Fallback title from text if needed
            if (!title && item.text && item.text.length > 0) {
                title = helperModule.unescape(item.text);
                if (title.length > 200) {
                    title = title.substring(0, 200) + '...';
                }
            }

            // Add title
            if (title) {
                const title_para = document.createElement('p');
                const strong = document.createElement('strong');
                strong.textContent = title;
                title_para.appendChild(strong);
                metadata_td.appendChild(title_para);
            }

            // Add thumbnail
            if (thumbnail_element) {
                metadata_td.appendChild(thumbnail_element);
            }

            // Add media filename
            if (media_text) {
                const media_small = document.createElement('small');
                const media_em = document.createElement('em');
                media_em.textContent = media_text;
                media_small.appendChild(media_em);
                metadata_td.appendChild(media_small);
            }

            tr.appendChild(metadata_td);

            // Status cell
            const status_td = create_table_cell('', '');
            status_td.style.width = '5%';
            status_td.style.textAlign = 'center';
            const status_small = document.createElement('small');
            const status_button = create_status_button(item.uuid, item.is_published);
            status_small.appendChild(status_button);
            status_td.appendChild(status_small);
            tr.appendChild(status_td);

            // Actions cell
            const actions_td = document.createElement('td');
            actions_td.id = `${item.uuid}-item-actions`;
            actions_td.style.width = '10%';

            const actions_div = document.createElement('div');
            actions_div.className = 'card-text text-sm-center';

            // Edit/view link for grid items
            const exhibit_id = encodeURIComponent(item.is_member_of_exhibit);
            const grid_id = encodeURIComponent(item.is_member_of_grid);
            const item_id = encodeURIComponent(item.uuid);

            let edit_url = '';
            let edit_title = '';
            let edit_icon = '';

            if (item.is_published === 1) {
                // Published - view details
                if (item.item_type === 'text') {
                    edit_url = `${APP_PATH}/items/grid/item/text/details?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${item_id}`;
                } else {
                    edit_url = `${APP_PATH}/items/grid/item/media/details?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${item_id}`;
                }
                edit_title = 'View details';
                edit_icon = 'fa fa-folder-open pr-1';
            } else {
                // Unpublished - edit
                if (item.item_type === 'text') {
                    edit_url = `${APP_PATH}/items/grid/item/text/edit?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${item_id}`;
                } else {
                    edit_url = `${APP_PATH}/items/grid/item/media/edit?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${item_id}`;
                }
                edit_title = 'Edit grid item';
                edit_icon = 'fa fa-edit pr-1';
            }

            const edit_link = create_link(edit_url, edit_title, edit_title.toLowerCase().replace(' ', '-'), edit_icon);
            actions_div.appendChild(edit_link);
            actions_div.appendChild(document.createTextNode('\u00A0'));

            // Delete button
            if (item.is_published === 1) {
                const delete_icon = create_icon('fa fa-trash pr-1', 'Can only delete if unpublished', 'delete-disabled', '#d3d3d3');
                actions_div.appendChild(delete_icon);
            } else {
                const delete_url = `${APP_PATH}/items/grid/item/delete?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${item_id}`;
                const delete_link = create_link(delete_url, 'Delete grid item', 'delete-grid-item', 'fa fa-trash pr-1');
                actions_div.appendChild(delete_link);
            }

            actions_td.appendChild(actions_div);
            tr.appendChild(actions_td);

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

            // Metadata cell
            const metadata_td = document.createElement('td');
            metadata_td.className = 'item-metadata';

            const type_para = document.createElement('p');
            const type_button = document.createElement('button');
            type_button.className = 'btn btn-default';
            type_button.setAttribute('type', 'button');
            type_button.setAttribute('aria-label', 'timeline item');

            const icon = create_icon('fa fa-clock-o');
            type_button.appendChild(icon);
            type_button.appendChild(document.createTextNode(' '));

            const small = document.createElement('small');
            small.textContent = 'timeline';
            type_button.appendChild(small);

            type_para.appendChild(type_button);

            // Lock icon if locked
            if (item.is_locked === 1) {
                type_para.appendChild(document.createTextNode('\u00A0\u00A0'));
                const lock_icon = create_icon('fa fa-lock', 'Record is currently locked', 'exhibit-is-locked', '#BA8E23');
                type_para.appendChild(lock_icon);
            }

            metadata_td.appendChild(type_para);

            // Title
            const title = helperModule.strip_html(helperModule.unescape(item.title || ''));
            if (title) {
                const title_para = document.createElement('p');
                const strong = document.createElement('strong');
                strong.textContent = title;
                title_para.appendChild(strong);
                metadata_td.appendChild(title_para);
            }

            tr.appendChild(metadata_td);

            // Status cell - FIXED: Added <small> wrapper for consistent font size
            const status_td = create_table_cell('', '');
            status_td.style.width = '5%';
            status_td.style.textAlign = 'center';
            const status_small = document.createElement('small');
            const status_button = create_status_button(item.uuid, item.is_published);
            status_small.appendChild(status_button);
            status_td.appendChild(status_small);
            tr.appendChild(status_td);

            // Actions cell
            const actions_td = document.createElement('td');
            actions_td.id = `${item.uuid}-item-actions`;
            actions_td.style.width = '10%';

            const actions_div = document.createElement('div');
            actions_div.className = 'card-text text-sm-center';

            // View timeline items link
            const exhibit_id = encodeURIComponent(item.is_member_of_exhibit);
            const timeline_id = encodeURIComponent(item.uuid);
            const view_url = `${APP_PATH}/items/timeline/items?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}`;
            const view_link = create_link(view_url, 'View timeline items', 'view-timeline-items', 'fa fa-list pr-1');
            actions_div.appendChild(view_link);
            actions_div.appendChild(document.createTextNode('\u00A0'));

            const edit_link = create_edit_link(item, 'vertical-timeline', item.is_published);
            actions_div.appendChild(edit_link);
            actions_div.appendChild(document.createTextNode('\u00A0'));

            const delete_button = create_delete_button(item, item.is_published);
            actions_div.appendChild(delete_button);

            actions_td.appendChild(actions_div);
            tr.appendChild(actions_td);

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

            // Metadata cell
            const metadata_td = document.createElement('td');
            metadata_td.className = 'item-metadata';

            // Type button
            const type_para = document.createElement('p');
            const type_button = document.createElement('button');
            type_button.className = 'btn btn-default';
            type_button.setAttribute('type', 'button');

            const type_icon = get_item_type_icon(item.item_type);
            type_button.appendChild(type_icon);
            type_button.appendChild(document.createTextNode(' '));

            const small = document.createElement('small');
            small.textContent = 'timeline item';
            type_button.appendChild(small);

            type_para.appendChild(type_button);

            // Lock icon if locked
            if (item.is_locked === 1) {
                type_para.appendChild(document.createTextNode('\u00A0\u00A0'));
                const lock_icon = create_icon('fa fa-lock', 'Record is currently locked', 'exhibit-is-locked', '#BA8E23');
                type_para.appendChild(lock_icon);
            }

            metadata_td.appendChild(type_para);

            // Title
            let title = helperModule.strip_html(helperModule.unescape(item.title || ''));

            // Get thumbnail based on item type
            let thumbnail_element = null;
            let media_text = '';

            if (item.item_type !== 'text') {
                // Handle repository items
                if (item.is_repo_item === 1) {
                    const repo_record = await helperMediaModule.get_repo_item_data(item.media);
                    if (repo_record) {
                        if (!title) {
                            title = repo_record.title;
                        }
                        const thumbnail_url = helperMediaModule.render_repo_thumbnail(repo_record.thumbnail.data);
                        thumbnail_element = create_thumbnail_image(thumbnail_url, 'Repository item thumbnail');
                    }
                } else if (item.is_kaltura_item === 1) {
                    if (!title) {
                        title = 'Kaltura Item';
                    }
                    const kaltura_thumbnail = get_thumbnail_url(item.item_type);
                    thumbnail_element = create_thumbnail_image(kaltura_thumbnail, 'Kaltura item thumbnail');
                } else if (item.item_type === 'image') {
                    // Image items
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
                } else {
                    // Other media types
                    const thumbnail_url = get_thumbnail_url(item.item_type);
                    thumbnail_element = create_thumbnail_image(thumbnail_url, `${item.item_type} thumbnail`);
                }

                if (item.media && item.media.length > 0) {
                    media_text = item.media;
                }
            } else {
                // Text only items
                media_text = 'Text only';
            }

            // Fallback title from text if needed
            if (!title && item.text && item.text.length > 0) {
                title = helperModule.unescape(item.text);
                if (title.length > 200) {
                    title = title.substring(0, 200) + '...';
                }
            }

            // Add title
            if (title) {
                const title_para = document.createElement('p');
                const strong = document.createElement('strong');
                strong.textContent = title;
                title_para.appendChild(strong);
                metadata_td.appendChild(title_para);
            }

            // Add thumbnail
            if (thumbnail_element) {
                metadata_td.appendChild(thumbnail_element);
            }

            // Add media filename
            if (media_text) {
                const media_small = document.createElement('small');
                const media_em = document.createElement('em');
                media_em.textContent = media_text;
                media_small.appendChild(media_em);
                metadata_td.appendChild(media_small);
            }

            tr.appendChild(metadata_td);

            // Date cell
            const date_td = create_table_cell('', '');
            date_td.style.width = '5%';
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
            status_td.style.width = '5%';
            status_td.style.textAlign = 'center';
            const status_small = document.createElement('small');
            const status_button = create_status_button(item.uuid, item.is_published);
            status_small.appendChild(status_button);
            status_td.appendChild(status_small);
            tr.appendChild(status_td);

            // Actions cell
            const actions_td = document.createElement('td');
            actions_td.id = `${item.uuid}-item-actions`;
            actions_td.style.width = '10%';

            const actions_div = document.createElement('div');
            actions_div.className = 'card-text text-sm-center';

            // Edit/view link for timeline items
            const exhibit_id = encodeURIComponent(item.is_member_of_exhibit);
            const timeline_id = encodeURIComponent(item.is_member_of_timeline);
            const item_id = encodeURIComponent(item.uuid);

            let edit_url = '';
            let edit_title = '';
            let edit_icon = '';

            if (item.is_published === 1) {
                // Published - view details
                if (item.item_type === 'text') {
                    edit_url = `${APP_PATH}/items/vertical-timeline/item/text/details?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${item_id}`;
                } else {
                    edit_url = `${APP_PATH}/items/vertical-timeline/item/media/details?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${item_id}`;
                }
                edit_title = 'View details';
                edit_icon = 'fa fa-folder-open pr-1';
            } else {
                // Unpublished - edit
                if (item.item_type === 'text') {
                    edit_url = `${APP_PATH}/items/vertical-timeline/item/text/edit?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${item_id}`;
                } else {
                    edit_url = `${APP_PATH}/items/vertical-timeline/item/media/edit?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${item_id}`;
                }
                edit_title = 'Edit timeline item';
                edit_icon = 'fa fa-edit pr-1';
            }

            const edit_link = create_link(edit_url, edit_title, edit_title.toLowerCase().replace(' ', '-'), edit_icon);
            actions_div.appendChild(edit_link);
            actions_div.appendChild(document.createTextNode('\u00A0'));

            // Delete button
            if (item.is_published === 1) {
                const delete_icon = create_icon('fa fa-trash pr-1', 'Can only delete if unpublished', 'delete-disabled', '#d3d3d3');
                actions_div.appendChild(delete_icon);
            } else {
                const delete_url = `${APP_PATH}/items/vertical-timeline/item/delete?exhibit_id=${exhibit_id}&timeline_id=${timeline_id}&item_id=${item_id}`;
                const delete_link = create_link(delete_url, 'Delete timeline item', 'delete-timeline-item', 'fa fa-trash pr-1');
                actions_div.appendChild(delete_link);
            }

            actions_td.appendChild(actions_div);
            tr.appendChild(actions_td);

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
     * Initialize module
     */
    obj.init = function() {
        console.log('Items list displays module initialized');
        return true;
    };

    return obj;

}());