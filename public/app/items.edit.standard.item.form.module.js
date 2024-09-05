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

const itemsEditStandardItemFormModule = (function () {

    'use strict';

    const APP_PATH = '/exhibits-dashboard';
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};
    let rich_text_data = {};

    /**
     * Sets rich text editor on defined input fields
     */
    function set_rich_text_editors () {
        const ids = ['item-title-input',
            'item-caption-input',
            'item-text-input',
            'item-description-input'];

        ids.forEach((id) => {
            rich_text_data[id] = helperModule.set_rich_text_editor(id);
        });
    }

    /**
     * Gets item record
     */
    async function get_item_record () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const token = authModule.get_user_token();
            let tmp = EXHIBITS_ENDPOINTS.exhibits.item_records.get.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':item_id', item_id);

            if (token === false) {

                document.querySelector('#message').innerHTML = 'ERROR: Unable to get API endpoints';

                setTimeout(() => {
                    window.location.replace(APP_PATH + '/exhibits-dashboard/auth');
                }, 3000);

                return false;
            }

            let response = await httpModule.req({
                method: 'GET',
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {
                return response.data.data[0];
            }

        } catch (error) {
            console.log('ERROR: ', error.message);
        }
    }

    /**
     * Populates edit form with exhibit record data
     */
    async function display_edit_record () {

        let record = await get_item_record();
        let media_url = '';
        let media_fragment = '';
        let thumbnail_fragment = '';
        let thumbnail_url = '';
        console.log('display: ', record);

        // item data
        rich_text_data['item-title-input'] = helperModule.set_rich_text_editor('item-title-input');
        rich_text_data['item-title-input'].setHTMLCode(helperModule.unescape(record.title));

        rich_text_data['item-caption-input'] = helperModule.set_rich_text_editor('item-caption-input');
        rich_text_data['item-caption-input'].setHTMLCode(helperModule.unescape(record.caption));

        rich_text_data['item-description-input'] = helperModule.set_rich_text_editor('item-description-input');
        rich_text_data['item-description-input'].setHTMLCode(helperModule.unescape(record.description));

        rich_text_data['item-text-input'] = helperModule.set_rich_text_editor('item-text-input');
        rich_text_data['item-text-input'].setHTMLCode(helperModule.unescape(record.text));

        if (record.media.length > 0) {

            // TODO: check if not image

            // TODO: allow to open media in separate window (pdf, video, audio)
            thumbnail_url = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', record.is_member_of_exhibit).replace(':media', record.thumbnail);
            thumbnail_fragment = `<p><img src="${thumbnail_url}" height="200" ></p>`;
            document.querySelector('#item-media-thumbnail-image-display').innerHTML = thumbnail_fragment;
            document.querySelector('#item-media-filename-display').innerHTML = `<span style="font-size: 11px">${record.media}</span>`;
            document.querySelector('#item-media').value = record.media;
            document.querySelector('#item-media-prev').value = record.media;
            document.querySelector('#item-media-trash').style.display = 'inline';
        }

        if (record.thumbnail.length > 0) {

            thumbnail_url = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', record.is_member_of_exhibit).replace(':media', record.thumbnail);
            thumbnail_fragment = `<p><img src="${thumbnail_url}" height="200" ></p>`;
            document.querySelector('#item-thumbnail-image-display').innerHTML = thumbnail_fragment;
            document.querySelector('#item-thumbnail-filename-display').innerHTML = `<span style="font-size: 11px">${record.thumbnail}</span>`;
            document.querySelector('#item-thumbnail-image-prev').value = record.thumbnail;
            document.querySelector('#item-thumbnail-trash').style.display = 'inline';
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

        if (styles !== undefined) {

            document.querySelector('#item-background-color').value = styles.backgroundColor;
            document.querySelector('#item-font-color').value = styles.color;

            let font_values = document.querySelector('#item-font');

            for (let i=0;i<font_values.length;i++) {
                if (font_values[i].value === styles.fontFamily) {
                    document.querySelector('#item-font').value = styles.fontFamily;
                }
            }

            document.querySelector('#item-font-size').value = styles.fontSize;
        }

        /*
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

         */

        /*
        // item styles
        let styles;

        if (typeof record.styles === 'string') {
            styles = JSON.parse(record.styles);
        }

        if (Object.keys(styles).length !== 0) {

            document.querySelector('#nav-menu-background-color').value = styles.exhibit.navigation.menu.backgroundColor;
            document.querySelector('#nav-menu-font-color').value = styles.exhibit.navigation.menu.color;

            let font_values = document.querySelector('#nav-menu-font');

            for (let i = 0;i<font_values.length;i++) {
                if (font_values[i].value === styles.exhibit.navigation.menu.fontFamily) {
                    document.querySelector('#nav-menu-font').value = styles.exhibit.navigation.menu.fontFamily;
                }
            }
        }

        */

        return false;
    }

    /**
     * Updates item record
     */
    obj.update_item_record = async function () {

        try {

            scrollTo(0, 0);
            document.querySelector('.card').style.visibility = 'hidden';
            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Updating item record...</div>`;
            let exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            let item_id = helperModule.get_parameter_by_name('item_id');

            // TODO
            // let data = get_item_data();

            let token = authModule.get_user_token();
            let response;
            console.log(data);
            if (exhibit_id === undefined || item_id === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get record ID</div>`;
                return false;
            }

            if (token === false) {
                setTimeout(() => {
                    document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get session token</div>`;
                    authModule.logout();
                }, 3000);

                return false;
            }

            let tmp = EXHIBITS_ENDPOINTS.exhibits.item_records.put.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':item_id', item_id);

            response = await httpModule.req({
                method: 'PUT',
                url: endpoint,
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Item record updated</div>`;

                setTimeout(() => {
                    // TODO
                    window.location.replace('edit?exhibit_id=' + exhibit_id + '&item_id=' + item_id);
                }, 2000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     *
     */
    obj.init = async function () {

        const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
        exhibitsModule.set_exhibit_title(exhibit_id);

        helperModule.set_rich_text_editor_config();
        set_rich_text_editors();
        await display_edit_record();

        // uploadsModule.upload_item_media();
        // uploadsModule.upload_item_thumbnail();

        // document.querySelector('#save-item-btn').addEventListener('click', itemsStandardItemFormModule.create_item_record);

        /*
        helperModule.set_rich_text_editor_config();
        document.querySelector('#save-item-btn').addEventListener('click', itemsEditFormModule.update_item_record);
        document.querySelector('#logout').addEventListener('click', authModule.logout);
        document.querySelector('#item-media-trash').style.display = 'none';
        // document.querySelector('#thumbnail-trash').style.display = 'none';
        uploadsModule.upload_item_media();
        await display_edit_record();

        // bind color pickers to input fields
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

         */
    };

    return obj;

}());




/**
 * Gets data from item edit form
 */
/*
function get_item_data () {

    let item = {};
    item.styles = {
        item: {}
    };

    // item data
    item.title = rich_text_data['item-title-input'].getHTMLCode();
    item.caption = rich_text_data['item-caption-input'].getHTMLCode();
    item.description = rich_text_data['item-description-input'].getHTMLCode();
    item.text = rich_text_data['item-text-input'].getHTMLCode();

    // grid item only
    if (document.querySelector('#item-date')) {
        item.date = document.querySelector('#item-date').value;
    }

    // item media
    if (document.querySelector('#item-thumbnail')) {
        item.thumbnail = document.querySelector('#item-thumbnail').value;
    }

    // TODO: get item type from upload module?
    if (document.querySelector('#item-type')) {
        item.item_type = document.querySelector('#item-type').value;
    }

    if (document.querySelector('#repo-uuid').value.length > 0) {
        item.media = document.querySelector('#repo-uuid').value;
    } else {
        item.media = document.querySelector('#item-media').value;
    }

    item.media_prev = document.querySelector('#item-media-prev').value;

    // item layout - standard item only
    if (document.getElementsByName('layout')) {
        item.layout = helperModule.get_checked_radio_button(document.getElementsByName('layout'));
    }

    if (item.layout.length === 0) {
        item.layout = 'grid';
    }

    // item styles
    let item_background_color = document.querySelector('#item-background-color').value;
    let item_color = document.querySelector('#item-font-color').value;
    let item_font = document.querySelector('#item-font').value;

    if (item_background_color.length > 0) {
        item.styles.item.backGroundColor = item_background_color;
    }

    if (item_color.length > 0) {
        item.styles.item.color = item_color;
    }

    if (item_font.length > 0) {
        item.styles.item.fontFamily = item_font;
    }

    console.log('edit item data ', item.styles);

    return item;
}
*/