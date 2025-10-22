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

    obj.get_common_form_fields = function () {

        // Cache all DOM selectors
        const selectors = {
            title: '#exhibit-title-input',
            subtitle: '#exhibit-sub-title-input',
            description: '#exhibit-description-input',
            curators: '#exhibit-about-the-curators-input',
            alert_text: '#exhibit-alert-text-input',
            is_featured: '#is-featured',
            is_student_curated: '#is-student-curated',
            is_content_advisory: '#is-content-advisory',
            owner: '#exhibit-owner',
            is_published: '#is-published',
            hero_image: '#hero-image',
            thumbnail: '#thumbnail-image',
            page_layout: '#exhibit-page-layout',
            template: '#exhibit-template',
            title_error: '#exhibit-title-error',
            message: '#message'
        };

        // Helper function to safely get element value
        const get_element_value = (selector, default_value = '') => {
            const element = document.querySelector(selector);
            return element?.value?.trim() || default_value;
        };

        // Helper function to safely get checkbox state
        const get_checkbox_value = (selector) => {
            const element = document.querySelector(selector);
            return element?.checked ?? false;
        };

        // Helper function to convert boolean to binary integer
        const bool_to_int = (value) => value ? 1 : 0;

        // Helper function to display error messages safely (prevents XSS)
        const show_error = (selector, message) => {
            const element = document.querySelector(selector);
            if (!element) {
                console.error(`Error element ${selector} not found`);
                return;
            }

            const alert_div = document.createElement('div');
            alert_div.className = 'alert alert-danger';
            alert_div.setAttribute('role', 'alert');

            const icon = document.createElement('i');
            icon.className = 'fa fa-exclamation';

            const text = document.createTextNode(` ${message}`);

            alert_div.appendChild(icon);
            alert_div.appendChild(text);

            element.innerHTML = '';
            element.appendChild(alert_div);
        };

        try {
            // Get and clean text inputs
            const title = helperModule.clean_html(get_element_value(selectors.title));
            const subtitle = helperModule.clean_html(get_element_value(selectors.subtitle));
            const description = helperModule.clean_html(get_element_value(selectors.description));
            const about_curators = helperModule.clean_html(get_element_value(selectors.curators));

            // Validate required field
            if (!title) {
                show_error(selectors.title_error, 'Please enter an exhibit title');
                return false;
            }

            // Get checkbox values
            const is_featured = get_checkbox_value(selectors.is_featured);
            const is_student_curated = get_checkbox_value(selectors.is_student_curated);
            const is_content_advisory = get_checkbox_value(selectors.is_content_advisory);

            // Get conditional alert text
            const alert_text = is_content_advisory
                ? helperModule.clean_html(get_element_value(selectors.alert_text))
                : '';

            // Get optional fields (may not exist in all forms)
            const owner = get_element_value(selectors.owner);
            const is_published = get_element_value(selectors.is_published);

            // Get media fields
            const hero_image = get_element_value(selectors.hero_image);
            const thumbnail = get_element_value(selectors.thumbnail);

            // Get banner template from radio buttons
            const banner_elements = document.getElementsByName('banner_template');
            const banner_template = banner_elements.length > 0
                ? helperModule.get_checked_radio_button(banner_elements)
                : '';

            // Get layout fields
            const page_layout = get_element_value(selectors.page_layout);
            const exhibit_template = get_element_value(selectors.template);

            // Construct exhibit object
            const exhibit = {
                title,
                subtitle,
                description,
                about_the_curators: about_curators,
                is_featured: bool_to_int(is_featured),
                is_student_curated: bool_to_int(is_student_curated),
                alert_text: alert_text,
                hero_image: hero_image,
                thumbnail: thumbnail,
                banner_template: banner_template,
                page_layout: page_layout,
                exhibit_template: exhibit_template
            };

            // Add optional fields only if they have values
            if (owner) {
                exhibit.owner = owner;
            }

            if (is_published) {
                exhibit.is_published = is_published;
            }

            return exhibit;

        } catch (error) {
            // Log error for debugging
            console.error('Error getting form fields:', error);

            // Display safe error message
            show_error(selectors.message, 'An error occurred while processing form data');

            return false;
        }
    };

    obj.get_exhibit_styles = function () {

        // Configuration mapping for style fields
        const style_config = {
            navigation: {
                backgroundColor: { selector: '#nav-background-color', transform: null },
                color: { selector: '#nav-font-color', transform: null },
                fontFamily: { selector: '#nav-font', transform: null },
                fontSize: { selector: '#nav-font-size', transform: (val) => val ? `${val}px` : '' }
            },
            template: {
                backgroundColor: { selector: '#template-background-color', transform: null },
                color: { selector: '#template-font-color', transform: null },
                fontFamily: { selector: '#template-font', transform: null },
                fontSize: { selector: '#template-font-size', transform: (val) => val ? `${val}px` : '' }
            },
            introduction: {
                backgroundColor: { selector: '#introduction-background-color', transform: null },
                color: { selector: '#introduction-font-color', transform: null },
                fontFamily: { selector: '#introduction-font', transform: null },
                fontSize: { selector: '#introduction-font-size', transform: (val) => val ? `${val}px` : '' }
            }
        };

        // Helper function to safely get element value
        const get_element_value = (selector) => {
            const element = document.querySelector(selector);
            return element?.value?.trim() || '';
        };

        // Helper function to apply transformation if provided
        const apply_transform = (value, transform) => {
            if (!value) return '';
            return transform ? transform(value) : value;
        };

        // Helper function to display error messages safely (prevents XSS)
        const show_error = (message) => {
            const message_el = document.querySelector('#message');
            if (!message_el) {
                console.error('Message element not found');
                return;
            }

            const alert_div = document.createElement('div');
            alert_div.className = 'alert alert-danger';
            alert_div.setAttribute('role', 'alert');

            const icon = document.createElement('i');
            icon.className = 'fa fa-exclamation';

            const text = document.createTextNode(` ${message}`);

            alert_div.appendChild(icon);
            alert_div.appendChild(text);

            message_el.innerHTML = '';
            message_el.appendChild(alert_div);
        };

        // Build styles object from configuration
        const build_styles_object = (config) => {
            const result = {};

            for (const [section, properties] of Object.entries(config)) {
                result[section] = {};

                for (const [property, settings] of Object.entries(properties)) {
                    const raw_value = get_element_value(settings.selector);
                    result[section][property] = apply_transform(raw_value, settings.transform);
                }
            }

            return result;
        };

        try {

            const styles = build_styles_object(style_config);

            return {
                exhibit: styles
            };

        } catch (error) {
            // Log error for debugging
            console.error('Error getting exhibit styles:', error);

            // Display safe error message
            show_error('An error occurred while processing style data');

            return null;
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

            document.querySelector('#introduction-background-color').addEventListener('input', () => {
                document.querySelector('#introduction-background-color-picker').value = document.querySelector('#introduction-background-color').value;
            });

            document.querySelector('#introduction-font-color-picker').addEventListener('input', () => {
                if (document.querySelector('#introduction-font-color')) {
                    document.querySelector('#introduction-font-color').value = document.querySelector('#introduction-font-color-picker').value;
                }
            });

            document.querySelector('#introduction-font-color').addEventListener('input', () => {
                document.querySelector('#introduction-font-color-picker').value = document.querySelector('#introduction-font-color').value;
            });

            document.querySelector('#nav-background-color-picker').addEventListener('input', () => {
                if (document.querySelector('#nav-background-color')) {
                    document.querySelector('#nav-background-color').value = document.querySelector('#nav-background-color-picker').value;
                }
            });

            document.querySelector('#nav-background-color').addEventListener('input', () => {
                document.querySelector('#nav-background-color-picker').value = document.querySelector('#nav-background-color').value;
            });

            document.querySelector('#nav-font-color-picker').addEventListener('input', () => {
                if (document.querySelector('#nav-font-color')) {
                    document.querySelector('#nav-font-color').value = document.querySelector('#nav-font-color-picker').value;
                }
            });

            document.querySelector('#nav-font-color').addEventListener('input', () => {
                document.querySelector('#nav-font-color-picker').value = document.querySelector('#nav-font-color').value;
            });

            document.querySelector('#template-background-color-picker').addEventListener('input', () => {
                if (document.querySelector('#template-background-color')) {
                    document.querySelector('#template-background-color').value = document.querySelector('#template-background-color-picker').value;
                }
            });

            document.querySelector('#template-background-color').addEventListener('input', () => {
                document.querySelector('#template-background-color-picker').value = document.querySelector('#template-background-color').value;
            });

            document.querySelector('#template-font-color-picker').addEventListener('input', () => {
                if (document.querySelector('#template-font-color')) {
                    document.querySelector('#template-font-color').value = document.querySelector('#template-font-color-picker').value;
                }
            });

            document.querySelector('#template-font-color').addEventListener('input', () => {
                document.querySelector('#template-font-color-picker').value = document.querySelector('#template-font-color').value;
            });

            helperModule.show_form();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
