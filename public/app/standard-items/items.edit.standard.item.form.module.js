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

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    let obj = {};

    async function get_item_record() {

        try {

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
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

        try {

            const record = await get_item_record();

            if (!record) {
                console.error('No record returned from get_item_record()');
                return false;
            }

            const is_media_path = window.location.pathname.includes('media');

            // Helper function for safe DOM queries
            const set_element_value = (selector, value) => {
                const el = document.querySelector(selector);
                if (el) {
                    el.value = value;
                }
            };

            const set_element_checked = (selector, checked) => {
                const el = document.querySelector(selector);
                if (el) {
                    el.checked = !!checked;
                }
            };

            // Format and display creation/update metadata
            const create_datetime = helperModule.format_date(new Date(record.created));
            const update_datetime = helperModule.format_date(new Date(record.updated));
            const metadata_parts = [];

            if (record.created_by) {
                metadata_parts.push(`<em>Created by ${record.created_by} on ${create_datetime}</em>`);
            }
            if (record.updated_by) {
                metadata_parts.push(`<em>Last updated by ${record.updated_by} on ${update_datetime}</em>`);
            }

            const created_el = document.querySelector('#created');
            if (created_el) {
                created_el.innerHTML = metadata_parts.join(' | ');
            }

            // Check if record is locked
            helperModule.check_if_locked(record, '#exhibit-submit-card');

            // Set published status
            const published_el = document.querySelector('#is-published');
            if (published_el) {
                published_el.value = record.is_published === 1;
            }

            // Set basic item data
            set_element_value('#item-title-input', helperModule.unescape(record.title));
            set_element_value('#item-text-input', helperModule.unescape(record.text));

            // Handle media-specific fields
            if (is_media_path) {
                await helperMediaModule.display_media_fields_common(record);

                if (record.item_subjects?.length > 0) {
                    const subjects = record.item_subjects.split('|');
                    await helperModule.create_subjects_menu(subjects);
                }
            }

            // Set radio button selections efficiently
            const set_radio_value = (name, value) => {
                const elements = document.getElementsByName(name);
                for (const el of elements) {
                    if (el.value === value) {
                        set_element_checked(`#${el.id}`, true);
                        break; // Found match, exit early
                    }
                }
            };

            set_radio_value('layout', record.layout);
            set_radio_value('media_width', String(record.media_width));

            // Parse and apply styles
            const apply_styles = () => {
                let styles = {};

                try {
                    styles = JSON.parse(record.styles || '{}');
                } catch (e) {
                    console.error('Invalid styles JSON:', e.message);
                    return;
                }

                if (Object.keys(styles).length === 0) {
                    return;
                }

                const style_field_map = {
                    backgroundColor: ['#item-background-color', '#item-background-color-picker'],
                    color: ['#item-font-color', '#item-font-color-picker'],
                };

                // Apply color and background styles
                for (const [style_key, selectors] of Object.entries(style_field_map)) {
                    const value = styles[style_key] || '';
                    selectors.forEach(selector => set_element_value(selector, value));
                }

                // Set font family
                if (styles.fontFamily) {
                    set_element_value('#item-font', styles.fontFamily);
                }

                // Set font size (remove 'px' suffix)
                if (styles.fontSize) {
                    const font_size_value = styles.fontSize.replace(/px$/, '');
                    set_element_value('#item-font-size', font_size_value);
                } else {
                    set_element_value('#item-font-size', '');
                }
            };

            apply_styles();

            return false;

        } catch (error) {
            console.error('Error in display_edit_record:', error.message);
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
            return false;
        }
    }

    obj.update_item_record = async function () {

        try {

            scrollTo(0, 0);
            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            let exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            let item_id = helperModule.get_parameter_by_name('item_id');
            let data = itemsCommonStandardItemFormModule.get_common_standard_item_form_fields();
            let token = authModule.get_user_token();
            let response;

            if (exhibit_id === undefined || item_id === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get record ID</div>`;
                return false;
            }

            if (token === false) {
                setTimeout(() => {
                    document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get session token</div>`;
                    authModule.logout();
                }, 1000);

                return false;
            }

            if (data === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get form field values</div>`;
                return false;
            } else if (data === false) {
                return false;
            }

            data.updated_by = helperModule.get_user_name();

            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Updating item record...</div>`;

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
                    window.location.reload();
                }, 900);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.init = async function () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            let type = 'media';

            if (window.location.pathname.indexOf('text')) {
                type = 'text';
            }

            const redirect = '/items/standard/' + type + '/details?exhibit_id=' + exhibit_id + '&item_id=' + item_id + '&status=403';
            await authModule.check_permissions(['update_item', 'update_any_item'], 'item', exhibit_id, item_id, redirect);

            exhibitsModule.set_exhibit_title(exhibit_id);
            await display_edit_record();
            document.querySelector('#update-item-btn').addEventListener('click', itemsEditStandardItemFormModule.update_item_record);

            if (window.location.pathname.indexOf('media') !== -1) {
                helperMediaModule.media_edit_init();
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
