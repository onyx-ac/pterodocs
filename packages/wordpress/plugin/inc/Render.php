<?php
/**
 * What the plugin does to the markup pterodocs wrote.
 *
 * Every filter here is additive. It adds classes, attributes and wrappers; it
 * never restructures a block and never rewrites stored content. Turn the plugin
 * off and the pages are the ordinary core blocks they always were.
 *
 * @package pterodocs
 */

declare( strict_types = 1 );

namespace Pterodocs;

defined( 'ABSPATH' ) || exit;

/**
 * The render_block filters.
 */
final class Render {

	/**
	 * Register the filters.
	 */
	public static function init(): void {
		add_filter( 'render_block', array( self::class, 'filter' ), 10, 2 );
		add_action( 'init', array( self::class, 'block_styles' ) );
	}

	/**
	 * Offer the scrolling table as a block style, so it can be turned on or off
	 * for one table from the editor's Styles panel.
	 */
	public static function block_styles(): void {
		register_block_style(
			'core/table',
			array(
				'name'  => 'pterodocs-scroll',
				'label' => __( 'Scrolls sideways', 'pterodocs' ),
			)
		);
	}

	/**
	 * The class prefix pterodocs was configured with.
	 */
	private static function prefix(): string {
		$prefix = Settings::get( 'classPrefix' );

		return is_string( $prefix ) && '' !== $prefix ? $prefix : 'pterodocs';
	}

	/**
	 * Dispatch one rendered block.
	 *
	 * @param string               $content The rendered block.
	 * @param array<string, mixed> $block   The parsed block.
	 * @return string The rewritten block.
	 */
	public static function filter( string $content, array $block ): string {
		if ( is_admin() || '' === trim( $content ) ) {
			return $content;
		}
		if ( ! Assets::should_load() ) {
			return $content;
		}

		$name   = $block['blockName'] ?? '';
		$prefix = self::prefix();

		switch ( $name ) {
			case 'core/columns':
				return Markup::block_has_class( $block, $prefix . '-docs' )
					? self::docs_root( $content, $block )
					: $content;

			case 'core/column':
				if ( Markup::block_has_class( $block, $prefix . '-docs-nav' ) ) {
					return self::nav_column( $content, $block );
				}
				if ( Markup::block_has_class( $block, $prefix . '-docs-main' ) ) {
					return Markup::decorate( $content, array( 'pd-main' ) );
				}
				return $content;

			case 'core/page-list':
				return self::page_list( $content, $block );

			case 'core/group':
				return Markup::block_has_class( $block, $prefix . '-docs-breadcrumb' )
					? self::breadcrumb( $content, $block )
					: $content;

			case 'core/table':
				return self::table( $content, $block );

			case 'core/code':
				return self::code( $content, $block );
		}

		return $content;
	}

	/**
	 * Parsed attributes of a block, always an array.
	 *
	 * @param array<string, mixed> $block The parsed block.
	 * @return array<string, mixed> Its attributes.
	 */
	private static function attrs( array $block ): array {
		return is_array( $block['attrs'] ?? null ) ? $block['attrs'] : array();
	}

	/**
	 * The documentation root.
	 *
	 * Width is applied by adding the theme's own alignment class rather than by
	 * out-specifying its layout CSS, so a full-width documentation page lines up
	 * with every other full-width block on the site.
	 *
	 * @param string               $content The rendered block.
	 * @param array<string, mixed> $block   The parsed block.
	 * @return string The rewritten block.
	 */
	private static function docs_root( string $content, array $block ): string {
		$attrs = self::attrs( $block );
		$width = Settings::resolve( $attrs, 'pterodocsWidth', 'width' );
		$width = is_string( $width ) ? $width : 'full';

		$classes = array( 'pd-docs' );
		if ( 'full' === $width ) {
			$classes[] = 'alignfull';
		} elseif ( 'wide' === $width ) {
			$classes[] = 'alignwide';
		}

		$scroll = Settings::resolve( $attrs, 'pterodocsScrollModel', 'scrollModel' );
		$scheme = Settings::get( 'colorScheme' );

		return Markup::decorate(
			$content,
			$classes,
			array(
				'data-pd-width'  => $width,
				'data-pd-scroll' => is_string( $scroll ) ? $scroll : 'page',
				'data-pd-scheme' => is_string( $scheme ) ? $scheme : 'auto',
			)
		);
	}

