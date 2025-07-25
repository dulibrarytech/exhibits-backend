/**

 Copyright 2025 University of Denver

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

const itemsDetailsStandardItemModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_item_record() {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const token = authModule.get_user_token();
            const profile = authModule.get_user_profile_data();
            let tmp = EXHIBITS_ENDPOINTS.exhibits.item_records.get.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':item_id', item_id);

            if (token === false) {

                document.querySelector('#message').innerHTML = 'ERROR: Unable to get API endpoints';

                setTimeout(() => {
                    window.location.replace(APP_PATH + '/exhibits-dashboard/auth');
                }, 1000);

                return false;
            }

            let response = await httpModule.req({
                method: 'GET',
                url: endpoint + '?type=edit&uid=' + profile.uid,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {
                return response.data.data[0];
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    async function display_edit_record() {

        const record = await get_item_record();
        // let thumbnail_fragment = '';
        // let thumbnail_url = '';
        let is_published = record.is_published;
        let created_by = record.created_by;
        let created = record.created;
        let create_date = new Date(created);
        let updated_by = record.updated_by;
        let updated = record.updated;
        let update_date = new Date(updated);
        let item_created = '';
        let create_date_time = helperModule.format_date(create_date);
        let update_date_time = helperModule.format_date(update_date);

        helperModule.check_if_locked(record, '#exhibit-submit-card');

        if (created_by !== null) {
            item_created += `<em>Created by ${created_by} on ${create_date_time}</em>`;
        }

        if (updated_by !== null) {
            item_created += ` | <em>Last updated by ${updated_by} on ${update_date_time}</em>`;
        }

        document.querySelector('#created').innerHTML = item_created;

        if (document.querySelector('#is-published') !== null && is_published === 1) {
            document.querySelector('#is-published').value = true;
        } else if (document.querySelector('#is-published') !== null && is_published === 0) {
            document.querySelector('#is-published').value = false;
        }

        // item data
        document.querySelector('#item-title-input').value = helperModule.unescape(record.title);
        document.querySelector('#item-text-input').value = helperModule.unescape(record.text);

        if (window.location.pathname.indexOf('media') !== -1) {
            await helperMediaModule.display_media_fields_common(record);

            /*
            document.querySelector('#item-caption-input').value = record.caption;
            document.querySelector('#pdf-open-to-page').value = record.pdf_open_to_page;

            if (record.wrap_text === 1) {
                document.querySelector('#wrap-text').checked = true;
            } else {
                document.querySelector('#wrap-text').checked = false;
            }

            if (record.is_embedded === 1) {
                document.querySelector('#embed-item').checked = true;
            } else {
                document.querySelector('#embed-item').checked = false;
            }

            if (record.media_padding === 1) {
                document.querySelector('#media-padding').checked = false;
            } else {
                document.querySelector('#media-padding').checked = true;
            }

            if (record.media.length > 0) {

                if (record.is_repo_item === 0 && record.is_kaltura_item === 0) {

                    if (record.mime_type.indexOf('image') !== -1) {

                        thumbnail_url = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', record.is_member_of_exhibit).replace(':media', record.media);
                        thumbnail_fragment = `<p><img src="${thumbnail_url}" height="200" ></p>`;
                        helperModule.set_alt_text(record);

                    } else if (record.mime_type.indexOf('video') !== -1) {
                        thumbnail_url = '/exhibits-dashboard/static/images/video-tn.png';
                        thumbnail_fragment = `<p><img src="${thumbnail_url}" height="200" ></p>`;
                    } else if (record.mime_type.indexOf('audio') !== -1) {
                        thumbnail_url = '/exhibits-dashboard/static/images/audio-tn.png';
                        thumbnail_fragment = `<p><img src="${thumbnail_url}" height="200" ></p>`;
                    } else if (record.mime_type.indexOf('pdf') !== -1) {
                        thumbnail_url = '/exhibits-dashboard/static/images/pdf-tn.png';
                        thumbnail_fragment = `<p><img src="${thumbnail_url}" height="200" ></p>`;
                        document.querySelector('#toggle-open-to-page').style.visibility = 'visible';
                    } else {
                        console.log('Unable to Determine Type');
                    }

                    document.querySelector('#item-media-trash').style.display = 'inline';
                    document.querySelector('#item-media-filename-display').innerHTML = `<span style="font-size: 11px">${record.media}</span>`;
                }

                document.querySelector('#item-type').value = record.item_type;

                if (record.is_repo_item === 1) {

                    document.getElementById('upload-media-tab').classList.remove('active');
                    document.getElementById('import-repo-media-tab').classList.add('active');
                    document.getElementById('upload-media').classList.remove('active');
                    document.getElementById('upload-media').classList.remove('show');
                    document.getElementById('import-repo-media').classList.add('show');
                    document.getElementById('import-repo-media').classList.add('active');
                    document.getElementById('upload-media-tab').setAttribute('aria-selected', 'false');
                    document.getElementById('import-repo-media-tab').setAttribute('aria-selected', 'true');
                    document.querySelector('#repo-uuid').value = record.media;
                    document.querySelector('#is-repo-item').value = 1;
                    await helperModule.get_repo_item_data(null);

                    if (record.item_type === 'image') {
                        helperModule.set_alt_text(record);
                    }
                }

                if (record.is_kaltura_item === 1) {

                    document.getElementById('upload-media-tab').classList.remove('active');
                    document.getElementById('import-audio-video-tab').classList.add('active');
                    document.getElementById('upload-media').classList.remove('active');
                    document.getElementById('upload-media').classList.remove('show');
                    document.getElementById('import-audio-video').classList.add('show');
                    document.getElementById('import-audio-video').classList.add('active');
                    document.getElementById('upload-media-tab').setAttribute('aria-selected', 'false');
                    document.getElementById('import-audio-video-tab').setAttribute('aria-selected', 'true');
                    document.querySelector('#audio-video').value = record.media;
                    document.querySelector('#is-kaltura-item').value = 1;

                    let item_types = document.getElementsByName('item_type');

                    for (let j = 0; j < item_types.length; j++) {
                        if (item_types[j].value === record.item_type) {
                            document.querySelector('#' + item_types[j].id).checked = true;
                        }
                    }

                    document.querySelector('#item-type').value = 'kaltura';
                }

                document.querySelector('#item-mime-type').value = helperModule.unescape(record.mime_type);
                document.querySelector('#item-media-thumbnail-image-display').innerHTML = thumbnail_fragment;
                document.querySelector('#item-media').value = record.media;
                document.querySelector('#item-media-prev').value = record.media;
            }

            if (record.thumbnail.length > 0) {

                thumbnail_url = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', record.is_member_of_exhibit).replace(':media', record.thumbnail);
                thumbnail_fragment = `<p><img src="${thumbnail_url}" height="200" ></p>`;
                document.querySelector('#item-thumbnail-image-display').innerHTML = thumbnail_fragment;
                document.querySelector('#item-thumbnail-filename-display').innerHTML = `<span style="font-size: 11px">${record.thumbnail}</span>`;
                document.querySelector('#item-thumbnail').value = record.thumbnail;
                document.querySelector('#item-thumbnail-image-prev').value = record.thumbnail;
                document.querySelector('#item-thumbnail-trash').style.display = 'inline';
            }
             */
        }

        let layouts = document.getElementsByName('layout');

        for (let j = 0; j < layouts.length; j++) {
            if (layouts[j].value === record.layout) {
                document.querySelector('#' + layouts[j].id).checked = true;
            }
        }

        let media_width = document.getElementsByName('media_width');

        for (let j = 0; j < media_width.length; j++) {
            if (parseInt(media_width[j].value) === parseInt(record.media_width)) {
                document.querySelector('#' + media_width[j].id).checked = true;
            }
        }

        let styles = JSON.parse(record.styles);

        if (Object.keys(styles).length !== 0) {

            if (styles.backgroundColor !== undefined) {
                document.querySelector('#item-background-color').value = styles.backgroundColor;
                document.querySelector('#item-background-color-picker').value = styles.backgroundColor;
            } else {
                document.querySelector('#item-background-color').value = '';
            }

            if (styles.color !== undefined) {
                document.querySelector('#item-font-color').value = styles.color;
                document.querySelector('#item-font-color-picker').value = styles.color;
            } else {
                document.querySelector('#item-font-color').value = '';
            }

            let font_values = document.querySelector('#item-font');

            for (let i = 0; i < font_values.length; i++) {
                if (font_values[i].value === styles.fontFamily) {
                    document.querySelector('#item-font').value = styles.fontFamily;
                }
            }

            if (styles.fontSize !== undefined) {
                document.querySelector('#item-font-size').value = styles.fontSize.replace('px', '');
            } else {
                document.querySelector('#item-font-size').value = '';
            }
        }

        return false;
    }

    obj.init = async function () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            exhibitsModule.set_exhibit_title(exhibit_id);
            await display_edit_record();
            // document.querySelector('#update-item-btn').addEventListener('click', itemsDetailsStandardItemModule.update_item_record);

            if (window.location.pathname.indexOf('media') !== -1) {
                helperMediaModule.media_edit_init();

                /*
                document.querySelector('#is-alt-text-decorative').addEventListener('click', () => {
                    helperModule.toggle_alt_text();
                });

                setTimeout(() => {

                    if (document.querySelector('#item-media').value.length === 0) {
                        document.querySelector('#item-media-trash').removeEventListener('click', delete_media);
                        document.querySelector('#item-media-trash').addEventListener('click', itemsCommonStandardItemFormModule.delete_media);
                    } else if (document.querySelector('#item-media').value !== 0) {
                        document.querySelector('#item-media-trash').removeEventListener('click', itemsCommonStandardItemFormModule.delete_media);
                        document.querySelector('#item-media-trash').addEventListener('click', delete_media);
                    }

                    if (document.querySelector('#item-thumbnail').value.length === 0) {
                        document.querySelector('#item-thumbnail-trash').removeEventListener('click', delete_thumbnail_image);
                        document.querySelector('#item-thumbnail-trash').addEventListener('click', itemsCommonStandardItemFormModule.delete_thumbnail_image);
                    } else if (document.querySelector('#item-thumbnail').value.length !== 0) {
                        document.querySelector('#item-thumbnail-trash').removeEventListener('click', itemsCommonStandardItemFormModule.delete_thumbnail_image);
                        document.querySelector('#item-thumbnail-trash').addEventListener('click', delete_thumbnail_image);
                    }

                }, 1000);

                 */
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
