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
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { exiftool } = require('exiftool-vendored');
const LOGGER = require('../libs/log4');

// Configuration
const storage_config = require('../config/storage_config')();
const APP_PATH = '/exhibits-dashboard';
const STORAGE_PATH = storage_config.storage_path;
const MAX_FILE_SIZE = storage_config.upload_max;
const MAX_FILES = 10;

// Thumbnail, permissions, and media type directory settings with fallback defaults
const THUMBNAIL_CONFIG = storage_config.thumbnail || { width: 400, height: 400, quality: 80 };
const PERMISSIONS = storage_config.permissions || { file: 0o640, directory: 0o750 };
const MEDIA_TYPE_DIRS = storage_config.media_type_dirs || {
    image: 'images',
    pdf: 'documents',
    video: 'video',
    audio: 'audio',
    thumbnails: 'thumbnails'
};

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

// ---------------------------------------------------------------------------
// Hash-Bucket Path Utilities
// ---------------------------------------------------------------------------

/**
 * Generates hash-bucketed directory segments from a UUID
 * Uses the first 2 and next 2 hex characters (hyphens stripped)
 * as two levels of subdirectories
 *
 * Example: 'a3f7b2c1-89d4-...' => ['a3', 'f7']
 *
 * @param {string} uuid - UUID string
 * @returns {string[]} Two-element array of directory segments
 */
const get_hash_buckets = (uuid) => {
    const clean = uuid.replace(/-/g, '');
    return [clean.substring(0, 2), clean.substring(2, 4)];
};

/**
 * Builds the full directory path for a file based on its UUID and media type
 * @param {string} media_type_dir - Directory name (e.g., 'images', 'documents')
 * @param {string} uuid - File UUID
 * @returns {string} Absolute directory path
 */
const build_directory_path = (media_type_dir, uuid) => {
    const [bucket1, bucket2] = get_hash_buckets(uuid);
    return path.join(STORAGE_PATH, media_type_dir, bucket1, bucket2);
};

/**
 * Builds the full file path including filename and extension
 * @param {string} media_type_dir - Directory name
 * @param {string} uuid - File UUID
 * @param {string} extension - File extension with leading dot
 * @returns {string} Absolute file path
 */
const build_file_path = (media_type_dir, uuid, extension) => {
    const dir_path = build_directory_path(media_type_dir, uuid);
    return path.join(dir_path, `${uuid}${extension}`);
};

/**
 * Builds the thumbnail path for a given file UUID
 * @param {string} uuid - File UUID
 * @returns {string} Absolute path to thumbnail file
 */
const build_thumbnail_path = (uuid) => {
    const dir_path = build_directory_path(MEDIA_TYPE_DIRS.thumbnails, uuid);
    return path.join(dir_path, `${uuid}_thumb.jpg`);
};

/**
 * Builds a relative path from the storage base for database storage
 * @param {string} absolute_path - Absolute file path
 * @returns {string} Relative path from STORAGE_PATH
 */
const to_relative_path = (absolute_path) => {
    return path.relative(STORAGE_PATH, absolute_path);
};

/**
 * Ensures a directory exists, creating it (and parents) if necessary
 * @param {string} dir_path - Directory path to ensure
 * @returns {Promise<void>}
 */
const ensure_directory = async (dir_path) => {

    try {
        await fs.mkdir(dir_path, {
            recursive: true,
            mode: PERMISSIONS.directory
        });
    } catch (error) {
        // EEXIST is fine — the directory is already there
        if (error.code !== 'EEXIST') {
            LOGGER.module().error(`ERROR: [/media-library/uploads (ensure_directory)] Failed to create directory ${dir_path}: ${error.message}`);
            throw error;
        }
    }
};

// ---------------------------------------------------------------------------
// File Validation
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Multer Configuration — Memory storage for hash-bucket processing
// ---------------------------------------------------------------------------

/**
 * Multer instance using memory storage
 * Files are held in buffer until written to hash-bucketed paths
 */
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: file_filter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES
    }
});

// ---------------------------------------------------------------------------
// Media Type Resolution
// ---------------------------------------------------------------------------

