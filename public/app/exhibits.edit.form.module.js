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

const exhibitsEditFormModule = (function () {

    'use strict';

    const APP_PATH = '/exhibits-dashboard';
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};
    let rich_text_data = {};

    /**
     * Gets exhibit record
     */
    async function get_exhibit_record () {

        try {

            const uuid = helperModule.get_parameter_by_name('uuid');
            const token = authModule.get_user_token();

            if (token === false || EXHIBITS_ENDPOINTS === null) {

                document.querySelector('#message').innerHTML = 'ERROR: Unable to get API endpoints';

                setTimeout(() => {
                    window.location.replace(APP_PATH + '/dashboard/login');
                }, 3000);

                return false;
            }

            document.querySelector('#exhibit-title').innerHTML = await exhibitsModule.get_exhibit_title(uuid);

            let response = await httpModule.req({
                method: 'GET',
                url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoints.get.endpoint.replace(':exhibit_id', uuid),
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

    /**
     * Gets data from exhibit edit form
     */
     function get_exhibit_data () {

         try {

             let exhibit = exhibitsCommonFormModule.get_common_form_fields(rich_text_data);
             exhibit.styles = exhibitsCommonFormModule.get_exhibit_styles();
             exhibit.hero_image_prev = document.querySelector('#hero-image-prev').value;
             exhibit.thumbnail_prev = document.querySelector('#thumbnail-image-prev').value;
             return exhibit;

         } catch (error) {
             document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
         }
    }

    /**
     * Populates edit form with exhibit record data
     */
    async function display_edit_record () {

        try {

            let record = await get_exhibit_record();
            let hero_image_url = '';
            let hero_image_fragment = '';
            let thumbnail_url = '';
            let thumbnail_fragment = '';

            // exhibit data
            rich_text_data['exhibit-title-input'] = helperModule.set_rich_text_editor('exhibit-title-input');
            rich_text_data['exhibit-title-input'].setHTMLCode(helperModule.unescape(record.title));

            rich_text_data['exhibit-sub-title-input'] = helperModule.set_rich_text_editor('exhibit-sub-title-input');
            rich_text_data['exhibit-sub-title-input'].setHTMLCode(helperModule.unescape(record.subtitle));

            rich_text_data['exhibit-alert-text-input'] = helperModule.set_rich_text_editor('exhibit-alert-text-input');
            rich_text_data['exhibit-alert-text-input'].setHTMLCode(helperModule.unescape(record.alert_text));

            rich_text_data['exhibit-description-input'] = helperModule.set_rich_text_editor('exhibit-description-input');
            rich_text_data['exhibit-description-input'].setHTMLCode(helperModule.unescape(record.description));

            // exhibit media
            if (record.hero_image.length > 0) {
                hero_image_url = `${APP_PATH}/api/v1/exhibits/${record.uuid}/media/${record.hero_image}`;
                hero_image_fragment = `<p><img src="${hero_image_url}" height="200"></p>`;
                document.querySelector('#hero-image-display').innerHTML = hero_image_fragment;
                document.querySelector('#hero-image-filename-display').innerHTML = `<span style="font-size: 11px">${record.hero_image}</span>`;
                document.querySelector('#hero-image').value = record.hero_image;
                document.querySelector('#hero-image-prev').value = record.hero_image;
                document.querySelector('#hero-trash').style.display = 'inline';
                //
            }

            if (record.thumbnail.length > 0) {
                thumbnail_url = `${APP_PATH}/api/v1/exhibits/${record.uuid}/media/${record.thumbnail}`;
                thumbnail_fragment = `<p><img src="${thumbnail_url}" height="200" ></p>`;
                document.querySelector('#thumbnail-image-display').innerHTML = thumbnail_fragment;
                document.querySelector('#thumbnail-filename-display').innerHTML = `<span style="font-size: 11px">${record.thumbnail}</span>`;
                document.querySelector('#thumbnail-image').value = record.thumbnail;
                document.querySelector('#thumbnail-image-prev').value = record.thumbnail;
                document.querySelector('#thumbnail-trash').style.display = 'inline';
            }

            // exhibit banner
            let banner_templates = document.getElementsByName('banner_template');

            for (let i = 0; i < banner_templates.length; i++) {
                if (banner_templates[i].value === record.banner_template) {
                    document.querySelector('#' + banner_templates[i].id).checked = true;
                }
            }

            // exhibit layout
            let page_layouts = document.getElementsByName('page_layout');

            for (let j = 0; j < page_layouts.length; j++) {
                if (page_layouts[j].value === record.page_layout) {
                    document.querySelector('#' + page_layouts[j].id).checked = true;
                }
            }

            // exhibit styles
            let styles = JSON.parse(record.styles);

            if (styles.exhibit.navigation !== undefined) {

                document.querySelector('#nav-background-color').value = styles.exhibit.navigation.backgroundColor;
                document.querySelector('#nav-font-color').value = styles.exhibit.navigation.color;

                let font_values = document.querySelector('#nav-font');

                for (let i=0;i<font_values.length;i++) {
                    if (font_values[i].value === styles.exhibit.navigation.fontFamily) {
                        document.querySelector('#nav-font').value = styles.exhibit.navigation.fontFamily;
                    }
                }

                document.querySelector('#nav-font-size').value = styles.exhibit.navigation.fontSize;
            }

            if (styles.exhibit.template !== undefined) {

                document.querySelector('#template-background-color').value = styles.exhibit.template.backgroundColor;
                document.querySelector('#template-font-color').value = styles.exhibit.template.color;

                let template_font_values = document.querySelector('#template-font');

                for (let i=0;i<template_font_values.length;i++) {

                    if (template_font_values[i].value === styles.exhibit.template.fontFamily) {
                        document.querySelector('#template-font').value = styles.exhibit.template.fontFamily;
                    }
                }

                document.querySelector('#template-font-size').value = styles.exhibit.template.fontSize;
            }

            return false;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    /**
     * Updates exhibit record
     */
    obj.update_exhibit_record = async function () {

        try {

            scrollTo(0, 0);
            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Updating exhibit record...</div>`;
            let uuid = helperModule.get_parameter_by_name('uuid');
            let data = get_exhibit_data();

            let token = authModule.get_user_token();
            let response;

            if (uuid === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get record UUID</div>`;
                return false;
            }

            if (token === false) {

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get session token</div>`;
                    authModule.logout();
                }, 3000);

                return false;
            }

            response = await httpModule.req({
                method: 'PUT',
                url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoints.put.endpoint.replace(':exhibit_id', uuid),
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Exhibit record updated</div>`;

                setTimeout(() => {
                    window.location.replace(APP_PATH + '/exhibits/exhibit/edit?uuid=' + uuid);
                }, 2000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Deletes hero image
     */
    function delete_hero_image() {

        try {

            (async function() {

                const uuid = helperModule.get_parameter_by_name('uuid');
                let hero_image = document.querySelector('#hero-image').value;
                let tmp = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', uuid)
                let endpoint = tmp.replace(':media', hero_image);
                let token = authModule.get_user_token();
                let response = await httpModule.req({
                    method: 'DELETE',
                    url: endpoint,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                });

                if (response !== undefined && response.status === 204) {

                    document.querySelector('#hero-image').value = '';
                    document.querySelector('#hero-image-filename-display').innerHTML = '';
                    document.querySelector('#hero-trash').style.display = 'none';
                    document.querySelector('#hero-image-display').innerHTML = '';
                    document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Hero image deleted</div>`;

                    setTimeout(() => {
                        document.querySelector('#message').innerHTML = '';
                    }, 3000);
                }

            })();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }

        return false;
    }

    // TODO: delete_thumbnail_image


    /**
     * Init function for exhibits edit form
     */
    obj.init = async function () {

        try {

            helperModule.set_rich_text_editor_config();
            document.querySelector('#save-exhibit-btn').addEventListener('click', exhibitsEditFormModule.update_exhibit_record);
            document.querySelector('#hero-trash').addEventListener('click', delete_hero_image);
            // document.querySelector('#thumbnail-trash').addEventListener('click', delete_thumbnail_image);
            await display_edit_record();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