	/**
	 * The navigation column.
	 *
	 * The trigger that opens the sheet is rendered here rather than by script, so
	 * it is present in the first paint and costs no layout shift.
	 *
	 * @param string               $content The rendered block.
	 * @param array<string, mixed> $block   The parsed block.
	 * @return string The rewritten block.
	 */
	private static function nav_column( string $content, array $block ): string {
		$attrs = self::attrs( $block );

		$mobile    = Settings::resolve( $attrs, 'pterodocsSidebarMobile', 'sidebarMobile' );
		$animation = Settings::resolve( $attrs, 'pterodocsSidebarAnimation', 'sidebarAnimation' );
		$sticky    = (bool) Settings::resolve( $attrs, 'pterodocsSidebarSticky', 'sidebarSticky' );

		$mobile    = is_string( $mobile ) ? $mobile : 'bottom-sheet';
		$animation = is_string( $animation ) ? $animation : 'slide';

		$style = sprintf(
			'--pd-sidebar-max-height:%s;--pd-sticky-top:%s;',
			Markup::length( Settings::get( 'sidebarMaxHeight' ), 'calc(100vh - 6rem)' ),
			Markup::length( Settings::get( 'sidebarStickyTop' ), '2rem' )
		);

		$content = Markup::decorate(
			$content,
			array( 'pd-nav', $sticky ? 'pd-nav--sticky' : 'pd-nav--static' ),
			array(
				'id'                => 'pd-nav-sheet',
				'data-pd-mobile'    => $mobile,
				'data-pd-animation' => $animation,
				'style'             => $style,
			)
		);

		if ( 'inline' === $mobile || 'hidden' === $mobile ) {
			return $content;
		}

		$trigger = sprintf(
			'<button type="button" class="pd-sheet-trigger" aria-expanded="false" aria-controls="pd-nav-sheet" hidden><span class="pd-sheet-trigger__icon" aria-hidden="true"></span>%s</button>',
			esc_html__( 'Documentation menu', 'pterodocs' )
		);

		return $trigger . '<div class="pd-sheet-scrim" hidden></div>' . $content;
	}

	/**
	 * The sidebar tree.
	 *
	 * The collapsed state is decided here, on the server, so the first paint is
	 * already correct and there is no flash of a fully expanded tree. The script
	 * only adds the buttons that toggle it.
	 *
	 * @param string               $content The rendered block.
	 * @param array<string, mixed> $block   The parsed block.
	 * @return string The rewritten block.
	 */
	private static function page_list( string $content, array $block ): string {
		$attrs = self::attrs( $block );

		$collapsible = (bool) Settings::resolve( $attrs, 'pterodocsSidebarCollapsible', 'sidebarCollapsible' );
		$depth       = (int) Settings::resolve( $attrs, 'pterodocsSidebarCollapsedDepth', 'sidebarCollapsedDepth' );
		$depth       = max( 0, $depth );

		// core/page-list already marks the page being read, its ancestors and every
		// item that has children. Nothing here needs to look a page up: the block
		// has done it, and its answer is the one the rest of the page agrees with.
		$tags  = new \WP_HTML_Tag_Processor( $content );
		$level = 0;

		while ( $tags->next_tag( array( 'tag_closers' => 'visit' ) ) ) {
			$tag = $tags->get_tag();

			if ( 'UL' === $tag ) {
				$level += $tags->is_tag_closer() ? -1 : 1;
				continue;
			}

			if ( 'LI' !== $tag || $tags->is_tag_closer() ) {
				continue;
			}

			$current  = true === $tags->has_class( 'current-menu-item' );
			$ancestor = true === $tags->has_class( 'current-menu-ancestor' );
			$branch   = true === $tags->has_class( 'has-child' );

			if ( $current ) {
				$tags->add_class( 'pd-current' );
			}
			if ( $ancestor ) {
				$tags->add_class( 'pd-ancestor' );
			}
			if ( ! $branch ) {
				continue;
			}

			$tags->add_class( 'pd-branch' );

			// Open if it is on the path to the page being read, or shallow enough
			// that the reader was going to see it anyway.
			if ( ! $collapsible || $ancestor || $current || $level <= $depth ) {
				$tags->add_class( 'pd-open' );
			}
		}

		return Markup::decorate(
			$tags->get_updated_html(),
			array( 'pd-tree', $collapsible ? 'pd-tree--collapsible' : 'pd-tree--open' ),
			array( 'data-pd-collapsed-depth' => (string) $depth )
		);
	}

	/**
	 * The breadcrumb.
	 *
	 * pterodocs bakes the separator into the stored paragraph, so changing it
	 * would otherwise mean re-syncing every page. Swapping it at render time
	 * makes it a setting.
	 *
	 * @param string               $content The rendered block.
	 * @param array<string, mixed> $block   The parsed block.
	 * @return string The rewritten block.
	 */
	private static function breadcrumb( string $content, array $block ): string {
		$attrs     = self::attrs( $block );
		$separator = Settings::resolve( $attrs, 'pterodocsBreadcrumbSeparator', 'breadcrumbSeparator' );

		if ( is_string( $separator ) && '' !== trim( $separator ) ) {
			$content = self::swap_separator( $content, $separator );
		}

		return Markup::decorate(
			$content,
			array( 'pd-breadcrumb' ),
			array(
				'role'       => 'navigation',
				'aria-label' => __( 'Breadcrumb', 'pterodocs' ),
			)
		);
	}

