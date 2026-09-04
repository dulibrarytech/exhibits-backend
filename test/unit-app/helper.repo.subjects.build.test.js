// @vitest-environment jsdom
//
// Unit tests for repoSubjectsModule.build_subjects_html — the single builder
// behind the Topics / Genre-Form / Places / Item Type block, which the upload,
// repository import, edit and Kaltura modals each used to hand-roll.

'use strict';

const { load_browser_module } = require('./helpers/load_module');

describe('repoSubjectsModule.build_subjects_html', () => {

    beforeAll(() => {
        globalThis.helperMediaLibraryModule = {
            escape_html: (s) => String(s)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;'),
            HTTP_STATUS: { OK: 200 },
        };

        load_browser_module(
            'public/app/media-library/helper.repo.subjects.module.js',
            'repoSubjectsModule',
        );
    });

    const render = (...args) => {
        document.body.innerHTML = repoSubjectsModule.build_subjects_html(...args);
        return document.body;
    };

    const select = (name) => document.querySelector(`select[name="${name}"]`);

    it('emits the four native selects populate_subjects_dropdowns upgrades', () => {
        render('file', 0);

        expect(select('topics_subjects')).not.toBe(null);
        expect(select('genre_form_subjects')).not.toBe(null);
        expect(select('places_subjects')).not.toBe(null);
        expect(select('item_type')).not.toBe(null);
    });

    it('derives ids and classes from the prefix and index', () => {
        render('file', 2);

        expect(select('topics_subjects').id).toBe('file-topics-2');
        expect(select('genre_form_subjects').id).toBe('file-genre-form-2');
        expect(select('places_subjects').id).toBe('file-places-2');
        expect(select('item_type').id).toBe('file-item-type-2');
        expect(select('item_type').classList.contains('file-item-type')).toBe(true);
    });

    it('omits the index suffix when no index is given (single-form modals)', () => {
        render('edit-file', null);
        expect(select('topics_subjects').id).toBe('edit-file-topics');
        expect(select('item_type').id).toBe('edit-file-item-type');
    });

    it('labels point at their field and carry the Required badge where required', () => {
        render('repo', 0);

        const labels = Array.from(document.querySelectorAll('label'));
        expect(labels.map((l) => l.getAttribute('for'))).toEqual([
            'repo-topics-0', 'repo-genre-form-0', 'repo-places-0', 'repo-item-type-0',
        ]);

        expect(labels[0].textContent).toContain('Topics');
        expect(labels[0].querySelector('.badge-required')).not.toBe(null);
        expect(labels[1].querySelector('.badge-required')).not.toBe(null);
        expect(labels[2].querySelector('.badge-required')).toBe(null);
        expect(labels[3].querySelector('.badge-required')).not.toBe(null);
    });

    it('marks Topics and Item Type required by default; Places never', () => {
        render('file', 0);

        expect(select('topics_subjects').hasAttribute('required')).toBe(true);
        expect(select('places_subjects').hasAttribute('required')).toBe(false);
        expect(select('item_type').hasAttribute('required')).toBe(true);
    });

    it('gives Genre/Form the badge but not the HTML required attribute', () => {
        /*
         * upgrade_select_to_widget forces genre_form required by name, so the
         * attribute is redundant — and leaving it off keeps checkValidity()
         * from blocking before the widget upgrade runs. All four hand-rolled
         * copies behaved this way.
         */
        render('file', 0);
        expect(select('genre_form_subjects').hasAttribute('required')).toBe(false);
        expect(document.querySelectorAll('label')[1].querySelector('.badge-required')).not.toBe(null);
    });

    it('honours required overrides (the edit modal makes Topics optional)', () => {
        render('edit-file', null, { required: { topics_subjects: false } });

        expect(select('topics_subjects').hasAttribute('required')).toBe(false);
        expect(document.querySelectorAll('label')[0].querySelector('.badge-required')).toBe(null);
        /* Genre/Form keeps its badge regardless. */
        expect(document.querySelectorAll('label')[1].querySelector('.badge-required')).not.toBe(null);
    });

    it('uses the default placeholders unless overridden', () => {
        render('kaltura', 0);
        expect(select('topics_subjects').options[0].textContent).toBe('Select topics...');
        expect(select('genre_form_subjects').options[0].textContent).toBe('Select genre/form...');
        expect(select('places_subjects').options[0].textContent).toBe('Select places...');
        expect(select('item_type').options[0].textContent).toBe('Select item type...');

        render('file', 0, {
            placeholders: {
                topics_subjects: 'Select a topic...',
                places_subjects: 'Select a place...',
            },
        });
        expect(select('topics_subjects').options[0].textContent).toBe('Select a topic...');
        expect(select('places_subjects').options[0].textContent).toBe('Select a place...');
        expect(select('genre_form_subjects').options[0].textContent).toBe('Select genre/form...');
    });

    it('emits data-selected only for non-empty pre-selections', () => {
        render('repo', 0, {
            selected: {
                topics_subjects: 'Photography',
                genre_form_subjects: '',
                item_type: 'Still Image',
            },
        });

        expect(select('topics_subjects').getAttribute('data-selected')).toBe('Photography');
        expect(select('genre_form_subjects').hasAttribute('data-selected')).toBe(false);
        expect(select('places_subjects').hasAttribute('data-selected')).toBe(false);
        expect(select('item_type').getAttribute('data-selected')).toBe('Still Image');
    });

    it('escapes pre-selected values into the attribute', () => {
        render('repo', 0, { selected: { topics_subjects: 'a"b<c' } });
        expect(select('topics_subjects').getAttribute('data-selected')).toBe('a"b<c');
    });

    it('wraps the block in a described group when help_id is given', () => {
        render('file', 1, { help_id: 'file-subjects-help-1' });

        const group = document.querySelector('[role="group"]');
        expect(group.getAttribute('aria-label')).toBe('Subjects');
        expect(group.getAttribute('aria-describedby')).toBe('file-subjects-help-1');
        expect(document.getElementById('file-subjects-help-1').textContent)
            .toBe('Choose 2–4 of the following tags to support search.');
    });

    it('omits the group wrapper when no help_id is given (Kaltura modal)', () => {
        render('kaltura', 0);
        expect(document.querySelector('[role="group"]')).toBe(null);
    });

    it('accepts custom help text', () => {
        render('file', 0, { help_id: 'h', help_text: 'Pick some tags' });
        expect(document.getElementById('h').textContent).toBe('Pick some tags');
    });

    it('lays the fields out as two two-column rows', () => {
        render('file', 0);
        const rows = document.querySelectorAll('.row');
        expect(rows).toHaveLength(2);
        expect(rows[0].querySelectorAll('.col-md-6')).toHaveLength(2);
        expect(rows[1].querySelectorAll('.col-md-6')).toHaveLength(2);
    });
});
