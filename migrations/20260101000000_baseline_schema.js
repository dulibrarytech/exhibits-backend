/**
 * Baseline schema migration.
 *
 * Captures the schema as it existed in db/exhibitsv2-2026-04-30.txt — the
 * deployed pre-migration state. On environments that already have this schema,
 * insert a row into knex_migrations marking this baseline as applied so that
 * `migrate:latest` skips it and runs only newer migrations on top.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {

  // Existing / dump-based databases already have this schema. Detect that and
  // record the baseline as applied WITHOUT recreating anything, so
  // `migrate:latest` proceeds to the newer migrations instead of failing with
  // "table already exists". This implements, in code, the "mark as applied"
  // note above so operators don't have to hand-edit knex_migrations. Fresh
  // databases (no core table) fall through and the full schema is created below.
  if (await knex.schema.hasTable('tbl_exhibits')) {
    return;
  }

  await knex.schema.raw(`
    CREATE TABLE \`ctbl_role_permissions\` (
      \`id\` int(11) NOT NULL AUTO_INCREMENT,
      \`role_id\` int(11) DEFAULT NULL,
      \`permission_id\` int(11) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`role_id_index\` (\`role_id\`) USING BTREE,
      KEY \`permission_id_index\` (\`permission_id\`) USING BTREE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);

  await knex.schema.raw(`
    CREATE TABLE \`ctbl_user_roles\` (
      \`id\` int(11) NOT NULL AUTO_INCREMENT,
      \`user_id\` int(11) DEFAULT NULL,
      \`role_id\` int(11) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`user_id_index\` (\`user_id\`) USING BTREE,
      KEY \`role_id_index\` (\`role_id\`) USING BTREE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);

  await knex.schema.raw(`
    CREATE TABLE \`tbl_exhibit_media\` (
      \`id\` int(11) unsigned NOT NULL AUTO_INCREMENT,
      \`exhibit_uuid\` varchar(255) NOT NULL,
      \`media_uuid\` varchar(255) NOT NULL,
      \`media_role\` varchar(50) NOT NULL COMMENT 'hero_image | thumbnail',
      \`is_deleted\` tinyint(1) NOT NULL DEFAULT 0,
      \`created\` timestamp NOT NULL DEFAULT current_timestamp(),
      \`updated\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      \`created_by\` varchar(255) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`exhibit_role_unique\` (\`exhibit_uuid\`,\`media_role\`,\`is_deleted\`),
      KEY \`exhibit_uuid_index\` (\`exhibit_uuid\`) USING BTREE,
      KEY \`media_uuid_index\` (\`media_uuid\`) USING BTREE,
      KEY \`media_role_index\` (\`media_role\`) USING BTREE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;
  `);

  await knex.schema.raw(`
    CREATE TABLE \`tbl_exhibits\` (
      \`id\` int(11) unsigned NOT NULL AUTO_INCREMENT,
      \`uuid\` varchar(255) NOT NULL DEFAULT '',
      \`type\` varchar(10) NOT NULL DEFAULT 'exhibit',
      \`title\` longtext NOT NULL COMMENT '{string | html} title for exhibit banner (R) ',
      \`subtitle\` longtext DEFAULT NULL COMMENT '{string | html} (default: null, no subtitle displayed)',
      \`banner_template\` varchar(100) DEFAULT 'banner_1' COMMENT '{''banner_1'' | ''banner_2''} (default: banner_1) ',
      \`about_the_curators\` longtext DEFAULT NULL COMMENT '{text | html} content for the "About the Curators" page ',
      \`alert_text\` longtext DEFAULT NULL COMMENT '{string | html} alert banner displayed below hero section (default: null, alert banner not displayed)',
      \`hero_image_media_uuid\` varchar(255) DEFAULT NULL,
      \`thumbnail_media_uuid\` varchar(255) DEFAULT NULL,
      \`hero_image\` varchar(255) DEFAULT NULL COMMENT '{filename.extension} filename or path to file (default: null, hero image not displayed. image section will be displayed with a gray background if the banner template has a hero image section)',
      \`thumbnail\` varchar(255) DEFAULT NULL COMMENT '{filename.extension} filename. exhibit thumbnail image. (default: null, thumbnail image will be derived from the ''hero_image'' if present.)',
      \`description\` longtext DEFAULT NULL COMMENT '{string | html} the exhibit banner text',
      \`page_layout\` varchar(50) NOT NULL DEFAULT 'top_nav' COMMENT '{''top_nav'', ''side_nav} (default: top_nav)',
      \`exhibit_template\` varchar(50) NOT NULL DEFAULT 'vertical_scroll' COMMENT '{''vertical_scroll'' | ''item_centered''} (R)',
      \`exhibit_subjects\` longtext DEFAULT NULL,
      \`styles\` longtext DEFAULT NULL COMMENT 'JSON String',
      \`order\` int(11) DEFAULT 0,
      \`is_student_curated\` tinyint(1) NOT NULL DEFAULT 0,
      \`is_published\` tinyint(1) NOT NULL DEFAULT 0 COMMENT '{0,1} (default: 0)',
      \`is_featured\` tinyint(1) DEFAULT 0 COMMENT '{0,1) if 1, will appear in featured exhibits display (default: 0)',
      \`is_embedded\` tinyint(1) NOT NULL DEFAULT 0,
      \`is_preview\` tinyint(1) NOT NULL DEFAULT 0,
      \`is_locked\` tinyint(1) NOT NULL DEFAULT 0,
      \`locked_by_user\` int(11) DEFAULT 0,
      \`locked_at\` timestamp NULL DEFAULT NULL,
      \`is_deleted\` tinyint(1) NOT NULL DEFAULT 0,
      \`is_indexed\` tinyint(1) NOT NULL DEFAULT 0,
      \`owner\` int(11) NOT NULL DEFAULT 0,
      \`created\` timestamp NOT NULL DEFAULT current_timestamp(),
      \`updated\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      \`created_by\` varchar(255) DEFAULT NULL,
      \`updated_by\` varchar(255) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`uuid_index\` (\`uuid\`),
      KEY \`is_published_index\` (\`is_published\`),
      KEY \`is_deleted_index\` (\`is_deleted\`) USING BTREE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;
  `);

  await knex.schema.raw(`
    CREATE TABLE \`tbl_grid_items\` (
      \`id\` int(11) unsigned NOT NULL AUTO_INCREMENT,
      \`uuid\` varchar(255) NOT NULL DEFAULT '',
      \`is_member_of_grid\` varchar(255) NOT NULL DEFAULT '',
      \`is_member_of_exhibit\` varchar(255) NOT NULL,
      \`repo_uuid\` varchar(255) DEFAULT NULL,
      \`thumbnail\` varchar(255) DEFAULT NULL,
      \`thumbnail_media_uuid\` varchar(255) DEFAULT NULL,
      \`title\` longtext NOT NULL,
      \`caption\` text DEFAULT NULL,
      \`item_type\` varchar(50) NOT NULL DEFAULT 'image',
      \`mime_type\` varchar(100) DEFAULT NULL,
      \`media\` varchar(255) DEFAULT NULL,
      \`media_uuid\` varchar(255) DEFAULT NULL,
      \`text\` longtext DEFAULT NULL,
      \`wrap_text\` tinyint(1) NOT NULL DEFAULT 1,
      \`description\` longtext DEFAULT NULL,
      \`type\` varchar(100) NOT NULL DEFAULT 'item',
      \`layout\` varchar(100) NOT NULL DEFAULT 'media_top',
      \`media_width\` int(11) NOT NULL DEFAULT 50,
      \`media_padding\` tinyint(1) NOT NULL DEFAULT 1,
      \`alt_text\` varchar(255) DEFAULT NULL,
      \`is_alt_text_decorative\` tinyint(1) DEFAULT 0,
      \`pdf_open_to_page\` int(11) NOT NULL DEFAULT 1,
      \`item_subjects\` longtext DEFAULT NULL,
      \`styles\` longtext DEFAULT NULL,
      \`order\` int(11) NOT NULL DEFAULT 0,
      \`is_repo_item\` tinyint(1) NOT NULL DEFAULT 0,
      \`is_kaltura_item\` tinyint(1) NOT NULL DEFAULT 0,
      \`is_embedded\` tinyint(1) NOT NULL DEFAULT 0,
      \`is_published\` tinyint(1) NOT NULL DEFAULT 0,
      \`is_locked\` tinyint(1) NOT NULL DEFAULT 0,
      \`locked_by_user\` int(11) DEFAULT 0,
      \`locked_at\` timestamp NULL DEFAULT NULL,
      \`is_deleted\` tinyint(1) NOT NULL DEFAULT 0,
      \`owner\` int(11) NOT NULL DEFAULT 0,
      \`created\` timestamp NOT NULL DEFAULT current_timestamp(),
      \`updated\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      \`created_by\` varchar(255) DEFAULT NULL,
      \`updated_by\` varchar(255) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uuid_index\` (\`uuid\`) USING BTREE,
      KEY \`is_member_of_grid_index\` (\`is_member_of_grid\`) USING BTREE,
      KEY \`is_member_of_exhibit_index\` (\`is_member_of_exhibit\`) USING BTREE,
      KEY \`is_published_index\` (\`is_published\`) USING BTREE,
      KEY \`is_deleted_index\` (\`is_deleted\`) USING BTREE,
      KEY \`media_uuid_index\` (\`media_uuid\`) USING BTREE,
      KEY \`thumbnail_media_uuid_index\` (\`thumbnail_media_uuid\`) USING BTREE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;
  `);

  await knex.schema.raw(`
    CREATE TABLE \`tbl_grids\` (
      \`id\` int(11) unsigned NOT NULL AUTO_INCREMENT,
      \`uuid\` varchar(255) NOT NULL DEFAULT '',
      \`is_member_of_exhibit\` varchar(255) NOT NULL DEFAULT '',
      \`type\` varchar(100) NOT NULL DEFAULT 'grid',
      \`columns\` int(11) NOT NULL DEFAULT 4,
      \`title\` longtext DEFAULT NULL,
      \`text\` longtext DEFAULT NULL,
      \`styles\` longtext DEFAULT NULL,
      \`order\` int(11) NOT NULL DEFAULT 0,
      \`is_deleted\` tinyint(1) NOT NULL DEFAULT 0,
      \`is_published\` tinyint(1) NOT NULL DEFAULT 0,
      \`created\` timestamp NOT NULL DEFAULT current_timestamp(),
      \`updated\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      \`owner\` int(11) NOT NULL DEFAULT 0,
      \`created_by\` varchar(255) DEFAULT NULL,
      \`updated_by\` varchar(255) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uuid_index\` (\`uuid\`) USING BTREE,
      KEY \`is_member_of_exhibit_index\` (\`is_member_of_exhibit\`) USING BTREE,
      KEY \`is_deleted_index\` (\`is_deleted\`) USING BTREE,
      KEY \`is_published_index\` (\`is_published\`) USING BTREE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;
  `);

  await knex.schema.raw(`
    CREATE TABLE \`tbl_heading_items\` (
      \`id\` int(11) unsigned NOT NULL AUTO_INCREMENT,
      \`is_member_of_exhibit\` varchar(255) NOT NULL DEFAULT '',
      \`uuid\` varchar(255) NOT NULL DEFAULT '',
      \`type\` varchar(10) NOT NULL DEFAULT 'heading',
      \`text\` longtext NOT NULL,
      \`order\` int(11) NOT NULL DEFAULT 0,
      \`styles\` longtext DEFAULT NULL,
      \`is_visible\` tinyint(1) NOT NULL DEFAULT 1,
      \`is_anchor\` tinyint(1) NOT NULL DEFAULT 1,
      \`is_published\` tinyint(1) NOT NULL DEFAULT 0,
      \`is_locked\` tinyint(1) NOT NULL DEFAULT 0,
      \`locked_by_user\` int(11) DEFAULT 0,
      \`locked_at\` timestamp NULL DEFAULT NULL,
      \`is_indexed\` tinyint(1) NOT NULL DEFAULT 0,
      \`is_deleted\` tinyint(1) NOT NULL DEFAULT 0,
      \`owner\` int(11) NOT NULL DEFAULT 0,
      \`created\` timestamp NOT NULL DEFAULT current_timestamp(),
      \`updated\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      \`created_by\` varchar(255) DEFAULT NULL,
      \`updated_by\` varchar(255) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uuid_index\` (\`uuid\`) USING BTREE,
      KEY \`is_member_of_exhibit_index\` (\`is_member_of_exhibit\`) USING BTREE,
      KEY \`is_published_index\` (\`is_published\`) USING BTREE,
      KEY \`is_deleted_index\` (\`is_deleted\`) USING BTREE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;
  `);

  await knex.schema.raw(`
    CREATE TABLE \`tbl_media_library\` (
      \`id\` int(11) unsigned NOT NULL AUTO_INCREMENT,
      \`uuid\` varchar(255) NOT NULL DEFAULT '',
      \`name\` varchar(255) NOT NULL,
      \`description\` text DEFAULT NULL,
      \`alt_text\` varchar(255) DEFAULT NULL,
      \`is_alt_text_decorative\` tinyint(1) DEFAULT 0,
      \`topics_subjects\` longtext DEFAULT NULL,
      \`genre_form_subjects\` longtext DEFAULT NULL,
      \`places_subjects\` longtext DEFAULT NULL,
      \`media_type\` varchar(50) NOT NULL,
      \`mime_type\` varchar(100) DEFAULT NULL,
      \`item_type\` varchar(255) DEFAULT NULL,
      \`call_number\` varchar(255) DEFAULT NULL,
      \`filename\` varchar(255) DEFAULT NULL,
      \`original_filename\` varchar(500) NOT NULL DEFAULT '',
      \`ingest_method\` varchar(255) NOT NULL,
      \`repo_uuid\` varchar(255) DEFAULT NULL,
      \`repo_handle\` varchar(255) DEFAULT NULL,
      \`kaltura_entry_id\` varchar(100) DEFAULT NULL COMMENT 'Kaltura entry id',
      \`kaltura_thumbnail_url\` varchar(255) DEFAULT NULL COMMENT 'Kaltura full thumbnail URL',
      \`exhibits\` longtext DEFAULT NULL,
      \`size\` bigint(20) DEFAULT NULL,
      \`storage_path\` varchar(500) DEFAULT NULL,
      \`thumbnail_path\` varchar(255) DEFAULT NULL,
      \`exif_data\` longtext DEFAULT NULL,
      \`media_width\` int(10) unsigned DEFAULT NULL COMMENT 'Image/video pixel width for IIIF canvas',
      \`media_height\` int(10) unsigned DEFAULT NULL COMMENT 'Image/video pixel height for IIIF canvas',
      \`media_duration\` decimal(10,3) DEFAULT NULL,
      \`iiif_manifest\` longtext DEFAULT NULL,
      \`is_deleted\` tinyint(1) NOT NULL DEFAULT 0,
      \`owner\` int(11) NOT NULL DEFAULT 0,
      \`created\` timestamp NOT NULL DEFAULT current_timestamp(),
      \`updated\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      \`created_by\` varchar(255) DEFAULT NULL,
      \`updated_by\` varchar(255) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uuid_index\` (\`uuid\`) USING BTREE,
      KEY \`is_deleted_index\` (\`is_deleted\`) USING BTREE,
      KEY \`original_filename_index\` (\`original_filename\`) USING BTREE,
      KEY \`ingest_method_index\` (\`ingest_method\`) USING BTREE,
      KEY \`kaltura_entry_id_index\` (\`kaltura_entry_id\`) USING BTREE,
      KEY \`repo_uuid_index\` (\`repo_uuid\`) USING BTREE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;
  `);

  await knex.schema.raw(`
    CREATE TABLE \`tbl_standard_items\` (
      \`id\` int(11) unsigned NOT NULL AUTO_INCREMENT,
      \`uuid\` varchar(255) NOT NULL DEFAULT '',
      \`is_member_of_exhibit\` varchar(255) NOT NULL DEFAULT '',
      \`thumbnail\` varchar(255) DEFAULT NULL,
      \`thumbnail_media_uuid\` varchar(255) DEFAULT NULL,
      \`title\` longtext NOT NULL,
      \`caption\` text DEFAULT NULL,
      \`item_type\` varchar(100) NOT NULL DEFAULT '',
      \`mime_type\` varchar(100) DEFAULT NULL,
      \`media\` varchar(255) DEFAULT NULL,
      \`media_uuid\` varchar(255) DEFAULT NULL,
      \`text\` longtext DEFAULT NULL,
      \`wrap_text\` tinyint(1) NOT NULL DEFAULT 1,
      \`description\` longtext DEFAULT NULL,
      \`type\` varchar(50) NOT NULL DEFAULT 'item',
      \`layout\` varchar(255) DEFAULT 'media_right',
      \`media_width\` int(11) DEFAULT 50,
      \`media_padding\` tinyint(1) NOT NULL DEFAULT 1,
      \`alt_text\` varchar(255) DEFAULT NULL,
      \`is_alt_text_decorative\` tinyint(1) DEFAULT 0,
      \`pdf_open_to_page\` int(11) NOT NULL DEFAULT 1,
      \`item_subjects\` longtext DEFAULT NULL,
      \`styles\` longtext DEFAULT NULL,
      \`order\` int(11) NOT NULL DEFAULT 0,
      \`is_repo_item\` tinyint(1) NOT NULL DEFAULT 0,
      \`is_kaltura_item\` tinyint(1) NOT NULL DEFAULT 0,
      \`is_embedded\` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'for audio and video',
      \`is_published\` tinyint(1) NOT NULL DEFAULT 0,
      \`is_locked\` tinyint(1) NOT NULL DEFAULT 0,
      \`locked_by_user\` int(11) DEFAULT 0,
      \`locked_at\` timestamp NULL DEFAULT NULL,
      \`is_deleted\` tinyint(1) NOT NULL DEFAULT 0,
      \`owner\` int(11) NOT NULL DEFAULT 0,
      \`created\` timestamp NOT NULL DEFAULT current_timestamp(),
      \`updated\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      \`created_by\` varchar(255) DEFAULT NULL,
      \`updated_by\` varchar(255) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uuid_index\` (\`uuid\`) USING BTREE,
      KEY \`is_member_of_exhibit_index\` (\`is_member_of_exhibit\`) USING BTREE,
      KEY \`is_published_index\` (\`is_published\`) USING BTREE,
      KEY \`is_deleted_index\` (\`is_deleted\`) USING BTREE,
      KEY \`media_uuid_index\` (\`media_uuid\`) USING BTREE,
      KEY \`thumbnail_media_uuid_index\` (\`thumbnail_media_uuid\`) USING BTREE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;
  `);

  await knex.schema.raw(`
    CREATE TABLE \`tbl_timeline_items\` (
      \`id\` int(11) unsigned NOT NULL AUTO_INCREMENT,
      \`uuid\` varchar(255) NOT NULL DEFAULT '',
      \`is_member_of_timeline\` varchar(255) NOT NULL DEFAULT '',
      \`is_member_of_exhibit\` varchar(255) NOT NULL,
      \`repo_uuid\` varchar(255) DEFAULT NULL,
      \`thumbnail\` varchar(255) DEFAULT NULL,
      \`thumbnail_media_uuid\` varchar(255) DEFAULT NULL,
      \`title\` longtext NOT NULL,
      \`caption\` text DEFAULT NULL,
      \`item_type\` varchar(50) NOT NULL DEFAULT 'image',
      \`mime_type\` varchar(100) DEFAULT NULL,
      \`media\` varchar(255) DEFAULT NULL,
      \`media_uuid\` varchar(255) DEFAULT NULL,
      \`text\` longtext DEFAULT NULL,
      \`wrap_text\` tinyint(1) NOT NULL DEFAULT 1,
      \`description\` longtext DEFAULT NULL,
      \`type\` varchar(100) NOT NULL DEFAULT 'item',
      \`layout\` varchar(100) NOT NULL DEFAULT 'media_top',
      \`media_width\` int(11) NOT NULL DEFAULT 50,
      \`media_padding\` tinyint(1) NOT NULL DEFAULT 1,
      \`alt_text\` varchar(255) DEFAULT NULL,
      \`is_alt_text_decorative\` tinyint(1) DEFAULT 0,
      \`pdf_open_to_page\` int(11) NOT NULL DEFAULT 1,
      \`item_subjects\` longtext DEFAULT NULL,
      \`styles\` longtext DEFAULT NULL,
      \`order\` int(11) NOT NULL DEFAULT 0,
      \`date\` varchar(255) DEFAULT NULL COMMENT 'vertical timeline (year-month-day)',
      \`is_repo_item\` tinyint(1) NOT NULL DEFAULT 0,
      \`is_kaltura_item\` tinyint(1) NOT NULL DEFAULT 0,
      \`is_embedded\` tinyint(1) NOT NULL DEFAULT 0,
      \`is_published\` tinyint(1) NOT NULL DEFAULT 0,
      \`is_locked\` tinyint(1) NOT NULL DEFAULT 0,
      \`locked_by_user\` int(11) DEFAULT 0,
      \`locked_at\` timestamp NULL DEFAULT NULL,
      \`is_deleted\` tinyint(1) NOT NULL DEFAULT 0,
      \`owner\` int(11) NOT NULL DEFAULT 0,
      \`created\` timestamp NOT NULL DEFAULT current_timestamp(),
      \`updated\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      \`created_by\` varchar(255) DEFAULT NULL,
      \`updated_by\` varchar(255) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uuid_index\` (\`uuid\`) USING BTREE,
      KEY \`is_member_of_timeline_index\` (\`is_member_of_timeline\`) USING BTREE,
      KEY \`is_member_of_exhibit_index\` (\`is_member_of_exhibit\`) USING BTREE,
      KEY \`is_published_index\` (\`is_published\`) USING BTREE,
      KEY \`is_deleted_index\` (\`is_deleted\`) USING BTREE,
      KEY \`media_uuid_index\` (\`media_uuid\`) USING BTREE,
      KEY \`thumbnail_media_uuid_index\` (\`thumbnail_media_uuid\`) USING BTREE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;
  `);

  await knex.schema.raw(`
    CREATE TABLE \`tbl_timelines\` (
      \`id\` int(11) unsigned NOT NULL AUTO_INCREMENT,
      \`uuid\` varchar(255) NOT NULL DEFAULT '',
      \`is_member_of_exhibit\` varchar(255) NOT NULL DEFAULT '',
      \`type\` varchar(100) NOT NULL DEFAULT 'vertical_timeline',
      \`title\` longtext NOT NULL,
      \`text\` longtext DEFAULT NULL,
      \`styles\` longtext DEFAULT NULL,
      \`order\` int(11) NOT NULL DEFAULT 0,
      \`is_deleted\` tinyint(1) NOT NULL DEFAULT 0,
      \`is_published\` tinyint(1) NOT NULL DEFAULT 0,
      \`created\` timestamp NOT NULL DEFAULT current_timestamp(),
      \`updated\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      \`owner\` int(11) NOT NULL DEFAULT 0,
      \`created_by\` varchar(255) DEFAULT NULL,
      \`updated_by\` varchar(255) DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uuid_index\` (\`uuid\`) USING BTREE,
      KEY \`is_member_of_exhibit_index\` (\`is_member_of_exhibit\`) USING BTREE,
      KEY \`is_deleted_index\` (\`is_deleted\`) USING BTREE,
      KEY \`is_published_index\` (\`is_published\`) USING BTREE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;
  `);

  await knex.schema.raw(`
    CREATE TABLE \`tbl_user_permissions\` (
      \`id\` int(11) NOT NULL AUTO_INCREMENT,
      \`permission\` varchar(255) NOT NULL,
      \`description\` text NOT NULL,
      \`has_permission\` varchar(255) NOT NULL,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);

  await knex.schema.raw(`
    CREATE TABLE \`tbl_user_roles\` (
      \`id\` int(11) NOT NULL AUTO_INCREMENT,
      \`role\` varchar(255) NOT NULL DEFAULT 'admin',
      \`description\` text DEFAULT NULL,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);

  await knex.schema.raw(`
    CREATE TABLE \`tbl_users\` (
      \`id\` int(11) unsigned NOT NULL AUTO_INCREMENT,
      \`du_id\` varchar(50) NOT NULL DEFAULT '',
      \`email\` varchar(100) NOT NULL DEFAULT '',
      \`first_name\` varchar(255) NOT NULL DEFAULT '',
      \`last_name\` varchar(255) NOT NULL DEFAULT '',
      \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
      \`token\` varchar(500) DEFAULT NULL,
      \`created\` timestamp NULL DEFAULT current_timestamp(),
      \`last_login\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`du_id_index\` (\`du_id\`) USING BTREE,
      UNIQUE KEY \`email_index\` (\`email\`) USING BTREE,
      UNIQUE KEY \`token_index\` (\`token\`) USING BTREE,
      KEY \`is_active_index\` (\`is_active\`) USING BTREE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const tables = [
    'tbl_users',
    'tbl_user_roles',
    'tbl_user_permissions',
    'tbl_timelines',
    'tbl_timeline_items',
    'tbl_standard_items',
    'tbl_media_library',
    'tbl_heading_items',
    'tbl_grids',
    'tbl_grid_items',
    'tbl_exhibits',
    'tbl_exhibit_media',
    'ctbl_user_roles',
    'ctbl_role_permissions',
  ];

  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
};
