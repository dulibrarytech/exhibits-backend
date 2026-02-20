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

'use strict';

const path = require('path');
const multer = require('multer');
const fs = require('fs').promises;
const exiftool = require('exiftool-vendored');
// import { exiftool } from 'exiftool-vendored';

// Configuration
const storage_config = require('../config/storage_config')();
const APP_PATH = '/exhibits-dashboard';
const STORAGE_PATH = storage_config.storage_path;
const MAX_FILE_SIZE = storage_config.upload_max;
const MAX_FILES = 10;

// Define allowed file types (images and PDFs only)
// Note: Audio/video are imported from Kaltura, not uploaded directly
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
];

const ALLOWED_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'
];

/**
 * Sanitizes filename to prevent path traversal and ensure cross-platform compatibility
 * @param {string} original_name - Original uploaded filename
 * @returns {string} Sanitized, unique filename
 */
const sanitize_filename = (original_name) => {
    const ext = path.extname(original_name).toLowerCase();
    const base_name = path.basename(original_name, ext);

    // Remove unsafe characters, limit length
    const safe_name = base_name
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_-]/gi, '')
        .substring(0, 100)
        .toLowerCase();

    return `${safe_name}${ext}`;
};

/**
 * Validates file type against whitelist
 * @param {Object} file - Multer file object
 * @returns {boolean} True if file type is allowed
 */
const is_valid_file_type = (file) => {
    const ext = path.extname(file.originalname).toLowerCase();
    return ALLOWED_MIME_TYPES.includes(file.mimetype) &&
        ALLOWED_EXTENSIONS.includes(ext);
};

/**
 * Multer file filter for validation
 */
const file_filter = (req, file, callback) => {
    if (!is_valid_file_type(file)) {
        const error = new Error(
            `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
        );
        error.code = 'INVALID_FILE_TYPE';
        return callback(error, false);
    }
    callback(null, true);
};

/**
 * Ensures storage directory exists
 * @returns {Promise<void>}
 */
const ensure_storage_directory = async () => {
    try {
        await fs.access(STORAGE_PATH);
    } catch (error) {
        // Directory doesn't exist, create it
        await fs.mkdir(STORAGE_PATH, { recursive: true });
        console.log(`Created storage directory: ${STORAGE_PATH}`);
    }
};

/**
 * Multer storage configuration
 */
const storage = multer.diskStorage({
    destination: async (req, file, callback) => {
        try {
            await ensure_storage_directory();
            callback(null, STORAGE_PATH);
        } catch (error) {
            console.error('Storage directory error:', error);
            callback(new Error('Storage directory not accessible'));
        }
    },
    filename: (req, file, callback) => {
        try {
            const safe_filename = sanitize_filename(file.originalname);
            callback(null, safe_filename);
        } catch (error) {
            callback(error);
        }
    }
});

/**
 * Multer instance with security constraints
 */
const upload = multer({
    storage: storage,
    fileFilter: file_filter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES
    }
});

/**
 * Get media type from MIME type
 * @param {string} mime_type - File MIME type
 * @returns {string} Media category
 */
const get_media_type = (mime_type) => {
    if (!mime_type) return 'unknown';
    
    const mime_lower = mime_type.toLowerCase();
    
    if (mime_lower.startsWith('image/')) return 'image';
    if (mime_lower.startsWith('video/')) return 'video';
    if (mime_lower.startsWith('audio/')) return 'audio';
    if (mime_lower.includes('pdf')) return 'pdf';
    
    return 'unknown';
};

/**
 * Upload request handler
 */
const handle_upload = async (req, res) => {
    try {
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({
                error: 'No files uploaded',
                code: 'NO_FILES'
            });
        }

        // Transform file data for response
        const uploaded_files = files.map(file => ({
            filename: file.filename,
            original_name: file.originalname,
            file_size: file.size,
            mime_type: file.mimetype,
            media_type: get_media_type(file.mimetype),
            path: path.join(STORAGE_PATH, file.filename),
            uploaded_at: new Date().toISOString()
        }));

        // TODO: exif tool
        const tags = await exiftool.read('photo.jpg');
        console.log('TAGS ', tags);
        console.log(`Camera: ${tags.Make} ${tags.Model}`);
        console.log(`Taken: ${tags.DateTimeOriginal}`);
        await exiftool.end();

        return res.status(201).json({
            success: true,
            count: uploaded_files.length,
            files: uploaded_files
        });

    } catch (error) {
        console.error('Upload processing error:', error);
        return res.status(500).json({
            error: 'Failed to process upload',
            code: 'PROCESSING_ERROR'
        });
    }
};

/**
 * Error handling middleware for multer errors
 */
const handle_upload_error = (error, req, res, next) => {
    console.error('Upload error:', error);

    // Handle specific multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
        const max_mb = Math.round(MAX_FILE_SIZE / (1024 * 1024));
        return res.status(413).json({
            error: `File exceeds maximum size of ${max_mb}MB`,
            code: 'FILE_TOO_LARGE'
        });
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
            error: `Maximum ${MAX_FILES} files allowed`,
            code: 'TOO_MANY_FILES'
        });
    }

    if (error.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
            error: error.message,
            code: 'INVALID_FILE_TYPE'
        });
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
            error: 'Unexpected field name',
            code: 'INVALID_FIELD'
        });
    }

    // Generic error
    return res.status(500).json({
        error: 'Upload failed',
        code: 'UPLOAD_ERROR'
    });
};

/**
 * Register upload routes
 * @param {Object} app - Express application instance
 */
module.exports = (app) => {
    app.post(
        `${APP_PATH}/media/library/uploads`,
        upload.array('files', MAX_FILES),
        handle_upload,
        handle_upload_error
    );
};
