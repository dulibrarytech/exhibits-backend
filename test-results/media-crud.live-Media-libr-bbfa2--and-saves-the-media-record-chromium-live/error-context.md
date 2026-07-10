# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: media-crud.live.spec.js >> Media library CRUD (live) >> uploads an image through Dropzone and saves the media record
- Location: test/e2e/live/media-crud.live.spec.js:42:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.evaluate: Target page, context or browser has been closed
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - complementary [ref=e2]:
    - navigation:
      - list [ref=e4]:
        - listitem [ref=e5]:
          - link "Expand sidebar" [ref=e6] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e7]: 
        - listitem [ref=e8]:
          - link "Back to Exhibit Builder" [ref=e9] [cursor=pointer]:
            - /url: /exhibits-dashboard/exhibits
            - generic [ref=e10]: 
        - listitem [ref=e11]:
          - link "Logout" [ref=e12] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e13]: 
  - generic [ref=e14]:
    - banner:
      - link "Skip to main content" [ref=e15] [cursor=pointer]:
        - /url: "#main"
      - navigation [ref=e16]:
        - link "Exhibits Builder EBD @ DU" [ref=e18] [cursor=pointer]:
          - /url: /exhibits-dashboard/exhibits
          - img "Exhibits Builder" [ref=e19]
          - text: EBD @ DU
    - main [ref=e20]:
      - status
      - heading "Media Library" [level=1] [ref=e21]
      - region "Import/Upload Media" [ref=e22]:
        - strong [ref=e24]: Import/Upload Media
        - generic [ref=e26]:
          - tablist [ref=e27]:
            - tab "Import Repository Media" [ref=e28] [cursor=pointer]
            - tab "Upload Media" [selected] [ref=e29] [cursor=pointer]
            - tab "Import Kaltura Audio/Video" [ref=e30] [cursor=pointer]
          - generic [ref=e31]:
            - text:   
            - tabpanel "Upload Media" [ref=e32]:
              - generic [ref=e33]:
                - alert [ref=e34]:
                  - generic [ref=e35]: 
                  - strong [ref=e36]: "Accepted files:"
                  - text: Images (PNG, JPG) and PDFs up to 50MB each. You can upload up to 10 files at a time.
                - alert
              - generic [ref=e38]:
                - form "Upload media files" [ref=e40] [cursor=pointer]:
                  - text: 
                  - generic [ref=e41]:
                    - img "pw-e2e-image.png" [ref=e43]
                    - generic [ref=e44]:
                      - generic [ref=e46]:
                        - strong [ref=e47]: "1"
                        - text: KB
                      - generic [ref=e48]: pw-e2e-image.png
                    - generic:
                      - img "Check"
                    - generic:
                      - img "Error"
                    - link "Remove file" [ref=e49]:
                      - /url: javascript:undefined;
                - generic [ref=e51]:
                  - paragraph [ref=e54]:
                    - img "pw-e2e-image.png" [ref=e55]
                  - generic [ref=e58]: pw-e2e-image.png
                  - button "Remove all uploaded media" [ref=e60] [cursor=pointer]:
                    - generic [ref=e61]: 
                    - text: Clear All
                - status
            - text:   
      - region "Media List" [ref=e62]:
        - strong [ref=e64]: Media List
        - generic [ref=e66]:
          - generic [ref=e67]:
            - generic [ref=e70]:
              - text: Show
              - combobox "Show files per page" [ref=e71]:
                - option "10"
                - option "25" [selected]
                - option "50"
                - option "100"
                - option "All"
              - text: files per page
            - combobox "Filter by Exhibit" [ref=e74]:
              - generic [ref=e75]: "Filter by Exhibit:"
              - generic [ref=e76]:
                - searchbox "Filter by Exhibit:" [ref=e77]
                - generic [ref=e79] [cursor=pointer]: 
            - generic [ref=e81]:
              - generic [ref=e82]: "Search media:"
              - searchbox "Search media:" [ref=e83]
          - table "List of media files in the library" [ref=e86]:
            - caption [ref=e94]: List of media files in the library
            - rowgroup [ref=e95]:
              - 'row "Name: Activate to sort File Name: Activate to sort Exhibits: Activate to remove sorting Date Added: Activate to sort Added By: Activate to sort Actions" [ref=e96]':
                - 'columnheader "Name: Activate to sort" [ref=e97] [cursor=pointer]':
                  - text: Name
                  - button [ref=e98]
                - 'columnheader "File Name: Activate to sort" [ref=e99] [cursor=pointer]':
                  - text: File Name
                  - button [ref=e100]
                - 'columnheader "Exhibits: Activate to remove sorting" [ref=e101] [cursor=pointer]':
                  - text: Exhibits
                  - button [ref=e102]
                - 'columnheader "Date Added: Activate to sort" [ref=e103] [cursor=pointer]':
                  - text: Date Added
                  - button [ref=e104]
                - 'columnheader "Added By: Activate to sort" [ref=e105] [cursor=pointer]':
                  - text: Added By
                  - button [ref=e106]
                - columnheader "Actions" [ref=e107]: Actions
            - rowgroup [ref=e108]:
              - row "No media files found in the library" [ref=e109]:
                - cell "No media files found in the library" [ref=e110]
          - generic [ref=e111]:
            - status [ref=e113]: No media files available
            - navigation "pagination" [ref=e116]:
              - text: 
              - link "Previous" [disabled]:
                - generic: 
                - generic: Previous
              - link "Next" [disabled]:
                - generic: 
                - generic: Next
              - text: 
    - contentinfo [ref=e118]:
      - generic [ref=e121]:
        - link "Exhibits @ DU PUI" [ref=e122] [cursor=pointer]:
          - /url: https://exhibits.library.du.edu/
        - text: "| Exhibits Builder @ DU | v2.0.0 (DEV) - ("
        - emphasis [ref=e124]: build 232
        - text: )
  - dialog "Media Uploaded Successfully" [active] [ref=e125]:
    - generic [ref=e126]:
      - strong [ref=e128]:
        - generic [ref=e129]: 
        - text: Media Uploaded Successfully
      - generic [ref=e130]:
        - alert [ref=e131]:
          - generic [ref=e132]:
            - generic [ref=e133]: 
            - generic [ref=e134]:
              - strong [ref=e135]: Upload Complete!
              - paragraph [ref=e136]: 1 file has been uploaded to the media library. Please provide details for each file below.
        - paragraph [ref=e138]:
          - generic [ref=e139]: 
          - text: Please provide details for each uploaded file below. Fields marked
          - generic [ref=e140]: Required
          - text: must be completed. Click
          - strong [ref=e141]: Save
          - text: on each file when done.
        - generic [ref=e143]:
          - generic [ref=e144]:
            - generic [ref=e145]:
              - generic [ref=e146]: "1"
              - generic [ref=e147]: pw-e2e-image.png
            - generic [ref=e148]: Image
          - generic [ref=e150]:
            - generic [ref=e152]:
              - generic [ref=e154]: 
              - generic [ref=e155]:
                - generic "pw-e2e-image.png" [ref=e156]
                - generic [ref=e157]: 1015 Bytes
            - generic [ref=e159]:
              - generic [ref=e160]:
                - generic [ref=e161]:
                  - generic [ref=e162]:
                    - text: Name
                    - generic [ref=e163]: Required
                  - textbox "Name Required" [ref=e164]:
                    - /placeholder: Enter a name
                    - text: pw3-upload-1783660944853-0
                - generic [ref=e165]:
                  - generic [ref=e166]:
                    - text: Alt Text
                    - generic [ref=e167]: Required
                  - textbox "Alt Text Required" [ref=e168]:
                    - /placeholder: Describe the image for screen readers
                    - text: PW live upload fixture image
                  - generic [ref=e169]:
                    - generic [ref=e170]: 
                    - text: Required for accessibility
              - generic [ref=e172]:
                - generic [ref=e173]:
                  - text: Description
                  - generic [ref=e174]: Required
                - textbox "Description Required" [ref=e175]:
                  - /placeholder: Enter a description
                  - text: PW live upload description
              - group "Subjects" [ref=e176]:
                - paragraph [ref=e177]: Choose 2–4 of the following tags to support search.
                - generic [ref=e178]:
                  - generic [ref=e179]: 
                  - text: Loading subjects...
                - generic [ref=e180]:
                  - generic [ref=e181]:
                    - generic [ref=e182]:
                      - text: Topics
                      - generic [ref=e183]: Required
                    - generic [ref=e185]:
                      - generic [ref=e186]: Select a topic...
                      - generic: 
                  - generic [ref=e187]:
                    - generic [ref=e188]:
                      - text: Genre/Form
                      - generic [ref=e189]: Required
                    - generic [ref=e191]:
                      - generic [ref=e192]: Select genre/form...
                      - generic: 
                - generic [ref=e193]:
                  - generic [ref=e194]:
                    - generic [ref=e195]: Places
                    - generic [ref=e197]:
                      - generic [ref=e198]: Select a place...
                      - generic: 
                  - generic [ref=e199]:
                    - generic [ref=e200]:
                      - text: Item Type
                      - generic [ref=e201]: Required
                    - combobox "Item Type Required" [disabled] [ref=e202]:
                      - option "Select item type..." [selected]
              - generic [ref=e204]:
                - button "Remove" [ref=e206] [cursor=pointer]:
                  - generic [ref=e207]: 
                  - text: Remove
                - button "Save" [ref=e208] [cursor=pointer]:
                  - generic [ref=e209]: 
                  - text: Save
      - generic [ref=e210]:
        - generic [ref=e212]:
          - generic [ref=e213]: 
          - text: 0 of 1 files saved
        - generic [ref=e214]:
          - button "Cancel" [ref=e215] [cursor=pointer]:
            - generic [ref=e216]: 
            - text: Cancel
          - text: 
  - text:                            
