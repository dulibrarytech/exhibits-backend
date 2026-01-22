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

const helperSubjectsModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Initialize the subjects menu instance on your app object
     * Call this once when your application initializes
     */
    obj.init_subjects_menu = function() {
        // Create the SubjectsMenu instance with your existing methods
        obj.subjects_menu = new SubjectsMenu({
            // Pass your existing method for fetching subjects
            get_item_subjects: obj.get_item_subjects.bind(obj),

            // Pass your existing error display function
            show_error_message: show_error_message,

            // Optional: callback when selection changes
            on_change: (selected) => {
                console.log('Subjects changed:', selected);
                // Trigger any additional logic here
            }
        });
    };

    /**
     * Wrapper method that maintains backward compatibility
     * with your existing create_subjects_menu calls
     *
     * @param {string[]} subjects - Array of pre-selected subjects
     */
    obj.create_subjects_menu = async function(subjects = []) {
        // Initialize if not already done
        if (!obj.subjects_menu) {
            obj.init_subjects_menu();
        }

        // Initialize or update based on state
        if (!obj.subjects_menu.is_initialized()) {
            await obj.subjects_menu.init(subjects);
        } else {
            // Widget already initialized, just update with new subjects
            await obj.subjects_menu.update(subjects);
        }
    };

    /**
     * Force a full re-initialization (useful if the available subjects list changes)
     *
     * @param {string[]} subjects - Array of pre-selected subjects
     */
    obj.reinit_subjects_menu = async function(subjects = []) {
        if (!obj.subjects_menu) {
            obj.init_subjects_menu();
        }
        await obj.subjects_menu.init(subjects);
    };

    /**
     * Get currently selected subjects
     * @returns {string[]}
     */
    obj.get_selected_subjects = function() {
        if (!obj.subjects_menu) {
            return [];
        }
        return obj.subjects_menu.get_selected();
    };

    /**
     * Clear all subject selections
     */
    obj.clear_subjects = function() {
        if (obj.subjects_menu) {
            obj.subjects_menu.clear();
        }
    };

    // Helper function for consistent error messaging
    function show_error_message(message) {
        try {
            const message_el = document.querySelector('#message');
            if (message_el) {
                message_el.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${message}</div>`;
            }
        } catch (error) {
            console.error('Error displaying message:', error.message);
        }
    }

    obj.init = function () {
    };

    return obj;

}());