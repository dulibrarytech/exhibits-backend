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

    const APP_PATH = '/exhibits-dashboard';
    let obj = {};

    /**
     * Renders exhibit hero image upload area
     */
    obj.upload_exhibit_hero_image = function() {

        const EXHIBIT_HERO = Dropzone;
        EXHIBIT_HERO.options.heroDropzone = {
            paramName: 'files',
            maxFilesize: 5000, // 5MB
            url: APP_PATH + '/uploads',
            uploadMultiple: false,
            maxFiles: 1,
            acceptedFiles: 'image/*',
            ignoreHiddenFiles: true,
            timeout: 20000,
            dictDefaultMessage: '<small><em>Drag and Drop Hero Image file here or Click to Upload</em></small>',
            autoProcessQueue: true,
            init: function () {},
            renameFile: function (file) {
                const extension = file.name.split('.').pop();
                return `${Date.now()}_exhibit_hero.${extension}`;
            },
            success: function(file, response) {

                // console.log('SUCCESS: ', file.upload);
                // console.log(file.upload.filename);
                // console.log(file.upload.total);

                const filename = file.upload.filename;
                document.querySelector('.upload-error').innerHTML = '';
                document.querySelector('#hero-image').value = filename;
                document.querySelector('#hero-image-filename-display').innerHTML = `<span style="font-size: 11px">${filename}</span>`;
                document.querySelector('#hero-trash').style.display = 'inline';

                setTimeout(() => {
                    this.removeFile(file);
                    const hero_url = `${APP_PATH}/media?media=${filename}`;
                    document.querySelector('#hero-image-display').innerHTML = `<p><img src="${hero_url}" height="200"></p>`;
                }, 2000);

            },
            error: function (file, error) {
                document.querySelector('.upload-error').innerHTML = `<span class="alert alert-danger" style="border: solid 1px"><i class="fa fa-exclamation"></i> ${error}</span>`;
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
            maxFilesize: 5000, // 5MB
            url: APP_PATH + '/uploads',
            uploadMultiple: false,
            maxFiles: 1,
            acceptedFiles: 'image/*',
            ignoreHiddenFiles: true,
            timeout: 20000,
            dictDefaultMessage: '<small><em>Drag and Drop Thumbnail Image file here or Click to Upload</em></small>',
            autoProcessQueue: true,
            init: function () {},
            renameFile: function (file) {
                let extension = file.name.split('.').pop();
                return `${Date.now()}_exhibit_thumbnail.${extension}`;
            },
            success: function(file, response) {

                // console.log(response);
                // console.log('SUCCESS: ', file.upload);
                // console.log(file.upload.filename);
                // console.log(file.upload.total);

                let filename = file.upload.filename;
                document.querySelector('.upload-error').innerHTML = '';
                document.querySelector('#thumbnail-image').value = filename;
                document.querySelector('#thumbnail-filename-display').innerHTML = `<span style="font-size: 11px">${filename}</span>`;
                document.querySelector('#thumbnail-trash').style.display = 'inline';

                setTimeout(() => {
                    const thumbnail_url = `${APP_PATH}/media?media=${filename}`;
                    document.querySelector('#thumbnail-image-display').innerHTML = `<p><img src="${thumbnail_url}" height="200"></p>`;
                    this.removeFile(file);
                }, 2000);

            },
            error: function (file, error) {
                document.querySelector('.upload-error').innerHTML = `<span class="alert alert-danger" style="border: solid 1px"><i class="fa fa-exclamation"></i> ${error}</span>`;
                this.removeFile(file);
            }
        };
    };

    /**
     * Renders item media upload area
     */
    obj.upload_item_media = function() {

        const ITEM_MEDIA = Dropzone;
        ITEM_MEDIA.options.itemDropzone = {
            paramName: 'files',
            maxFilesize: 10000, // - TODO: temp
            url: APP_PATH + '/uploads',
            uploadMultiple: false,
            maxFiles: 1,
            acceptedFiles: 'image/*,video/*,audio/*,application/pdf',
            ignoreHiddenFiles: true,
            timeout: 20000,
            dictDefaultMessage: 'Drag and Drop Item Media file here or Click to Upload',
            autoProcessQueue: true,
            init: function () {},
            renameFile: function (file) {

                console.log('item media: ', file);
                console.log('orig name: ', file.name);
                console.log('mime type: ', file.type);

                let extension = file.name.split('.').pop();
                return `${Date.now()}_item_media.${extension}`;
            },
            success: function(file, response) {

                console.log('SUCCESS: ', file.upload);
                console.log(file.upload.filename);
                console.log(file.upload.total);

                let item_type;
                let mime_type = file.type;
                let filename = file.upload.filename;
                let thumbnail_url = '';

                if (file.type.indexOf('image') !== -1) {
                    thumbnail_url = `${APP_PATH}/media?media=${filename}`;
                    item_type = 'image';
                } else if (file.type.indexOf('video') !== -1) {
                    thumbnail_url = '/exhibits-dashboard/static/images/video-tn.png';
                    item_type = 'video';
                } else if (file.type.indexOf('audio') !== -1) {
                    thumbnail_url = '/exhibits-dashboard/static/images/audio-tn.png';
                    item_type = 'audio';
                } else if (file.type.indexOf('pdf') !== -1) {
                    thumbnail_url = '/exhibits-dashboard/static/images/pdf-tn.png';
                    item_type = 'pdf';
                    document.querySelector('#toggle-open-to-page').style.visibility = 'visible';
                } else {
                    item_type = 'Unable to Determine Type';
                }

                document.querySelector('#item-type').value = item_type;
                document.querySelector('#item-mime-type').value = mime_type;
                document.querySelector('.upload-error').innerHTML = '';
                document.querySelector('#item-media').value = filename;
                document.querySelector('#item-media-filename-display').innerHTML = `<span style="font-size: 11px">${filename}</span>`;
                document.querySelector('#item-media-trash').style.display = 'inline';

                setTimeout(() => {
                    document.querySelector('#item-media-thumbnail-image-display').innerHTML = `<p><img src="${thumbnail_url}" height="200"></p>`;
                    this.removeFile(file);
                }, 2000);
            },
            error: function (file, error) {
                document.querySelector('.upload-error').innerHTML = `<span class="alert alert-danger" style="border: solid 1px"><i class="fa fa-exclamation"></i> ${error}</span>`;
                this.removeFile(file);
            }
        };
    };

    /**
     * Renders item thumbnail upload area
     */
    obj.upload_item_thumbnail = function() {

        const ITEM_THUMBNAIL = Dropzone;
        ITEM_THUMBNAIL.options.itemThumbnailDropzone = {
            paramName: 'files',
            maxFilesize: 5000, // 5MB
            url: APP_PATH + '/uploads',
            uploadMultiple: false,
            maxFiles: 1,
            acceptedFiles: 'image/*',
            ignoreHiddenFiles: true,
            timeout: 20000,
            dictDefaultMessage: 'Drag and Drop Item Thumbnail file here or Click to Upload',
            autoProcessQueue: true,
            init: function () {},
            renameFile: function (file) {
                // console.log('item media: ', file);
                let extension = file.name.split('.').pop();
                return `${Date.now()}_item_thumbnail.${extension}`;
            },
            success: function(file, response) {

                console.log('SUCCESS: ', file.upload);
                console.log(file.upload.filename);
                console.log(file.upload.total);

                let filename = file.upload.filename;
                document.querySelector('.upload-error').innerHTML = '';
                document.querySelector('#item-thumbnail').value = filename;
                document.querySelector('#item-thumbnail-filename-display').innerHTML = `<span style="font-size: 11px">${filename}</span>`;
                document.querySelector('#item-thumbnail-trash').style.display = 'inline';

                setTimeout(() => {
                    const thumbnail_url = `${APP_PATH}/media?media=${filename}`;
                    document.querySelector('#item-thumbnail-image-display').innerHTML = `<p><img src="${thumbnail_url}" height="200"></p>`;
                    this.removeFile(file);
                }, 2000);
            },
            error: function (file, error) {
                document.querySelector('.upload-error').innerHTML = `<span class="alert alert-danger" style="border: solid 1px"><i class="fa fa-exclamation"></i> ${error}</span>`;
                this.removeFile(file);
            }
        };
    };

    obj.init = function () {};

    return obj;

}());