```

# Test source

```ts
  1   | 'use strict';
  2   | 
  3   | /**
  4   |  * UI helpers shared by LIVE specs.
  5   |  */
  6   | 
  7   | /**
  8   |  * Satisfies the exhibit form's required-styles gate through the real DOM.
  9   |  *
  10  |  * exhibitsStylesModule.validate_required checks 5 sections x 4 properties
  11  |  * (`{section}-background-color|-font-color|-font-size|-font`) for non-empty
  12  |  * values before allowing save. The stubbed suite monkeypatches the validator;
  13  |  * live tests instead FILL the real fields (selects pick their first non-empty
  14  |  * option; inputs get a sensible value) and dispatch input/change so the form
  15  |  * modules observe the edits — the payload the app builds from these fields is
  16  |  * then posted to the real API.
  17  |  */
  18  | async function fillRequiredStyles(page) {
  19  |     await page.evaluate(() => {
  20  |         // 'template' ("Exhibit") section removed 2026-07-02 — required sections only.
  21  |         const sections = ['introduction', 'navigation', 'heading1', 'item1'];
  22  |         const fields = [
  23  |             { suffix: '-background-color', value: '#ffffff' },
  24  |             { suffix: '-font-color', value: '#111111' },
  25  |             { suffix: '-font-size', value: '16' },
  26  |             { suffix: '-font', value: '' } // selects resolve below
  27  |         ];
  28  |         for (const section of sections) {
  29  |             for (const field of fields) {
  30  |                 const el = document.getElementById(section + field.suffix);
  31  |                 if (!el) {
  32  |                     continue;
  33  |                 }
  34  |                 if (el.tagName === 'SELECT') {
  35  |                     const opt = Array.from(el.options).find((o) => o.value && o.value.trim() !== '');
  36  |                     if (opt) {
  37  |                         el.value = opt.value;
  38  |                     }
  39  |                 } else if (!el.value || el.value.trim() === '') {
  40  |                     el.value = field.value || '16';
  41  |                 }
  42  |                 el.dispatchEvent(new Event('input', { bubbles: true }));
  43  |                 el.dispatchEvent(new Event('change', { bubbles: true }));
  44  |             }
  45  |         }
  46  |     });
  47  | }
  48  | 
  49  | /**
  50  |  * Sets a Subjects multi-select widget's value within a container.
  51  |  *
  52  |  * repoSubjectsModule upgrades the named <select>s to `.ms-widget`s whose state
  53  |  * lives in an `<input type="hidden" name="...">` — BOTH the save-gate
  54  |  * (validate_required_fields) and the POST payload (FormData) read that hidden
  55  |  * input, so setting it exercises the real validation + persistence path. The
  56  |  * vocabulary itself is repository(ES)-backed; live specs pass an explicit value
  57  |  * so the flow works with or without the external vocab being reachable.
  58  |  */
  59  | async function setSubjectsWidget(page, container_selector, field_name, value) {
  60  |     await page.waitForSelector(
  61  |         `${container_selector} .ms-widget input[type="hidden"][name="${field_name}"]`,
  62  |         { state: 'attached', timeout: 15_000 }
  63  |     );
  64  |     await page.evaluate(({ container_selector, field_name, value }) => {
  65  |         const input = document.querySelector(
  66  |             `${container_selector} .ms-widget input[type="hidden"][name="${field_name}"]`
  67  |         );
  68  |         input.value = value;
  69  |         input.dispatchEvent(new Event('change', { bubbles: true }));
  70  |     }, { container_selector, field_name, value });
  71  | }
  72  | 
  73  | /**
  74  |  * Ensures a plain required <select> has a non-empty value: keeps an existing
  75  |  * selection (e.g. Item Type auto-populated from the media type), otherwise
  76  |  * picks the first real option once options have loaded. The option list is
  77  |  * repository(ES)-backed and can be slow on cold parallel hits — wait
  78  |  * generously, then fall back to injecting a known-real value so the workflow
  79  |  * under test (persistence) can proceed even when the external vocab is
  80  |  * unavailable.
  81  |  */
  82  | async function ensureSelectValue(page, selector, fallback_value = 'still image') {
  83  |     try {
  84  |         await page.waitForFunction((sel) => {
  85  |             const el = document.querySelector(sel);
  86  |             return el && (el.value || el.options.length > 1);
  87  |         }, selector, { timeout: 30_000 });
  88  |     } catch (_) {
  89  |         // Vocab never arrived — inject the fallback below.
  90  |     }
> 91  |     await page.evaluate(({ sel, fallback_value }) => {
      |                ^ Error: page.evaluate: Target page, context or browser has been closed
  92  |         const el = document.querySelector(sel);
  93  |         if (!el) {
  94  |             return;
  95  |         }
  96  |         if (!el.value) {
  97  |             let opt = Array.from(el.options).find((o) => o.value && o.value.trim() !== '');
  98  |             if (!opt) {
  99  |                 opt = new Option(fallback_value, fallback_value);
  100 |                 el.appendChild(opt);
  101 |             }
  102 |             el.value = opt.value;
  103 |         }
  104 |         el.dispatchEvent(new Event('change', { bubbles: true }));
  105 |     }, { sel: selector, fallback_value });
  106 | }
  107 | 
  108 | /** Fills an input when it exists and is empty (e.g. Alt Text on image cards). */
  109 | async function fillIfPresent(page, selector, value) {
  110 |     const el = page.locator(selector);
  111 |     if (await el.count() > 0 && !(await el.inputValue())) {
  112 |         await el.fill(value);
  113 |     }
  114 | }
  115 | 
  116 | module.exports = { fillRequiredStyles, setSubjectsWidget, ensureSelectValue, fillIfPresent };
  117 | 
```