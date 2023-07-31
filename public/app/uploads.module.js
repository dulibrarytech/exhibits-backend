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

const uploadsModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Renders exhibit hero image upload area
     */
    obj.upload_exhibit_hero_image = function() {

        const EXHIBIT_HERO = Dropzone;
        EXHIBIT_HERO.options.heroDropzone = {
            paramName: 'files',
            maxFilesize: 7000, // 7MB
            url: '/uploads',
            uploadMultiple: false,
            maxFiles: 1,
            // parallelUploads: 2,
            acceptedFiles: '.jpg',
            ignoreHiddenFiles: true,
            timeout: 20000,
            dictDefaultMessage: 'Drag and Drop Hero Image file here',
            autoProcessQueue: true,
            init: function () {},
            renameFile: function (file) {
                console.log(file.name);
                // TODO: file.name
                let filename = 'exhibit_hero.jpg';
                return filename;
            },
            success: function(file, response) {

                console.log(response);
                console.log('SUCCESS: ', file.upload);

                let filename = 'hero.jpg';
                document.querySelector('#hero-image').value = filename;
                document.querySelector('#hero-image-filename-display').innerHTML = filename;

                setTimeout(() => {
                    this.removeFile(file);
                }, 2000);

            },
            error: function (file, error) {
                console.log(error);
                // let message = '<div class="alert alert-danger">' + error + ' - "' + file.name + '" is type: ' + file.type + '</div>';
                // domModule.html('#message', message);
                this.removeFile(file);
            }
        };
    };

    /**
     * Renders exhibit hero image upload area
     */
    obj.upload_exhibit_thumbnail_image = function() {

        const THUMBNAIL = Dropzone;
        THUMBNAIL.options.thumbnailDropzone = {
            paramName: 'files',
            maxFilesize: 7000, // 7MB
            url: '/uploads',
            uploadMultiple: false,
            maxFiles: 1,
            acceptedFiles: '.jpg',
            ignoreHiddenFiles: true,
            timeout: 20000,
            dictDefaultMessage: 'Drag and Drop Thumbnail Image file here',
            autoProcessQueue: true,
            init: function () {},
            renameFile: function (file) {
                console.log(file.name);
                // TODO: file.name
                let filename = 'exhibit_thumbnail.jpg';
                return filename;
            },
            success: function(file, response) {

                console.log(response);
                console.log('SUCCESS: ', file.upload);

                let filename = 'thumbnail.jpg';
                document.querySelector('#thumbnail').value = filename;
                document.querySelector('#thumbnail-filename-display').innerHTML = filename;

                setTimeout(() => {
                    this.removeFile(file);
                }, 2000);

            },
            error: function (file, error) {
                console.log(error);
                // let message = '<div class="alert alert-danger">' + error + ' - "' + file.name + '" is type: ' + file.type + '</div>';
                // domModule.html('#message', message);
                this.removeFile(file);
            }
        };
    };


    /**
     * Copies pdf url to clipboard
     * @param id
     * @returns {Promise<void>}
     */
    obj.copyToClipboard = async function(id) {

        let copied_url = document.getElementById(id + '-text').href;
        let message = '<div class="alert alert-info">"' + copied_url + '" copied to clipboard.</div>';

        try {
            await navigator.clipboard.writeText(copied_url);
            domModule.html('#message', message);
        } catch(error) {
            message = '<div class="alert alert-danger">' + copied_url + ' not copied to clipboard. ' + error + '</div>';
            domModule.html('#message', message);
        }

        setTimeout(function() {
            domModule.html('#message', null);
        }, 4000);
    }

    obj.init = function () {
        uploadsModule.upload_exhibit_hero_image();
        uploadsModule.upload_exhibit_thumbnail_image();
    };

    return obj;

}());