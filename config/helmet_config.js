/**

 Copyright 2026 University of Denver

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

/**
 * Helmet security headers configuration
 * Includes Content Security Policy directives for Kaltura player iframe embedding
 * and all external CDN resources used in dashboard partials.
 *
 * All front-end libraries (jQuery, Popper, Bootstrap JS+CSS, Dropzone,
 * normalize, Font Awesome, Themify Icons) and the Open Sans webfont are
 * self-hosted under public/libs and public/assets/fonts, so script/style/font
 * are locked to 'self'. The only remaining external origins are functional
 * third-party services, not swappable static assets:
 *
 *   Kaltura services (media playback — cannot be self-hosted):
 *     - cdnapisec.kaltura.com (JS/CSS/IMG/MEDIA: player embed, API, thumbnails)
 *     - cfvod.kaltura.com     (IMG: Kaltura record thumbnails served via HTTP)
 *     - stats.kaltura.com     (CONNECT: player analytics)
 *     - analytics.kaltura.com (CONNECT: player analytics)
 *
 *   Images (favicons / logo, not render-critical):
 *     - i.imgur.com           (IMG: apple-touch-icon, shortcut icon)
 *     - library.du.edu        (IMG: favicon SVG)
 *
 * Usage in Express app:
 *   const helmet = require('helmet');
 *   const helmet_config = require('./config/helmet_config')();
 *   app.use(helmet(helmet_config));
 */

// Kaltura domains
const KALTURA_CDN = process.env.KALTURA_CDN;
const KALTURA_VOD = process.env.KALTURA_VOD;
const KALTURA_STATS = process.env.KALTURA_STATS;
const KALTURA_ANALYTICS = process.env.KALTURA_ANALYTICS;

// Image domains (from header.ejs favicons)
const IMGUR = process.env.IMGUR;
const DU_LIBRARY = process.env.DU_LIBRARY;
const DU_EXHIBITS_PUBLIC = process.env.DU_EXHIBITS_PUBLIC;

module.exports = function () {

    return {

        // Content Security Policy
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],

                // Scripts: self + Kaltura player embed. All front-end libraries
                // (jQuery, Popper, Bootstrap, Dropzone) are self-hosted under
                // public/libs, so no general-purpose CDN origin is allowed.
                // unsafe-inline: required for inline <script> blocks in EJS templates
                // unsafe-eval: required for DataTables internal eval patterns
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "'unsafe-eval'",
                    KALTURA_CDN
                ],

                // Styles: self + Kaltura player embed. Bootstrap/Font Awesome/
                // Themify/normalize/Dropzone CSS and the Open Sans webfont are all
                // self-hosted, so no CSS CDN origin is allowed.
                // unsafe-inline: required for inline styles and Bootstrap style attributes
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    KALTURA_CDN
                ],

                // Images: self + Kaltura thumbnails + favicon sources + data URIs
                imgSrc: [
                    "'self'",
                    KALTURA_CDN,
                    KALTURA_VOD,
                    IMGUR,
                    DU_LIBRARY,
                    'data:'
                ],

                // Frames: Kaltura player iframe embeds only
                frameSrc: [
                    KALTURA_CDN,
                    DU_EXHIBITS_PUBLIC,
                    "'self'"
                ],

                // Connections: self + Kaltura API/stats for player analytics
                connectSrc: [
                    "'self'",
                    KALTURA_CDN,
                    KALTURA_STATS,
                    KALTURA_ANALYTICS,
                    DU_EXHIBITS_PUBLIC
                ],

                // Fonts: self only. Font Awesome, Themify Icons and Open Sans font
                // files are self-hosted and loaded via relative paths from their
                // (self-hosted) CSS. data: retained for any inline font URIs.
                fontSrc: [
                    "'self'",
                    'data:'
                ],

                // Media: self + Kaltura streaming (for direct media playback)
                mediaSrc: [
                    "'self'",
                    KALTURA_CDN
                ],

                // Objects: none (block Flash/plugins)
                objectSrc: ["'none'"],

                // Base URI: restrict to self
                baseUri: ["'self'"],

                // Form targets: self only
                formAction: ["'self'"],

                // Frame ancestors: self only (prevent clickjacking)
                frameAncestors: ["'self'"]
            }
        },

        // Allow cross-origin resources (required for CDN assets)
        crossOriginEmbedderPolicy: false,

        // Referrer Policy
        referrerPolicy: {
            policy: 'strict-origin-when-cross-origin'
        },

        // HSTS - Strict Transport Security
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true
        },

        // X-Frame-Options (supplemental to frame-ancestors CSP)
        frameguard: {
            action: 'sameorigin'
        },

        // Disable X-Powered-By header
        hidePoweredBy: true,

        // X-XSS-Protection
        xssFilter: true
    };
};
