<?php
/**
 * Remove everything the plugin stored.
 *
 * Only the one option: the plugin never writes to post content, so there is
 * nothing else of ours on the site to clean up.
 *
 * @package pterodocs
 */

declare( strict_types = 1 );

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'pterodocs_settings' );

// Multisite: the option is per site, so each one has its own to remove.
if ( is_multisite() ) {
	$sites = get_sites( array( 'fields' => 'ids', 'number' => 0 ) );

	foreach ( $sites as $site_id ) {
		switch_to_blog( (int) $site_id );
		delete_option( 'pterodocs_settings' );
		restore_current_blog();
	}
}
