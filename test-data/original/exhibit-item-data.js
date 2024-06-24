module.exports = [

  /* repo source - embed with no iiif */
  {
    "uuid": "00726715-bdaa-4a6b-a6b0-4f6007b1b2ff",
    "is_member_of_exhibit": "00509704-bdaa-4a6b-a6b0-4f6007b1b2fe",
    "caption": "Single object from repo",
    "template": "custom", // TBD
    "item_type": "repo",
    "url": "00509704-bdaa-4a6b-a6b0-4f6007b1b2fe", // Identified as uuid in code. Fetch data from index, get object type, mimetype, etc.
    "text": "<div><p>In 2017 UNSW Sydney became the caretaker for the <i><b>Dennis Wolanski Library collection</b></i>. The collection was originally part of the Sydney Opera House performing arts library. The collection is international in scope and focuses on the performing arts in Australia, 1789-1997. It consists of 1,600 archive boxes, containing press clippings, theatre programs, press releases, correspondence, and ephemera, and a card index of 80,000 entries.</p><p>"+
      "Collection access is managed by the Performance Memories Project, a partnership of <a href='#'>UNSW Library</a>, UNSW Theatre and Performance Studies, AusStage and the Wolanski Foundation. As part of project, we have now made available as downloads more than 160,000 records from the project site, including a subject list of research files and two converted card indexes, one covering the performing arts in general, one devoted to Australian drama. </p><div>",
    "type": "item",
    "order": 1, // get the part of a compound object. Ignored if non-compound object
    "layout": "item_right",
    "is_published": 1,
    "created": "2022-10-13T20:24:20.000Z"
  },

  /* repo source - embed with iiif */
  {
    "uuid": "00726715-bdaa-4a6b-a6b0-4f6007b1b2ff",
    "is_member_of_exhibit": "00509704-bdaa-4a6b-a6b0-4f6007b1b2fe",
    "caption": "Compound object from repo",
    "template": "custom", // TBD
    "item_type": "repo",
    "url": "00509704-bdaa-4a6b-a6b0-4f6007b1b2fe", // Fetch data from index, get object type, mimetype, etc.
    "is_iiif": 1,
    "text": "<div><p>In 2017 UNSW Sydney became the caretaker for the Dennis Wolanski Library collection. The collection was originally part of the Sydney Opera House performing arts library. The collection is international in scope and focuses on the performing arts in Australia, 1789-1997. It consists of 1,600 archive boxes, containing press clippings, theatre programs, press releases, correspondence, and ephemera, and a card index of 80,000 entries.</p><p>"+
      "Collection access is managed by the Performance Memories Project, a partnership of UNSW Library, UNSW Theatre and Performance Studies, AusStage and the Wolanski Foundation. As part of project, we have now made available as downloads more than 160,000 records from the project site, including a subject list of research files and two converted card indexes, one covering the performing arts in general, one devoted to Australian drama. </p><div>",
    "type": "item",
    "order": -1, // show entire compound object, not just part?
    "layout": "item_left",
    "is_published": 1,
    "created": "2022-10-13T20:24:20.000Z",
  },

  /* text only */
  {
    "is_member_of_exhibit": "00509704-bdaa-4a6b-a6b0-4f6007b1b2fe",
    "template": "custom", // TBD
    "text": "<div><p>In 2017 UNSW Sydney became the caretaker for the Dennis Wolanski Library collection. The collection was originally part of the Sydney Opera House performing arts library. The collection is international in scope and focuses on the performing arts in Australia, 1789-1997. It consists of 1,600 archive boxes, containing press clippings, theatre programs, press releases, correspondence, and ephemera, and a card index of 80,000 entries.</p><p>"+
      "Collection access is managed by the Performance Memories Project, a partnership of UNSW Library, UNSW Theatre and Performance Studies, AusStage and the Wolanski Foundation. As part of project, we have now made available as downloads more than 160,000 records from the project site, including a subject list of research files and two converted card indexes, one covering the performing arts in general, one devoted to Australian drama. </p><div>",
    "type": "item",
    "layout": "text_only",
    "is_published": 1
    // need other fields? 
  },

  /* external source - render in an iframe? (if nothing specifies what type of item is being sourced, ex. pdf, jpg, mov, etc) */
  // {
  //   "uuid": "00726715-bdaa-4a6b-a6b0-4f6007b1b2ff",
  //   "is_member_of_exhibit": "00509704-bdaa-4a6b-a6b0-4f6007b1b2fe",
  //   "caption": "Item description",
  //   "template": "custom", // TBD
  //   "item_type": "external",
  //   "url": "https://upload.wikimedia.org/wikipedia/commons/e/ee/Sample_abc.jpg", 
  //   "text": "<div><p>In 2017 UNSW Sydney became the caretaker for the <i>Dennis Wolanski Library</i> collection. The collection was originally part of the Sydney Opera House performing arts library. The collection is international in scope and focuses on the performing arts in Australia, 1789-1997. It consists of 1,600 archive boxes, containing press clippings, theatre programs, press releases, correspondence, and ephemera, and a card index of 80,000 entries.</p><p>"+
  //     "Collection access is managed by the Performance Memories Project, a partnership of UNSW Library, UNSW Theatre and Performance Studies, AusStage and the Wolanski Foundation. As part of project, we have now made available as downloads more than 160,000 records from the project site, including a subject list of research files and two converted card indexes, one covering the performing arts in general, one devoted to Australian drama. </p><div>",
  //   "type": "item",
  //   "order": 1, // 
  //   "layout": "item_bottom",
  //   "is_published": 1,
  //   "created": "2022-10-13T20:24:20.000Z"
  // },

  // /* image - external source */
  // {
  //   "uuid": "00726715-bdaa-4a6b-a6b0-4f6007b1b2ff",
  //   "is_member_of_exhibit": "00509704-bdaa-4a6b-a6b0-4f6007b1b2fe",
  //   "caption": "Item description",
  //   "item_type": "image", // external source url, if url in "url" field
  //   "url": "https://upload.wikimedia.org/wikipedia/commons/e/ee/Sample_abc.jpg", // frontend fetches from storage, or backend includes uri to resource? (as an 'external' item)
  //   "text": "<div><p>In 2017 UNSW Sydney became the caretaker for the Dennis Wolanski Library collection. The collection was originally part of the Sydney Opera House performing arts library. The collection is international in scope and focuses on the performing arts in Australia, 1789-1997. It consists of 1,600 archive boxes, containing press clippings, theatre programs, press releases, correspondence, and ephemera, and a card index of 80,000 entries.</p><p>"+
  //     "Collection access is managed by the Performance Memories Project, a partnership of UNSW Library, UNSW Theatre and Performance Studies, AusStage and the Wolanski Foundation. As part of project, we have now made available as downloads more than 160,000 records from the project site, including a subject list of research files and two converted card indexes, one covering the performing arts in general, one devoted to Australian drama. </p><div>",
  //   "type": "item",
  //   "layout": "item_right",
  //   "is_published": 1,
  //   "created": "2022-10-13T20:24:20.000Z"
  // },

  // /* image - source from storage */
  // {
  //   "uuid": "00726715-bdaa-4a6b-a6b0-4f6007b1b2ff",
  //   "is_member_of_exhibit": "00509704-bdaa-4a6b-a6b0-4f6007b1b2fe",
  //   "caption": "Item description",
  //   "item_type": "image", // wasabi storage? (local storage - dev)
  //   "url": "00509704-bdaa-4a6b-a6b0-4f6007b1b2fe.jpg",
  //   "text": "<div><p>In 2017 UNSW Sydney became the caretaker for the Dennis Wolanski Library collection. The collection was originally part of the Sydney Opera House performing arts library. The collection is international in scope and focuses on the performing arts in Australia, 1789-1997. It consists of 1,600 archive boxes, containing press clippings, theatre programs, press releases, correspondence, and ephemera, and a card index of 80,000 entries.</p><p>"+
  //     "Collection access is managed by the Performance Memories Project, a partnership of UNSW Library, UNSW Theatre and Performance Studies, AusStage and the Wolanski Foundation. As part of project, we have now made available as downloads more than 160,000 records from the project site, including a subject list of research files and two converted card indexes, one covering the performing arts in general, one devoted to Australian drama. </p><div>",
  //   "type": "item",
  //   "layout": "item_only",
  //   "text_overlay": "<h3>This is the text overlay</h3>",
  //   "css": "* {color:green}",
  //   "is_published": 1,
  //   "created": "2022-10-13T20:24:20.000Z"
  // },

  // /* audio - url source (construct <audio> element and add to page) */
  // {
  //   "uuid": "00726715-bdaa-4a6b-a6b0-4f6007b1b2ff",
  //   "is_member_of_exhibit": "00509704-bdaa-4a6b-a6b0-4f6007b1b2fe",
  //   "caption": "Item description",
  //   "item_type": "audio",  
  //   "url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", // 
  //   "text": "<div><p>In 2017 UNSW Sydney became the caretaker for the Dennis Wolanski Library collection. The collection was originally part of the Sydney Opera House performing arts library. The collection is international in scope and focuses on the performing arts in Australia, 1789-1997. It consists of 1,600 archive boxes, containing press clippings, theatre programs, press releases, correspondence, and ephemera, and a card index of 80,000 entries.</p><p>"+
  //     "Collection access is managed by the Performance Memories Project, a partnership of UNSW Library, UNSW Theatre and Performance Studies, AusStage and the Wolanski Foundation. As part of project, we have now made available as downloads more than 160,000 records from the project site, including a subject list of research files and two converted card indexes, one covering the performing arts in general, one devoted to Australian drama. </p><div>",
  //   "type": "item",
  //   "layout": "item_top",
  //   "is_published": 1,
  //   "created": "2022-10-13T20:24:20.000Z"
  // },

  // /* audio - embed code (embed the code directly on page) */
  // {
  //   "uuid": "00726715-bdaa-4a6b-a6b0-4f6007b1b2ff",
  //   "is_member_of_exhibit": "00509704-bdaa-4a6b-a6b0-4f6007b1b2fe",
  //   "caption": "Item description",
  //   "item_type": "audio",  
  //   "code": '<embed><audio controls="" autoplay="" src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" type="audio/mpeg" class="media-document audio mac"></audio></embed>', // sanitize html before storing
  //   "text": "<div><p>In 2017 UNSW Sydney became the caretaker for the Dennis Wolanski Library collection. The collection was originally part of the Sydney Opera House performing arts library. The collection is international in scope and focuses on the performing arts in Australia, 1789-1997. It consists of 1,600 archive boxes, containing press clippings, theatre programs, press releases, correspondence, and ephemera, and a card index of 80,000 entries.</p><p>"+
  //     "Collection access is managed by the Performance Memories Project, a partnership of UNSW Library, UNSW Theatre and Performance Studies, AusStage and the Wolanski Foundation. As part of project, we have now made available as downloads more than 160,000 records from the project site, including a subject list of research files and two converted card indexes, one covering the performing arts in general, one devoted to Australian drama. </p><div>",
  //   "type": "item",
  //   "layout": "item_only",
  //   "is_published": 1,
  //   "created": "2022-10-13T20:24:20.000Z"
  // },

  //   /* video - embed code (embed the code directly on page) */
  // {
  //   "uuid": "00726715-bdaa-4a6b-a6b0-4f6007b1b2ff",
  //   "is_member_of_exhibit": "00509704-bdaa-4a6b-a6b0-4f6007b1b2fe",
  //   "caption": "Video - code embed",
  //   "item_type": "video",  
  //   "code": '<embed><video></video></embed>', // sanitize html before storing *If 'code' is present, embed it directly
  //   "text": "<div><h4>UNSW Library</h4><p>In 2017 UNSW Sydney became the caretaker for the <a href='#'>Dennis Wolanski Library collection</a>. The collection was originally part of the Sydney Opera House performing arts library. The collection is international in scope and focuses on the performing arts in Australia, 1789-1997. It consists of 1,600 archive boxes, containing press clippings, theatre programs, press releases, correspondence, and ephemera, and a card index of 80,000 entries.</p><p>"+
  //     "Collection access is managed by the Performance Memories Project, a partnership of UNSW Library, UNSW Theatre and Performance Studies, AusStage and the Wolanski Foundation. As part of project, we have now made available as downloads more than 160,000 records from the project site, including a subject list of research files and two converted card indexes, one covering the performing arts in general, one devoted to Australian drama. </p><div>",
  //   "type": "item",
  //   "layout": "item_left",
  //   "is_published": 1,
  //   "created": "2022-10-13T20:24:20.000Z"
  // },
  
  // /* video - kaltura player (create player code locally) */
  // {
  //   "uuid": "00726715-bdaa-4a6b-a6b0-4f6007b1b2ff",
  //   "is_member_of_exhibit": "00509704-bdaa-4a6b-a6b0-4f6007b1b2fe",
  //   "caption": "Video - Kaltura",
  //   "item_type": "video",  // kaltura?
  //   "kaltura_id": "1_auwwemt0", // kaltura id (if present, will render kaltura player)
  //   "type": "item_right",
  //   "is_published": 1,
  //   "created": "2022-10-13T20:24:20.000Z"
  // },

  // /* pdf file - render pdf viewer on page, source from url */
  // {
  //   "uuid": "00726715-bdaa-4a6b-a6b0-4f6007b1b2ff",
  //   "is_member_of_exhibit": "00509704-bdaa-4a6b-a6b0-4f6007b1b2fe",
  //   "caption": "Pdf item",
  //   "item_type": "pdf",  
  //   "url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
  //   "text": "<div><p>In 2017 UNSW Sydney became the caretaker for the Dennis Wolanski Library collection. The collection was originally part of the Sydney Opera House performing arts library. The collection is international in scope and focuses on the performing arts in Australia, 1789-1997. It consists of 1,600 archive boxes, containing press clippings, theatre programs, press releases, correspondence, and ephemera, and a card index of 80,000 entries.</p><p>"+
  //     "Collection access is managed by the Performance Memories Project, a partnership of UNSW Library, UNSW Theatre and Performance Studies, AusStage and the Wolanski Foundation. As part of project, we have now made available as downloads more than 160,000 records from the project site, including a subject list of research files and two converted card indexes, one covering the performing arts in general, one devoted to Australian drama. </p><div>",
  //   "type": "item",
  //   "layout": "item_only",
  //   "is_published": 1,
  //   "created": "2022-10-13T20:24:20.000Z"
  // }
]