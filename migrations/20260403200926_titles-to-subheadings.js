/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('tbl_timelines', table => {
    table.text('title').nullable().alter();
  }).then(async () => {
    const exhibits = await knex('tbl_exhibits').select('uuid').timeout(10000);

    for (const exhibit of exhibits) {
      // find items for exhibit
      const tables = ['tbl_heading_items', 'tbl_standard_items', 'tbl_grids', 'tbl_timelines'];
      const [headings, items, grids, timelines] = await Promise.all(
        tables.map(async table =>
          await knex(table).select('*').where({
            is_member_of_exhibit: exhibit.uuid,
            is_deleted: 0
          }).timeout(10000)
        )
      );
      let exhibitItems = [...headings, ...items, ...grids, ...timelines];
      const hasTitles = exhibitItems.filter(item => item.title);
      let newHeadings = [];
      const now = new Date();

      hasTitles.forEach(titledItem => {
        newHeadings.push({
          uuid: crypto.randomUUID(),
          text: titledItem.title,
          order: titledItem.order,
          is_member_of_exhibit: titledItem.is_member_of_exhibit,
          type: 'subheading',
         	styles: JSON.stringify({
            backgroundColor: "",
            color: "",
            fontFamily: "",
            fontSize: ""
          }),
          created: now,
          updated: now,
          created_by: titledItem.created_by,
          updated_by: titledItem.updated_by,
        })
      });

      if (hasTitles.length > 0) {
        for (const titledItem of hasTitles) {
          // shift current and subsequent items          
          exhibitItems = exhibitItems.map(item => ({
            ...item,
            order: Number(item.order) >= Number(titledItem.order)
              ? Number(item.order) + 1
              : item.order
          }));

          newHeadings = newHeadings.map(heading => ({
            ...heading,
            order: Number(heading.order) > Number(titledItem.order)
              ? Number(heading.order) + 1
              : heading.order
          }))
        }

        await knex('tbl_heading_items').insert(newHeadings);
        await Promise.all(exhibitItems.map(item => {
          let itemTable;
          switch (item.type) {
            case 'grid':
              itemTable = 'tbl_grids';
              break;
            case 'timeline':
            case 'vertical_timeline':
              itemTable = 'tbl_timelines';
              break;
            case 'heading':
            case 'subheading':
              itemTable = 'tbl_heading_items';
              break;
            default:
              itemTable = 'tbl_standard_items';
          }

          return knex(itemTable)
            .update({ order: item.order })
            .where('uuid', item.uuid)
        }));
      }
    }
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('tbl_timelines', table => {
    table.text('title').nullable().alter();
  });
};
