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
 * External resource origins (from partials):
 *
 *   header.ejs:
 *     - cdn.jsdelivr.net      (CSS: normalize, bootstrap, font-awesome, themify-icons, pixeden-stroke)
 *     - unpkg.com             (CSS: dropzone)
 *     - i.imgur.com           (IMG: apple-touch-icon, shortcut icon)
 *     - library.du.edu        (IMG: favicon SVG)
 *
 *   Kaltura services:
 *     - cdnapisec.kaltura.com (JS/CSS/IMG/MEDIA: player embed, API, thumbnails)
 *     - cfvod.kaltura.com     (IMG: Kaltura record thumbnails served via HTTP)
 *     - stats.kaltura.com     (CONNECT: player analytics)
 *     - analytics.kaltura.com (CONNECT: player analytics)
 *
 *   exhibits-libs-common.ejs:
 *     - code.jquery.com       (JS: jQuery)
 *     - cdn.jsdelivr.net      (JS: popper, bootstrap, jquery-match-height)
 *
 *   dashboard-media-home.ejs:
 *     - cdnjs.cloudflare.com  (JS+CSS: dropzone)
 *
 *   Font files (loaded by Font Awesome & Themify Icons CSS via relative paths):
 *     - cdn.jsdelivr.net      (WOFF/WOFF2/TTF/EOT font files)
 *
 * Usage in Express app:
 *   const helmet = require('helmet');
 *   const helmet_config = require('./config/helmet_config')();
 *   app.use(helmet(helmet_config));
 */

// Kaltura domains
const KALTURA_CDN = 'https://cdnapisec.kaltura.com';
const KALTURA_VOD = 'http://cfvod.kaltura.com';
const KALTURA_STATS = 'https://stats.kaltura.com';
const KALTURA_ANALYTICS = 'https://analytics.kaltura.com';

// CDN domains (from partials)
const JSDELIVR = 'https://cdn.jsdelivr.net';
const UNPKG = 'https://unpkg.com';
const CLOUDFLARE_CDN = 'https://cdnjs.cloudflare.com';
const JQUERY_CDN = 'https://code.jquery.com';

// Image domains (from header.ejs favicons)
const IMGUR = 'https://i.imgur.com';
const DU_LIBRARY = 'https://library.du.edu';

const GOOGLE_FONTS_CSS = 'https://fonts.googleapis.com';
const GOOGLE_FONTS_FILES = 'https://fonts.gstatic.com';

module.exports = function () {

    return {

        // Content Security Policy
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],

                // Scripts: self + all CDN origins serving JS
                // unsafe-inline: required for inline <script> blocks in EJS templates
                // unsafe-eval: required for DataTables internal eval patterns
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "'unsafe-eval'",
                    JQUERY_CDN,
                    JSDELIVR,
                    CLOUDFLARE_CDN,
                    KALTURA_CDN
                ],

                // Styles: self + all CDN origins serving CSS
                // unsafe-inline: required for inline styles and Bootstrap style attributes
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    JSDELIVR,
                    UNPKG,
                    CLOUDFLARE_CDN,
                    KALTURA_CDN,
                    GOOGLE_FONTS_CSS
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
                    "'self'"
                ],

                // Connections: self + Kaltura API/stats for player analytics
                connectSrc: [
                    "'self'",
                    KALTURA_CDN,
                    KALTURA_STATS,
                    KALTURA_ANALYTICS
                ],

                // Fonts: CDN-hosted webfonts (Font Awesome, Themify Icons, Pixeden)
                // loaded via relative paths in their respective CSS files on jsdelivr
                fontSrc: [
                    "'self'",
                    JSDELIVR,
                    CLOUDFLARE_CDN,
                    GOOGLE_FONTS_FILES,
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
