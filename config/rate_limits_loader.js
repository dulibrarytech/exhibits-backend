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
            LOGGER.module().warn(`WARNING: [Rate Limit] ${operation_type} limit exceeded for IP: ${req.ip} - Path: ${req.path}`);
        }

        res.status(429).json({
            success: false,
            message: 'Too many requests. Please try again later.',
            data: null
        });
    };
};

// Rate limit configurations.
// Limits are PER CLIENT (keyed by the real client IP now that `trust proxy` is set
// in config/express.js; auth_identity is keyed by the submitted username). These are
// conservative starting points — generous enough not to throttle normal use, low
// enough to bound a single abusive/compromised account — and are meant to be tuned
// against real traffic.
const rate_limit_configs = {
    // Strict rate limit for write operations (create, update, delete)
    write_operations: {
        window_ms: 15 * 60 * 1000, // 15 minutes
        max_requests: 300,
        message: 'Too many write requests'
    },

    // Moderate rate limit for read operations
    read_operations: {
        window_ms: 15 * 60 * 1000, // 15 minutes
        max_requests: 750,
        message: 'Too many read requests'
    },

    // Very strict rate limit for publish/suppress operations
    state_change_operations: {
        window_ms: 60 * 60 * 1000, // 1 hour
        max_requests: 150,
        message: 'Too many state change requests'
    },

    // Strict rate limit for media upload/delete operations
    media_operations: {
        window_ms: 15 * 60 * 1000, // 15 minutes
        max_requests: 200,
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
        max_requests: 750,
        message: 'Too many public media requests'
    },

    // Authentication/login attempts (IP-keyed)
    auth_operations: {
        window_ms: 15 * 60 * 1000, // 15 minutes
        max_requests: 5,
        message: 'Too many authentication attempts'
    },

    // Per-account auth limit (keyed by the submitted identity, not IP) — pairs
    // with the IP-keyed auth_operations to also bound attempts against a single
    // account coming from many IPs (distributed brute force).
    auth_identity_operations: {
        window_ms: 15 * 60 * 1000, // 15 minutes
        max_requests: 10,
        message: 'Too many authentication attempts for this account'
    },

    // Very strict — a full search-index rebuild is expensive, so only a handful
    // per hour. Used by the indexer "create/rebuild index" route.
    index_operations: {
        window_ms: 60 * 60 * 1000, // 1 hour
        max_requests: 20,
        message: 'Too many index operations'
    },

    // General API operations — used as the global per-client backstop, so it sits
    // above the per-tier limits (a heavy session may legitimately mix many reads,
    // writes, and page loads).
    general_operations: {
        window_ms: 15 * 60 * 1000, // 15 minutes
        max_requests: 1500,
        message: 'Too many requests'
    }
};

// Shared skip: disable rate limiting for the e2e/test harness (which sets
// EXHIBITS_TEST_AUTH_BYPASS so the global backstop can't throttle a test run) and
// for whitelisted dev IPs. EXHIBITS_TEST_AUTH_BYPASS must never be set in production.
const base_skip = (req) => {
    if (process.env.EXHIBITS_TEST_AUTH_BYPASS === '1') {
        return true;
    }
    if (process.env.NODE_ENV === 'development' && process.env.RATE_LIMIT_WHITELIST) {
        return process.env.RATE_LIMIT_WHITELIST.split(',').includes(req.ip);
    }
    return false;
};

// Create rate limiter instances. extra_options can supply a keyGenerator (e.g. to
// key by submitted identity instead of IP) and/or an additional skip predicate,
// which is OR-ed with base_skip.
const create_rate_limiter = (config_name, extra_options = {}) => {
    const config = rate_limit_configs[config_name];

    if (!config) {
        throw new Error(`Rate limit configuration '${config_name}' not found`);
    }

    const { skip: extra_skip, ...rest } = extra_options;

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
        skip: extra_skip ? (req, res) => base_skip(req) || extra_skip(req, res) : base_skip,
        ...rest
    });
};

// Create all rate limiters
const rate_limits = {
    write_operations: create_rate_limiter('write_operations'),
    read_operations: create_rate_limiter('read_operations'),
    state_change_operations: create_rate_limiter('state_change_operations'),
    media_operations: create_rate_limiter('media_operations'),
    preview_operations: create_rate_limiter('preview_operations'),
    index_operations: create_rate_limiter('index_operations'),
    public_media_access: create_rate_limiter('public_media_access'),
    auth_operations: create_rate_limiter('auth_operations'),
    // Keyed by the submitted username (req.body.employeeID), lower-cased; skipped
    // when no identity is present so the IP-keyed auth_operations still applies.
    auth_identity_operations: create_rate_limiter('auth_identity_operations', {
        keyGenerator: (req) => 'id:' + String((req.body && req.body.employeeID) || '').trim().toLowerCase(),
        skip: (req) => !(req.body && typeof req.body.employeeID === 'string' && req.body.employeeID.trim() !== '')
    }),
    general_operations: create_rate_limiter('general_operations')
};

// Export both the rate limiters and the configurations
module.exports = {
    rate_limits,
    rate_limit_configs,
    create_rate_limiter
};