	/**
	 * Replace the separator between breadcrumb links.
	 *
	 * Only text sitting between the end of one link and the start of the next is
	 * touched, so link text and the trailing page title are left exactly as they
	 * were.
	 *
	 * @param string $html      The rendered breadcrumb.
	 * @param string $separator The separator to use.
	 * @return string The rewritten breadcrumb.
	 */
	private static function swap_separator( string $html, string $separator ): string {
		// With render.blocks set to 'plugin', pterodocs wrapped each separator in
		// a span of its own, so there is nothing to infer.
		$marker = self::prefix() . '-breadcrumb-separator';

		if ( str_contains( $html, $marker ) ) {
			$replaced = preg_replace(
				'#(<span class="' . preg_quote( $marker, '#' ) . '"[^>]*>)[^<]*(</span>)#i',
				'$1' . esc_html( $separator ) . '$2',
				$html
			);

			return is_string( $replaced ) ? $replaced : $html;
		}

		// Otherwise the separator is loose text between two links, and the run
		// between them is the only thing it can be.
		$replaced = preg_replace_callback(
			'#(</a>)([^<]+)(?=<a[\s>])#i',
			static function ( array $found ) use ( $separator ): string {
				if ( '' === trim( $found[2] ) ) {
					return $found[0];
				}

				return $found[1] . '<span class="pd-breadcrumb__sep" aria-hidden="true">'
					. esc_html( $separator ) . '</span>';
			},
			$html
		);

		return is_string( $replaced ) ? $replaced : $html;
	}

	/**
	 * A table that can be wider than the column it sits in.
	 *
	 * @param string               $content The rendered block.
	 * @param array<string, mixed> $block   The parsed block.
	 * @return string The rewritten block.
	 */
	private static function table( string $content, array $block ): string {
		$attrs = self::attrs( $block );
		$on    = (bool) Settings::resolve( $attrs, 'pterodocsTableScroll', 'tableScroll' );

		if ( ! $on && ! Markup::block_has_class( $block, 'is-style-pterodocs-scroll' ) ) {
			return $content;
		}

		return Markup::wrap(
			$content,
			'div',
			array(
				'class'      => 'pd-scroll',
				'tabindex'   => '0',
				'role'       => 'region',
				'aria-label' => __( 'Table, scrolls sideways', 'pterodocs' ),
			)
		);
	}

	/**
	 * A code block with a copy button.
	 *
	 * The button is rendered outside the `<pre>` so it is never part of what gets
	 * copied, and on the server so it does not shift the layout when the script
	 * runs.
	 *
	 * @param string               $content The rendered block.
	 * @param array<string, mixed> $block   The parsed block.
	 * @return string The rewritten block.
	 */
	private static function code( string $content, array $block ): string {
		$attrs = self::attrs( $block );

		$copy    = (bool) Settings::resolve( $attrs, 'pterodocsCodeCopy', 'codeCopy' );
		$wrap    = (bool) Settings::resolve( $attrs, 'pterodocsCodeWrap', 'codeWrap' );
		$numbers = Settings::resolve( $attrs, 'pterodocsCodeLineNumbers', 'codeLineNumbers' );
		$numbers = is_string( $numbers ) ? $numbers : 'auto';

		$language = Prism::language_of( $content );

		// pterodocs marks a fence that asked for line numbers with its own class.
		$requested = Markup::has_class( $content, self::prefix() . '-line-numbers' );
		$numbered  = 'always' === $numbers || ( 'auto' === $numbers && $requested );

		$classes = array( 'pd-code__block' );
		if ( $wrap ) {
			$classes[] = 'pd-code__block--wrap';
		}
		if ( $numbered ) {
			$classes[] = 'line-numbers';
		}

		// pterodocs carries a fence's highlighted range in the block comment,
		// because core's code block has nowhere to put it and markup core would
		// not have written is markup the editor refuses. Turning it into the
		// attribute Prism reads is this plugin's job, at render time.
		$attributes = array();
		$highlight  = $attrs['pterodocsHighlight'] ?? null;

		if ( is_string( $highlight ) && 1 === preg_match( '/^[0-9,\s-]+$/', $highlight ) ) {
			$attributes['data-line'] = trim( $highlight );
		}

		$button = '';
		if ( $copy ) {
			$button = sprintf(
				'<button type="button" class="pd-copy" data-pd-copy><span class="pd-copy__label">%s</span><span class="pd-copy__done" aria-hidden="true">%s</span></button>',
				esc_html__( 'Copy', 'pterodocs' ),
				esc_html__( 'Copied', 'pterodocs' )
			);
		}

		return Markup::wrap(
			Markup::decorate( $content, $classes, $attributes ),
			'div',
			array(
				'class'        => 'pd-code',
				'data-pd-lang' => $language,
			),
			$button
		);
	}
}
