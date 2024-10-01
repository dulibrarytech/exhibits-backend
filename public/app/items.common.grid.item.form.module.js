/**

 Copyright 2024 University of Denver

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

const itemsCommonGridItemFormModule = (function () {

    'use strict';

    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    /**
     * Gets common grid item form fields
     */
    obj.get_common_grid_item_form_fields = function (rich_text_data) {

        try {

            let media = [];
            let item = {};
            item.styles = {};

            // item metadata
            item.title = rich_text_data['item-title-input'].getHTMLCode();
            item.caption = rich_text_data['item-caption-input'].getHTMLCode();
            item.description = rich_text_data['item-description-input'].getHTMLCode();
            item.text = rich_text_data['item-text-input'].getHTMLCode();

            // item media
            item.thumbnail = document.querySelector('#item-thumbnail').value;
            item.thumbnail_prev = document.querySelector('#item-thumbnail-image-prev').value;
            item.item_type = document.querySelector('#item-type').value;
            item.mime_type = document.querySelector('#item-mime-type').value;
            item.media = document.querySelector('#item-media').value;
            item.media_prev = document.querySelector('#item-media-prev').value;
            item.kaltura = document.querySelector('#audio-video').value;
            item.repo_uuid = document.querySelector('#repo-uuid').value;
            item.media_padding = document.querySelector('#media-padding').value;

            if (item.media.length === 0 && item.kaltura.length === 0 && item.repo_uuid.length === 0) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Please upload or import a media item</div>`;
                return false;
            }

            media.push(item.media);
            media.push(item.kaltura);
            media.push(item.repo_uuid);

            if (media.length > 1) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Please upload or import only one media item</div>`;
                return false;
            }

            // item layout - standard item only
            item.layout = helperModule.get_checked_radio_button(document.getElementsByName('layout'));
            item.media_width = helperModule.get_checked_radio_button(document.getElementsByName('media_width'));

            // item styles
            let item_background_color = document.querySelector('#item-background-color').value;
            let item_color = document.querySelector('#item-font-color').value;
            let item_font = document.querySelector('#item-font').value;
            let item_font_size = document.querySelector('#item-font-size').value;

            if (item_background_color.length > 0) {
                item.styles.backgroundColor = item_background_color;
            }

            if (item_color.length > 0) {
                item.styles.color = document.querySelector('#item-font-color').value;
            }

            if (item_font.length > 0) {
                item.styles.fontFamily = item_font;
            }

            if (item_font_size.length > 0) {
                item.styles.fontSize = item_font_size;
            }

            return item;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Deletes media
     */
    obj.delete_media = function () {

        try {

            (async function() {

                let media = document.querySelector('#item-media').value;
                let token = authModule.get_user_token();
                let response = await httpModule.req({
                    method: 'DELETE',
                    url: EXHIBITS_ENDPOINTS.exhibits.media.delete.endpoint + '?media=' + media,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                });

                if (response !== undefined && response.status === 204) {

                    document.querySelector('#item-media').value = '';
                    document.querySelector('#item-media-thumbnail-image-display').innerHTML = '';
                    document.querySelector('#item-media-filename-display').innerHTML = '';
                    document.querySelector('#item-media-trash').style.display = 'none';
                    document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Media deleted</div>`;
                    // only for PDF
                    document.querySelector('#toggle-open-to-page').style.visibility = 'hidden';

                    setTimeout(() => {
                        document.querySelector('#message').innerHTML = '';
                    }, 3000);
                }

            })();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }

        return false;
    };

    /**
     * Deletes thumbnail image
     */
    obj.delete_thumbnail_image = function () {

        try {

            (async function() {

                let thumbnail_image = document.querySelector('#item-thumbnail').value;
                let token = authModule.get_user_token();
                let response = await httpModule.req({
                    method: 'DELETE',
                    url: EXHIBITS_ENDPOINTS.exhibits.media.delete.endpoint + '?media=' + thumbnail_image,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                });

                if (response !== undefined && response.status === 204) {

                    document.querySelector('#item-thumbnail').value = '';
                    document.querySelector('#item-thumbnail-image-display').innerHTML = '';
                    document.querySelector('#item-thumbnail-filename-display').innerHTML = '';
                    document.querySelector('#item-thumbnail-trash').style.display = 'none';
                    document.querySelector('#item-media-thumbnail-image-display').innerHTML = '';
                    document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Thumbnail image deleted</div>`;

                    setTimeout(() => {
                        document.querySelector('#message').innerHTML = '';
                    }, 3000);
                }

            })();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }

        return false;
    };

    /**
     * Init function for grid item common add/edit forms
     */
    obj.init = async function () {

        try {

            navModule.init();
            navModule.back_to_items();

            uploadsModule.upload_item_media();
            uploadsModule.upload_item_thumbnail();

            document.querySelector('#item-media-trash').style.display = 'none';
            document.querySelector('#item-thumbnail-trash').style.display = 'none';
            document.querySelector('#item-background-color-picker').addEventListener('input', () => {
                if (document.querySelector('#item-background-color')) {
                    document.querySelector('#item-background-color').value = document.querySelector('#item-background-color-picker').value;
                }
            });

            document.querySelector('#item-font-color-picker').addEventListener('input', () => {
                if (document.querySelector('#item-font-color')) {
                    document.querySelector('#item-font-color').value = document.querySelector('#item-font-color-picker').value;
                }
            });

            setTimeout(() => {
                document.querySelector('#item-media-trash').addEventListener('click', itemsCommonGridItemFormModule.delete_media);
                document.querySelector('#item-thumbnail-trash').addEventListener('click', itemsCommonGridItemFormModule.delete_thumbnail_image);
            }, 1000);

            setTimeout(() => {
                document.querySelector('#item-data-card').style.visibility = 'visible';
            }, 250);

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