/**
 * Get media type from MIME type
 * @param {string} mime_type - File MIME type
 * @returns {string} Media category
 */
const get_media_type = (mime_type) => {

    if (!mime_type) return 'unknown';

    const mime_lower = mime_type.toLowerCase();

    if (mime_lower.startsWith('image/')) return 'image';
    if (mime_lower.includes('pdf')) return 'pdf';

    return 'unknown';
};

/**
 * Resolves the storage directory name for a given media type
 * @param {string} media_type - Media type (image, pdf)
 * @returns {string} Directory name
 */
const resolve_media_type_dir = (media_type) => {
    return MEDIA_TYPE_DIRS[media_type] || 'other';
};

// ---------------------------------------------------------------------------
// Thumbnail Generation
// ---------------------------------------------------------------------------

/**
 * Generates a JPEG thumbnail for an image buffer
 * @param {Buffer} image_buffer - Source image buffer
 * @param {string} uuid - File UUID for thumbnail naming
 * @returns {Promise<string|null>} Absolute path to generated thumbnail, or null on failure
 */
const generate_image_thumbnail = async (image_buffer, uuid) => {

    try {

        const thumbnail_path = build_thumbnail_path(uuid);
        const thumbnail_dir = path.dirname(thumbnail_path);

        await ensure_directory(thumbnail_dir);

        await sharp(image_buffer)
            .resize(THUMBNAIL_CONFIG.width, THUMBNAIL_CONFIG.height, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: THUMBNAIL_CONFIG.quality })
            .toFile(thumbnail_path);

        await fs.chmod(thumbnail_path, PERMISSIONS.file);

        LOGGER.module().info(`INFO: [/media-library/uploads (generate_image_thumbnail)] Generated thumbnail for ${uuid}`);
        return thumbnail_path;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/uploads (generate_image_thumbnail)] Thumbnail generation failed for ${uuid}: ${error.message}`);
        return null;
    }
};

/**
 * Generates a thumbnail from the first page of a PDF
 * Uses pdfjs-dist with node-canvas for pure Node.js rendering — no system dependencies required
 * @param {Buffer} pdf_buffer - Source PDF buffer
 * @param {string} uuid - File UUID for thumbnail naming
 * @param {string} source_path - Path to the stored PDF file (unused, kept for signature compatibility)
 * @returns {Promise<string|null>} Absolute path to generated thumbnail, or null on failure
 */
const generate_pdf_thumbnail = async (pdf_buffer, uuid, source_path) => {

    try {

        const thumbnail_path = build_thumbnail_path(uuid);
        const thumbnail_dir = path.dirname(thumbnail_path);

        await ensure_directory(thumbnail_dir);

        // Import pdfjs-dist legacy build for Node.js compatibility
        const { createCanvas, DOMMatrix } = require('@napi-rs/canvas');

        // pdfjs-dist renderer expects DOMMatrix as a global
        if (typeof globalThis.DOMMatrix === 'undefined') {
            globalThis.DOMMatrix = DOMMatrix;
        }

        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

        // Load the PDF from the buffer
        const pdf_data = new Uint8Array(pdf_buffer);
        const pdf_document = await pdfjsLib.getDocument({ data: pdf_data }).promise;

        // Get the first page
        const page = await pdf_document.getPage(1);

        // Calculate scale to produce a thumbnail at the target width
        const unscaled_viewport = page.getViewport({ scale: 1.0 });
        const scale = THUMBNAIL_CONFIG.width / unscaled_viewport.width;
        const viewport = page.getViewport({ scale: scale });

        // Create a canvas at the scaled dimensions
        const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
        const context = canvas.getContext('2d');

        // Render the page onto the canvas
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        // Convert canvas to PNG buffer
        const png_buffer = canvas.toBuffer('image/png');

        // Clean up PDF document
        await pdf_document.destroy();

        // Use Sharp to resize to final thumbnail dimensions and convert to JPEG
        await sharp(png_buffer)
            .resize(THUMBNAIL_CONFIG.width, THUMBNAIL_CONFIG.height, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: THUMBNAIL_CONFIG.quality })
            .toFile(thumbnail_path);

        await fs.chmod(thumbnail_path, PERMISSIONS.file);

        LOGGER.module().info(`INFO: [/media-library/uploads (generate_pdf_thumbnail)] Generated PDF thumbnail for ${uuid}`);
        return thumbnail_path;

    } catch (error) {
        LOGGER.module().warn(`WARN: [/media-library/uploads (generate_pdf_thumbnail)] PDF thumbnail generation failed for ${uuid}: ${error.message}`);
        return null;
    }
};

// ---------------------------------------------------------------------------
// File Storage
// ---------------------------------------------------------------------------

/**
 * Stores a file buffer into the hash-bucketed directory structure
 * Generates a UUID filename, creates hash-bucket directories,
 * writes the file, and generates a thumbnail if applicable
 *
 * @param {Buffer} file_buffer - File content buffer
 * @param {string} original_name - Original uploaded filename
 * @param {string} mime_type - File MIME type
 * @returns {Promise<Object>} Storage result with paths and metadata
 */
const store_file = async (file_buffer, original_name, mime_type) => {

    const uuid = uuidv4();
    const media_type = get_media_type(mime_type);
    const media_type_dir = resolve_media_type_dir(media_type);
    const extension = path.extname(original_name).toLowerCase();

    // Build hash-bucketed file path
    const file_path = build_file_path(media_type_dir, uuid, extension);
    const file_dir = path.dirname(file_path);

    // Ensure target directory exists
    await ensure_directory(file_dir);

    // Write the file
    await fs.writeFile(file_path, file_buffer, { mode: PERMISSIONS.file });

    const file_size = file_buffer.length;

    LOGGER.module().info(`INFO: [/media-library/uploads (store_file)] Stored file ${uuid}${extension} (${media_type_dir}, ${file_size} bytes)`);

    // Build result object
    const result = {
        uuid: uuid,
        file_path: file_path,
        storage_path: to_relative_path(file_path),
        thumbnail_path: null,
        media_type: media_type,
        media_type_dir: media_type_dir,
        mime_type: mime_type,
        original_name: original_name,
        extension: extension,
        file_size: file_size,
        media_width: null,
        media_height: null
    };

    // Generate thumbnail for images
    if (media_type === 'image') {

        const abs_thumbnail = await generate_image_thumbnail(file_buffer, uuid);

        if (abs_thumbnail) {
            result.thumbnail_path = to_relative_path(abs_thumbnail);
        }

        // Extract pixel dimensions via Sharp
        // works on PNG, GIF, WebP that may lack EXIF headers)
        try {
            const img_metadata = await sharp(file_buffer).metadata();
            result.media_width = img_metadata.width || null;
            result.media_height = img_metadata.height || null;
        } catch (dim_error) {
            LOGGER.module().warn(`WARN: [/media-library/uploads (store_file)] Dimension extraction failed for ${uuid}: ${dim_error.message}`);
        }
    }

    // Generate thumbnail for PDFs (first page)
    if (media_type === 'pdf') {

        const abs_thumbnail = await generate_pdf_thumbnail(file_buffer, uuid, file_path);

        if (abs_thumbnail) {
            result.thumbnail_path = to_relative_path(abs_thumbnail);

            // Extract dimensions from the generated thumbnail
            // (represents the first page at rendered resolution)
            try {
                const thumb_buffer = await fs.readFile(abs_thumbnail);
                const thumb_metadata = await sharp(thumb_buffer).metadata();
                result.media_width = thumb_metadata.width || null;
                result.media_height = thumb_metadata.height || null;
            } catch (dim_error) {
                LOGGER.module().warn(`WARN: [/media-library/uploads (store_file)] PDF dimension extraction failed for ${uuid}: ${dim_error.message}`);
            }
        }
    }

    return result;
};

// ---------------------------------------------------------------------------
// EXIF Metadata Extraction
// ---------------------------------------------------------------------------

/**
 * EXIF metadata fields to extract from uploaded files
 * Organized by category for clarity
 */
const EXIF_FIELDS = {
    // Camera/device info
    camera: ['Make', 'Model', 'LensModel', 'Software'],
    // Image dimensions and format
    format: ['ImageWidth', 'ImageHeight', 'MIMEType', 'FileType', 'FileSize', 'ColorSpace', 'BitsPerSample'],
    // Capture settings
    capture: ['ExposureTime', 'FNumber', 'ISO', 'FocalLength', 'Flash', 'WhiteBalance', 'ExposureProgram', 'MeteringMode'],
    // Date/time
    dates: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'],
    // GPS/location
    gps: ['GPSLatitude', 'GPSLongitude', 'GPSAltitude'],
    // Descriptive metadata
    descriptive: ['Title', 'Description', 'Subject', 'Keywords', 'Artist', 'Creator', 'Copyright'],
    // PDF-specific
    pdf: ['PageCount', 'PDFVersion', 'Author', 'Producer', 'CreatorTool']
};

/**
 * Extracts relevant EXIF/metadata from an uploaded file
 * @param {string} file_path - Full path to the uploaded file
 * @param {string} media_type - Media type category ('image' or 'pdf')
 * @returns {Promise<Object>} Extracted metadata or empty object on failure
 */
const extract_metadata = async (file_path, media_type) => {

    try {

        const tags = await exiftool.read(file_path);
        const metadata = {};

        // Select relevant field categories based on media type
        let categories;

        if (media_type === 'pdf') {
            categories = ['format', 'dates', 'descriptive', 'pdf'];
        } else if (media_type === 'image') {
            categories = ['camera', 'format', 'capture', 'dates', 'gps', 'descriptive'];
        } else {
            return metadata;
        }

        // Extract fields from selected categories
        for (const category of categories) {
            const fields = EXIF_FIELDS[category];

            if (fields) {
                for (const field of fields) {

                    if (tags[field] !== undefined && tags[field] !== null) {
                        const value = tags[field];

                        // Convert complex exiftool objects to simple values
                        if (typeof value === 'object' && value !== null && typeof value.toString === 'function' && value.constructor.name !== 'Array') {
                            metadata[field] = value.toString();
                        } else {
                            metadata[field] = value;
                        }
                    }
                }
            }
        }

        return metadata;

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/uploads (extract_metadata)] Metadata extraction failed for ${file_path}: ${error.message}`);
        return {};
    }
};

