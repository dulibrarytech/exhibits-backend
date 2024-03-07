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

const itemsFormModule = (function () {

    'use strict';

    const APP_PATH = '/exhibits-backend';
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    /*
    item.title = rich_text_data.item_title.getHTMLCode();
        item.caption = rich_text_data.item_caption.getHTMLCode();
        item.description = rich_text_data.item_description.getHTMLCode();
        item.text = rich_text_data.item_text.getHTMLCode();
     */

    /*
    let standard_item_field_ids = ['item_title', 'item_caption', 'item_description', 'item_text'];
    rich_text_data = helperModule.set_rich_text_editor(standard_item_field_ids);
    console.log('rich_text_data ', rich_text_data);

     */

    /** TODO: refactor
     * Sets rich text editor on defined input fields
     */
    function set_rich_text_editor () {
        let rich_text_data = {};
        rich_text_data.item_title = helperModule.render_rich_text_editor('#item-title-input');
        rich_text_data.item_caption = helperModule.render_rich_text_editor('#item-caption-input');
        rich_text_data.item_description = helperModule.render_rich_text_editor('#item-description-input')
        rich_text_data.item_text = helperModule.render_rich_text_editor('#item-text-input');
        return rich_text_data;
    }

    /**
     * Gets item heading data
     */
    function get_heading_data() {

        let item_heading = {};
        item_heading.styles = {};
        item_heading.text = document.querySelector('#item-heading-text').value;
        let heading_background_color =  document.querySelector('#heading-background-color').value;
        let heading_color = document.querySelector('#heading-font-color').value;
        let font = document.querySelector('#heading-font').value;

        if (heading_background_color.length > 0) {
            item_heading.styles.backGroundColor = heading_background_color;
        }

        if (heading_color.length > 0) {
            item_heading.styles.color = heading_color;
        }

        if (font.length > 0) {
            item_heading.styles.fontFamily = font;
        }

        return item_heading;
    }

    /**
     * Gets grid data
     */
    function get_grid_data() {

        let grid = {};
        grid.styles = {};
        grid.columns = document.querySelector('#grid-columns').value;

        let grid_item_background_color = document.querySelector('#grid-background-color').value;
        let grid_item_color = document.querySelector('#grid-font-color').value;
        let grid_item_font = document.querySelector('#grid-font').value;

        if (grid_item_background_color.length > 0) {
            grid.styles.backGroundColor = grid_item_background_color;
        }

        if (grid_item_color.length > 0) {
            grid.styles.color = grid_item_color;
        }

        if (grid_item_font.length > 0) {
            grid.styles.fontFamily = grid_item_font;
        }

        return grid;
    }

    /**
     * Gets item data from form
     */
    function get_item_data() {

        let item = {};
        item.styles = {};

        // item metadata
        item.title = rich_text_data.item_title.getHTMLCode();
        item.caption = rich_text_data.item_caption.getHTMLCode();
        item.description = rich_text_data.item_description.getHTMLCode();
        item.text = rich_text_data.item_text.getHTMLCode();

        /*
        item.title = document.querySelector('#item-title').value;
        item.caption = document.querySelector('#item-caption').value;
        item.description = document.querySelector('#item-description').value;
        item.text = document.querySelector('#item-text').value;
        */

        // grid item only
        item.date = document.querySelector('#item-date').value;

        // item media
        item.thumbnail = document.querySelector('#item-thumbnail').value;
        item.item_type = document.querySelector('#item-type').value;
        item.media = document.querySelector('#item-media').value;
        item.repo_uuid = document.querySelector('#repo-uuid').value;

        // item layout - standard item only
        item.layout = helperModule.get_checked_radio_button(document.getElementsByName('layout'));

        if (item.layout.length === 0) {
            item.layout = 'grid';
        }

        // item styles
        let item_background_color = document.querySelector('#item-background-color').value;
        let item_color = document.querySelector('#item-font-color').value;
        let item_font = document.querySelector('#item-font').value;

        if (item_background_color.length > 0) {
            item.styles.backGroundColor = item_background_color;
        }

        if (item_color.length > 0) {
            item.styles.color = document.querySelector('#item-font-color').value;
        }

        if (item_font.length > 0) {
            item.styles.fontFamily = item_font;
        }

        console.log(item);
        return item;
    }

    /**
     * Creates item heading
     */
    obj.create_heading_record = async function () {

        window.scrollTo(0, 0);
        let uuid = helperModule.get_parameter_by_name('uuid');

        if (uuid === undefined) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-info"></i> Unable to create item heading record.</div>`;
            return false;
        }

        document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Creating item heading record...</div>`;
        let data = get_heading_data();

        try {

            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'POST',
                url: EXHIBITS_ENDPOINTS.exhibits.heading_records.post.endpoint.replace(':exhibit_id', uuid),
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                document.querySelector('#item-heading-card').style.visibility = 'hidden';
                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Heading record created</div>`;

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = '';
                    document.querySelector('#item-heading-form').reset();
                    document.querySelector('#item-heading-card').style.visibility = 'visible';
                }, 3000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Creates grid
     */
    obj.create_grid_record = async function () {

        window.scrollTo(0, 0);
        let uuid = helperModule.get_parameter_by_name('uuid');

        if (uuid === undefined) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-info"></i> Unable to create grid record.</div>`;
            return false;
        }

        document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Creating grid record...</div>`;
        let data = get_grid_data();

        try {

            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'POST',
                url: EXHIBITS_ENDPOINTS.exhibits.grid_records.post.endpoint.replace(':exhibit_id', uuid),
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                window.scrollTo(0, 0);
                document.querySelector('#item-grid-card').style.visibility = 'hidden';
                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Grid record created</div>`;
                document.querySelector('#item-grid-form').reset();

                setTimeout(() => {
                    location.replace(`${APP_PATH}/dashboard/items/standard?uuid=${uuid}&grid=${response.data.data}`)
                }, 3000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Creates item
     */
    obj.create_item_record = async function () {

        window.scrollTo(0, 0);
        let uuid = helperModule.get_parameter_by_name('uuid');
        let grid_id = helperModule.get_parameter_by_name('grid');

        if (uuid === undefined) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-info"></i> Unable to create item record.</div>`;
            return false;
        }

        document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Creating item record...</div>`;
        let data = get_item_data();

        if (grid_id === undefined) {
            data.is_member_of_item_grid = '0';
        } else {
            data.is_member_of_item_grid = grid_id;
        }

        try {

            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'POST',
                url: EXHIBITS_ENDPOINTS.exhibits.item_records.post.endpoint.replace(':exhibit_id', uuid),
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                document.querySelector('#item-card').style.visibility = 'hidden';

                let message = 'Item record created';

                if (itemsFormModule.check_grid() === true) {
                    message = 'Grid item record created';
                }

                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> ${message}</div>`;

                setTimeout(() => {

                    if (itemsFormModule.check_grid() === true) {
                        location.replace(`${APP_PATH}/dashboard/items/standard?uuid=${uuid}&grid=${grid_id}`);
                    } else {
                        location.replace(`${APP_PATH}/dashboard/items/standard?uuid=${uuid}`);
                    }

                }, 3000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Sets menu links for headings form
     */
    obj.set_headings_form_nav_menu_links = function () {

        let uuid = helperModule.get_parameter_by_name('uuid');
        let back_link = `${APP_PATH}/dashboard/items?uuid=${uuid}`;
        let standard_item_link = `${APP_PATH}/dashboard/items/standard?uuid=${uuid}`;
        let item_grid_link = `${APP_PATH}/dashboard/items/grid?uuid=${uuid}`;
        let item_vertical_timeline_link = `${APP_PATH}/dashboard/items/vertical-timeline?uuid=${uuid}`;
        let form_menu_fragment = `
                <li>
                    <a href="${back_link}" data-backdrop="static" data-keyboard="false">
                        <i class=" menu-icon fa fa-arrow-left"></i>Back to items
                    </a>
                </li>
                <li>
                    <a href="${standard_item_link}" data-keyboard="false"> 
                        <i class=" menu-icon ti-menu-alt"></i>Add Items
                    </a>
                </li>
                <li>
                    <a href="${item_grid_link}" data-keyboard="false"> <i
                                class=" menu-icon fa fa-th"></i>Create Item Grid</a>
                </li>
                <li>
                    <a href="${item_vertical_timeline_link}" data-keyboard="false">
                        <i class=" menu-icon ti-calendar"></i>Create Vertical Timeline
                    </a>
                </li>`;

        document.querySelector('#items-menu').innerHTML = form_menu_fragment;
    };

    /**
     * Sets menu links for items form
     */
    obj.set_items_form_nav_menu_links = function () {

        let uuid = helperModule.get_parameter_by_name('uuid');
        let back_link = `${APP_PATH}/dashboard/items?uuid=${uuid}`;
        let headings_item_link = `${APP_PATH}/dashboard/items/heading?uuid=${uuid}`;
        let item_grid_link = `${APP_PATH}/dashboard/items/grid?uuid=${uuid}`;
        let item_vertical_timeline_link = `${APP_PATH}/dashboard/items/vertical-timeline?uuid=${uuid}`;
        let form_menu_fragment = `
                <li>
                    <a href="${back_link}" data-backdrop="static" data-keyboard="false">
                        <i class=" menu-icon fa fa-arrow-left"></i>Back to items
                    </a>
                </li>
                <li>
                    <a href="${headings_item_link}" data-keyboard="false"> 
                        <i class=" menu-icon ti-menu-alt"></i>Add Headings
                    </a>
                </li>
                <li>
                    <a href="${item_grid_link}" data-keyboard="false"> <i
                                class=" menu-icon fa fa-th"></i>Create Item Grid</a>
                </li>
                <li>
                    <a href="${item_vertical_timeline_link}" data-keyboard="false">
                        <i class=" menu-icon ti-calendar"></i>Create Vertical Timeline
                    </a>
                </li>`;

        document.querySelector('#items-menu').innerHTML = form_menu_fragment;
    };

    /**
     * Sets menu links for grid items form
     */
    obj.set_grid_items_form_nav_menu_links = function () {

        let uuid = helperModule.get_parameter_by_name('uuid');
        let back_link = `${APP_PATH}/dashboard/items?uuid=${uuid}`;
        let headings_item_link = `${APP_PATH}/dashboard/items/heading?uuid=${uuid}`;
        let standard_item_link = `${APP_PATH}/dashboard/items/standard?uuid=${uuid}`;
        let item_vertical_timeline_link = `${APP_PATH}/dashboard/items/vertical-timeline?uuid=${uuid}`;
        let form_menu_fragment = `
                <li>
                    <a href="${back_link}" data-backdrop="static" data-keyboard="false">
                        <i class=" menu-icon fa fa-arrow-left"></i>Back to items
                    </a>
                </li>
                <li>
                    <a href="${headings_item_link}" data-keyboard="false"> 
                        <i class=" menu-icon ti-menu-alt"></i>Add Headings
                    </a>
                </li>
                <li>
                    <a href="${standard_item_link}" data-keyboard="false"> 
                        <i class=" menu-icon ti-menu-alt"></i>Add Items
                    </a>
                </li>
                <li>
                    <a href="${item_vertical_timeline_link}" data-keyboard="false">
                        <i class=" menu-icon ti-calendar"></i>Create Vertical Timeline
                    </a>
                </li>`;

        document.querySelector('#items-menu').innerHTML = form_menu_fragment;
    };

    /**
     *
     * @return {boolean}
     */
    obj.check_grid = function () {

        let is_grid = helperModule.get_parameter_by_name('grid');

        if (is_grid !== null) {
            console.log('grid mode');
            document.querySelector('.is-grid-item').style.visibility = 'visible';
            document.querySelector('.is-standard-item').style.display = 'none';
            return true;
        }

        return false;
    }

    /**
     * Init function for headings form
     */
    obj.headings_init = function () {
        itemsFormModule.set_headings_form_nav_menu_links();
        document.querySelector('#save-heading-btn').addEventListener('click', itemsFormModule.create_heading_record);
        document.querySelector('#heading-background-color-picker').addEventListener('input', () => {
            if (document.querySelector('#heading-background-color')) {
                document.querySelector('#heading-background-color').value = document.querySelector('#heading-background-color-picker').value;
            }
        });

        document.querySelector('#heading-font-color-picker').addEventListener('input', () => {
            if (document.querySelector('#heading-font-color')) {
                document.querySelector('#heading-font-color').value = document.querySelector('#heading-font-color-picker').value;
            }
        });

    };

    /**
     * init function for standard items form
     */
    obj.items_init = function () {
        set_rich_text_editor();
        itemsFormModule.set_items_form_nav_menu_links();
        uploadsModule.upload_item_media();
        uploadsModule.upload_item_thumbnail();
        itemsFormModule.check_grid();
        document.querySelector('#save-item-btn').addEventListener('click', itemsFormModule.create_item_record);
        document.querySelector('#item-media-trash').style.display = 'none';
        document.querySelector('#item-thumbnail-trash').style.display = 'none';
        document.querySelectorAll('.item-layout-left-right-radio-btn').forEach((radio_input) => {
            radio_input.addEventListener('click', () => {
                document.querySelector('#item-media-width').style.display = 'block';
            });
        });

        document.querySelectorAll('.item-layout-radio-btn').forEach((radio_input) => {
            radio_input.addEventListener('click', () => {
                document.querySelector('#item-media-width').style.display = 'none';
            });
        });

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
    };

    /**
     * Init function for grid form
     */
    obj.grid_init = function () {

        itemsFormModule.set_grid_items_form_nav_menu_links();
        document.querySelector('#save-grid-btn').addEventListener('click', itemsFormModule.create_grid_record);
        uploadsModule.upload_item_media();
        uploadsModule.upload_item_thumbnail();

        document.querySelector('#grid-background-color-picker').addEventListener('input', () => {
            if (document.querySelector('#grid-background-color')) {
                document.querySelector('#grid-background-color').value = document.querySelector('#grid-background-color-picker').value;
            }
        });

        document.querySelector('#grid-font-color-picker').addEventListener('input', () => {
            if (document.querySelector('#grid-font-color')) {
                document.querySelector('#grid-font-color').value = document.querySelector('#grid-font-color-picker').value;
            }
        });
    };

    /**
     *
     */
    obj.init = async function () {
        // TODO: check auth?
        const uuid = helperModule.get_parameter_by_name('uuid');
        exhibitsModule.set_preview_link();
        await itemsModule.set_exhibit_title(uuid);

        /*
        setTimeout(() => {
            document.querySelector('.card').style.visibility = 'visible';
        }, 100);
         */
    };

    return obj;

}());
