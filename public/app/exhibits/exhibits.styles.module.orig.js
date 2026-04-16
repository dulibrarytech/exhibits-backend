/**

 Copyright 2026 University of Denver

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

const exhibitsStylesModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Style section keys — must match the EJS styleSections array in exhibit-styles.ejs.
     * Order: required sections first, then optional sections.
     * @type {string[]}
     */
    const STYLE_SECTIONS = [
        'introduction',
        'navigation',
        'heading1',
        'item1',
        'heading2',
        'heading3',
        'item2',
        'item3'
    ];

    /**
     * Section keys that must have all four fields filled before form submission.
     * @type {string[]}
     */
    const REQUIRED_SECTIONS = [
        'introduction',
        'navigation',
        'heading1',
        'item1'
    ];

    /**
     * Human-readable labels for each section (used in validation error messages).
     * @type {Object}
     */
    const SECTION_LABELS = {
        introduction: 'Exhibit Introduction',
        navigation: 'Navigation Menu',
        heading1: 'Heading Style 1',
        item1: 'Item Style 1',
        heading2: 'Heading Style 2',
        heading3: 'Heading Style 3',
        item2: 'Item Style 2',
        item3: 'Item Style 3'
    };

    /**
     * Human-readable labels for each style property (used in validation error messages).
     * @type {Object}
     */
    const PROPERTY_LABELS = {
        backgroundColor: 'Background Color',
        color: 'Font Color',
        fontSize: 'Font Size',
        fontFamily: 'Font'
    };

    /**
     * CSS property keys used in the styles JSON blob.
     * Maps each property to its DOM selector suffix and optional value transform.
     * @type {Object}
     */
    const STYLE_PROPERTIES = {
        backgroundColor: {
            suffix: '-background-color',
            picker_suffix: '-background-color-picker',
            swatch_role: 'bg',
            transform: null
        },
        color: {
            suffix: '-font-color',
            picker_suffix: '-font-color-picker',
            swatch_role: 'font',
            transform: null
        },
        fontSize: {
            suffix: '-font-size',
            picker_suffix: null,
            swatch_role: null,
            transform: function (val) {
                return val ? val + 'px' : '';
            }
        },
        fontFamily: {
            suffix: '-font',
            picker_suffix: null,
            swatch_role: null,
            transform: null
        }
    };

    // ==================== PRIVATE HELPERS ====================

    /**
     * Safely gets the trimmed value of a DOM element
     * @param {string} selector - CSS selector
     * @returns {string} Trimmed value or empty string
     */
    const get_element_value = function (selector) {
        const element = document.querySelector(selector);
        return element?.value?.trim() || '';
    };

    /**
     * Safely sets the value of a DOM element
     * @param {string} selector - CSS selector
     * @param {string} value - Value to set
     */
    const set_element_value = function (selector, value) {
        const element = document.querySelector(selector);

        if (element) {
            element.value = value || '';
        }
    };

    /**
     * Validates a hex color string
     * @param {string} value - Color string to validate
     * @returns {boolean} True if valid hex color
     */
    const is_valid_hex_color = function (value) {
        return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);
    };

    /**
     * Updates a header swatch element with a color value
     * @param {string} section_key - Section key (e.g. 'introduction')
     * @param {string} role - Swatch role ('bg' or 'font')
     * @param {string} color_value - Hex color value
     */
    const update_swatch = function (section_key, role, color_value) {
        const swatch = document.getElementById('swatch-' + section_key + '-' + role);

        if (!swatch) {
            return;
        }

        if (is_valid_hex_color(color_value)) {
            swatch.style.backgroundColor = color_value;
            swatch.style.backgroundImage = 'none';
        } else {
            swatch.style.backgroundColor = '';
            swatch.style.backgroundImage = '';
        }
    };

    /**
     * Syncs color picker ↔ text input bidirectionally and updates the header swatch.
     * @param {string} section_key - Section key
     * @param {string} input_suffix - Text input ID suffix (e.g. '-background-color')
     * @param {string} picker_suffix - Color picker ID suffix (e.g. '-background-color-picker')
     * @param {string} swatch_role - Swatch role ('bg' or 'font')
     * @returns {boolean} True if listeners were attached successfully
     */
    const setup_color_sync = function (section_key, input_suffix, picker_suffix, swatch_role) {
        const input_el = document.getElementById(section_key + input_suffix);
        const picker_el = document.getElementById(section_key + picker_suffix);

        if (!input_el || !picker_el) {
            console.warn('Color picker elements not found for section: ' + section_key + input_suffix);
            return false;
        }

        // Picker → text input + swatch
        picker_el.addEventListener('input', function () {
            input_el.value = picker_el.value;
            update_swatch(section_key, swatch_role, picker_el.value);
        });

        // Text input → picker + swatch
        input_el.addEventListener('input', function () {
            const val = input_el.value.trim();

            if (is_valid_hex_color(val)) {
                picker_el.value = val;
            }

            update_swatch(section_key, swatch_role, val);
        });

        return true;
    };

    /**
     * Strips 'px' suffix from a font size value for populating the number input
     * @param {string} value - fontSize value (e.g. '16px' or '16')
     * @returns {string} Numeric string or empty string
     */
    const strip_px = function (value) {

        if (!value || typeof value !== 'string') {
            return '';
        }

        return value.replace(/px$/i, '').trim();
    };

    // ==================== PUBLIC API ====================

    /**
     * Validates that all required style sections have all four fields filled in.
     * Highlights empty fields with Bootstrap 4 'is-invalid' class, expands the
     * first accordion panel that contains errors, and returns a result object.
     *
     * @returns {{ valid: boolean, errors: string[] }}
     *          errors contains human-readable messages like
     *          "Exhibit Introduction: Background Color is required"
     */
    obj.validate_required = function () {

        const errors = [];
        let first_error_section = null;

        // Clear any previous validation state first
        obj.clear_validation();

        // Check each required section
        for (let i = 0; i < REQUIRED_SECTIONS.length; i++) {
            const key = REQUIRED_SECTIONS[i];
            const section_label = SECTION_LABELS[key] || key;

            for (const [prop, config] of Object.entries(STYLE_PROPERTIES)) {
                const field_el = document.getElementById(key + config.suffix);

                if (!field_el) {
                    continue;
                }

                const value = field_el.value.trim();

                if (!value) {
                    const error_msg = (PROPERTY_LABELS[prop] || prop) + ' is required';

                    // Mark the field invalid
                    field_el.classList.add('is-invalid');

                    // Create inline feedback element
                    const feedback = document.createElement('div');
                    feedback.className = 'invalid-feedback style-validation-feedback';
                    feedback.style.display = 'block';
                    feedback.textContent = error_msg;

                    // Insert after the field's parent .input-group (or after select)
                    const parent_group = field_el.closest('.input-group');

                    if (parent_group) {
                        parent_group.parentNode.insertBefore(feedback, parent_group.nextSibling);
                    } else {
                        // select fields have no .input-group wrapper
                        field_el.parentNode.insertBefore(feedback, field_el.nextSibling);
                    }

                    errors.push(section_label + ': ' + error_msg);

                    if (!first_error_section) {
                        first_error_section = key;
                    }
                }
            }
        }

        // Expand the accordion panel containing the first error
        if (first_error_section) {
            const collapse_el = document.getElementById('collapse-' + first_error_section);

            if (collapse_el && !collapse_el.classList.contains('show')) {

                // Use jQuery for Bootstrap 4 collapse if available
                if (typeof $ !== 'undefined' && typeof $.fn.collapse === 'function') {
                    $(collapse_el).collapse('show');
                } else {
                    collapse_el.classList.add('show');
                }
            }

            // Scroll to the styles card
            const styles_card = document.getElementById('exhibit-styles-card');

            if (styles_card) {
                styles_card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    };

    /**
     * Clears all validation error states and inline feedback messages from style fields.
     * Called automatically at the start of validate_required(), or can be called
     * manually on form reset.
     */
    obj.clear_validation = function () {

        // Remove is-invalid class from all fields
        const invalid_fields = document.querySelectorAll('#exhibit-styles-card .is-invalid');

        for (let i = 0; i < invalid_fields.length; i++) {
            invalid_fields[i].classList.remove('is-invalid');
        }

        // Remove all injected feedback divs
        const feedback_els = document.querySelectorAll('#exhibit-styles-card .style-validation-feedback');

        for (let i = 0; i < feedback_els.length; i++) {
            feedback_els[i].parentNode.removeChild(feedback_els[i]);
        }
    };

    /**
     * Gathers all style field values from the DOM and returns the styles object
     * for inclusion in the exhibit data payload.
     *
     * Output shape:
     * {
     *   exhibit: {
     *     introduction: { backgroundColor, color, fontFamily, fontSize },
     *     navigation: { ... },
     *     heading1: { ... },
     *     ...
     *   }
     * }
     *
     * @returns {Object|null} Styles object or null on error
     */
    obj.get_styles = function () {

        try {

            const sections = {};

            for (let i = 0; i < STYLE_SECTIONS.length; i++) {
                const key = STYLE_SECTIONS[i];
                const section_data = {};

                for (const [prop, config] of Object.entries(STYLE_PROPERTIES)) {
                    const raw_value = get_element_value('#' + key + config.suffix);
                    section_data[prop] = config.transform ? config.transform(raw_value) : raw_value;
                }

                sections[key] = section_data;
            }

            return {
                exhibit: sections
            };

        } catch (error) {
            console.error('Error getting exhibit styles:', error);
            return null;
        }
    };

    /**
     * Populates all style fields in the DOM from a styles object.
     * Used when loading an existing exhibit record for editing.
     *
     * @param {Object} styles - The styles object from the exhibit record
     *                          Expected shape: { exhibit: { introduction: {...}, navigation: {...}, ... } }
     */
    obj.set_styles = function (styles) {

        try {

            if (!styles || typeof styles !== 'object') {
                console.warn('No styles data to populate');
                return;
            }

            // Handle both stringified and object styles
            let styles_obj = styles;

            if (typeof styles === 'string') {
                try {
                    styles_obj = JSON.parse(styles);
                } catch (parse_error) {
                    console.error('Failed to parse styles JSON:', parse_error);
                    return;
                }
            }

            const exhibit_styles = styles_obj.exhibit;

            if (!exhibit_styles || typeof exhibit_styles !== 'object') {
                console.warn('No exhibit styles found in styles object');
                return;
            }

            for (let i = 0; i < STYLE_SECTIONS.length; i++) {
                const key = STYLE_SECTIONS[i];
                const section_data = exhibit_styles[key];

                if (!section_data || typeof section_data !== 'object') {
                    continue;
                }

                // Background color
                if (section_data.backgroundColor) {
                    set_element_value('#' + key + '-background-color', section_data.backgroundColor);
                    set_element_value('#' + key + '-background-color-picker', section_data.backgroundColor);
                    update_swatch(key, 'bg', section_data.backgroundColor);
                }

                // Font color
                if (section_data.color) {
                    set_element_value('#' + key + '-font-color', section_data.color);
                    set_element_value('#' + key + '-font-color-picker', section_data.color);
                    update_swatch(key, 'font', section_data.color);
                }

                // Font size (strip 'px' for the number input)
                if (section_data.fontSize) {
                    set_element_value('#' + key + '-font-size', strip_px(section_data.fontSize));
                }

                // Font family
                if (section_data.fontFamily) {
                    set_element_value('#' + key + '-font', section_data.fontFamily);
                }
            }

        } catch (error) {
            console.error('Error setting exhibit styles:', error);
        }
    };

    /**
     * Initializes the styles module:
     * - Sets up bidirectional color picker ↔ text input sync for all sections
     * - Wires swatch updates on color field changes
     *
     * Must be called after the DOM has rendered the exhibit-styles.ejs partial.
     *
     * @returns {boolean} True if initialization succeeded
     */
    obj.init = function () {

        try {

            let synced_count = 0;
            let failed_count = 0;

            for (let i = 0; i < STYLE_SECTIONS.length; i++) {
                const key = STYLE_SECTIONS[i];

                // Setup sync for each color property in the section
                for (const [prop, config] of Object.entries(STYLE_PROPERTIES)) {

                    if (!config.picker_suffix || !config.swatch_role) {
                        continue;
                    }

                    const success = setup_color_sync(
                        key,
                        config.suffix,
                        config.picker_suffix,
                        config.swatch_role
                    );

                    if (success) {
                        synced_count++;
                    } else {
                        failed_count++;
                    }
                }
            }

            console.log('Styles module initialized: ' + synced_count + ' color pickers synced, ' + failed_count + ' failed');
            return true;

        } catch (error) {
            console.error('Error initializing styles module:', error);
            return false;
        }
    };

    return obj;

}());
