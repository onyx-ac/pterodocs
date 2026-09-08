<?php
/**
 * Plugin Name:       pterodoc
 * Plugin URI:        https://github.com/onyx-ac/pterodoc
 * Description:       Turns documentation published by pterodoc into a proper documentation experience: a collapsible sidebar, highlighted code with a copy button, scrolling tables and a full-width layout — all styled from your theme's own palette.
 * Version:           0.2.0
 * Requires at least: 6.5
 * Requires PHP:      8.0
 * Author:            Onyx
 * Author URI:        https://onyx.ac
 * License:           CC-BY-SA-4.0
 * License URI:       https://creativecommons.org/licenses/by-sa/4.0/
 * Text Domain:       pterodoc
 * Domain Path:       /languages
 *
 * @package pterodoc
 */

declare( strict_types = 1 );

namespace Pterodoc;

defined( 'ABSPATH' ) || exit;

const VERSION = '0.2.0';

define( 'PTERODOC_FILE', __FILE__ );
define( 'PTERODOC_DIR', plugin_dir_path( __FILE__ ) );
define( 'PTERODOC_URL', plugin_dir_url( __FILE__ ) );

require_once PTERODOC_DIR . 'inc/Settings.php';
require_once PTERODOC_DIR . 'inc/Markup.php';
require_once PTERODOC_DIR . 'inc/Prism.php';
require_once PTERODOC_DIR . 'inc/Assets.php';
require_once PTERODOC_DIR . 'inc/Render.php';

/**
 * Wire the plugin up.
 *
 * Everything this plugin does is additive: it registers no block types and
 * rewrites no stored content. Deactivate it and the pages it was styling are
 * still readable, because the markup underneath is ordinary core blocks.
 */
function bootstrap(): void {
	Settings::init();
	Assets::init();
	Render::init();

	add_action(
		'init',
		static function (): void {
			load_plugin_textdomain( 'pterodoc', false, dirname( plugin_basename( PTERODOC_FILE ) ) . '/languages' );
		}
	);
}

bootstrap();
