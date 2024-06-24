/* 
 * Required fields are marked with "(R)" 
 */

module.exports = [
    // heading, example items
    {
        "type": "heading", // (R)
        "is_member_of_exhibit": "1", 
        "text": "Example Items", // {string | html} heading text (default: "")
        "order": 1, 
        "is_visible": 1, // {0,1} If 0, the heading is not displayed, but its link appears in the page navigation (default: 1, heading text is shown in the exhibit)
        "is_anchor": 1 // {0,1} If 0, the heading link is not included in the page navigation (default: 1, heading link appears in navigation menu)
    },

    // item
    {
        "uuid": "f14d40a9ba5f040c5868c36b473ad7f5",
        "is_member_of_exhibit": "1",
        "thumbnail": "",
        "title": "item", // {string} (default: null, item displays no title) *** The title field will appear in the navigation as a sublink under the previous page heading ***
        "caption": "Image from Kynewisbok, vol36, academic year 1933-1934", // {string} (default: null, item displays no caption under media content)
        "item_type": "image", // {'image', 'large_image', 'audio', 'video', 'pdf', 'external'} (R)
        "media": "f14d40a9ba5f040c5868c36b473ad7f5.jpg", // { {filename}.{extension} | {digitaldu item uuid} } (R if no "text" value)
        "text": "<div style='font-size: 1.3em; font-weight: bold'>Fullwidth item</div><hr>Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32.", // {string | html} (R if no "url" value)
        "wrap_text": 1, // bool {0,1} If 1, text will wrap around the media element (default: 1)
        "description": "", // {string | html} This is the text displayed on a grid item (preview only, the item text is not displayed on preview items) (default: null, not displayed)
        "type": "item", // {'row' | 'grid' | 'vertical_timeline' | 'heading'} (R)
        "layout": "media_left", // {'media_right' | 'media_left' | 'media_top' | 'media_bottom' | "media_only" | "text_only"} (R)
        "media_width": "65", // {int from x to y TBD} width of the media element in the item as percent (default: '50') * use only on side-by-side layouts 'media_right' and 'media_left' 

        /* user style settings (default: {}) */
        "styles": { 

            /* 
             * user styles for exhibit item 
             */
            "item": {
                "backgroundColor": "", // hex or rgb value from color picker
                "color": "", // hex or rgb value from color picker
                "fontFamily": "", // list of font-family options
                "fontSize": ""
            }
        },

        "is_published": 1, // (default: 0)
        "is_embedded": 0,  // (default: 0) If 1, media is embedded in the item on the template, and is not opened in the popup viewer when clicked. Media is viewed/played from the template
        "order": 2,
        "created": "2022-10-13T20:24:20.000Z"
    },

    // item grid
    {
        "uuid": "7358d544fab45abb782ab2bf39d3ff50a",
        "is_member_of_exhibit": "1",
        "type": "grid", // (R)
        "columns": "4", // (1-4)
        "title": "item grid", // *** The title field will appear in the navigation as a sublink under the previous page heading ***
        "order": 3,
        "styles": {
            "item_grid": { // styles for grid section
                "color": "#303030",
                "backgroundColor": "#706560",
                "fontFamily": "arial"
            }
        },
        "items": [
            {
                "uuid": "27e8d544f03300b782ab2bf39d3cbb8a",
                "is_member_of_exhibit": "1",
                "date": "March 5, 1864",
                "title": "John Evans",
                //"description": "University of Denver (DU) founder John Evans poses for a portrait. Evans was also one of the founders of Northwestern University, as well as the second governor of the Colorado Territory.",
                "description": "description",
                "caption": "University of Denver founded by John Evans, also Colorado's Second Territorial Governor.",
                "item_type": "image",
                "media": "27e8d544f03300b782ab2bf39d3cbb8a.jpeg",
                "text": "text",
                "thumbnail": "27e8d544f03300b782ab2bf39d3cbb8a.jpeg",
                "type": "item",
                "styles": {
                    "item": { // styles this item in grid
                        "backgroundColor": "#849B78",
                        "fontFamily": "Verdana"
                    }
                },
                "is_published": 1, // this should be ok here, not in the parent grid object
                "order": 1, // this should be ok here, not in the parent grid object
                "created": "2022-10-13T20:24:20.000Z"
            },
            {
                "uuid": "6cf1a7cf3bd10f588bd0122d05346877",
                "is_member_of_exhibit": "1",
                "date": "November 29, 1864",
                "title": "One November Morning",
                "description": "Sand Creek Massacre. More than 160 Cheyenne and Arapaho people - primarily women, children, and elders - are massacred by the Colorado Third Cavalry, led by DU trustee Colonel John Chivington.",
                "caption": "Sand Creek Massacre",
                "item_type": "image",
                "media": "6cf1a7cf3bd10f588bd0122d05346877.jpeg",
                "text": "test text",
                "type": "item",
                "styles": {
                    "item": {
                        "backgroundColor": "#F09169",
                        "fontFamily": "Verdana"
                    }
                },
                "is_published": 1,
                "order": 2,
                "created": "2022-10-13T20:24:20.000Z"
            },
            {
                "uuid": "69cc54aa37cc876deb529821667e2f89",
                "is_member_of_exhibit": "1",
                "date": "1919",
                "title": "\"Ministers Snapped in Action\" article in the DU Clarion vol. 27.",
                "description": "The \"Fighting Parsons\" is first mentioned as a nickname for the football team in the Clarion. No likeness or cartoon associated with the nickname; the team is also called \“Fighting Ministers.\"",
                "caption": "Clipping of \"Ministers Snapped in Action\" article in the DU Clarion vol. 27.",
                "item_type": "image",
                "media": "69cc54aa37cc876deb529821667e2f89.jpeg",
                "text": "test text",
                "type": "item",
                "styles": {
                    "item": { // styles this item in grid
                        "backgroundColor": "#849B78",
                        "fontFamily": "Times New Roman"
                    }
                },
                "is_published": 1,
                "order": 3,
                "created": "2022-10-13T20:24:20.000Z"
            },
            {
                "uuid": "e5dda358941b0bd63e474a5a27a723c0",
                "is_member_of_exhibit": "1",
                "date": "October 1924",
                "title": "\"Denver 'Battling Ministers' Seek Fitting Name\" Clarion Article.",
                "description": "Clarion article “Denver ‘Battling Ministers’ Seek Fitting Name: War Cry to Replace Outworn Slogans is Big Contest Aim” highlights student desire to change nickname to something that better reflects the school mission and spirit.",
                "caption": "Clarion article “Denver ‘Battling Ministers’",
                "item_type": "image",
                "media": "e5dda358941b0bd63e474a5a27a723c0.jpeg",
                "text": "test text",
                "type": "item",
                "styles": {
                    "item": {
                        "backgroundColor": "#F09169"
                    }
                },
                "is_published": 1,
                "order": 4,
                "created": "2022-10-13T20:24:20.000Z"
            },
            {
                "uuid": "a72e0377e0dce115e5bc71fac040dbdb",
                "is_member_of_exhibit": "1",
                "date": "1925",
                "title": "\"Ministers Snapped in Action\" article in the DU Clarion vol. 27.",
                "description": "Pioneers first mentioned in 1924-25 (vol 27) Kynewisbok, the student yearbook; in subsequent years (such as this image from the 1925-26 yearbook), the University added a “Pioneer Day” to their Homecoming celebrations, where faculty, students, and staff would dress in 1890s costume, often with white students in costume as Native Americans.",
                "caption": "caption text",
                "item_type": "image",
                "media": "a72e0377e0dce115e5bc71fac040dbdb.png",
                "text": "test text",
                "type": "item",
                "styles": {
                    "item": { // styles this item in grid
                        "backgroundColor": "#849B78",
                        "fontFamily": "arial"
                    }
                },
                "is_published": 1,
                "order": 5,
                "created": "2022-10-13T20:24:20.000Z"
            },
            {
                "uuid": "b2d4e85c511220df168e4240583de4e5",
                "is_member_of_exhibit": "1",
                "date": "1940s to 1950s",
                "title": "\"Pioneer Pete\" Image from Kynewisbok",
                "description": "\"Pioneer Pete\" character appears first as illustrations and then as a mascot-type in the 1950s. “Pioneer Pete” was a person in costume who appeared at football games",
                "caption": "caption text",
                "item_type": "image",
                "media": "b2d4e85c511220df168e4240583de4e5.png",
                "text": "test text",
                "type": "item",
                "layout": "media_bottom",
                "media_width": "100",
                "styles": {
                    "item": {
                        "backgroundColor": "#F09169"
                    }
                },
                "is_published": 1,
                "order": 6,
                "created": "2022-10-13T20:24:20.000Z"
            }
        ]
    },

    // vertical timeline item grid
    {
        "uuid": "7358d544fab45abb782ab2bf39d3ff50a",
        "is_member_of_exhibit": "1",
        "type": "vertical_timeline", // (R)
        "title": "vertical timeline item grid", // *** The title field will appear in the navigation as a sublink under the previous page heading ***
        "order": 4,
        "styles": {
            "item_grid": { // styles for grid section
                "color": "#303030",
                "backgroundColor": "gray",
                "fontFamily": "Cursive"
            }
        },
        "items": [
            {
                "uuid": "27e8d544f03300b782ab2bf39d3cbb8a",
                "is_member_of_exhibit": "1",
                "date": "March 5, 1864",
                "title": "University of Denver Founder and Trustee John Evans",
                "description": "University of Denver (DU) founder John Evans poses for a portrait. Evans was also one of the founders of Northwestern University, as well as the second governor of the Colorado Territory.",
                "caption": "University of Denver founded by John Evans, also Colorado's Second Territorial Governor.",
                "item_type": "image",
                "media": "27e8d544f03300b782ab2bf39d3cbb8a.jpeg",
                "text": "test text",
                "thumbnail": "27e8d544f03300b782ab2bf39d3cbb8a.jpeg",
                "type": "item",
                "year_label": "1850", // insert a year label to the timeline before this item
                "styles": {
                    "item": { // styles for this item in grid
                        "color": "green",
                        "backgroundColor": "black",
                        "fontFamily": "arial"
                    }
                },
                "is_published": 1, // this should be ok here, not in the parent grid object
                "order": 1, // this should be ok here, not in the parent grid object
                "created": "2022-10-13T20:24:20.000Z"
            },
            {
                "uuid": "6cf1a7cf3bd10f588bd0122d05346877",
                "is_member_of_exhibit": "1",
                "date": "November 29, 1864",
                "title": "One November Morning",
                "description": "Sand Creek Massacre. More than 160 Cheyenne and Arapaho people - primarily women, children, and elders - are massacred by the Colorado Third Cavalry, led by DU trustee Colonel John Chivington.",
                "caption": "Sand Creek Massacre",
                "item_type": "image",
                "media": "6cf1a7cf3bd10f588bd0122d05346877.jpeg",
                "text": "test text",
                "type": "item",
                "styles": {
                    "item": {
                        
                    }
                },
                "is_published": 1,
                "order": 2,
                "created": "2022-10-13T20:24:20.000Z"
            },
            {
                "uuid": "69cc54aa37cc876deb529821667e2f89",
                "is_member_of_exhibit": "1",
                "date": "1919",
                "title": "\"Ministers Snapped in Action\" article in the DU Clarion vol. 27.",
                "description": "The \"Fighting Parsons\" is first mentioned as a nickname for the football team in the Clarion. No likeness or cartoon associated with the nickname; the team is also called \“Fighting Ministers.\"",
                "caption": "Clipping of \"Ministers Snapped in Action\" article in the DU Clarion vol. 27.",
                "item_type": "image",
                "media": "69cc54aa37cc876deb529821667e2f89.jpeg",
                "text": "test text",
                "type": "item",
                "styles": {},
                "year_label": "1900",
                "is_published": 1,
                "order": 3,
                "created": "2022-10-13T20:24:20.000Z"
            },
            {
                "uuid": "e5dda358941b0bd63e474a5a27a723c0",
                "is_member_of_exhibit": "1",
                "date": "October 1924",
                "title": "\"Denver 'Battling Ministers' Seek Fitting Name\" Clarion Article.",
                "description": "Clarion article “Denver ‘Battling Ministers’ Seek Fitting Name: War Cry to Replace Outworn Slogans is Big Contest Aim” highlights student desire to change nickname to something that better reflects the school mission and spirit.",
                "caption": "Clarion article “Denver ‘Battling Ministers’",
                "item_type": "image",
                "media": "e5dda358941b0bd63e474a5a27a723c0.jpeg",
                "text": "test text",
                "type": "item",
                "styles": {},
                "is_published": 1,
                "order": 4,
                "created": "2022-10-13T20:24:20.000Z"
            },
            {
                "uuid": "a72e0377e0dce115e5bc71fac040dbdb",
                "is_member_of_exhibit": "1",
                "date": "1925",
                "title": "\"Ministers Snapped in Action\" article in the DU Clarion vol. 27.",
                "description": "Pioneers first mentioned in 1924-25 (vol 27) Kynewisbok, the student yearbook; in subsequent years (such as this image from the 1925-26 yearbook), the University added a “Pioneer Day” to their Homecoming celebrations, where faculty, students, and staff would dress in 1890s costume, often with white students in costume as Native Americans.",
                "caption": "caption text",
                "item_type": "image",
                "media": "a72e0377e0dce115e5bc71fac040dbdb.png",
                "text": "test text",
                "type": "item",
                "styles": {},
                "is_published": 1,
                "order": 5,
                "created": "2022-10-13T20:24:20.000Z"
            },
            {
                "uuid": "b2d4e85c511220df168e4240583de4e5",
                "is_member_of_exhibit": "1",
                "date": "1955",
                "title": "\"Pioneer Pete\" Image from Kynewisbok",
                "description": "\"Pioneer Pete\" character appears first as illustrations and then as a mascot-type in the 1950s. “Pioneer Pete” was a person in costume who appeared at football games",
                "caption": "caption text",
                "item_type": "image",
                "media": "b2d4e85c511220df168e4240583de4e5.png",
                "text": "test text",
                "type": "item",
                "year_label": "1950",
                "styles": {},
                "is_published": 1,
                "order": 6,
                "created": "2022-10-13T20:24:20.000Z"
            }
        ]
    },

    ////////////////////////
    // end examples
    ////////////////////////

    // heading, example layout options
    {
        "type": "heading",
        "is_member_of_exhibit": "1", 
        "text": "Example Layout Options", 
        "order": 5, 
        "is_visible": 1, 
        "is_anchor": 1 
    },

    // media left item
    {
        "uuid": "f14d40a9ba5f040c5868c36b473ad7f5",
        "is_member_of_exhibit": "1",
        "title": "media left, wrap text", 
        "caption": "Image from Kynewisbok, vol36, academic year 1933-1934", 
        "template": "row", 
        "item_type": "image", 
        "media": "f14d40a9ba5f040c5868c36b473ad7f5.jpg", 
        "text": "<div style='font-size: 1.3em; font-weight: bold'>Media left, wrap text</div><hr>Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32.", // {string | html} (R if no "url" value)
        "wrap_text": 1, 
        "description": "", 
        "type": "item", 
        "layout": "media_left", 
        "media_width": "65", 

        
        "styles": { 

            
            "item": {
                "backgroundColor": "", 
                "color": "", 
                "fontFamily": "" 
            }
        },

        "is_published": 1, 
        "order": 6,
        "created": "2022-10-13T20:24:20.000Z"
    },

    // media right item
    {
        "uuid": "f14d40a9ba5f040c5868c36b473ad7f5",
        "is_member_of_exhibit": "1",
        "title": "media right, wrap text", 
        "caption": "Image from Kynewisbok, vol36, academic year 1933-1934", 
        "template": "row", 
        "item_type": "image", 
        "media": "f14d40a9ba5f040c5868c36b473ad7f5.jpg", 
        "text": "<div style='font-size: 1.3em; font-weight: bold'>Media right, wrap text</div><hr>Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32.", // {string | html} (R if no "url" value)
        "wrap_text": 1, 
        "description": "", 
        "type": "item", 
        "layout": "media_right", 
        "media_width": "65", 

        
        "styles": { 

            
            "item": {
                "backgroundColor": "", 
                "color": "", 
                "fontFamily": "" 
            }
        },

        "is_published": 1, 
        "order": 7,
        "created": "2022-10-13T20:24:20.000Z"
    },

    // media left item no text wrap
    {
        "uuid": "f14d40a9ba5f040c5868c36b473ad7f5",
        "is_member_of_exhibit": "1",
        "title": "media left item no text wrap", 
        "caption": "Image from Kynewisbok, vol36, academic year 1933-1934", 
        "template": "row", 
        "item_type": "image", 
        "media": "f14d40a9ba5f040c5868c36b473ad7f5.jpg", 
        "text": "<div style='font-size: 1.3em; font-weight: bold'>Media left, no wrap text</div><hr>Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32.", // {string | html} (R if no "url" value)
        "wrap_text": 0, 
        "description": "", 
        "type": "item", 
        "layout": "media_left", 
        "media_width": "50", 

        
        "styles": { 

            
            "item": {
                "backgroundColor": "", 
                "color": "", 
                "fontFamily": "" 
            }
        },

        "is_published": 1, 
        "order": 8,
        "created": "2022-10-13T20:24:20.000Z"
    },

    // media right item no text wrap
    {
        "uuid": "f14d40a9ba5f040c5868c36b473ad7f5",
        "is_member_of_exhibit": "1",
        "title": "media right item no text wrap", 
        "caption": "Image from Kynewisbok, vol36, academic year 1933-1934", 
        "template": "row", 
        "item_type": "image", 
        "media": "f14d40a9ba5f040c5868c36b473ad7f5.jpg", 
        "text": "<div style='font-size: 1.3em; font-weight: bold'>Media right, no wrap text</div><hr>Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32.", // {string | html} (R if no "url" value)
        "wrap_text": 0, 
        "description": "", 
        "type": "item", 
        "layout": "media_right", 
        "media_width": "40", 

        
        "styles": { 

            
            "item": {
                "backgroundColor": "", 
                "color": "", 
                "fontFamily": "" 
            }
        },

        "is_published": 1, 
        "order": 9,
        "created": "2022-10-13T20:24:20.000Z"
    },

    // media top item
    {
        "uuid": "f14d40a9ba5f040c5868c36b473ad7f5",
        "is_member_of_exhibit": "1",
        "title": "media top", 
        "caption": "Image from Kynewisbok, vol36, academic year 1933-1934", 
        "template": "row", 
        "item_type": "image", 
        "media": "f14d40a9ba5f040c5868c36b473ad7f5.jpg", 
        "text": "Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32.", // {string | html} (R if no "url" value)
        "wrap_text": 1, 
        "show_title": 1,
        "type": "item", 
        "layout": "media_top", 
        "media_width": "65", 

        
        "styles": { 

            
            "item": {
                "backgroundColor": "", 
                "color": "", 
                "fontFamily": "" 
            }
        },

        "is_published": 1, 
        "order": 10,
        "created": "2022-10-13T20:24:20.000Z"
    },
    
    // media bottom item
    {
        "uuid": "f14d40a9ba5f040c5868c36b473ad7f5",
        "is_member_of_exhibit": "1",
        "title": "media bottom", 
        "caption": "Image from Kynewisbok, vol36, academic year 1933-1934", 
        "template": "row", 
        "item_type": "image", 
        "media": "f14d40a9ba5f040c5868c36b473ad7f5.jpg", 
        "text": "<div style='font-size: 1.3em; font-weight: bold'>Media bottom</div><hr>Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32.", // {string | html} (R if no "url" value)
        "wrap_text": 1, 
        "description": "", 
        "type": "item", 
        "layout": "media_bottom", 
        "media_width": "65", 

        
        "styles": { 

            
            "item": {
                "backgroundColor": "", 
                "color": "", 
                "fontFamily": "" 
            }
        },

        "is_published": 1, 
        "order": 11,
        "created": "2022-10-13T20:24:20.000Z"
    },

    // media only item
    {
        "uuid": "f14d40a9ba5f040c5868c36b473ad7f5",
        "is_member_of_exhibit": "1",
        "title": "media only", 
        "caption": "Image from Kynewisbok, vol36, academic year 1933-1934", 
        "template": "row", 
        "item_type": "image", 
        "media": "f14d40a9ba5f040c5868c36b473ad7f5.jpg", 
        "description": "", 
        "type": "item", 
        "layout": "media_only", 
        "media_width": "100", 
        "show_title": 1,
        
        "styles": { 

            
            "item": {
                "backgroundColor": "", 
                "color": "", 
                "fontFamily": "" 
            }
        },

        "is_published": 1, 
        "order": 12,
        "created": "2022-10-13T20:24:20.000Z"
    },

    // text only item
    {
        "uuid": "f14d40a9ba5f040c5868c36b473ad7f5",
        "is_member_of_exhibit": "1",
        "title": "text only", 
        "caption": "Image from Kynewisbok, vol36, academic year 1933-1934", 
        "template": "row", 
        "item_type": "text", 
        "media": "f14d40a9ba5f040c5868c36b473ad7f5.jpg", 
        "text": "<div style='font-size: 1.3em; font-weight: bold'>Text only</div><hr>Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32.", // {string | html} (R if no "url" value)
        "wrap_text": 1, 
        "description": "", 
        "type": "item", 
        "layout": "text_only", 
        "media_width": "65", 

        
        "styles": { 

            
            "item": {
                "backgroundColor": "", 
                "color": "", 
                "fontFamily": "" 
            }
        },

        "is_published": 1, 
        "order": 2,
        "created": "2022-10-13T20:24:20.000Z"
    },

    // media left, media width 35%
    {
        "uuid": "f14d40a9ba5f040c5868c36b473ad7f5",
        "is_member_of_exhibit": "1",
        "title": "media left, media width 35%", 
        "caption": "Image from Kynewisbok, vol36, academic year 1933-1934", 
        "template": "row", 
        "item_type": "image", 
        "media": "f14d40a9ba5f040c5868c36b473ad7f5.jpg", 
        "text": "<div style='font-size: 1.3em; font-weight: bold'>Media left, media width 35%</div><hr>Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32. Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum passage, and going through the cites of the word in classical literature, discovered the undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of \"de Finibus Bonorum et Malorum\" (The Extremes of Good and Evil) by Cicero, written in 45 BC. This book is a treatise on the theory of ethics, very popular during the Renaissance. The first line of Lorem Ipsum, \"Lorem ipsum dolor sit amet..\", comes from a line in section 1.10.32.", // {string | html} (R if no "url" value)
        "wrap_text": 1, 
        "description": "", 
        "type": "item", 
        "layout": "media_left", 
        "media_width": "35", 

        
        "styles": { 

            
            "item": {
                "backgroundColor": "", 
                "color": "", 
                "fontFamily": "" 
            }
        },

        "is_published": 1, 
        "order": 13,
        "created": "2022-10-13T20:24:20.000Z"
    },

    ////////////////////////////////
    // items opened in modal viewer
    ////////////////////////////////

    // heading, example item types
    {
        "type": "heading",
        "is_member_of_exhibit": "1", 
        "text": "Example Item Types", 
        "order": 14, 
        "is_visible": 1, 
        "is_anchor": 1 
    },

    /*
    * test small image (modal viewer)
    */
    {
        "uuid": "854bd0a5e8c76348c6b91184f8e740bf",
        "is_member_of_exhibit": "1",
        "title": "small image",
        "caption": "Summary/Description. Image courtesy of the University of Denver.",
        "item_type": "image",
        "media": "87e2442acfbd95fe5ed8b18e3ca09e11.jpg",
        "description": "This is the text that goes on the preview item This is the text that goes on the preview item This is the text that goes on the preview item",
        "text": "<div style='font-size: 1.3em; font-weight: bold'>Small image</div><hr>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum",
        "type": "item",
        "layout": "media_right",
        "thumbnail": "test-tn.png",
        "styles": {
            "item": {
                "background": "#F1A35E"
            }
        },
        "is_published": 1,
        "order": 15,
        "created": "2023-06-29T20:24:20.000Z"
    },

    /*
    * test large image (modal viewer)
    */
    {
        "uuid": "93429003c83376671df7d807e64ac7af",
        "is_member_of_exhibit": "1",
        "title": "large image, media only",
        "caption": "Summary/Description. Image courtesy of the University of Denver.",
        "item_type": "large_image",
        "media": "9c9088bf-3581-4f0b-89fa-ee0fd38a3e4d.tif",
        "text": "<div style='font-size: 1.3em; font-weight: bold'>Large image</div><hr>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum",
        "type": "item",
        "thumbnail": "test-tn.png",
        "layout": "media_only",
        "styles": {
            "item": {
                "background": "#B0BF73"
            }
        },
        "media_width": "50",
        "is_published": 1,
        "show_title": 1,
        "order": 16,
        "created": "2023-06-29T20:24:20.000Z"
    },

    /*
    * test audio (modal viewer)
    */
    {
        "uuid": "6b0fd7c7a894ec469ff6facec1b34566",
        "is_member_of_exhibit": "1",
        "title": "audio item",
        "caption": "Summary/Description. Audio content courtesy of the University of Denver.",
        "item_type": "audio",
        "thumbnail": "test-tn.png",
        "media": "416aac52-de61-4c86-b329-32663c355789.mp3",
        "text": "<div style='font-size: 1.3em; font-weight: bold'>Audio</div><hr>It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English.",
        "description": "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout.",
        "type": "item",
        "layout": "media_right",
        "media_width": "25",
        "styles": {
            "item": {
                "background": "#F1A35E"
            }
        },
        "is_published": 1,
        "order": 17,
        "created": "2023-06-29T20:24:20.000Z"
    },

    /*
    * test video (modal viewer)
    */
    {
        "uuid": "178575b6affa27334ada62d3d7214831",
        "is_member_of_exhibit": "1",
        "title": "video item",
        "caption": "Summary/Description. Video content courtesy of the University of Denver.",
        "item_type": "video",
        "media": "65f602d0-b036-485a-a9e2-ffffaa22004b.mp4",
        "text": "<div style='font-size: 1.3em; font-weight: bold'>Video</div><hr>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco.",
        "type": "item",
        "thumbnail": "test-tn.png",
        "layout": "media_right",
        "media_width": "25",
        "styles": {
            "item": {
                "background": "#B0BF73"
            }
        },
        "is_published": 1,
        "order": 18,
        "created": "2023-06-29T20:24:20.000Z"
    },

    /*
    * test pdf (modal viewer)
    */
    {
        "uuid": "973790c6923d7081604a2a184d4a6abb",
        "is_member_of_exhibit": "1",
        "title": "pdf item",
        "caption": "Summary/Description. Courtesy of the University of Denver.",
        "item_type": "pdf",
        "media": "5916273c-fb54-42f3-8340-f63ad24faafa_1.pdf",
        "text": "<div style='font-size: 1.3em; font-weight: bold'>Pdf</div><hr>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
        "type": "item",
        "layout": "media_right",
        "thumbnail": "test-tn.png",
        "media_width": "25",
        "styles": {
            "item": {
                "background": "#F1A35E"
            }
        },
        "is_published": 1,
        "order": 19,
        "created": "2023-06-29T20:24:20.000Z"
    },

    /*
    * test external source url (modal viewer)
    * 
    */
    {
        "uuid": "7a315ba354f92e8c5f6527c424b0ed8a",
        "is_member_of_exhibit": "1",
        "title": "external source item",
        "caption": "Summary/Description. Courtesy of the University of Denver.",
        "item_type": "external",
        "thumbnail": "test-tn.png",
        "media": "https://sample-videos.com/img/Sample-jpg-image-1mb.jpg",
        //"media": "https://web.stanford.edu/class/ee398a/data/image/airfield512x512.tif", // not supported in iframe viewer
        "text": "<div style='font-size: 1.3em; font-weight: bold'>External source</div><hr>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
        "description": "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout.",
        "type": "item",
        "styles": {
            "item": {
                "background": "#B0BF73"
            }
        },
        "wrap_text": 0,
        "is_published": 1,
        "order": 20,
        "created": "2023-06-29T20:24:20.000Z"
    },

    {
        "type": "heading",
        "is_member_of_exhibit": "1",
        "text": "Example Item Types - Repository Items",
        "subtext": "subtitle text",
        "order": 21
    },

    ////////////////////////////////
    // end items opened in modal viewer
    ////////////////////////////////

    //////////////////////
    // repository items
    //////////////////////

    // small img
    { 
        "uuid": "repo_test_small_img",
        "is_member_of_exhibit": "1",
        "title": "repo small image",
        "template": "custom",
        "item_type": "repo",
        "thumbnail": "test-tn.png",
        "media": "6250938b-1e0c-401e-a47e-1dff189bd6bf",
        "text": "<div style='font-size: 1.3em; font-weight: bold'>Small image</div><hr><div><p>In 2017 UNSW Sydney became the caretaker for the <i><b>Dennis Wolanski Library collection</b></i>. The collection was originally part of the Sydney Opera House performing arts library. The collection is international in scope and focuses on the performing arts in Australia, 1789-1997. It consists of 1,600 archive boxes, containing press clippings, theatre programs, press releases, correspondence, and ephemera, and a card index of 80,000 entries.</p><p>"+
        "Collection access is managed by the Performance Memories Project, a partnership of <a href='#'>UNSW Library</a>, UNSW Theatre and Performance Studies, AusStage and the Wolanski Foundation. As part of project, we have now made available as downloads more than 160,000 records from the project site, including a subject list of research files and two converted card indexes, one covering the performing arts in general, one devoted to Australian drama. </p><div>",
        "type": "item",
        "order": 22,
        "layout": "media_right",
        "is_published": 1,
        "created": "2022-10-13T20:24:20.000Z"
    },

    // large img
    {
        "uuid": "repo_test_large_img",
        "is_member_of_exhibit": "1",
        "title": "repo large image",
        "template": "custom",
        "item_type": "repo",
        "thumbnail": "test-tn.png",
        "media": "a6371d18-dbac-4840-8ea8-4cf9230bf821",
        "text": "<div style='font-size: 1.3em; font-weight: bold'>Large image</div><hr><div><p>In 2017 UNSW Sydney became the caretaker for the <i><b>Dennis Wolanski Library collection</b></i>. The collection was originally part of the Sydney Opera House performing arts library. The collection is international in scope and focuses on the performing arts in Australia, 1789-1997. It consists of 1,600 archive boxes, containing press clippings, theatre programs, press releases, correspondence, and ephemera, and a card index of 80,000 entries.</p><p>"+
        "Collection access is managed by the Performance Memories Project, a partnership of <a href='#'>UNSW Library</a>, UNSW Theatre and Performance Studies, AusStage and the Wolanski Foundation. As part of project, we have now made available as downloads more than 160,000 records from the project site, including a subject list of research files and two converted card indexes, one covering the performing arts in general, one devoted to Australian drama. </p><div>",
        "type": "item",
        "order": 23,
        "layout": "media_right",
        "is_published": 1,
        "created": "2022-10-13T20:24:20.000Z"
    },

    // audio
    {
        "uuid": "repo_test_audio",
        "is_member_of_exhibit": "1",
        "title": "repo audio item",
        "template": "custom",
        "thumbnail": "test-tn.png",
        "item_type": "repo",
        "media": "38613e09-28ee-4b00-9081-df2a18f7946e",
        "text": "<div style='font-size: 1.3em; font-weight: bold'>Audio</div><hr><div><p>In 2017 UNSW Sydney became the caretaker for the <i><b>Dennis Wolanski Library collection</b></i>. The collection was originally part of the Sydney Opera House performing arts library. The collection is international in scope and focuses on the performing arts in Australia, 1789-1997. It consists of 1,600 archive boxes, containing press clippings, theatre programs, press releases, correspondence, and ephemera, and a card index of 80,000 entries.</p><p>"+
        "Collection access is managed by the Performance Memories Project, a partnership of <a href='#'>UNSW Library</a>, UNSW Theatre and Performance Studies, AusStage and the Wolanski Foundation. As part of project, we have now made available as downloads more than 160,000 records from the project site, including a subject list of research files and two converted card indexes, one covering the performing arts in general, one devoted to Australian drama. </p><div>",
        "type": "item",
        "order": 24,
        "media_width": "25",
        "layout": "media_right",
        "is_published": 1,
        "created": "2022-10-13T20:24:20.000Z"
    },

    // video
    {
        "uuid": "repo_test_video",
        "is_member_of_exhibit": "1",
        "title": "repo video item",
        "template": "custom",
        "item_type": "repo",
        "media": "953ea5ce-7a36-4816-8a10-6dc0fc81b10d",
        "text": "<div style='font-size: 1.3em; font-weight: bold'>Video</div><hr><div><p>In 2017 UNSW Sydney Denver became the caretaker for the <i><b>Dennis Wolanski Library collection</b></i>. The collection was originally part of the Sydney Opera House performing arts library. The collection is international in scope and focuses on the performing arts in Australia, 1789-1997. It consists of 1,600 archive boxes, containing press clippings, theatre programs, press releases, correspondence, and ephemera, and a card index of 80,000 entries.</p><p>"+
        "Collection access is managed by the Performance Memories Project, a partnership of <a href='#'>UNSW Library</a>, UNSW Theatre and Performance Studies, AusStage and the Wolanski Foundation. As part of project, we have now made available as downloads more than 160,000 records from the project site, including a subject list of research files and two converted card indexes, one covering the performing arts in general, one devoted to Australian drama. </p><div>",
        "type": "item",
        "thumbnail": "test-tn.png",
        "order": 25,
        "media_width": "25",
        "layout": "media_right",
        "is_published": 1,
        "created": "2022-10-13T20:24:20.000Z"
    },

    // pdf
    {
        "uuid": "repo_test_pdf",
        "is_member_of_exhibit": "1",
        "title": "repo pdf item",
        "template": "custom",
        "thumbnail": "clarion_hidef.jpg",
        "thumbnail": "test-tn.png",
        "item_type": "repo",
        "media": "5281b988-1f64-44d0-bb04-26e1faf85620",
        "text": "<div style='font-size: 1.3em; font-weight: bold'>Pdf</div><hr><div><p>In 2017 UNSW Sydney became the caretaker for the <i><b>Dennis Wolanski Library collection</b></i>. The collection was originally part of the Sydney Opera House performing arts library. The collection is international in scope and focuses on the performing arts in Australia, 1789-1997. It consists of 1,600 archive boxes, containing press clippings, theatre programs, press releases, correspondence, and ephemera, and a card index of 80,000 entries.</p><p>"+
        "Collection access is managed by the Performance Memories Project, a partnership of <a href='#'>UNSW Library</a>, UNSW Theatre and Performance Studies, AusStage and the Wolanski Foundation. As part of project, we have now made available as downloads more than 160,000 records from the project site, including a subject list of research files and two converted card indexes, one covering the performing arts in general, one devoted to Australian drama. </p><div>",
        "type": "item",
        "order": 26,
        "layout": "media_left",
        "is_published": 1,
        "created": "2022-10-13T20:24:20.000Z"
    },

    //////////////////////
    // repository items
    //////////////////////

    //////////////////////
    // embedded items
    //////////////////////

    {
        "uuid": "44c028631f69c94cf57c5b49754f2d6d",
        "type": "heading",
        "is_member_of_exhibit": "dd748b2c862c71bf50c1238c62ca26f0",
        "text": "Example Item Types (Embedded)",
        "order": 27,
        "is_visible": 1,
        "is_anchor": 1
    },
    {
        "uuid": "d30fbab695c973b23631bca98cd6e072",
        "is_member_of_exhibit": "dd748b2c862c71bf50c1238c62ca26f0",
        "title": "small image",
        "caption": "Summary/Description. Image courtesy of the University of Denver.",
        "item_type": "image",
        "media": "87e2442acfbd95fe5ed8b18e3ca09e11.jpg",
        "description": "This is the text that goes on the preview item This is the text that goes on the preview item This is the text that goes on the preview item",
        "text": "&lt;div style=&amp;#39;font-size: 1.3em; font-weight: bold&amp;#39;&gt;Small image&lt;/div&gt;&lt;hr&gt;Lorem ipsum dolor sit amet denver, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum",
        "type": "item",
        "layout": "media_right",
        "styles": "{\"item\":{\"background\":\"#F1A35E\"}}",
        "is_embedded": 1,
        "is_published": 1,
        "order": 28,
        "created": "2023-06-29T20:24:20.000Z"
    },
    {
        "uuid": "d8ccc1b145d20a3cf39e394c9d7e87b6",
        "is_member_of_exhibit": "dd748b2c862c71bf50c1238c62ca26f0",
        "title": "large image, media only",
        "caption": "Summary/Description. Image courtesy of the University of Denver.",
        "item_type": "large_image",
        "media": "9c9088bf-3581-4f0b-89fa-ee0fd38a3e4d.tif",
        "text": "&lt;div style=&amp;#39;font-size: 1.3em; font-weight: bold&amp;#39;&gt;Large image&lt;/div&gt;&lt;hr&gt;Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum",
        "type": "item",
        "layout": "media_only",
        "styles": "{\"item\":{\"background\":\"#B0BF73\"}}",
        "media_width": "50",
        "is_embedded": 1,
        "is_published": 1,
        "show_title": 1,
        "order": 29,
        "created": "2023-06-29T20:24:20.000Z"
    },
    {
        "uuid": "ee29e23a988177d38a34b814be6f5793",
        "is_member_of_exhibit": "dd748b2c862c71bf50c1238c62ca26f0",
        "title": "audio item",
        "caption": "Summary/Description. Audio content courtesy of the University of Denver.",
        "item_type": "audio",
        "media": "38613e09-28ee-4b00-9081-df2a18f7946e.mp3",
        "text": "&lt;div style=&amp;#39;font-size: 1.3em; font-weight: bold&amp;#39;&gt;Audio&lt;/div&gt;&lt;hr&gt;It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using &amp;#39;Content here, content here&amp;#39;, making it look like readable English.",
        "description": "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout.",
        "type": "item",
        "layout": "media_right",
        "media_width": "25",
        "styles": "{\"item\":{\"background\":\"#F1A35E\"}}",
        "is_embedded": 1,
        "is_published": 1,
        "kaltura_id": "0_unc0v4as",
        "order": 30,
        "created": "2023-06-29T20:24:20.000Z"
    },
    {
        "uuid": "bb74428a8639083a5c351750ff3d6b47",
        "is_member_of_exhibit": "dd748b2c862c71bf50c1238c62ca26f0",
        "title": "video item",
        "caption": "Summary/Description. Video content courtesy of the University of Denver.",
        "item_type": "video",
        "media": "953ea5ce-7a36-4816-8a10-6dc0fc81b10d.mp4",
        "text": "&lt;div style=&amp;#39;font-size: 1.3em; font-weight: bold&amp;#39;&gt;Video&lt;/div&gt;&lt;hr&gt;Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco.",
        "type": "item",
        "layout": "media_right",
        "media_width": "25",
        "styles": "{\"item\":{\"background\":\"#B0BF73\"}}",
        "is_embedded": 1,
        "is_published": 1,
        "kaltura_id": "0_za4023rj",
        "order": 31,
        "created": "2023-06-29T20:24:20.000Z"
    },
    {
        "uuid": "41096e73aa6448d5a81c8e7dd669da48",
        "is_member_of_exhibit": "dd748b2c862c71bf50c1238c62ca26f0",
        "title": "pdf item",
        "caption": "Summary/Description. Courtesy of the University of Denver.",
        "item_type": "pdf",
        "media": "5916273c-fb54-42f3-8340-f63ad24faafa_1.pdf",
        "text": "&lt;div style=&amp;#39;font-size: 1.3em; font-weight: bold&amp;#39;&gt;Pdf&lt;/div&gt;&lt;hr&gt;Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
        "type": "item",
        "layout": "media_right",
        "media_width": "25",
        "styles": "{\"item\":{\"background\":\"#F1A35E\"}}",
        "is_embedded": 1,
        "is_published": 1,
        "order": 32,
        "created": "2023-06-29T20:24:20.000Z"
    },
    {
        "uuid": "def6dcc6d1a69df509f8a41aea8d2337",
        "is_member_of_exhibit": "dd748b2c862c71bf50c1238c62ca26f0",
        "title": "external source item",
        "caption": "Summary/Description. Courtesy of the University of Denver.",
        "item_type": "external",
        "media": "https://sample-videos.com/img/Sample-jpg-image-1mb.jpg",
        "text": "&lt;div style=&amp;#39;font-size: 1.3em; font-weight: bold&amp;#39;&gt;External source&lt;/div&gt;&lt;hr&gt;Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
        "description": "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout.",
        "type": "item",
        "styles": "{\"item\":{\"background\":\"#B0BF73\"}}",
        "is_embedded": 1,
        "is_published": 1,
        "order": 33,
        "created": "2023-06-29T20:24:20.000Z"
    }

    //////////////////////
    // end embedded items
    //////////////////////
]