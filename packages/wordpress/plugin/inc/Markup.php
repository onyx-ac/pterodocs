<?php
/**
 * Small helpers for changing rendered block markup.
 *
 * `WP_HTML_Tag_Processor` can change attributes but cannot insert elements, so
 * anything that needs new DOM is either a wrapper around a whole block — which
 * is a string concatenation, and safe because the block's own markup is
 * untouched — or is added by the front-end script.
 *
 * @package pterodoc
 */

declare( strict_types = 1 );

namespace Pterodoc;

defined( 'ABSPATH' ) || exit;

/**
 * Markup rewriting that does not resort to regular expressions.
 */
final class Markup {

	/**
	 * Add classes and attributes to a block's outermost tag.
	 *
	 * @param string                $html       The rendered block.
	 * @param string[]              $classes    Classes to add.
	 * @param array<string, string> $attributes Attributes to set.
	 * @return string The rewritten block.
	 */
	public static function decorate( string $html, array $classes = array(), array $attributes = array() ): string {
		$tags = new \WP_HTML_Tag_Processor( $html );

		if ( ! $tags->next_tag() ) {
			return $html;
		}

		foreach ( $classes as $class ) {
			$tags->add_class( $class );
		}
		foreach ( $attributes as $name => $value ) {
			$tags->set_attribute( $name, $value );
		}

		return $tags->get_updated_html();
	}

	/**
	 * Read a class off a block's outermost tag.
	 *
	 * @param string $html  The rendered block.
	 * @param string $class Class to look for.
	 * @return bool Whether the block carries it.
	 */
	public static function has_class( string $html, string $class ): bool {
		$tags = new \WP_HTML_Tag_Processor( $html );

		return $tags->next_tag() && true === $tags->has_class( $class );
	}

	/**
	 * Whether a parsed block declares a class in its attributes.
	 *
	 * Cheaper than parsing the markup, and it is how pterodoc marks the blocks it
	 * generated: `className` is part of the block comment.
	 *
	 * @param array<string, mixed> $block A parsed block.
	 * @param string               $class Class to look for.
	 * @return bool Whether the block declares it.
	 */
	public static function block_has_class( array $block, string $class ): bool {
		$declared = $block['attrs']['className'] ?? '';

		if ( ! is_string( $declared ) || '' === $declared ) {
			return false;
		}

		return in_array( $class, preg_split( '/\s+/', $declared ) ?: array(), true );
	}

	/**
	 * Wrap a block in an element.
	 *
	 * @param string                $html       The rendered block.
	 * @param string                $tag        Element name.
	 * @param array<string, string> $attributes Attributes for the wrapper.
	 * @param string                $after      Markup placed after the block, inside the wrapper.
	 * @param string                $before     Markup placed before the block, inside the wrapper.
	 * @return string The wrapped block.
	 */
	public static function wrap(
		string $html,
		string $tag,
		array $attributes = array(),
		string $after = '',
		string $before = ''
	): string {
		$parts = array();
		foreach ( $attributes as $name => $value ) {
			$parts[] = sprintf( '%s="%s"', esc_attr( $name ), esc_attr( $value ) );
		}
		$open = sprintf( '<%s %s>', $tag, implode( ' ', $parts ) );

		return $open . $before . $html . $after . sprintf( '</%s>', $tag );
	}

	/**
	 * A CSS length that is safe to put in a style attribute.
	 *
	 * Deliberately permissive about functions, because `calc(100vh - 6rem)` is
	 * the useful default for the sidebar, and deliberately strict about anything
	 * that could close the attribute or start a url().
	 *
	 * @param mixed  $value    The configured value.
	 * @param string $fallback Used when the value is not a length.
	 * @return string A CSS length.
	 */
	public static function length( $value, string $fallback = '' ): string {
		if ( ! is_string( $value ) || '' === trim( $value ) ) {
			return $fallback;
		}

		$value = trim( $value );

		if ( 1 !== preg_match( '/^[0-9a-zA-Z%.,()\/\s+*-]+$/', $value ) ) {
			return $fallback;
		}
		if ( false !== stripos( $value, 'url' ) || false !== stripos( $value, 'expression' ) ) {
			return $fallback;
		}

		return $value;
	}
}