// ---------------------------------------------------------------------------
// Upload Request Handler
// ---------------------------------------------------------------------------

/**
 * Upload request handler - stores files in hash-bucketed directories,
 * generates thumbnails and extracts EXIF metadata
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

        // Process each file: store, generate thumbnail, extract metadata
        const uploaded_files = await Promise.all(files.map(async (file) => {

            // Store file in hash-bucketed directory structure
            const storage_result = await store_file(
                file.buffer,
                file.originalname,
                file.mimetype
            );

            // Extract EXIF metadata from the stored file
            const metadata = await extract_metadata(
                storage_result.file_path,
                storage_result.media_type
            );

            return {
                uuid: storage_result.uuid,
                filename: `${storage_result.uuid}${storage_result.extension}`,
                original_name: file.originalname,
                file_size: storage_result.file_size,
                mime_type: storage_result.mime_type,
                media_type: storage_result.media_type,
                storage_path: storage_result.storage_path,
                thumbnail_path: storage_result.thumbnail_path,
                media_width: storage_result.media_width,
                media_height: storage_result.media_height,
                metadata: metadata,
                uploaded_at: new Date().toISOString()
            };
        }));

        return res.status(201).json({
            success: true,
            count: uploaded_files.length,
            files: uploaded_files
        });

    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/uploads (handle_upload)] Upload processing error: ${error.message}`);
        return res.status(500).json({
            error: 'Failed to process upload',
            code: 'PROCESSING_ERROR'
        });
    }
};

// ---------------------------------------------------------------------------
// File Retrieval
// ---------------------------------------------------------------------------

/**
 * Resolves a relative storage path to an absolute path and verifies it exists
 * @param {string} relative_path - Relative path from DB (e.g., 'images/a3/f7/uuid.jpg')
 * @returns {Promise<string>} Absolute file path
 * @throws {Error} If the file does not exist
 */
