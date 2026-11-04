exports.up = async function(knex) {
  const has_title = await knex.schema.hasColumn('tbl_content_block_items', 'title');

  if (!has_title) {
    await knex.schema.alterTable('tbl_content_block_items', (table) => {
      table.text('title', 'longtext');
    });
  }
};

exports.down = async function(knex) {
  const has_title = await knex.schema.hasColumn('tbl_content_block_items', 'title');

  if (has_title) {
    await knex.schema.alterTable('tbl_content_block_items', (table) => {
      table.dropColumn('title');
    });
  }
};
