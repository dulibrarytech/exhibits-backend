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

    obj.get_common_grid_item_form_fields = function () {

        try {

            let media = [];
            let item = {};
            item.styles = {};

            // item metadata
            item.title = document.querySelector('#item-title-input').value;
            item.text = document.querySelector('#item-text-input').value;
            item.description = document.querySelector('#item-description-input').value;
            item.caption = document.querySelector('#item-caption-input').value;

            if (window.location.pathname.indexOf('text') !== -1 && item.text.length === 0) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Please enter "Text" for this item</div>`;
                return false;
            }

            if (document.querySelector('#is-published') !== null) {
                item.is_published = document.querySelector('#is-published').value;
            }

            if (window.location.pathname.indexOf('media') !== -1) {

                item.is_alt_text_decorative = document.querySelector('#is-alt-text-decorative').checked;
                item.is_embedded = document.querySelector('#embed-item').checked;

                if (item.is_embedded === true) {
                    item.is_embedded = 1;
                } else if (item.is_embedded === false) {
                    item.is_embedded = 0;
                }

                // item media
                item.thumbnail = document.querySelector('#item-thumbnail').value;
                item.thumbnail_prev = document.querySelector('#item-thumbnail-image-prev').value;
                item.item_type = document.querySelector('#item-type').value;
                item.mime_type = document.querySelector('#item-mime-type').value;
                item.media = document.querySelector('#item-media').value;
                item.media_prev = document.querySelector('#item-media-prev').value;
                item.kaltura = document.querySelector('#audio-video').value;
                item.repo_uuid = document.querySelector('#repo-uuid').value;
                item.pdf_open_to_page = document.querySelector('#pdf-open-to-page').value;

                if (item.mime_type.indexOf('image') !== -1) {
                    if (item.is_alt_text_decorative === true) {
                        item.is_alt_text_decorative = 1;
                        item.alt_text = '';
                    } else if (item.is_alt_text_decorative === false) {
                        item.is_alt_text_decorative = 0;
                        item.alt_text = document.querySelector('#item-alt-text-input').value;
                        if (item.alt_text.length === 0 && item.alt_text.length === 0) {
                            if (item.alt_text.length === 0) {
                                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Please enter "alt text" for this item</div>`;
                                return false;
                            }
                        }
                    }
                }

                if (item.media.length === 0 && item.kaltura.length === 0 && item.repo_uuid.length === 0) {
                    if (item.text.length === 0) {
                        document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Please upload or import a media item</div>`;
                        return false;
                    }
                }

                if (item.media.length > 0 && item.repo_uuid.length > 0 && item.media === item.repo_uuid) {
                    item.repo_uuid = '';
                }

                if (item.media.length > 0 && item.kaltura.length > 0 && item.media === item.kaltura) {
                    item.kaltura = '';
                }

                if (item.media.length > 0) {
                    media.push(item.media);
                }

                if (item.kaltura.length > 0) {
                    media.push(item.kaltura);
                    item.item_type = 'kaltura';
                }

                if (item.repo_uuid.length > 0) {
                    media.push(item.repo_uuid);
                }

                if (media.length > 1) {
                    document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Please upload or import only one media item</div>`;
                    return false;
                }

                if (item.item_type === 'kaltura') {
                    item.item_type = document.querySelector('input[name="item_type"]:checked').value;
                }
            } else {
                item.item_type = 'text';
            }

            /*
            if (media.length === 0 && item.text.length !== 0) {
                item.item_type = 'text';
            }
             */

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
                item.styles.fontSize = `${item_font_size}px`;
            }

            return item;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.delete_media = function () {

        try {

            (async function () {

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
                    document.querySelector('#image-alt-text').style.display = 'none';

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

    obj.delete_thumbnail_image = function () {

        try {

            (async function () {

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

    obj.init = async function () {

        try {

            if (window.location.pathname.indexOf('media') !== -1) {

                uploadsModule.upload_item_media();
                uploadsModule.upload_item_thumbnail();

                document.querySelector('#item-media-trash').style.display = 'none';
                document.querySelector('#item-thumbnail-trash').style.display = 'none';
                document.querySelector('#is-media-only-caption').style.display = 'block';

                setTimeout(() => {
                    document.querySelector('#item-media-trash').addEventListener('click', itemsCommonGridItemFormModule.delete_media);
                    document.querySelector('#item-thumbnail-trash').addEventListener('click', itemsCommonGridItemFormModule.delete_thumbnail_image);
                }, 1000);

                document.querySelector('#repo-uuid-btn').addEventListener('click', async () => {
                    await helperModule.get_repo_item_data(null);
                });

                document.querySelector('#audio-video').addEventListener('focusout', () => {
                    helperModule.clear_media_fields('kaltura_media');
                    document.querySelector('#is-kaltura-item').value = 1;
                });
            }

            if (window.location.pathname.indexOf('text') !== -1) {
                document.querySelector('#is-required-text').innerHTML = '<span style="color: darkred">*</span> Text<small><em>(Required)</em></small>';
            }

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            navModule.init();
            navModule.back_to_grid_items();
            navModule.set_preview_link();

            document.querySelector('#item-background-color-picker').addEventListener('input', () => {
                if (document.querySelector('#item-background-color')) {
                    document.querySelector('#item-background-color').value = document.querySelector('#item-background-color-picker').value;
                }
            });

            document.querySelector('#item-background-color').addEventListener('input', () => {
                document.querySelector('#item-background-color-picker').value = document.querySelector('#item-background-color').value;
            });

            document.querySelector('#item-font-color-picker').addEventListener('input', () => {
                if (document.querySelector('#item-font-color')) {
                    document.querySelector('#item-font-color').value = document.querySelector('#item-font-color-picker').value;
                }
            });

            document.querySelector('#item-font-color').addEventListener('input', () => {
                document.querySelector('#item-font-color-picker').value = document.querySelector('#item-font-color').value;
            });

            helperModule.show_form();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }


    };

    return obj;

}());
