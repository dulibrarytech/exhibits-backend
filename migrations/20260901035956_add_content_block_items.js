exports.up = function(knex) {
  return knex.schema.createTableLike('tbl_content_block_items', 'tbl_timelines', (table) => {
    table.string('size');
    table.string('url');
    table.string('attribution');
    table.string('content_type');
    table.boolean('transparent');
    table.boolean('is_locked');
    table.boolean('is_visible');
    table.integer('locked_by_user');
  }).then(() => knex.schema.alterTable('tbl_content_block_items', (table) => {
    table.string('type').defaultTo().alter();
    table.dropColumn('text_alignment');
    table.dropColumn('margins');
    table.dropColumn('internal_name');
  }));
};

exports.down = function(knex) {
  return knex.schema.dropTable('tbl_content_block_items');
};