const resolve_storage_path = async (relative_path) => {

    const absolute_path = path.join(STORAGE_PATH, relative_path);

    // Prevent path traversal
    const resolved = path.resolve(absolute_path);
    const resolved_storage = path.resolve(STORAGE_PATH);

    if (!resolved.startsWith(resolved_storage)) {
        throw new Error('Path traversal attempt detected');
    }

    await fs.access(resolved);
    return resolved;
};

// ---------------------------------------------------------------------------
// File Deletion
// ---------------------------------------------------------------------------

/**
 * Deletes a stored file and its thumbnail from the hash-bucketed structure
 * Cleans up empty parent directories
 * @param {string} relative_path - Relative file path from DB
 * @param {string|null} thumbnail_relative_path - Relative thumbnail path, if any
 * @returns {Promise<void>}
 */
const delete_stored_file = async (relative_path, thumbnail_relative_path = null) => {

    // Delete main file
    if (relative_path) {

        const absolute_path = path.join(STORAGE_PATH, relative_path);

        try {
            await fs.unlink(absolute_path);
            LOGGER.module().info(`INFO: [/media-library/uploads (delete_stored_file)] Deleted file: ${relative_path}`);
            await prune_empty_directories(path.dirname(absolute_path));
        } catch (error) {
            if (error.code !== 'ENOENT') {
                LOGGER.module().error(`ERROR: [/media-library/uploads (delete_stored_file)] Failed to delete file ${relative_path}: ${error.message}`);
                throw error;
            }
            LOGGER.module().warn(`WARN: [/media-library/uploads (delete_stored_file)] File already missing: ${relative_path}`);
        }
    }

    // Delete thumbnail if present
    if (thumbnail_relative_path) {

        const thumb_absolute = path.join(STORAGE_PATH, thumbnail_relative_path);

        try {
            await fs.unlink(thumb_absolute);
            LOGGER.module().info(`INFO: [/media-library/uploads (delete_stored_file)] Deleted thumbnail: ${thumbnail_relative_path}`);
            await prune_empty_directories(path.dirname(thumb_absolute));
        } catch (error) {
            if (error.code !== 'ENOENT') {
                LOGGER.module().error(`ERROR: [/media-library/uploads (delete_stored_file)] Failed to delete thumbnail: ${error.message}`);
            }
        }
    }
};

