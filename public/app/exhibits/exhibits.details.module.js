/**

 Copyright 2025 University of Denver

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

const exhibitsDetailsModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Loads the exhibit record into the read-only details page.
     *
     * The record fetch and the whole populate pass live in
     * exhibitsCommonFormModule and are shared with the edit form; the details
     * page differs only in reading with `type: 'details'` (no lock acquired)
     * and in not rendering the editable affordances.
     *
     * @returns {Promise<boolean>} always false (legacy contract)
     */
    async function display_details_record() {

        try {

            const record = await exhibitsCommonFormModule.get_exhibit_record({ type: 'details' });

            if (!record) {
                throw new Error('Failed to retrieve exhibit record');
            }

            await exhibitsCommonFormModule.apply_record_to_form(record, { editable: false });

            return false;

        } catch (error) {
            // Log error for debugging
            console.error('Error displaying details record:', error);

            // Display safe error message
            const error_message = error.message || 'An error occurred while loading the exhibit record';
            domModule.set_alert('#message', 'danger', error_message);

            return false;
        }
    }

    obj.init = async function () {

        // Helper function to safely add event listener
        const add_listener = (selector, event, handler) => {
            const element = document.querySelector(selector);
            if (element && handler && typeof handler === 'function') {
                element.addEventListener(event, handler);
                return true;
            }
            console.warn(`Could not attach listener to: ${selector}`);
            return false;
        };

        try {

            // Check for permission denied status
            const status = helperModule.get_parameter_by_name('status');
            if (status === '403') {
                domModule.set_alert('#message', 'danger', 'You do not have permission to edit this record.');
            }


            // Add save button listener
            add_listener('#save-exhibit-btn', 'click', exhibitsDetailsModule?.update_exhibit_record);

            // Display the record details
            await display_details_record();

            console.debug('Module initialized successfully');
            return true;

        } catch (error) {
            // Log error for debugging
            console.error('Error initializing module:', error);

            // Display user-friendly error message
            const error_message = error.message || 'An error occurred during initialization';
            domModule.set_alert('#message', 'danger', error_message);

            return false;
        }
    };

    return obj;

}());
