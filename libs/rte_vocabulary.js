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
 * Per-field rich text vocabulary enforcement.
 *
 * The global request middleware (libs/dom.js) is an XSS backstop with
 * DOMPurify's default allow-list. This module is the content gate: it
 * normalizes staff-entered rich text to exactly what the dashboard editors
 * (public/app/utils/rte.module.js) can produce, so nothing outside the
 * editor vocabulary reaches the database.
 *
 * Profiles:
 *   full    — paragraphs/line breaks, bold/italic/underline, links,
 *             ordered/bullet lists, indent classes, H2/H3 headings,
 *             DU-palette text color on <span style="color: ...">
 *   reduced — inline bold/italic/underline only (titles, headings)
 *   plain   — all markup stripped; text content only
 */

const CREATEDOMPURIFY = require('dompurify'),
    {JSDOM} = require('jsdom'),
    WINDOW = new JSDOM('').window,
    DOMPURIFY = CREATEDOMPURIFY(WINDOW);

/*
 * DU palette — keep in sync with DU_PALETTE in public/app/utils/rte.module.js
 * and the migration color map in scripts/migrate_rte_content.js.
 */
const ALLOWED_COLORS = new Set(['#181818', '#8b2332', '#3c7896', '#139aa1', '#6c757d']);

const FULL_TAGS = ['p', 'br', 'strong', 'em', 'u', 'b', 'i', 'a', 'ol', 'ul', 'li', 'h2', 'h3', 'span'];
const FULL_ATTRS = ['href', 'target', 'rel', 'class', 'style'];
const REDUCED_TAGS = ['strong', 'em', 'u', 'b', 'i', 'br'];

const INDENT_CLASS_REGEX = /^ql-indent-[1-8]$/;
const COLOR_STYLE_REGEX = /^\s*color:\s*([^;]+);?\s*$/i;
const ALLOWED_URI_REGEX = /^(?:https?:|mailto:|tel:|\/(?!\/)|#)/i;

/*
 * Normalizes a CSS color to a lowercase hex string when possible so palette
 * membership can be checked against ALLOWED_COLORS. rgb(...) values are
 * converted; anything unrecognized returns null and is stripped.
 */
function normalize_color(value) {

    const color = value.trim().toLowerCase();

    if (/^#[0-9a-f]{6}$/.test(color)) {
        return color;
    }

    if (/^#[0-9a-f]{3}$/.test(color)) {
        return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    }

    const rgb = color.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);

    if (rgb !== null) {
        return '#' + [rgb[1], rgb[2], rgb[3]].map((part) => {
            return Number(part).toString(16).padStart(2, '0');
        }).join('');
    }

    return null;
}

/*
 * afterSanitizeAttributes hook enforcing the FULL profile's attribute rules:
 * - class: only ql-indent-1..8 survive
 * - style: only a palette color survives (normalized to hex)
 * - a: safe href schemes only; target="_blank" forces rel="noopener noreferrer"
 */
function full_profile_hook(node) {

    if (node.hasAttribute === undefined) {
        return;
    }

    if (node.hasAttribute('class')) {

        const kept = node.getAttribute('class')
            .split(/\s+/)
            .filter((name) => INDENT_CLASS_REGEX.test(name));

        if (kept.length > 0) {
            node.setAttribute('class', kept.join(' '));
        } else {
            node.removeAttribute('class');
        }
    }

    if (node.hasAttribute('style')) {

        const match = node.getAttribute('style').match(COLOR_STYLE_REGEX);
        const color = match === null ? null : normalize_color(match[1]);

        if (color !== null && ALLOWED_COLORS.has(color)) {
            node.setAttribute('style', `color: ${color}`);
        } else {
            node.removeAttribute('style');
        }
    }

    if (node.tagName === 'A') {

        const href = node.getAttribute('href');

        if (href === null || ALLOWED_URI_REGEX.test(href.trim()) === false) {
            node.removeAttribute('href');
        }

        if (node.getAttribute('target') === '_blank') {
            node.setAttribute('rel', 'noopener noreferrer');
        } else {
            node.removeAttribute('target');
            node.removeAttribute('rel');
        }
    }
}

function run_sanitize(value, config, hook) {

    if (typeof value !== 'string' || value.length === 0) {
        return value;
    }

    if (hook !== undefined) {
        DOMPURIFY.addHook('afterSanitizeAttributes', hook);
    }

    try {
        return DOMPURIFY.sanitize(value, config).trim();
    } finally {
        DOMPURIFY.removeAllHooks();
    }
}

/**
 * FULL profile — item/container text, descriptions, captions, exhibit
 * introduction, about the curators, media library description.
 * @param {string} value
 * @returns {string}
 */
exports.sanitize_rich_full = function (value) {

    return run_sanitize(value, {
        ALLOWED_TAGS: FULL_TAGS,
        ALLOWED_ATTR: FULL_ATTRS,
        KEEP_CONTENT: true
    }, full_profile_hook);
};

/**
 * REDUCED profile — exhibit title/subtitle, item titles, heading text.
 * @param {string} value
 * @returns {string}
 */
exports.sanitize_rich_reduced = function (value) {

    return run_sanitize(value, {
        ALLOWED_TAGS: REDUCED_TAGS,
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true
    });
};

/**
 * PLAIN profile — internal names, alt text, media names, dates. All markup
 * is stripped; what remains displays exactly as entered.
 * @param {string} value
 * @returns {string}
 */
exports.sanitize_plain = function (value) {

    return run_sanitize(value, {
        ALLOWED_TAGS: [],
        KEEP_CONTENT: true
    });
};

const PROFILES = {
    full: exports.sanitize_rich_full,
    reduced: exports.sanitize_rich_reduced,
    plain: exports.sanitize_plain
};

/**
 * Applies a field → profile map to a record in place and returns it.
 * Missing fields and non-string values are left untouched.
 *
 * @param {Object} record
 * @param {Object} field_profiles - e.g. { text: 'full', title: 'reduced' }
 * @returns {Object} the same record
 */
exports.apply = function (record, field_profiles) {

    if (record === null || typeof record !== 'object') {
        return record;
    }

    for (const field of Object.keys(field_profiles)) {

        const sanitize = PROFILES[field_profiles[field]];

        if (sanitize !== undefined && typeof record[field] === 'string') {
            record[field] = sanitize(record[field]);
        }
    }

    return record;
};
