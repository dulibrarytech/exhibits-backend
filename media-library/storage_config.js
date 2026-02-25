/**
 * Copyright 2026 University of Denver
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Storage Configuration
 *
 * This configuration file reads from environment variables
 * to configure the media upload storage settings.
 *
 * Files are stored in a hash-bucketed directory structure:
 *   <storage_path>/<media_type>/<bucket1>/<bucket2>/<uuid>.<ext>
 *
 * Example:
 *   /mnt/storage/media/images/a3/f7/a3f7b2c1-89d4-4e2a-b5c6-1234abcd5678.jpg
 *
 * Environment Variables:
 * - STORAGE_PATH: Path to media storage directory (default: ./media-library/storage)
 * - UPLOAD_MAX: Maximum upload file size in bytes (default: 100000000 = ~100MB)
 * - THUMBNAIL_WIDTH: Maximum thumbnail width in pixels (default: 400)
 * - THUMBNAIL_HEIGHT: Maximum thumbnail height in pixels (default: 400)
 * - THUMBNAIL_QUALITY: JPEG quality for thumbnails 1-100 (default: 80)
 */

'use strict';

const path = require('path');

module.exports = () => {
    // Read from environment variables with sensible defaults
    const storage_path = process.env.STORAGE_PATH || './media-library/storage';
    const upload_max = parseInt(process.env.UPLOAD_MAX, 10) || 100000000; // 100MB default

    // Thumbnail settings
    const thumbnail_width = parseInt(process.env.THUMBNAIL_WIDTH, 10) || 400;
    const thumbnail_height = parseInt(process.env.THUMBNAIL_HEIGHT, 10) || 400;
    const thumbnail_quality = parseInt(process.env.THUMBNAIL_QUALITY, 10) || 80;

    // Resolve storage path relative to project root
    const resolved_storage_path = path.resolve(process.cwd(), storage_path);

    return {
        // Absolute path to storage directory
        storage_path: resolved_storage_path,

        // Maximum upload file size in bytes
        upload_max: upload_max,

        // Human-readable max size for display
        upload_max_mb: Math.round(upload_max / (1024 * 1024)),

        // Thumbnail generation settings
        thumbnail: {
            width: thumbnail_width,
            height: thumbnail_height,
            quality: thumbnail_quality
        },

        // File and directory permissions
        permissions: {
            file: 0o640,
            directory: 0o750
        },

        // Media type directory names used in hash-bucket structure
        media_type_dirs: {
            image: 'images',
            pdf: 'documents',
            video: 'video',
            audio: 'audio',
            thumbnails: 'thumbnails'
        },

        // Allowed file types configuration (images and PDFs only)
        // Note: Audio/video are imported from Kaltura, not uploaded directly
        allowed_types: {
            images: {
                extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
                mime_types: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
                max_size: upload_max
            },
            documents: {
                extensions: ['.pdf'],
                mime_types: ['application/pdf'],
                max_size: upload_max
            }
        }
    };
};
