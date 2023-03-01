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

const helperModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Renders error message
     * @param message
     */
    obj.renderError = function (message) {
        domModule.html('#message', '<div class="alert alert-danger"><i class="fa fa-exclamation-circle"></i> ' + DOMPurify.sanitize(message) + '</div>');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return false;
    };

    /**
     * Gets url parameter
     * @param name
     * @param url
     * @returns {*}
     */
    obj.getParameterByName = function (name, url) {

        if (!url) {
            url = window.location.href;
        }

        name = name.replace(/[\[\]]/g, "\\$&");

        let regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);

        if (!results) {
            return null;
        }

        if (!results[2]) {
            return '';
        }

        return decodeURIComponent(DOMPurify.sanitize(results[2].replace(/\+/g, " ")));
    };

    /**
     * Gets current year
     */
    obj.getCurrentYear = function () {
        let cdate = new Date().getFullYear();
        domModule.html('#cdate', DOMPurify.sanitize(cdate));
    };

    /**
     * creates pagination
     * @param uuid
     * @param total_records
     * @returns {string}
     */
    obj.pagination = function (uuid, total_records) {

        let path = window.location.pathname,
            q = helperModule.getParameterByName('q')

        if (uuid === null && q === null) {
            uuid = 'root';
        }

        let current_page = helperModule.getParameterByName('page'),
            total_on_page = 10,
            max_pages = 10,
            total_pages = Math.ceil(total_records / total_on_page),
            query_string,
            html = '';

        if (uuid === null && q !== null) {
            query_string = '?q=' + q;
        } else {
            query_string = '?uuid=' + uuid;
        }

        // don't render pagination
        if (total_pages === 1) {
            return html;
        }

        // set default to page 1
        if (current_page === null || current_page < 1) {
            current_page = 1;
        } else if (current_page > total_pages) {
            current_page = total_pages;
        }

        html += '<ul class="pagination" style="width:100%; margin: auto">';

        current_page = parseInt(current_page);

        // create first link
        if (current_page > total_on_page) {

            html += '<li>';
            html += '<a href="' + path + query_string + '&page=1&total_on_page=' + total_on_page + '">First</a>';
            html += '</li>';
        }

        // create previous link
        if (current_page > 1) {

            let prev_current_page = current_page - 1;

            html += '<li>';
            html += '<a href="' + path + query_string + '&page=' + prev_current_page + '&total_on_page=' + total_on_page + '">Prev</a>';
            html += '</li>';
        }

        let start_page,
            end_page,
            last;

        if (total_pages <= max_pages) {

            // show all pages
            start_page = 1;
            end_page = total_pages;

        } else {

            let total_pages_before_current_page = Math.floor(max_pages / 2),
                total_pages_after_current_page = Math.ceil(max_pages / 2) - 1;

            if (current_page <= total_pages_before_current_page) {

                // page near start
                start_page = 1;
                end_page = max_pages;

            } else if (current_page + total_pages_after_current_page >= total_pages) {

                // page near end
                last = true;
                start_page = total_pages - max_pages + 1;
                end_page = total_pages;

            } else {
                // middle pages
                start_page = current_page - total_pages_before_current_page;
                end_page = current_page + total_pages_after_current_page;
            }
        }

        let start_index = (current_page - 1) * total_on_page,
            end_index = Math.min(start_index + total_on_page - 1, total_records - 1),
            pages = Array.from(Array((end_page + 1) - start_page).keys()).map(i => start_page + i);

        for (let i=0;i<pages.length;i++) {

            if (current_page === pages[i]) {

                html += '<li class="active disabled">';
                html += '<a href="' + path + query_string + '&page=' + pages[i] + '&total_on_page=' + total_on_page + '" disabled>' + pages[i] + '</a>';
                html += '</li>';

            } else {

                html += '<li>';
                html += '<a href="' + path + query_string + '&page=' + pages[i] + '&total_on_page=' + total_on_page + '">' + pages[i] + '</a>';
                html += '</li>';
            }
        }

        // create next link
        if (current_page < total_pages) {

            current_page = (parseInt(current_page) + 1);

            html += '<li>';
            html += '<a href="' + path + query_string + '&page=' + current_page + '&total_on_page=' + total_on_page + '">Next</a>';
            html += '</li>';
        }

        // create last link
        if (total_pages > 10 && current_page !== total_pages) {

            html += '<li>';
            html += '<a href="' + path + query_string + '&page=' + total_pages + '&total_on_page=' + total_on_page + '">Last</a>';
            html += '</li>';
        }

        html += '</ul>';

        return DOMPurify.sanitize(html);
    };

    obj.init = function () {};

    return obj;

}());

helperModule.init();