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

    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    /**
     *
     * @return {boolean}

     obj.toggle_item_forms = function () {

        let radios = document.querySelector('#is-heading-check').elements['heading'];
        for(let  i = 0, max = radios.length; i < max; i++) {
            radios[i].onclick = () => {
                if (radios[i].value === 'yes') {
                    // show headings form
                    document.querySelector('#is-heading').style.display = 'block';
                    document.querySelector('#is-standard-item').style.display = 'none';
                } else if (radios[i].value === 'no') {
                    // show standard items form
                    document.querySelector('#is-heading').style.display = 'none';
                    document.querySelector('#is-standard-item').style.display = 'block';
                }
            }
        }

        return false;
    }
     */

    /**
     * Gets item heading data
     */
    function get_heading_data() {
        let item_heading = {};
        item_heading.text = document.querySelector('#item-heading-text').value;
        item_heading.subtext = document.querySelector('#item-heading-sub-text').value;
        return item_heading;
    }

    /**
     * Gets grid data
     */
    function get_grid_data() {
        let grid = {};
        grid.styles = {};
        grid.columns = document.querySelector('#grid-columns').value;
        grid.styles.backGroundColor = document.querySelector('#grid-background-color').value;
        grid.styles.color = document.querySelector('#grid-font-color').value;
        grid.styles.fontFamily = document.querySelector('#grid-font').value;
        return grid;
    }

    /**
     * Gets item data
     */
    function get_item_data() {

        let item = {};
        item.styles = {};
        // item metadata
        item.title = document.querySelector('#item-title').value;
        item.caption = document.querySelector('#item-caption').value;
        item.description = document.querySelector('#item-description').value;
        item.text = document.querySelector('#item-text').value;
        item.date = document.querySelector('#item-date').value; // grid item only
        // item media
        item.thumbnail = document.querySelector('#item-thumbnail').value;
        item.item_type = document.querySelector('#item-type').value;
        item.media = document.querySelector('#item-media').value;
        item.repo_uuid = document.querySelector('#repo-uuid').value;
        // item layout
        item.layout = helperModule.get_checked_radio_button(document.getElementsByName('layout')); // standard item only
        // item styles - TODO: check if styles are blank - see exhibit styles
        item.styles.backGroundColor = document.querySelector('#item-background-color').value;
        item.styles.color = document.querySelector('#item-font-color').value;
        item.styles.fontFamily = document.querySelector('#item-font').value;

        console.log(item);
        return item;
    }

    /**
     * Creates item heading
     */
    obj.create_heading_record = async function () {

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
                    location.replace(`/dashboard/items/standard?uuid=${uuid}&grid=${response.data.data}`)
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

        let uuid = helperModule.get_parameter_by_name('uuid');
        let grid_id = helperModule.get_parameter_by_name('grid');

        if (uuid === undefined) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-info"></i> Unable to create item record.</div>`;
            return false;
        }

        document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Creating item record...</div>`;
        let data = get_item_data();
        data.is_member_of_item_grid = grid_id;
        console.log('data', data);

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

                window.scrollTo(0, 0);

                document.querySelector('#item-card').style.visibility = 'hidden';
                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Grid item record created</div>`;

                setTimeout(() => {

                    if (itemsFormModule.check_grid() === true) {
                        location.replace(`/dashboard/items/standard?uuid=${uuid}&grid=${response.data.data}`);
                    } else {
                        location.replace(`/dashboard/items/standard?uuid=${uuid}`);
                    }

                }, 3000);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.set_headings_form_nav_menu_links = function () {

        let uuid = helperModule.get_parameter_by_name('uuid');
        let back_link = `/dashboard/items?uuid=${uuid}`;
        let standard_item_link = `/dashboard/items/standard?uuid=${uuid}`;
        let item_grid_link = `/dashboard/items/grid?uuid=${uuid}`;
        let item_vertical_timeline_link = `/dashboard/items/vertical-timeline?uuid=${uuid}`;
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

    obj.set_items_form_nav_menu_links = function () {

        let uuid = helperModule.get_parameter_by_name('uuid');
        let back_link = `/dashboard/items?uuid=${uuid}`;
        let headings_item_link = `/dashboard/items/heading?uuid=${uuid}`;
        let item_grid_link = `/dashboard/items/grid?uuid=${uuid}`;
        let item_vertical_timeline_link = `/dashboard/items/vertical-timeline?uuid=${uuid}`;
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

    obj.set_grid_items_form_nav_menu_links = function () {

        let uuid = helperModule.get_parameter_by_name('uuid');
        let back_link = `/dashboard/items?uuid=${uuid}`;
        let headings_item_link = `/dashboard/items/heading?uuid=${uuid}`;
        let standard_item_link = `/dashboard/items/standard?uuid=${uuid}`;
        let item_vertical_timeline_link = `/dashboard/items/vertical-timeline?uuid=${uuid}`;
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

    obj.init = async function () {
        // TODO: check auth?
        const uuid = helperModule.get_parameter_by_name('uuid');
        exhibitsModule.set_preview_link();
        await itemsModule.set_exhibit_title(uuid);
        setTimeout(() => {
            document.querySelector('.card').style.visibility = 'visible';
        }, 100);
    };

    return obj;

}());