/**
 * Removes empty directories up the hash-bucket chain
 * Stops at the base storage path to avoid deleting top-level dirs
 * @param {string} dir_path - Starting directory to check
 * @returns {Promise<void>}
 */
const prune_empty_directories = async (dir_path) => {

    const resolved_storage = path.resolve(STORAGE_PATH);

    if (!dir_path.startsWith(resolved_storage) || dir_path === resolved_storage) {
        return;
    }

    try {
        const entries = await fs.readdir(dir_path);

        if (entries.length === 0) {
            await fs.rmdir(dir_path);
            await prune_empty_directories(path.dirname(dir_path));
        }
    } catch {
        // Directory may have been removed by a concurrent process
    }
};

// ---------------------------------------------------------------------------
// Error Handling Middleware
// ---------------------------------------------------------------------------

/**
 * Error handling middleware for multer errors
 */
const handle_upload_error = (error, req, res, next) => {

    LOGGER.module().error(`ERROR: [/media-library/uploads (handle_upload_error)] ${error.message}`);

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

// ---------------------------------------------------------------------------
// ExifTool Shutdown
// ---------------------------------------------------------------------------

/**
 * Gracefully shuts down the exiftool child process
 * Call during application shutdown to prevent orphaned processes
 * @returns {Promise<void>}
 */
const shutdown_exiftool = async () => {

    try {
        await exiftool.end();
        LOGGER.module().info('INFO: [/media-library/uploads (shutdown_exiftool)] ExifTool process terminated');
    } catch (error) {
        LOGGER.module().error(`ERROR: [/media-library/uploads (shutdown_exiftool)] ExifTool shutdown error: ${error.message}`);
    }
};

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

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

// Export utilities for use by controller and model
module.exports.resolve_storage_path = resolve_storage_path;
module.exports.delete_stored_file = delete_stored_file;
module.exports.shutdown_exiftool = shutdown_exiftool;
module.exports.STORAGE_PATH = STORAGE_PATH;
