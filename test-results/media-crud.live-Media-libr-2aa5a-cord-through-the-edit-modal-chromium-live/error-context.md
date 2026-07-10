# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: media-crud.live.spec.js >> Media library CRUD (live) >> updates a media record through the edit modal
- Location: test/e2e/live/media-crud.live.spec.js:104:5

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
            - tab "Import Repository Media" [selected] [ref=e28] [cursor=pointer]
            - tab "Upload Media" [ref=e29] [cursor=pointer]
            - tab "Import Kaltura Audio/Video" [ref=e30] [cursor=pointer]
          - generic [ref=e31]:
            - tabpanel "Import Repository Media" [ref=e32]:
              - generic [ref=e33]:
                - form "Import repository media" [ref=e34]:
                  - generic [ref=e35]:
                    - generic [ref=e36]: Search Repository
                    - textbox "Search Repository" [ref=e37]
                    - generic [ref=e38]: Enter a search term (e.g., uuid, title, creator, subject, identifier)
                  - button "Search" [ref=e40] [cursor=pointer]:
                    - generic [ref=e41]: 
                    - text: Search
                  - generic [ref=e42]: 
                  - generic [ref=e43]: 
                - status
                - region "Repository search results" [ref=e44]
            - text:      
      - region "Media List" [ref=e46]:
        - strong [ref=e48]: Media List
        - generic [ref=e50]:
          - generic [ref=e51]:
            - generic [ref=e54]:
              - text: Show
              - combobox "Show files per page" [ref=e55]:
                - option "10"
                - option "25" [selected]
                - option "50"
                - option "100"
                - option "All"
              - text: files per page
            - combobox "Filter by Exhibit" [ref=e58]:
              - generic [ref=e59]: "Filter by Exhibit:"
              - generic [ref=e60]:
                - searchbox "Filter by Exhibit:" [ref=e61]
                - generic [ref=e63] [cursor=pointer]: 
            - generic [ref=e65]:
              - generic [ref=e66]: "Search media:"
              - searchbox "Search media:" [ref=e67]
          - table "List of media files in the library" [ref=e70]:
            - caption [ref=e78]: List of media files in the library
            - rowgroup [ref=e79]:
              - 'row "Name: Activate to sort File Name: Activate to sort Exhibits: Activate to remove sorting Date Added: Activate to sort Added By: Activate to sort Actions" [ref=e80]':
                - 'columnheader "Name: Activate to sort" [ref=e81] [cursor=pointer]':
                  - text: Name
                  - button [ref=e82]
                - 'columnheader "File Name: Activate to sort" [ref=e83] [cursor=pointer]':
                  - text: File Name
                  - button [ref=e84]
                - 'columnheader "Exhibits: Activate to remove sorting" [ref=e85] [cursor=pointer]':
                  - text: Exhibits
                  - button [ref=e86]
                - 'columnheader "Date Added: Activate to sort" [ref=e87] [cursor=pointer]':
                  - text: Date Added
                  - button [ref=e88]
                - 'columnheader "Added By: Activate to sort" [ref=e89] [cursor=pointer]':
                  - text: Added By
                  - button [ref=e90]
                - columnheader "Actions" [ref=e91]: Actions
            - rowgroup [ref=e92]:
              - row "Placeholder for pw3-media-delete-1783660945886-5 pw3-media-delete-1783660945886-5 Uploaded pw3-media-delete-1783660945886-5.png 07/09/2026 @ 23:22:26 PW Admin Actions for pw3-media-delete-1783660945886-5" [ref=e93]:
                - cell "Placeholder for pw3-media-delete-1783660945886-5 pw3-media-delete-1783660945886-5 Uploaded" [ref=e94]:
                  - generic [ref=e95]:
                    - img "Placeholder for pw3-media-delete-1783660945886-5" [ref=e96] [cursor=pointer]
                    - generic [ref=e97]:
                      - generic "pw3-media-delete-1783660945886-5" [ref=e98] [cursor=pointer]
                      - generic [ref=e99]: Uploaded
                - cell "pw3-media-delete-1783660945886-5.png" [ref=e100]:
                  - generic "pw3-media-delete-1783660945886-5.png" [ref=e101]:
                    - generic [ref=e102]: 
                    - text: pw3-media-delete-1783660945886-5.png
                - cell [ref=e103]
                - cell "07/09/2026 @ 23:22:26" [ref=e104]
                - cell "PW Admin" [ref=e105]
                - cell "Actions for pw3-media-delete-1783660945886-5" [ref=e106]:
                  - generic [ref=e107]:
                    - button "Actions for pw3-media-delete-1783660945886-5" [ref=e108] [cursor=pointer]:
                      - generic [ref=e109]: 
                    - text:  
              - row "Placeholder for pw3-media-edit-1783660945815-4 pw3-media-edit-1783660945815-4 Uploaded pw3-media-edit-1783660945815-4.png 07/09/2026 @ 23:22:26 PW Admin Actions for pw3-media-edit-1783660945815-4" [ref=e110]:
                - cell "Placeholder for pw3-media-edit-1783660945815-4 pw3-media-edit-1783660945815-4 Uploaded" [ref=e111]:
                  - generic [ref=e112]:
                    - img "Placeholder for pw3-media-edit-1783660945815-4" [ref=e113] [cursor=pointer]
                    - generic [ref=e114]:
                      - generic "pw3-media-edit-1783660945815-4" [ref=e115] [cursor=pointer]
                      - generic [ref=e116]: Uploaded
                - cell "pw3-media-edit-1783660945815-4.png" [ref=e117]:
                  - generic "pw3-media-edit-1783660945815-4.png" [ref=e118]:
                    - generic [ref=e119]: 
                    - text: pw3-media-edit-1783660945815-4.png
                - cell [ref=e120]
                - cell "07/09/2026 @ 23:22:26" [ref=e121]
                - cell "PW Admin" [ref=e122]
                - cell "Actions for pw3-media-edit-1783660945815-4" [ref=e123]:
                  - generic [ref=e124]:
                    - button "Actions for pw3-media-edit-1783660945815-4" [ref=e125] [cursor=pointer]:
                      - generic [ref=e126]: 
                    - text:  
          - generic [ref=e127]:
            - status [ref=e129]: Showing 1 - 2 of 2 results
            - navigation "pagination" [ref=e132]:
              - text: 
              - link "Previous" [disabled]:
                - generic: 
                - generic: Previous
              - link "1" [ref=e133] [cursor=pointer]
              - link "Next" [disabled]:
                - generic: 
                - generic: Next
              - text: 
    - contentinfo [ref=e135]:
      - generic [ref=e138]:
        - link "Exhibits @ DU PUI" [ref=e139] [cursor=pointer]:
          - /url: https://exhibits.library.du.edu/
        - text: "| Exhibits Builder @ DU | v2.0.0 (DEV) - ("
        - emphasis [ref=e141]: build 232
        - text: )
  - text:                 
  - dialog "Edit Media Record" [active] [ref=e142]:
    - document:
      - generic [ref=e143]:
        - generic [ref=e144]:
          - heading "Edit Media Record" [level=5] [ref=e145]:
            - generic [ref=e146]: 
            - text: Edit Media Record
          - button "Close" [ref=e147] [cursor=pointer]: ×
        - generic [ref=e148]:
          - status
          - text: 
          - generic [ref=e150]:
            - generic [ref=e152]:
              - img "pw3-media-edit-1783660945815-4.png" [ref=e154]
              - generic [ref=e155]:
                - generic "pw3-media-edit-1783660945815-4.png" [ref=e156]:
                  - strong [ref=e157]: "Filename:"
                  - text: pw3-media-edit-1783660945815-4.png
                - generic [ref=e158]:
                  - strong [ref=e159]: "File Size:"
                  - text: 1 Bytes
                - generic [ref=e160]:
                  - strong [ref=e161]: "Media Type:"
                  - text: Image
                - generic [ref=e162]:
                  - strong [ref=e163]: "Ingest Method:"
                  - text: Upload
                - generic [ref=e164]:
                  - strong [ref=e165]: "Date Created:"
                  - text: 07/09/2026 @ 23:22
                - generic [ref=e166]:
                  - strong [ref=e167]: "Added By:"
                  - text: PW Admin
            - generic [ref=e169]:
              - generic [ref=e170]:
                - generic [ref=e171]:
                  - generic [ref=e172]:
                    - text: Name
                    - generic [ref=e173]: Required
                  - textbox "Name Required" [ref=e174]:
                    - /placeholder: Enter a name
                    - text: pw3-media-edit-1783660945815-4-updated
                - generic [ref=e175]:
                  - generic [ref=e176]:
                    - text: Alt Text
                    - generic [ref=e177]: Required
                  - textbox "Alt Text Required" [ref=e178]:
                    - /placeholder: Describe the image for screen readers
                    - text: PW arranged image
                  - generic [ref=e179]:
                    - generic [ref=e180]: 
                    - text: Required for accessibility
              - generic [ref=e182]:
                - generic [ref=e183]:
                  - text: Description
                  - generic [ref=e184]: Required
                - textbox "Description Required" [ref=e185]:
                  - /placeholder: Enter a description
                  - text: PW live edit description
              - group "Subjects" [ref=e186]:
                - paragraph [ref=e187]: Choose 2–4 of the following tags to support search.
                - generic [ref=e188]:
                  - generic [ref=e189]: 
                  - text: Loading subjects...
                - generic [ref=e190]:
                  - generic [ref=e191]:
                    - generic [ref=e192]: Topics
                    - generic [ref=e194]:
                      - generic [ref=e195]: Select a topic...
                      - generic: 
                  - generic [ref=e196]:
                    - generic [ref=e197]:
                      - text: Genre/Form
                      - generic [ref=e198]: Required
                    - generic [ref=e200]:
                      - generic [ref=e201]: Select genre/form...
                      - generic: 
                - generic [ref=e202]:
                  - generic [ref=e203]:
                    - generic [ref=e204]: Places
                    - generic [ref=e206]:
                      - generic [ref=e207]: Select a place...
                      - generic: 
                  - generic [ref=e208]:
                    - generic [ref=e209]:
                      - text: Item Type
                      - generic [ref=e210]: Required
                    - combobox "Item Type Required" [disabled] [ref=e211]:
                      - option "Select item type..." [selected]
        - generic [ref=e212]:
          - button "Cancel" [ref=e213] [cursor=pointer]:
            - generic [ref=e214]: 
            - text: Cancel
          - button "Save Changes" [ref=e215] [cursor=pointer]:
            - generic [ref=e216]: 
            - text: Save Changes
  - text:             
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