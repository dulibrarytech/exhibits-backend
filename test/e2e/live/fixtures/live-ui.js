'use strict';

/**
 * UI helpers shared by LIVE specs.
 */

/**
 * Satisfies the exhibit form's required-styles gate through the real DOM.
 *
 * exhibitsStylesModule.validate_required checks 5 sections x 4 properties
 * (`{section}-background-color|-font-color|-font-size|-font`) for non-empty
 * values before allowing save. The stubbed suite monkeypatches the validator;
 * live tests instead FILL the real fields (selects pick their first non-empty
 * option; inputs get a sensible value) and dispatch input/change so the form
 * modules observe the edits — the payload the app builds from these fields is
 * then posted to the real API.
 */
async function fillRequiredStyles(page) {
    await page.evaluate(() => {
        const sections = ['template', 'introduction', 'navigation', 'heading1', 'item1'];
        const fields = [
            { suffix: '-background-color', value: '#ffffff' },
            { suffix: '-font-color', value: '#111111' },
            { suffix: '-font-size', value: '16' },
            { suffix: '-font', value: '' } // selects resolve below
        ];
        for (const section of sections) {
            for (const field of fields) {
                const el = document.getElementById(section + field.suffix);
                if (!el) {
                    continue;
                }
                if (el.tagName === 'SELECT') {
                    const opt = Array.from(el.options).find((o) => o.value && o.value.trim() !== '');
                    if (opt) {
                        el.value = opt.value;
                    }
                } else if (!el.value || el.value.trim() === '') {
                    el.value = field.value || '16';
                }
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    });
}

/**
 * Sets a Subjects multi-select widget's value within a container.
 *
 * repoSubjectsModule upgrades the named <select>s to `.ms-widget`s whose state
 * lives in an `<input type="hidden" name="...">` — BOTH the save-gate
 * (validate_required_fields) and the POST payload (FormData) read that hidden
 * input, so setting it exercises the real validation + persistence path. The
 * vocabulary itself is repository(ES)-backed; live specs pass an explicit value
 * so the flow works with or without the external vocab being reachable.
 */
async function setSubjectsWidget(page, container_selector, field_name, value) {
    await page.waitForSelector(
        `${container_selector} .ms-widget input[type="hidden"][name="${field_name}"]`,
        { state: 'attached', timeout: 15_000 }
    );
    await page.evaluate(({ container_selector, field_name, value }) => {
        const input = document.querySelector(
            `${container_selector} .ms-widget input[type="hidden"][name="${field_name}"]`
        );
        input.value = value;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, { container_selector, field_name, value });
}

/**
 * Ensures a plain required <select> has a non-empty value: keeps an existing
 * selection (e.g. Item Type auto-populated from the media type), otherwise
 * picks the first real option once options have loaded. The option list is
 * repository(ES)-backed and can be slow on cold parallel hits — wait
 * generously, then fall back to injecting a known-real value so the workflow
 * under test (persistence) can proceed even when the external vocab is
 * unavailable.
 */
async function ensureSelectValue(page, selector, fallback_value = 'still image') {
    try {
        await page.waitForFunction((sel) => {
            const el = document.querySelector(sel);
            return el && (el.value || el.options.length > 1);
        }, selector, { timeout: 30_000 });
    } catch (_) {
        // Vocab never arrived — inject the fallback below.
    }
    await page.evaluate(({ sel, fallback_value }) => {
        const el = document.querySelector(sel);
        if (!el) {
            return;
        }
        if (!el.value) {
            let opt = Array.from(el.options).find((o) => o.value && o.value.trim() !== '');
            if (!opt) {
                opt = new Option(fallback_value, fallback_value);
                el.appendChild(opt);
            }
            el.value = opt.value;
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, { sel: selector, fallback_value });
}

/** Fills an input when it exists and is empty (e.g. Alt Text on image cards). */
async function fillIfPresent(page, selector, value) {
    const el = page.locator(selector);
    if (await el.count() > 0 && !(await el.inputValue())) {
        await el.fill(value);
    }
}

module.exports = { fillRequiredStyles, setSubjectsWidget, ensureSelectValue, fillIfPresent };
