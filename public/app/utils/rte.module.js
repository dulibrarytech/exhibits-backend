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
 * Rich text editor (Quill 2.x) wrapper for dashboard forms.
 *
 * Editors are declared in markup as:
 *   <div class="rte-container" id="item-text-input" data-rte="full"></div>
 * and instantiated by rteModule.init_all() (or rteModule.init(id)).
 *
 * Profiles:
 *   full    — bold/italic/underline, DU-palette text color, H2/H3 headings,
 *             links, ordered/bullet lists, indent
 *   reduced — bold/italic/underline only (titles, subtitles, headings —
 *             fields rendered inside <h*> tags on the public site)
 *
 * The serialized value is semantic HTML (getSemanticHTML), the same shape
 * the server-side vocabulary sanitizer (libs/rte_vocabulary.js) enforces.
 */
const rteModule = (function () {

    'use strict';

    let obj = {};

    /* editor registry keyed by container element id */
    const instances = {};

    /*
     * DU palette swatches. Empty string = "remove color" swatch.
     * Keep in sync with the server-side allow-list in libs/rte_vocabulary.js
     * and the migration color map in scripts/migrate_rte_content.js.
     */
    const DU_PALETTE = ['', '#181818', '#8B2332', '#3C7896', '#139AA1', '#6C757D'];

    const PROFILES = {
        full: {
            formats: ['bold', 'italic', 'underline', 'color', 'header', 'link', 'list', 'indent'],
            toolbar: [
                [{header: [2, 3, false]}],
                ['bold', 'italic', 'underline'],
                [{color: DU_PALETTE}],
                ['link'],
                [{list: 'ordered'}, {list: 'bullet'}],
                [{indent: '-1'}, {indent: '+1'}],
                ['clean']
            ]
        },
        reduced: {
            formats: ['bold', 'italic', 'underline'],
            toolbar: [
                ['bold', 'italic', 'underline'],
                ['clean']
            ]
        }
    };

    /*
     * Values considered empty for required-field checks. Quill represents an
     * empty document as '<p><br></p>'.
     */
    function has_content(quill) {

        if (quill.getText().trim().length > 0) {
            return true;
        }

        /* embeds (none are enabled, but stay safe if formats change) */
        return quill.getContents().ops.some(function (op) {
            return typeof op.insert === 'object';
        });
    }

    /**
     * Initializes a single editor on the container with the given id.
     * @param id container element id (the legacy textarea id, unchanged so
     *           form modules keep their selectors)
     * @param profile 'full' | 'reduced' (defaults to the container's
     *                data-rte attribute, then 'full')
     * @returns the Quill instance or null
     */
    obj.init = function (id, profile) {

        try {

            const container = document.getElementById(id);

            if (container === null) {
                return null;
            }

            if (instances[id] !== undefined) {

                /* modals rebuild their markup; drop instances whose DOM is gone */
                if (document.body.contains(instances[id].quill.root)) {
                    return instances[id].quill;
                }

                delete instances[id];
            }

            if (typeof Quill === 'undefined') {
                console.error('rteModule: Quill is not loaded');
                return null;
            }

            const profile_name = profile || container.dataset.rte || 'full';
            const config = PROFILES[profile_name] || PROFILES.full;
            const is_disabled = container.dataset.rteDisabled === 'true';

            const quill = new Quill(container, {
                theme: 'snow',
                formats: config.formats,
                modules: {
                    toolbar: is_disabled ? false : config.toolbar
                },
                placeholder: container.dataset.rtePlaceholder || '',
                readOnly: is_disabled
            });

            const instance = {
                quill: quill,
                dirty: false,
                on_change: null,
                sync_id: container.dataset.rteSync || null
            };

            quill.on('text-change', function (delta, old_delta, source) {

                sync_hidden_field(id, instance);

                if (source === 'user') {

                    instance.dirty = true;

                    if (typeof instance.on_change === 'function') {
                        instance.on_change();
                    }
                }
            });

            instances[id] = instance;

            /*
             * data-rte-sync names a hidden form field (usually a textarea kept
             * for FormData/HTML5-validation compatibility in modal forms). Seed
             * the editor from it, then mirror edits back into it.
             */
            if (instance.sync_id !== null) {

                const sync_el = document.getElementById(instance.sync_id);

                if (sync_el !== null && sync_el.value.trim().length > 0) {
                    obj.set_html(id, sync_el.value);
                }
            }

            return quill;

        } catch (error) {
            console.error('rteModule.init error:', error.message);
            return null;
        }
    };

    /**
     * Initializes every [data-rte] container on the page.
     */
    obj.init_all = function () {

        document.querySelectorAll('[data-rte]').forEach(function (container) {

            if (container.id.length > 0) {
                obj.init(container.id);
            }
        });
    };

    /* mirrors editor HTML into the instance's hidden sync field, if any */
    function sync_hidden_field(id, instance) {

        if (instance.sync_id === null) {
            return;
        }

        const sync_el = document.getElementById(instance.sync_id);

        if (sync_el !== null) {
            sync_el.value = obj.get_html(id);
        }
    }

    /*
     * Lazily initializes on access so callers don't depend on
     * DOMContentLoaded ordering between modules.
     */
    function ensure(id) {

        if (instances[id] === undefined) {
            obj.init(id);
        }

        return instances[id];
    }

    /**
     * Returns the editor's serialized HTML, or '' when the editor is empty.
     * @param id container element id
     */
    obj.get_html = function (id) {

        const instance = ensure(id);

        if (instance === undefined) {
            return '';
        }

        if (has_content(instance.quill) === false) {
            return '';
        }

        /*
         * getSemanticHTML emits real <ul>/<ol> structures (the editor DOM
         * uses <ol> + data-list internally). It also hard-codes some spaces
         * as &nbsp; — collapse those back to plain spaces so stored content
         * stays searchable and diff-able.
         */
        return instance.quill.getSemanticHTML()
            .replace(/&nbsp;/g, ' ');
    };

    /**
     * Loads stored HTML into the editor and resets dirty state.
     * @param id container element id
     * @param html stored HTML string (may be '' / null)
     */
    obj.set_html = function (id, html) {

        const instance = ensure(id);

        if (instance === undefined) {
            return false;
        }

        const value = typeof html === 'string' ? html : '';
        const delta = instance.quill.clipboard.convert({html: value});
        instance.quill.setContents(delta, 'silent');
        instance.quill.history.clear();
        instance.dirty = false;
        sync_hidden_field(id, instance);
        return true;
    };

    /**
     * True when the editor holds no text content (e.g. '<p><br></p>').
     * Unknown ids report empty.
     * @param id container element id
     */
    obj.is_empty = function (id) {

        const instance = ensure(id);

        if (instance === undefined) {
            return true;
        }

        return has_content(instance.quill) === false;
    };

    /**
     * True when the user has changed the editor since the last set_html.
     * @param id container element id
     */
    obj.is_dirty = function (id) {
        return instances[id] !== undefined && instances[id].dirty === true;
    };

    /**
     * Registers a change callback (used by edit forms for dirty tracking).
     * @param id container element id
     * @param callback invoked on each user edit
     */
    obj.on_change = function (id, callback) {

        const instance = ensure(id);

        if (instance !== undefined) {
            instance.on_change = callback;
        }
    };

    /**
     * Enables/disables editing (used while records are locked).
     * @param id container element id
     * @param enabled boolean
     */
    obj.set_enabled = function (id, enabled) {

        if (instances[id] !== undefined) {
            instances[id].quill.enable(enabled === true);
        }
    };

    /**
     * Renders stored rich text into a static read-only display box (no
     * editor). Used by details pages that show content without Quill —
     * the target is a plain <div class="rte-readonly"> with no data-rte
     * attribute, so init_all() never mounts an editor on it.
     * @param id container element id
     * @param html stored HTML string (may be '' / null)
     */
    obj.render_static = function (id, html) {

        const element = document.getElementById(id);

        if (element === null) {
            return false;
        }

        const value = typeof html === 'string' ? html : '';

        if (typeof DOMPurify !== 'undefined') {
            element.innerHTML = DOMPurify.sanitize(value);
        } else {
            element.textContent = value;
        }

        return true;
    };

    /**
     * Enables/disables every editor on the page (record lock flows).
     * @param enabled boolean
     */
    obj.set_all_enabled = function (enabled) {

        Object.keys(instances).forEach(function (id) {
            obj.set_enabled(id, enabled);
        });
    };

    /* auto-initialize declared editors once the DOM is ready */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', obj.init_all);
    } else {
        obj.init_all();
    }

    return obj;

}());
