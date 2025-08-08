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

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_exhibit_record() {

        try {

            const uuid = helperModule.get_parameter_by_name('exhibit_id');
            const token = authModule.get_user_token();
            const profile = authModule.get_user_profile_data();

            if (token === false || EXHIBITS_ENDPOINTS === null) {

                document.querySelector('#message').innerHTML = 'ERROR: Unable to get API endpoints';

                setTimeout(() => {
                    window.location.replace(APP_PATH + '/dashboard/login');
                }, 1000);

                return false;
            }

            document.querySelector('#exhibit-title').innerHTML = await exhibitsModule.get_exhibit_title(uuid);

            const endpoint = EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoints.get.endpoint.replace(':exhibit_id', uuid) + '?type=edit&uid=' + profile.uid;
            const response = await httpModule.req({
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
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    function get_exhibit_data() {

        try {

            let exhibit = exhibitsCommonFormModule.get_common_form_fields();
            exhibit.styles = exhibitsCommonFormModule.get_exhibit_styles();
            exhibit.hero_image_prev = document.querySelector('#hero-image-prev').value;
            exhibit.thumbnail_prev = document.querySelector('#thumbnail-image-prev').value;
            return exhibit;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    async function display_edit_record() {

        try {

            let record = await get_exhibit_record();
            let hero_image_url = '';
            let hero_image_fragment = '';
            let thumbnail_url = '';
            let thumbnail_fragment = '';
            let is_published = record.is_published;
            let created_by = record.created_by;
            let created = record.created;
            let create_date = new Date(created);
            let updated_by = record.updated_by;
            let updated = record.updated;
            let update_date = new Date(updated);
            let exhibit_created = '';
            let create_date_time = helperModule.format_date(create_date);
            let update_date_time = helperModule.format_date(update_date);

            helperModule.check_if_locked(record, '#exhibit-submit-card');

            if (created_by !== null) {
                exhibit_created += `<em>Created by ${created_by} on ${create_date_time}</em>`;
            }

            if (updated_by !== null) {
                exhibit_created += ` | <em>Last updated by ${updated_by} on ${update_date_time}</em>`;
            }

            document.querySelector('#created').innerHTML = exhibit_created;

            if (document.querySelector('#is-published') !== null && is_published === 1) {
                document.querySelector('#is-published').value = true;
            } else if (document.querySelector('#is-published') !== null && is_published === 0) {
                document.querySelector('#is-published').value = false;
            }

            // exhibit data
            document.querySelector('#exhibit-title-input').value = helperModule.unescape(record.title);
            document.querySelector('#exhibit-sub-title-input').value = helperModule.unescape(record.subtitle);
            document.querySelector('#exhibit-description-input').value = helperModule.unescape(record.description);
            document.querySelector('#exhibit-about-the-curators-input').value = helperModule.unescape(record.about_the_curators);
            document.querySelector('#exhibit-owner').value = record.owner;

            if (record.is_featured === 1) {
                document.querySelector('#is-featured').checked = true;
            } else {
                document.querySelector('#is-featured').checked = false;
            }

            if (record.is_student_curated === 1) {
                document.querySelector('#is-student-curated').checked = true;
            } else {
                document.querySelector('#is-student-curated').checked = false;
            }

            if (record.alert_text.length > 0) {
                document.querySelector('#is-content-advisory').checked = true;
                document.querySelector('#exhibit-alert-text-input').value = helperModule.unescape(record.alert_text);
            }

            // exhibit media
            if (record.hero_image.length > 0) {
                hero_image_url = `${APP_PATH}/api/v1/exhibits/${record.uuid}/media/${record.hero_image}`;
                hero_image_fragment = `<p><img alt="${record.hero_image}" src="${hero_image_url}" height="200"></p>`;
                document.querySelector('#hero-image-display').innerHTML = hero_image_fragment;
                document.querySelector('#hero-image-filename-display').innerHTML = `<span style="font-size: 11px">${record.hero_image}</span>`;
                document.querySelector('#hero-image').value = record.hero_image;
                document.querySelector('#hero-image-prev').value = record.hero_image;
                document.querySelector('#hero-trash').style.display = 'inline';
            }

            if (record.thumbnail.length > 0) {
                thumbnail_url = `${APP_PATH}/api/v1/exhibits/${record.uuid}/media/${record.thumbnail}`;
                thumbnail_fragment = `<p><img alt="${record.thumbnail}" src="${thumbnail_url}" height="200"></p>`;
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

            // exhibit styles
            let styles = JSON.parse(record.styles);

            if (styles.exhibit.navigation !== undefined) {

                if (styles.exhibit.navigation.backgroundColor !== undefined && styles.exhibit.navigation.backgroundColor.length !== 0) {
                    document.querySelector('#nav-background-color').value = styles.exhibit.navigation.backgroundColor;
                    document.querySelector('#nav-background-color-picker').value = styles.exhibit.navigation.backgroundColor;
                }

                if (styles.exhibit.navigation.color !== undefined && styles.exhibit.navigation.color.length !== 0) {
                    document.querySelector('#nav-font-color').value = styles.exhibit.navigation.color;
                    document.querySelector('#nav-font-color-picker').value = styles.exhibit.navigation.color;
                }

                let font_values = document.querySelector('#nav-font');

                for (let i = 0; i < font_values.length; i++) {
                    if (font_values[i].value === styles.exhibit.navigation.fontFamily) {
                        document.querySelector('#nav-font').value = styles.exhibit.navigation.fontFamily;
                    }
                }

                if (styles.exhibit.navigation.fontSize !== undefined) {
                    document.querySelector('#nav-font-size').value = styles.exhibit.navigation.fontSize.replace('px', '');
                }
            }

            if (styles.exhibit.template !== undefined && styles.exhibit.template.length !== 0) {

                if (styles.exhibit.template.backgroundColor !== undefined && styles.exhibit.template.backgroundColor.length !== 0) {
                    document.querySelector('#template-background-color').value = styles.exhibit.template.backgroundColor;
                    document.querySelector('#template-background-color-picker').value = styles.exhibit.template.backgroundColor;
                }

                if (styles.exhibit.template.color !== undefined && styles.exhibit.template.color.length !== 0) {
                    document.querySelector('#template-font-color').value = styles.exhibit.template.color;
                    document.querySelector('#template-font-color-picker').value = styles.exhibit.template.color;
                }

                let template_font_values = document.querySelector('#template-font');

                for (let i = 0; i < template_font_values.length; i++) {

                    if (template_font_values[i].value === styles.exhibit.template.fontFamily) {
                        document.querySelector('#template-font').value = styles.exhibit.template.fontFamily;
                    }
                }

                if (styles.exhibit.template.fontSize !== undefined) {
                    document.querySelector('#template-font-size').value = styles.exhibit.template.fontSize.replace('px', '');
                }
            }

            if (styles.exhibit.introduction !== undefined) {

                if (styles.exhibit.introduction.backgroundColor !== undefined && styles.exhibit.introduction.backgroundColor.length !== 0) {

                    if (styles.exhibit.introduction.backgroundColor.length > 0) {
                        document.querySelector('#introduction-background-color').value = styles.exhibit.introduction.backgroundColor;
                        document.querySelector('#introduction-background-color-picker').value = styles.exhibit.introduction.backgroundColor;
                    }
                }

                if (styles.exhibit.introduction.color !== undefined) {

                    if (styles.exhibit.introduction.color.length > 0 && styles.exhibit.introduction.color.length !== 0) {
                        document.querySelector('#introduction-font-color').value = styles.exhibit.introduction.color;
                        document.querySelector('#introduction-font-color-picker').value = styles.exhibit.introduction.color;
                    }
                }

                let font_values = document.querySelector('#introduction-font');

                for (let i = 0; i < font_values.length; i++) {
                    if (font_values[i].value === styles.exhibit.introduction.fontFamily) {
                        document.querySelector('#introduction-font').value = styles.exhibit.introduction.fontFamily;
                    }
                }

                if (styles.exhibit.introduction.fontSize !== undefined) {
                    document.querySelector('#introduction-font-size').value = styles.exhibit.introduction.fontSize.replace('px', '');
                }
            }

            return false;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.update_exhibit_record = async function () {

        try {

            scrollTo(0, 0);
            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Updating exhibit record...</div>`;
            let uuid = helperModule.get_parameter_by_name('exhibit_id');
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
                }, 1000);

                return false;
            }

            const user = JSON.parse(sessionStorage.getItem('exhibits_user'));

            if (user.name === null) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to retrieve your name</div>`;
                return false;
            }

            data.updated_by = user.name;

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
                    window.location.reload();
                }, 900);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    function delete_hero_image() {

        try {

            (async function () {

                const uuid = helperModule.get_parameter_by_name('exhibit_id');
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
                        window.location.reload();
                    }, 900);
                }

            })();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }

        return false;
    }

    function delete_thumbnail_image() {

        try {

            (async function () {

                const uuid = helperModule.get_parameter_by_name('exhibit_id');
                let hero_image = document.querySelector('#thumbnail-image').value;
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

                    document.querySelector('#thumbnail-image').value = '';
                    document.querySelector('#thumbnail-filename-display').innerHTML = '';
                    document.querySelector('#thumbnail-trash').style.display = 'none';
                    document.querySelector('#thumbnail-image-display').innerHTML = '';
                    document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Thumbnail deleted</div>`;

                    setTimeout(() => {
                        document.querySelector('#message').innerHTML = '';
                        window.location.reload();
                    }, 900);
                }

            })();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }

        return false;
    }

    obj.init = async function () {

        try {

            const uuid = helperModule.get_parameter_by_name('exhibit_id');
            authModule.check_permissions(['update_exhibit', 'update_any_exhibit'], 'exhibit', uuid);
            navModule.back_to_exhibits();
            document.querySelector('#save-exhibit-btn').addEventListener('click', exhibitsEditFormModule.update_exhibit_record);

            setTimeout(async () => {

                await display_edit_record();

                if (document.querySelector('#hero-image').value.length === 0) {
                    document.querySelector('#hero-trash').removeEventListener('click', delete_hero_image);
                    document.querySelector('#hero-trash').addEventListener('click', exhibitsCommonFormModule.delete_hero_image);
                } else if (document.querySelector('#hero-image').value !== 0) {
                    document.querySelector('#hero-trash').removeEventListener('click', exhibitsCommonFormModule.delete_hero_image);
                    document.querySelector('#hero-trash').addEventListener('click', delete_hero_image);
                }

                if (document.querySelector('#thumbnail-image').value.length === 0) {
                    document.querySelector('#thumbnail-trash').removeEventListener('click', delete_thumbnail_image);
                    document.querySelector('#thumbnail-trash').addEventListener('click', exhibitsCommonFormModule.delete_thumbnail_image);
                } else if (document.querySelector('#thumbnail-image').value.length !== 0) {
                    document.querySelector('#thumbnail-trash').removeEventListener('click', exhibitsCommonFormModule.delete_thumbnail_image);
                    document.querySelector('#thumbnail-trash').addEventListener('click', delete_thumbnail_image);
                }

            }, 500);

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
