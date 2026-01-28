/**
 * Storage Configuration
 * 
 * This configuration file reads from environment variables
 * to configure the media upload storage settings.
 * 
 * Environment Variables:
 * - STORAGE_PATH: Path to media storage directory (default: ./media-library/storage)
 * - UPLOAD_MAX: Maximum upload file size in bytes (default: 100000000 = ~100MB)
 */

'use strict';

const path = require('path');

module.exports = () => {
    // Read from environment variables with sensible defaults
    const storage_path = process.env.STORAGE_PATH || './media-library/storage';
    const upload_max = parseInt(process.env.UPLOAD_MAX, 10) || 100000000; // 100MB default

    // Resolve storage path relative to project root
    const resolved_storage_path = path.resolve(process.cwd(), storage_path);

    return {
        // Absolute path to storage directory
        storage_path: resolved_storage_path,
        
        // Maximum upload file size in bytes
        upload_max: upload_max,
        
        // Human-readable max size for display
        upload_max_mb: Math.round(upload_max / (1024 * 1024)),
        
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
