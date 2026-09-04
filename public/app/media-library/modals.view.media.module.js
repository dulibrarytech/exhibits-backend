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

/**
 * Single owner of the `#view-media-modal` preview dialog.
 *
 * The upload modal module and the repository import modal module each carried
 * a full implementation of this dialog against the SAME DOM element, and the
 * two had drifted. Everything they shared — the close/cleanup pass, the
 * button wiring, the info-row rendering, the show/load/error flow — lives
 * here; the per-source differences (where the preview URL comes from, which
 * metadata rows are shown, whether a repository handle link is added) are
 * passed in as a small strategy object.
 */
const viewMediaModalModule = (function() {

    'use strict';

    const MODAL_ID = 'view-media-modal';

    let obj = {};

    /* Strategy in force for the currently-open dialog (see obj.open). */
    let active_strategy = {};

    /**
     * Resolves the modal element.
     * @returns {HTMLElement|null}
     */
    const get_modal = () => document.getElementById(MODAL_ID);

    /**
     * Writes the preview area's error state.
     * @param {string} text
     */
    const show_error = (text) => {
        const loading_el = document.getElementById('view-media-loading');
        const error_el = document.getElementById('view-media-error');

        if (loading_el) loading_el.style.display = 'none';

        if (error_el) {
            error_el.style.display = 'block';
            const error_text = document.getElementById('view-media-error-text');
            if (error_text) error_text.textContent = text;
        }
    };

    /**
     * Closes the dialog and resets the shared preview elements. Any
     * source-specific cleanup runs through the active strategy.
     */
    const close_view_modal = () => {

        const modal_element = get_modal();

        if (!modal_element) {
            return;
        }

        helperMediaLibraryModule.hide_bootstrap_modal(modal_element, () => {

            const image_el = document.getElementById('view-media-image');
            const pdf_el = document.getElementById('view-media-pdf');

            if (image_el) {
                image_el.src = '';
                image_el.style.display = 'none';
                image_el.style.cursor = '';
                image_el.title = '';
                image_el.onclick = null;
            }

            if (pdf_el) {
                pdf_el.src = '';
            }

            // Remove repo handle hint if present
            const container = document.getElementById('view-media-container');

            if (container && container.parentNode) {
                const hint = container.parentNode.querySelector('.repo-handle-hint');
                if (hint) {
                    hint.remove();
                }
            }

            if (typeof active_strategy.on_close === 'function') {
                active_strategy.on_close();
            }
        });
    };

    /**
     * (Re)wires the dialog's Close / Cancel / Edit buttons. Each button is
     * cloned first so repeated opens never stack listeners.
     */
    const setup_view_modal_handlers = () => {

        ['view-media-close-btn', 'view-media-cancel-btn'].forEach((id) => {
            const btn = document.getElementById(id);

            if (btn) {
                const fresh = btn.cloneNode(true);
                btn.parentNode.replaceChild(fresh, btn);
                fresh.addEventListener('click', close_view_modal);
            }
        });

        /*
         * Edit button: closes the preview and opens the edit form for the
         * currently-displayed record. The uuid is stashed on the modal
         * element's dataset by the opener, so a single shared handler works
         * regardless of which dispatch (repo or upload) populated the modal.
         */
        const edit_btn = document.getElementById('view-media-edit-btn');

        if (edit_btn) {
            const fresh_edit = edit_btn.cloneNode(true);
            edit_btn.parentNode.replaceChild(fresh_edit, edit_btn);
            fresh_edit.addEventListener('click', () => {
                const modal_el = get_modal();
                const uuid = modal_el && modal_el.dataset ? modal_el.dataset.uuid : '';
                close_view_modal();

                if (uuid && typeof mediaEditModalModule !== 'undefined' && typeof mediaEditModalModule.open_edit_media_modal === 'function') {
                    // Small delay so the preview modal's close animation
                    // finishes before the edit modal opens.
                    setTimeout(() => { mediaEditModalModule.open_edit_media_modal(uuid); }, 200);
                }
            });
        }
    };

    /**
     * Builds the metadata rows every source renders identically, from
     * "Media Type" down through the audit fields.
     *
     * @param {Object} ctx - the open() context
     * @returns {Array} rows, each `[label, value]`; the pseudo-label
     *     `__exhibits__` carries an array rendered as a stacked list
     */
    obj.build_tail_rows = function(ctx) {

        const rows = [];
        const record = ctx.record;
        const media_type_for_view = (record && record.media_type) || ctx.media_type;

        if (media_type_for_view && media_type_for_view !== 'N/A') {
            rows.push(['Media Type', media_type_for_view]);
        }

        const ingest_method_cap = ctx.ingest_method
            ? ctx.ingest_method.charAt(0).toUpperCase() + ctx.ingest_method.slice(1)
            : 'N/A';

        rows.push(['Ingest Method', ingest_method_cap]);

        /*
         * Exhibit associations (resolved to titles by the list module) — shown
         * as a stacked list beneath the label. Only when the media has been
         * added to at least one exhibit.
         */
        if (record && Array.isArray(record.exhibit_names) && record.exhibit_names.length > 0) {
            rows.push(['__exhibits__', record.exhibit_names]);
        }

        // Audit rows — only when the full record was passed through
        if (record && record.created_display) rows.push(['Date Created', record.created_display]);
        if (record && record.created_by) rows.push(['Added By', record.created_by]);

        if (record && record.updated_by) {
            const ub = String(record.updated_by).trim();
            const ubl = ub.toLowerCase();

            if (ub && ubl !== 'n/a' && ubl !== 'migration_script') {
                rows.push(['Updated By', ub]);
            }
        }

        return rows;
    };

    /**
     * Renders metadata rows to HTML. `mb-0` always lands on the last visible
     * row regardless of which optional rows are present.
     * @param {Array} rows - as built by build_tail_rows
     * @returns {string}
     */
    obj.render_info_rows = function(rows) {

        const escape_html = helperMediaLibraryModule.escape_html;

        return rows.map((row, idx) => {

            const cls = idx === rows.length - 1 ? 'mb-0' : 'mb-1';

            if (row[0] === '__exhibits__') {
                const names_html = row[1]
                    .map(n => '<div>' + escape_html(String(n)) + '</div>')
                    .join('');
                return '<p class="mb-1"><strong>Exhibit(s):</strong></p>'
                    + '<div class="' + cls + '">' + names_html + '</div>';
            }

            return '<p class="' + cls + '"><strong>' + row[0] + ':</strong> <span>' + escape_html(String(row[1])) + '</span></p>';
        }).join('');
    };

    /**
     * Opens the shared view-media dialog.
     *
     * @param {Object} ctx
     * @param {string} ctx.uuid - media record UUID
     * @param {string} ctx.name - record name (header + info row)
     * @param {string} ctx.filename - original filename for display
     * @param {string} ctx.size - formatted file size
     * @param {string} ctx.media_type - media type ('image', 'pdf', …)
     * @param {string} ctx.ingest_method - 'upload' | 'repository' | 'kaltura'
     * @param {Object} [ctx.record] - full row record (audit + exhibit fields)
     * @param {Object} ctx.strategy - source-specific behaviour:
     *   - {Function} build_info_html(ctx) -> HTML for `#view-media-info`
     *   - {Function} resolve_media_url(ctx) -> preview URL, or null/'' to error
     *   - {Function} [render_as_image(ctx)] -> true to render a non-image type
     *       through the <img> element (repository audio/video/PDF thumbnails)
     *   - {Function} [image_alt(ctx)] -> alt text for the <img>
     *   - {Function} [on_image_load(ctx, image_el)] -> after a successful load
     *   - {Function} [on_image_error(ctx, image_el)] -> return true when the
     *       failure was handled (e.g. a placeholder retry)
     *   - {Function} [on_close()] -> extra cleanup after the dialog closes
     * @returns {boolean} true when the dialog was opened
     */
    obj.open = function(ctx) {

        const modal_element = get_modal();

        if (!modal_element) {
            console.error('View media modal not found');
            return false;
        }

        const context = Object.assign({}, ctx);
        const strategy = context.strategy || {};

        active_strategy = strategy;

        // Decode HTML entities in name to prevent double-encoding
        context.name = helperMediaLibraryModule.decode_html_entities(context.name);

        /*
         * Stash the uuid on the modal element so the Edit button click handler
         * can read it back without needing closure capture (the handler is
         * wired once per open and serves whichever source populated it).
         */
        if (context.uuid) {
            modal_element.dataset.uuid = context.uuid;
        } else {
            delete modal_element.dataset.uuid;
        }

        // Display type — the passed media_type, else the filename's extension
        context.display_type = (context.media_type && context.media_type !== 'N/A')
            ? context.media_type.toLowerCase()
            : helperMediaLibraryModule.get_media_type_from_filename(context.filename);

        const title_el = document.getElementById('view-media-modal-title');

        if (title_el) {
            title_el.textContent = context.name || 'View Media';
        }

        const info_el = document.getElementById('view-media-info');

        if (info_el && typeof strategy.build_info_html === 'function') {
            info_el.innerHTML = strategy.build_info_html(context);
        }

        const image_el = document.getElementById('view-media-image');
        const pdf_container = document.getElementById('view-media-pdf-container');
        const pdf_el = document.getElementById('view-media-pdf');
        const loading_el = document.getElementById('view-media-loading');
        const error_el = document.getElementById('view-media-error');

        // Reset display states
        if (image_el) image_el.style.display = 'none';
        if (pdf_container) pdf_container.style.display = 'none';
        if (loading_el) loading_el.style.display = 'block';
        if (error_el) error_el.style.display = 'none';

        const media_url = typeof strategy.resolve_media_url === 'function'
            ? strategy.resolve_media_url(context)
            : null;

        if (!media_url) {
            show_error('Unable to build media URL.');
            return false;
        }

        setup_view_modal_handlers();

        // Show modal (dismissible)
        helperMediaLibraryModule.show_bootstrap_modal(modal_element, { backdrop: true, keyboard: true });

        const as_image = typeof strategy.render_as_image === 'function'
            ? strategy.render_as_image(context)
            : false;

        if (as_image || context.display_type === 'image') {

            if (image_el) {

                image_el.onload = function() {
                    if (loading_el) loading_el.style.display = 'none';
                    image_el.style.display = 'block';

                    if (typeof strategy.on_image_load === 'function') {
                        strategy.on_image_load(context, image_el);
                    }
                };

                image_el.onerror = function() {

                    if (typeof strategy.on_image_error === 'function'
                        && strategy.on_image_error(context, this) === true) {
                        return;
                    }

                    show_error(as_image ? 'Unable to load thumbnail.' : 'Unable to load image.');
                };

                image_el.src = media_url;
                image_el.alt = typeof strategy.image_alt === 'function'
                    ? strategy.image_alt(context)
                    : 'Preview of ' + (context.name || context.filename);
            }

        } else if (context.display_type === 'pdf') {

            if (pdf_el && pdf_container) {
                if (loading_el) loading_el.style.display = 'none';
                pdf_container.style.display = 'block';
                pdf_el.src = media_url;
            }

        } else {
            show_error('This media type cannot be previewed.');
        }

        console.debug('View media modal opened for: ' + context.name);
        return true;
    };

    /**
     * Closes the dialog (public entry point for the dispatch modules).
     */
    obj.close = function() {
        close_view_modal();
    };

    obj.init = function() {
        console.debug('View media modal module initialized');
        return true;
    };

    return obj;

}());
