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

'use strict';

const express_rate_limit = require('express-rate-limit');
const LOGGER = require('../libs/log4');

/**
 * Rate limit configurations for different operation types
 * These can be used across all route modules for consistency
 */

// Rate limit handler - centralized error response
const rate_limit_handler = (operation_type) => {
    return (req, res) => {
        if (typeof LOGGER !== 'undefined' && LOGGER.module) {
            LOGGER.module().warn`WARNING: [Rate Limit] ${operation_type} limit exceeded for IP: ${req.ip} - Path: ${req.path}`;
        }

        res.status(429).json({
            success: false,
            message: 'Too many requests. Please try again later.',
            data: null
        });
    };
};

// Rate limit configurations
const rate_limit_configs = {
    // Strict rate limit for write operations (create, update, delete)
    write_operations: {
        window_ms: 15 * 60 * 1000, // 15 minutes
        max_requests: 100,
        message: 'Too many write requests'
    },

    // Moderate rate limit for read operations
    read_operations: {
        window_ms: 15 * 60 * 1000, // 15 minutes
        max_requests: 250,
        message: 'Too many read requests'
    },

    // Very strict rate limit for publish/suppress operations
    state_change_operations: {
        window_ms: 60 * 60 * 1000, // 1 hour
        max_requests: 250,
        message: 'Too many state change requests'
    },

    // Strict rate limit for media upload/delete operations
    media_operations: {
        window_ms: 15 * 60 * 1000, // 15 minutes
        max_requests: 30,
        message: 'Too many media operations'
    },

    // Moderate rate limit for preview building (resource intensive)
    preview_operations: {
        window_ms: 60 * 60 * 1000, // 1 hour
        max_requests: 150,
        message: 'Too many preview requests'
    },

    // Standard rate limit for public media access (no auth required)
    public_media_access: {
        window_ms: 15 * 60 * 1000, // 15 minutes
        max_requests: 500,
        message: 'Too many public media requests'
    },

    // Authentication/login attempts
    auth_operations: {
        window_ms: 15 * 60 * 1000, // 15 minutes
        max_requests: 5,
        message: 'Too many authentication attempts'
    },

    // General API operations
    general_operations: {
        window_ms: 15 * 60 * 1000, // 15 minutes
        max_requests: 250,
        message: 'Too many requests'
    }
};

// Create rate limiter instances
const create_rate_limiter = (config_name) => {
    const config = rate_limit_configs[config_name];

    if (!config) {
        throw new Error(`Rate limit configuration '${config_name}' not found`);
    }

    return express_rate_limit({
        windowMs: config.window_ms,
        max: config.max_requests,
        message: {
            success: false,
            message: config.message,
            data: null
        },
        standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
        legacyHeaders: false, // Disable `X-RateLimit-*` headers
        handler: rate_limit_handler(config_name),
        // Skip rate limiting for certain conditions (optional)
        skip: (req) => {
            // Skip rate limiting for whitelisted IPs in development
            if (process.env.NODE_ENV === 'development' && process.env.RATE_LIMIT_WHITELIST) {
                const whitelist = process.env.RATE_LIMIT_WHITELIST.split(',');
                return whitelist.includes(req.ip);
            }
            return false;
        }
    });
};

// Create all rate limiters
const rate_limits = {
    write_operations: create_rate_limiter('write_operations'),
    read_operations: create_rate_limiter('read_operations'),
    state_change_operations: create_rate_limiter('state_change_operations'),
    media_operations: create_rate_limiter('media_operations'),
    preview_operations: create_rate_limiter('preview_operations'),
    public_media_access: create_rate_limiter('public_media_access'),
    auth_operations: create_rate_limiter('auth_operations'),
    general_operations: create_rate_limiter('general_operations')
};

// Export both the rate limiters and the configurations
module.exports = {
    rate_limits,
    rate_limit_configs,
    create_rate_limiter
};