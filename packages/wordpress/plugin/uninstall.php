<?php
/**
 * Remove everything the plugin stored.
 *
 * The option, the bookkeeping for the rewrite rules, and the llms.txt held on
 * each documentation root. The plugin never writes to post content, so there
 * is nothing else of ours on the site to clean up.
 *
 * @package pterodocs
 */

declare( strict_types = 1 );

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

pterodocs_uninstall_site();

/**
 * Remove this site's data.
 */
function pterodocs_uninstall_site() {
	delete_option( 'pterodocs_settings' );
	delete_option( 'pterodocs_llms_rules' );
	delete_transient( 'pterodocs_llms_roots' );

	delete_post_meta_by_key( '_pterodocs_llms_index' );
	delete_post_meta_by_key( '_pterodocs_llms_full' );
}

// Multisite: the option is per site, so each one has its own to remove.
if ( is_multisite() ) {
	$sites = get_sites( array( 'fields' => 'ids', 'number' => 0 ) );

	foreach ( $sites as $site_id ) {
		switch_to_blog( (int) $site_id );
		pterodocs_uninstall_site();
		restore_current_blog();
	}
}
