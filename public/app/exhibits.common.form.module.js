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

const exhibitsCommonFormModule = (function () {

    'use strict';

    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    /**
     * Gets common form fields
     */
    obj.get_common_form_fields = function () {

        try {

            let exhibit = {};

            // exhibit data
            exhibit.title = helperModule.clean_html(document.querySelector('#exhibit-title-input').value);
            exhibit.subtitle = helperModule.clean_html(document.querySelector('#exhibit-sub-title-input').value);
            exhibit.alert_text = helperModule.clean_html(document.querySelector('#exhibit-alert-text-input').value);
            exhibit.description = helperModule.clean_html(document.querySelector('#exhibit-description-input').value);
            exhibit.about_the_curators = helperModule.clean_html(document.querySelector('#exhibit-about-the-curators-input').value);
            exhibit.is_featured = document.querySelector('#is-featured').checked;
            exhibit.is_student_curated = document.querySelector('#is-student-curated').checked;

            if (exhibit.is_featured === true) {
                exhibit.is_featured = 1;
            } else if (exhibit.is_featured === false) {
                exhibit.is_featured = 0;
            }

            if (exhibit.is_student_curated === true) {
                exhibit.is_student_curated = 1;
            } else if (exhibit.is_student_curated === false) {
                exhibit.is_student_curated = 0;
            }

            // validate
            if (exhibit.title.length === 0) {
                document.querySelector('#exhibit-title-error').innerHTML = '<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Please enter an exhibit title</div>';
                return false;
            }

            // exhibit media
            exhibit.hero_image = document.querySelector('#hero-image').value;
            exhibit.thumbnail = document.querySelector('#thumbnail-image').value;

            // exhibit banner
            exhibit.banner_template = helperModule.get_checked_radio_button(document.getElementsByName('banner_template'));

            // exhibit page layout
            // exhibit.page_layout = helperModule.get_checked_radio_button(document.getElementsByName('page_layout'));
            exhibit.page_layout = document.querySelector('#exhibit-page-layout').value;

            // exhibit template layout - only one option set by default - hidden field in add/edit forms
            exhibit.exhibit_template = document.querySelector('#exhibit-template').value;

            return exhibit;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Gets exhibit styles
     */
    obj.get_exhibit_styles = function () {

        try {

            let exhibit = {};
            let navigation = {};
            let template = {};
            let introduction = {};

            let exhibit_nav_background_color = document.querySelector('#nav-background-color').value;
            let exhibit_nav_font_color = document.querySelector('#nav-font-color').value;
            let exhibit_nav_font = document.querySelector('#nav-font').value;
            let exhibit_nav_font_size = document.querySelector('#nav-font-size').value;
            let exhibit_template_background_color = document.querySelector('#template-background-color').value;
            let exhibit_template_font_color = document.querySelector('#template-font-color').value;
            let exhibit_template_font = document.querySelector('#template-font').value;
            let exhibit_template_font_size = document.querySelector('#template-font-size').value;

            let exhibit_introduction_background_color = document.querySelector('#introduction-background-color').value;
            let exhibit_introduction_font_color = document.querySelector('#introduction-font-color').value;
            let exhibit_introduction_font = document.querySelector('#introduction-font').value;
            let exhibit_introduction_font_size = document.querySelector('#introduction-font-size').value;

            if (exhibit_nav_background_color.length > 0) {
                navigation.backgroundColor = exhibit_nav_background_color;
            } else {
                navigation.backgroundColor = '';
            }

            if (exhibit_nav_font_color.length > 0) {
                navigation.color = exhibit_nav_font_color;
            } else {
                navigation.color = '';
            }

            if (exhibit_nav_font.length > 0) {
                navigation.fontFamily = exhibit_nav_font;
            } else {
                navigation.fontFamily = '';
            }

            if (exhibit_nav_font_size.length > 0) {
                navigation.fontSize = `${exhibit_nav_font_size}px`;
            } else {
                navigation.fontSize = '';
            }

            if (exhibit_template_background_color.length > 0) {
                template.backgroundColor = exhibit_template_background_color;
            } else {
                template.backgroundColor = '';
            }

            if (exhibit_template_font_color.length > 0) {
                template.color = exhibit_template_font_color;
            } else {
                template.color = '';
            }

            if (exhibit_template_font.length > 0) {
                template.fontFamily = exhibit_template_font;
            } else {
                template.fontFamily = '';
            }

            if (exhibit_template_font_size.length > 0) {
                template.fontSize = `${exhibit_template_font_size}px`;
            } else {
                template.fontSize = '';
            }

            if (exhibit_introduction_background_color.length > 0) {
                introduction.backgroundColor = exhibit_introduction_background_color;
            } else {
                introduction.backgroundColor = '';
            }

            if (exhibit_introduction_font_color.length > 0) {
                introduction.color = exhibit_introduction_font_color;
            } else {
                introduction.color = '';
            }

            if (exhibit_introduction_font.length > 0) {
                introduction.fontFamily = exhibit_introduction_font;
            } else {
                introduction.fontFamily = '';
            }

            if (exhibit_introduction_font_size.length > 0) {
                introduction.fontSize = `${exhibit_introduction_font_size}px`;
            } else {
                introduction.fontSize = '';
            }

            exhibit.exhibit = {
                navigation: navigation,
                template: template,
                introduction: introduction
            };

            return exhibit;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Deletes hero image
     */
    obj.delete_hero_image = function () {

        try {

            (async function() {

                let hero_image = document.querySelector('#hero-image').value;
                let token = authModule.get_user_token();
                let response = await httpModule.req({
                    method: 'DELETE',
                    url: EXHIBITS_ENDPOINTS.exhibits.media.delete.endpoint + '?media=' + hero_image,
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
                    }, 1000);
                }

            })();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }

        return false;
    }

    /**
     * Deletes thumbnail image
     */
    obj.delete_thumbnail_image = function () {

        try {

            (async function() {

                let thumbnail_image = document.querySelector('#thumbnail-image').value;
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

                    document.querySelector('#thumbnail-image').value = '';
                    document.querySelector('#thumbnail-filename-display').innerHTML = '';
                    document.querySelector('#thumbnail-trash').style.display = 'none';
                    document.querySelector('#thumbnail-image-display').innerHTML = '';
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
    }

    /**
     * Init function for exhibits common add/edit forms
     */
    obj.init = async function () {

        try {

            uploadsModule.upload_exhibit_hero_image();
            uploadsModule.upload_exhibit_thumbnail_image();

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            navModule.init();
            document.querySelector('#hero-trash').style.display = 'none';
            document.querySelector('#thumbnail-trash').style.display = 'none';

            document.querySelector('#introduction-background-color-picker').addEventListener('input', () => {
                if (document.querySelector('#introduction-background-color')) {
                    document.querySelector('#introduction-background-color').value = document.querySelector('#introduction-background-color-picker').value;
                }
            });

            document.querySelector('#introduction-font-color-picker').addEventListener('input', () => {
                if (document.querySelector('#introduction-font-color')) {
                    document.querySelector('#introduction-font-color').value = document.querySelector('#introduction-font-color-picker').value;
                }
            });

            document.querySelector('#nav-background-color-picker').addEventListener('input', () => {
                if (document.querySelector('#nav-background-color')) {
                    document.querySelector('#nav-background-color').value = document.querySelector('#nav-background-color-picker').value;
                }
            });

            document.querySelector('#nav-font-color-picker').addEventListener('input', () => {
                if (document.querySelector('#nav-font-color')) {
                    document.querySelector('#nav-font-color').value = document.querySelector('#nav-font-color-picker').value;
                }
            });

            document.querySelector('#template-background-color-picker').addEventListener('input', () => {
                if (document.querySelector('#template-background-color')) {
                    document.querySelector('#template-background-color').value = document.querySelector('#template-background-color-picker').value;
                }
            });

            document.querySelector('#template-font-color-picker').addEventListener('input', () => {
                if (document.querySelector('#template-font-color')) {
                    document.querySelector('#template-font-color').value = document.querySelector('#template-font-color-picker').value;
                }
            });

            helperModule.show_form();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
