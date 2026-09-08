<?php
/**
 * Loading the stylesheet and the scripts, and only where they are wanted.
 *
 * The decision is made at `wp_enqueue_scripts` from the queried post's stored
 * content, rather than during rendering: a style enqueued while the content
 * filter is running has already missed `wp_head`, and the page flashes
 * unstyled before it arrives.
 *
 * @package pterodoc
 */

declare( strict_types = 1 );

namespace Pterodoc;

defined( 'ABSPATH' ) || exit;

/**
 * Conditional asset loading.
 */
final class Assets {

	/**
	 * Memoised answer for this request.
	 *
	 * @var bool|null
	 */
	private static ?bool $should_load = null;

	/**
	 * Register the hooks.
	 */
	public static function init(): void {
		add_action( 'wp_enqueue_scripts', array( self::class, 'enqueue' ) );
		add_action( 'enqueue_block_editor_assets', array( self::class, 'editor' ) );
	}

	/**
	 * The content of the post being displayed, if there is one.
	 */
	private static function content(): string {
		if ( is_admin() || ! is_singular() ) {
			return '';
		}

		$post = get_post();

		return $post instanceof \WP_Post ? (string) $post->post_content : '';
	}

	/**
	 * Whether this request is showing a page pterodoc published.
	 *
	 * Documentation is recognised by the class pterodoc puts on the layout it
	 * generates. Nothing loads anywhere else on the site.
	 */
	public static function should_load(): bool {
		if ( null !== self::$should_load ) {
			return self::$should_load;
		}

		$content = self::content();

		if ( '' === $content ) {
			self::$should_load = false;

			return false;
		}

		$prefix = Settings::get( 'classPrefix' );
		$prefix = is_string( $prefix ) && '' !== $prefix ? $prefix : 'pterodoc';

		self::$should_load = str_contains( $content, $prefix . '-docs' );

		return self::$should_load;
	}

	/**
	 * Load the front-end assets.
	 */
	public static function enqueue(): void {
		if ( ! self::should_load() ) {
			return;
		}

		wp_enqueue_style( 'pterodoc', PTERODOC_URL . 'assets/css/docs.css', array(), VERSION );
		wp_add_inline_style( 'pterodoc', self::custom_properties() );

		wp_enqueue_script( 'pterodoc', PTERODOC_URL . 'assets/js/docs.js', array(), VERSION, true );
		wp_set_script_translations( 'pterodoc', 'pterodoc', PTERODOC_DIR . 'languages' );

		Prism::enqueue( self::content() );
	}

	/**
	 * The settings, as custom properties.
	 *
	 * Only what the settings page controls is written here. Everything else is
	 * defined in the stylesheet in terms of the theme's own global-styles
	 * variables, so a theme's palette and spacing scale reach the documentation
	 * without passing through this plugin at all.
	 */
	private static function custom_properties(): string {
		$settings = Settings::all();

		$declarations = array();

		$gutter = Markup::length( $settings['gutter'] ?? '', '' );
		if ( '' !== $gutter ) {
			$declarations[] = '--pd-gutter:' . $gutter;
		}

		$measure = Markup::length( $settings['measure'] ?? '', '' );
		if ( '' !== $measure ) {
			$declarations[] = '--pd-measure:' . $measure;
		}

		if ( 'none' === ( $settings['sidebarAnimation'] ?? '' ) ) {
			$declarations[] = '--pd-motion:0ms';
		}

		if ( array() === $declarations ) {
			return '';
		}

		return ':root{' . implode( ';', $declarations ) . ';}';
	}

	/**
	 * Extend the core blocks pterodoc uses with the plugin's own settings.
	 *
	 * No block type is registered: this adds attributes and an inspector panel
	 * to blocks WordPress already has, which is what keeps the stored content
	 * ordinary core markup.
	 */
	public static function editor(): void {
		wp_enqueue_script(
			'pterodoc-editor',
			PTERODOC_URL . 'assets/js/editor.js',
			array( 'wp-blocks', 'wp-hooks', 'wp-element', 'wp-components', 'wp-block-editor', 'wp-compose', 'wp-core-data', 'wp-i18n' ),
			VERSION,
			true
		);
		wp_set_script_translations( 'pterodoc-editor', 'pterodoc', PTERODOC_DIR . 'languages' );

		wp_enqueue_style( 'pterodoc-editor', PTERODOC_URL . 'assets/css/editor.css', array(), VERSION );
	}
}
