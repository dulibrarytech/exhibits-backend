/* Required fields are marked with "(R)" */

module.exports = [
  {
    "uuid": "1",
    "type": "exhibit",
    "title": "Title: Test Exhibit", // {string | html} title for exhibit banner (R) 
    "subtitle": "Subtitle: The Legacy of Settler Colonialism and the University of Denver", // {string | html} (default: null, no subtitle displayed)
    "banner_template": "banner_1", // {'banner_1' | 'banner_2'} (default: banner_1) 
    "about_the_curators": "About the curators content", // tbd
    "alert_text": "this is an <strong>Alert</strong>", // {string | html} alert banner displayed below hero section (default: null, alert banner not displayed)
    "hero_image": "brent-learned_one-november-morning.jpeg", // {filename.extension} filename or path to file (default: null, hero image not displayed. image section will be displayed with a gray background if the banner template has a hero image section)
    "thumbnail_image": "example-exhibit_tn.jpg", // {filename.extension} filename. exhibit thumbnail image. (default: null, thumbnail image will be derived from the 'hero_image' if present.)
    "description": "<strong>Description text:</strong> At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.", // {string | html} the exhibit banner text
    "page_layout": "top_nav", // {'top_nav', 'side_nav} (default: top_nav)
    "template": "vertical_scroll",  // {'vertical_scroll' | 'item_centered'} (R)

    /* user style settings (value is a JSON string, default: "{}") */
    // "styles": {
    //
    //   "exhibit": {
    // 
    //     "heading": {}, /* exhibit headings */
    //
    //     "navigation": {}, /* navigation menu banner or sidebar section */
    //
    //     "template": {} /* applied to entire exhibit */
    //
    //   }
    //
    // },
    "styles": '{"exhibit":{"navigation":{"menu":{"backgroundColor":"#e5e5e5","color":"#505050","fontFamily":"Tahoma","fontSize":"18px","textAlign":"left"}},"template":{"backgroundColor":"white","color":"#303030","fontFamily":"Verdana","fontSize":"18px","textAlign":"left"},"heading":{"backgroundColor":"#8b2332","color":"white","fontFamily":"Nocturne Serif"}}}',
    
    "is_published": 1, // {0,1} (default: 0)
    "is_featured": 1, // {0,1) if 1, will appear in featured exhibits display (default: 0)
    "created": "2022-10-13T20:24:20.000Z"
  },
  {
    "uuid": "2",
    "type": "exhibit",
    "title": "#NoMorePios",
    "subtitle": "The Legacy of Settler Colonialism and the University of Denver",
    "banner_template": "banner_1",
    "alert_text": "<strong>Warning:</strong> This exhibit contains materials that are racist and may be painful or traumatizing to viewers. Please proceed with caution.",
    "hero_image": "phys-exhibit_narrow.jpg",
    "thumbnail_image": "", 
    "description": "<p>Founded in 1864, the University of Denver (DU) has a history of athletic team nicknames, mascots, and university branding that draw heavily on the identity as the oldest private university in Colorado. The history of DU is also forever connected to the Sand Creek Massacre, where more than 160 Cheyenne and Arapaho people - mostly elders, women, and children - were murdered by Colorado’s Third Cavalry in November 1864, just six months after the University’s founding.</p><p>Like many colleges and universities in the American West, DU has appropriated and romanticized Native American peoples and the U.S. settler colonial project. While many of our alumni associate the term 'pioneer' with positive memories of the university, for many others, this term represents the forced expropriation of Native lands. Universities use mascots and nicknames to create a sense of community, but for Native students, alumni, faculty, staff, this term is a reminder of stolen land and genocide.</p><p>This exhibit explores DU’s history of mascots, nicknames, and branding and the changes over its 150 year history, which often took place alongside related social and cultural changes. 'Pioneer' has not always been the nickname and Denver Boone was not the first mascot. DU’s traditions have changed considerably over time, and these changes – like the demands to remove “Pioneer” as the nickname – have largely been student-driven.<p><div style='color: black; text-align: center; display: grid; margin: 0 auto; width: 38%;'><span style='color: #8b2332; margin: 0 auto; width: 50%'><hr style='height: 3px; opacity: 0.8'></span><span><strong>DU is long overdue for another change. test</strong></span><span><strong>#NoMorePios</strong></span><span style='color: #8b2332; margin: 0 auto; width: 50%'><hr style='height: 3px; opacity: 0.8'></span></div>",
    "page_layout": "side_nav",
    "template": "vertical_scroll",
    "styles": '{"exhibit":{"heading":{"textAlign":"center","color":"#8b2332"},"navigation":{"menu":{"background":"#AE9E6F"},"links":{"background":"#C6BA97"}},"template":{"fontFamily":"Arial","color":"#2E2924","fontSize":"20px","textAlign":"center"}}}',

    "is_published": 1,
    "is_featured": 0,
    "created": "2022-10-13T20:24:20.000Z"
},
{
  "uuid": "3",
  "type": "exhibit",
  "title": "Women in Botanical Illustration",
  "subtitle": "",
  "banner_template": "banner_1",
  "hero_image": "1b4f992fc12049c790f0aad6138d7755.png",
  "alert_text": "<strong style='color: black'>Warning:</strong> This exhibit contains materials that are racist and may be painful or traumatizing to viewers. Please proceed with caution.",
  "thumbnail_image": "", 
  "description": "A selection of books and artworks from the University of Denver Libraries and Special Collections & Archives test",
  "page_layout": "side_nav",
  "template": "vertical_scroll",
  "styles": "{}",
  "is_published": 1,
  "created": "2022-10-13T20:24:20.000Z"
},
///////////////////////////////////////////
// mockup exhibits
///////////////////////////////////////////
{
  "uuid": "4",
  "type": "exhibit",
  "title": "DU Outdoors",
  "subtitle": "This is the DU Outdoors Online Exhibit",
  "banner_template": "banner_4",
  "hero_image": "du-outdoors_hero.jpg",
  "about_the_curators": "About the curators content",
  "thumbnail_image": "du-outdoors_tn.png",
  "description": "<div style='color: white'>Since the university was founded in 1864, the DU community has sought inspiration and recreation outside of the classroom. Student organizations, department initiatives, and the recently established John C. Kennedy Mountain Campus provide evidence of a continuous drive toward nature throughout the university’s history. The first Kynewisbok student yearbook, published in 1898, included an ode to the University of Denver. The Ode referred to DU as the “queenly mother” “under the slopes of the mountains... where winter kisses the summer on Evans, or Pike’s Peak, or Gray.” Times changed, but DU’s love for the mountains did not. The 1974 yearbook featured the music and lyrics of John Denver’s well-known song, “Rocky Mountain High.” Several decades later, the Kynewisbok highlighted student recreational clubs as “Rocky Mountain High Outlets to Students,” where “the temptation to explore and the reminder to preserve are constant threats to studying.” Today, DU students share their Rocky Mountain adventures via Instagram, Facebook, and other social media platforms. Student organizations and University programs throughout time have created opportunities for DU students to leave some of their stress behind on campus and journey to the mountains."
  +"<br><br><div style='font-size: 1.5em; text-align: center'>How we recreate is just as important as why we recreate.</div>"
  +"<br><br>Outdoor organizations have published guidelines for how to recreate responsibly in 2023. These include building an inclusive outdoors, respecting others, and following Leave No Trace principles. By recognizing the historic and systemic exclusivity of outdoor recreation, we can work to create a more inclusive environment for all seeking connection in and with nature. Leaders in the field call for the acknowledgment of historic and contemporary discrimination to address the history of segregation in public spaces. Institutionally, another area for change is amplifying diverse perspectives in the field by filling leadership positions with people of color."
  +"Responsible outdoor recreation also requires respecting the connections that others may hold to a place. In the United States, some recreation areas occupy stolen land that embodies the cultural heritage of contemporary Native American communities. Certain national parks, state parks, and other recreation areas are both natural and cultural landscapes. When visiting an area to recreate, consider whose land you are on, and how you can respect their connections to the place while you form your own."
  +"When recreating, practicing respect for the environment is critical for maintaining the nation’s natural resources for the enjoyment of future generations. Leave No Trace principles are designed to teach low impact ethics to balance recreational land use with preservation. Practicing sustainable recreation is key to the longevity of our natural spaces.</div>",
  "page_layout": "top_nav",
  "template": "vertical_scroll",
  "styles": '{"exhibit":{"template":{"backgroundColor":"rgb(124, 165, 153)","color":"#fff","fontSize":"20px","fontFamily":"arial"},"navigation":{"menu":{"backgroundColor":"#688D71","color":"white"}},"heading":{"fontFamily":"arial"}}}',
  "is_published": 1,
  "is_featured": 1,
  "created": "2022-10-13T20:24:20.000Z"
},

{
  "uuid": "5",
  "type": "exhibit",
  "title": "DU Outdoors (no styles)",
  "banner_template": "banner_3",
  "hero_image": "du-outdoors_hero.jpg",
  "description": "Since the university was founded in 1864, the DU community has sought inspiration and recreation outside of the classroom. Student organizations, department initiatives, and the recently established John C. Kennedy Mountain Campus provide evidence of a continuous drive toward nature throughout the university’s history. The first Kynewisbok student yearbook, published in 1898, included an ode to the University of Denver. The Ode referred to DU as the “queenly mother” “under the slopes of the mountains... where winter kisses the summer on Evans, or Pike’s Peak, or Gray.” Times changed, but DU’s love for the mountains did not. The 1974 yearbook featured the music and lyrics of John Denver’s well-known song, “Rocky Mountain High.” Several decades later, the Kynewisbok highlighted student recreational clubs as “Rocky Mountain High Outlets to Students,” where “the temptation to explore and the reminder to preserve are constant threats to studying.” Today, DU students share their Rocky Mountain adventures via Instagram, Facebook, and other social media platforms. Student organizations and University programs throughout time have created opportunities for DU students to leave some of their stress behind on campus and journey to the mountains."
  +"<br><br><div style='font-size: 1.5em; text-align: center'>How we recreate is just as important as why we recreate.</div>"
  +"<br>Outdoor organizations have published guidelines for how to recreate responsibly in 2023. These include building an inclusive outdoors, respecting others, and following Leave No Trace principles. By recognizing the historic and systemic exclusivity of outdoor recreation, we can work to create a more inclusive environment for all seeking connection in and with nature. Leaders in the field call for the acknowledgment of historic and contemporary discrimination to address the history of segregation in public spaces. Institutionally, another area for change is amplifying diverse perspectives in the field by filling leadership positions with people of color."
  +"Responsible outdoor recreation also requires respecting the test connections that others may hold to a place. In the United States, some recreation areas occupy stolen land that embodies the cultural heritage of contemporary Native American communities. Certain national parks, state parks, and other recreation areas are both natural and cultural landscapes. When visiting an area to recreate, consider whose land you are on, and how you can respect their connections to the place while you form your own."
  +"When recreating, practicing respect for the environment is critical for maintaining the nation’s natural resources for the enjoyment of future generations. Leave No Trace principles are designed to teach low impact ethics to balance recreational land use with preservation. Practicing sustainable recreation is key to the longevity of our natural spaces.",
  "page_layout": "top_nav",
  "template": "vertical_scroll",
  "styles": "{}",
  "is_published": 1,
  "created": "2022-10-13T20:24:20.000Z"
},

{
  "uuid": "6",
  "type": "exhibit",
  "title": "Loewenstien",
  "subtitle": "subtitle text",
  "banner_template": "banner_4",
  "hero_image": "hero_2.jpg",
  "thumbnail_image": "dd057997d5b5f36d806b77c38c2fb472.jpeg", 
  "description": '<style>.description-body {color: #fff} .item-1-blocks button {background-color: rgb(64,21,15); border: none; color: #fff; border-radius: 25px; padding: 8px 20px; margin-top: 15px; text-transform: uppercase;}</style><div class="description-body"><p>In 1933, the year of Hitler\'s rise to power, approximately 160,000 Jews lived in Berlin, Germany, which was less than 4% of its population. By 1939, an estimated 80,000 Berlin Jews had managed to emigrate. Between 1941 and 1944 more than 60,000 were deported to Eastern European ghettoes and death camps. Only about 7,000 were known to have survived by 1945.</p><p>The historic documents in the Lowenstein Family Papers and Art collection tell the story of one Jewish family\'s miraculous survival amidst the horrors of the Holocaust. Two exceedingly rare documents from 1942 served as eviction notices. They order the recipients to report at a certain date and time to a government building in Berlin. In reality the notice was a summons of deportation to death camps. If obeyed, the recipient was killed. If not obeyed, the recipient most certainly did not retain the letter. That notice led to the deaths of an estimated 60,000 Jews.</p><p>The Loewensteins (Lowenstein after immigration) - Max, Maria, Karin, and Henry - lived in Berlin and, beginning in 1933, experienced the ever tightening Nazi noose. Like many other Jewish families they tried desperately to find ways to leave Germany. The beginnings of the Holocaust burst forth on Kristallnacht in 1938. Synagogues were burned and thousands of Jews were taken to concentration camps. Many were never seen again.</p><p>Thirteen-year-old Henry was lucky to be one of 10,000 children to be saved by the Kindertransport in 1939. Kindertransports were organized by British aid organizations to bring predominantly German, Austrian, and Czechoslovakian Jewish children to the United Kingdom. Henry was able to reunite with his family in 1947.</p><p>Henry\'s mother Maria, born into a Lutheran family, used her Aryan status to protect her loved ones. Her courage saved the family from deportation and certain death on numerous occasions. She brought the documents in this collection to America in 1946.</p><p>Henry Lowenstein donated them to the Ira M. and Peryle Hayutin Beck Memorial Archives. The collection is located in the Anderson Academic Commons, Special Collections and Archives.</p><div class="item-1-blocks" style="width: 100%; margin-top: 50px; text-align: center; font-size: 19px"><div style="margin: 0 auto; width: 85%; display: flex;"><div style="background: rgb(165,87,41); padding: 30px; border-radius: 25px; margin-right: 50px;">More Information available at:<div style="display: flex; margin-top: 30px; position: relative"><div style="width: 50%"><div>Loewenstein Family Papers and Art Finding aid</div><button>finding aid</button></div><div style="position: relative"><div>View the Entire Collection</div><button style="position: absolute; bottom: 0px; right: 12px">collection</button></div></div></div><div style=" background: rgb(140, 64, 50); padding: 30px; border-radius: 25px;"><div style="height: 20%">Please complete this feedback form for a 1-minute survey to helps us improve and engage our exhibits with different audiences.</div><div style="height: 80%; position: relative; right: 47px;"><button style="position: absolute; bottom: 0px;">survey</button></div></div></div></div></div>',
  "page_layout": "top_nav",
  "template": "vertical_scroll",
  "styles": '{"exhibit":{"navigation":{"menu":{"backgroundColor":"#DCC9AB","color":"#303030","textAlign":"center"}},"template":{"backgroundColor":"rgb(125,135,145)","color":"#303030","fontSize":"19px","line-height":"29px"},"heading":{"backgroundColor":"#DCC9AB","color":"rgb(155,136,110)","fontSize":"47px","fontFamily":"Nocturne Serif"}}}',
  "is_published": 1,
  "is_featured": 1,
  "created": "2022-10-13T20:24:20.000Z"
},

///////////////////////////////////////////
// End mockup exhibits
///////////////////////////////////////////
// {
//   "uuid": "7",
//   "type": "exhibit",
//   "title": "title",
//   "subtitle": "subtitle text",
//   "banner_template": "banner_1",
//   "hero_image": "phys-exhibit_narrow.jpg",
//   "thumbnail_image": "87e2442acfbd95fe5ed8b18e3ca09e11.jpg", 
//   "description": "description text",
//   "page_layout": "side_nav",
//   "template": "vertical_scroll",
//   "styles": {},
//   "is_published": 1,
//   "created": "2022-10-13T20:24:20.000Z"
// },

// {
//   "uuid": "8",
//   "type": "exhibit",
//   "title": "title",
//   "subtitle": "subtitle text",
//   "banner_template": "banner_1",
//   "hero_image": "903533c4f94e775801505ea90fe3d9ab.jpeg",
//   "description": "description text",
//   "page_layout": "side_nav",
//   "template": "vertical_scroll",
//   "styles": {},
//   "is_published": 1,
//   "created": "2022-10-13T20:24:20.000Z"
// },

// {
//   "uuid": "9",
//   "type": "exhibit",
//   "title": "title",
//   "subtitle": "subtitle text",
//   "banner_template": "banner_1",
//   "hero_image": "phys-exhibit_narrow.jpg",
//   "thumbnail_image": "cfe00254d432133be93270dd221b530d.jpeg", 
//   "description": "description text",
//   "page_layout": "side_nav",
//   "template": "vertical_scroll",
//   "styles": {},
//   "is_published": 1,
//   "created": "2022-10-13T20:24:20.000Z"
// },

// {
//   "uuid": "10",
//   "type": "exhibit",
//   "title": "title",
//   "subtitle": "subtitle text",
//   "banner_template": "banner_1",
//   "hero_image": "phys-exhibit_narrow.jpg",
//   "thumbnail_image": "dd057997d5b5f36d806b77c38c2fb472.jpeg", 
//   "description": "description text",
//   "page_layout": "side_nav",
//   "template": "vertical_scroll",
//   "styles": {},
//   "is_published": 1,
//   "is_featured": 0,
//   "created": "2022-10-13T20:24:20.000Z"
// },

// {
//   "uuid": "11",
//   "type": "exhibit",
//   "title": "title",
//   "subtitle": "subtitle text",
//   "banner_template": "banner_1",
//   "hero_image": "phys-exhibit_narrow.jpg",
//   "thumbnail_image": "dec9080b9446fce9c3e810c1c5a81b74.jpeg", 
//   "description": "description text",
//   "page_layout": "side_nav",
//   "template": "vertical_scroll",
//   "styles": {},
//   "is_published": 1,
//   "created": "2022-10-13T20:24:20.000Z"
// },

// {
//   "uuid": "12",
//   "type": "exhibit",
//   "title": "title",
//   "subtitle": "subtitle text",
//   "banner_template": "banner_1",
//   "hero_image": "phys-exhibit_narrow.jpg",
//   "thumbnail_image": "e82e9f9391407e7bb449df221af39e42.jpg", 
//   "description": "description text",
//   "page_layout": "side_nav",
//   "template": "vertical_scroll",
//   "styles": {},
//   "is_published": 1,
//   "created": "2022-10-13T20:24:20.000Z"
// }

]