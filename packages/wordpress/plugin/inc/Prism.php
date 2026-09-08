<?php
/**
 * Syntax highlighting.
 *
 * pterodoc already writes `class="language-xxx"` on every fence, which is
 * exactly what Prism reads, so highlighting needs no change to stored content.
 *
 * The grammars a page needs are worked out here, on the server, and only those
 * are enqueued. That is why the autoloader is not used: it would sniff the DOM
 * on the client, fetch grammars afterwards, and repaint the page once they
 * arrive.
 *
 * No Prism theme is shipped. Token colours are custom properties defined in the
 * stylesheet in terms of the block's own resolved colours, so a code block given
 * a background from the palette gets syntax colours that follow it.
 *
 * @package pterodoc
 */

declare( strict_types = 1 );

namespace Pterodoc;

defined( 'ABSPATH' ) || exit;

/**
 * Works out which Prism grammars a page needs.
 */
final class Prism {

	/**
	 * Grammars that Prism defines in its core file.
	 *
	 * Asking for one of these as a separate script would 404.
	 */
	private const BUILT_IN = array( 'markup', 'html', 'xml', 'svg', 'mathml', 'ssml', 'atom', 'rss', 'css', 'clike', 'javascript', 'js' );

	/**
	 * What each grammar needs loaded before it.
	 *
	 * Only the languages documentation actually uses are listed; an unknown one
	 * is loaded with no dependency, which is right far more often than not.
	 *
	 * @var array<string, string[]>
	 */
	private const REQUIRES = array(
		'bash'       => array(),
		'shell'      => array( 'bash' ),
		'console'    => array( 'bash' ),
		'sh'         => array( 'bash' ),
		'typescript' => array( 'javascript' ),
		'ts'         => array( 'javascript' ),
		'jsx'        => array( 'markup', 'javascript' ),
		'tsx'        => array( 'markup', 'javascript', 'typescript' ),
		'json'       => array(),
		'json5'      => array( 'json' ),
		'jsonp'      => array( 'json' ),
		'yaml'       => array(),
		'yml'        => array( 'yaml' ),
		'toml'       => array(),
		'ini'        => array(),
		'markdown'   => array( 'markup' ),
		'md'         => array( 'markup' ),
		'php'        => array( 'markup-templating' ),
		'sql'        => array(),
		'python'     => array(),
		'py'         => array(),
		'ruby'       => array(),
		'rb'         => array(),
		'go'         => array(),
		'rust'       => array(),
		'java'       => array(),
		'kotlin'     => array(),
		'swift'      => array(),
		'csharp'     => array(),
		'cs'         => array(),
		'c'          => array(),
		'cpp'        => array( 'c' ),
		'diff'       => array(),
		'docker'     => array(),
		'dockerfile' => array(),
		'nginx'      => array(),
		'apacheconf' => array(),
		'graphql'    => array(),
		'scss'       => array( 'css' ),
		'sass'       => array( 'css' ),
		'less'       => array( 'css' ),
		'powershell' => array(),
		'makefile'   => array(),
		'regex'      => array(),
		'scala'      => array( 'java' ),
		'perl'       => array(),
		'lua'        => array(),
		'r'          => array(),
	);

	/**
	 * Aliases Prism does not define a file for.
	 *
	 * @var array<string, string>
	 */
	private const ALIASES = array(
		'js'         => 'javascript',
		'ts'         => 'typescript',
		'py'         => 'python',
		'rb'         => 'ruby',
		'yml'        => 'yaml',
		'md'         => 'markdown',
		'sh'         => 'bash',
		'shell'      => 'bash',
		'console'    => 'bash',
		'cs'         => 'csharp',
		'dockerfile' => 'docker',
		'html'       => 'markup',
		'xml'        => 'markup',
		'svg'        => 'markup',
	);

	/** Where the vendored library sits. */
	private const VENDOR = 'assets/vendor/prism/';

	/**
	 * The language of one rendered code block.
	 *
	 * @param string $html The rendered block.
	 * @return string The language, or an empty string.
	 */
	public static function language_of( string $html ): string {
		if ( 1 === preg_match( '/\blanguage-([A-Za-z0-9#+_-]+)/', $html, $found ) ) {
			return strtolower( $found[1] );
		}

		return '';
	}

	/**
	 * Every language a piece of content mentions.
	 *
	 * @param string $content Post content, or rendered markup.
	 * @return string[] Language names, deduplicated.
	 */
	public static function languages_in( string $content ): array {
		if ( 0 === preg_match_all( '/\blanguage-([A-Za-z0-9#+_-]+)/', $content, $found ) ) {
			return array();
		}

		return array_values( array_unique( array_map( 'strtolower', $found[1] ) ) );
	}

	/**
	 * Whether the library has actually been vendored.
	 *
	 * It is fetched from npm by `npm run vendor` rather than committed, so a
	 * checkout that has not run the build should degrade to unhighlighted code
	 * rather than to a page of 404s.
	 */
	public static function available(): bool {
		return file_exists( PTERODOC_DIR . self::VENDOR . 'prism.js' );
	}

	/**
	 * Resolve a language to the grammar files it needs, in load order.
	 *
	 * @param string[] $languages Languages found on the page.
	 * @return string[] Grammar names to load, dependencies first.
	 */
	private static function resolve( array $languages ): array {
		$ordered = array();

		$add = static function ( string $name ) use ( &$add, &$ordered ): void {
			$name = self::ALIASES[ $name ] ?? $name;

			if ( in_array( $name, self::BUILT_IN, true ) || in_array( $name, $ordered, true ) ) {
				return;
			}
			foreach ( self::REQUIRES[ $name ] ?? array() as $needed ) {
				$add( $needed );
			}
			$ordered[] = $name;
		};

		foreach ( $languages as $language ) {
			$add( $language );
		}

		return $ordered;
	}

	/**
	 * Enqueue Prism and exactly the grammars this page uses.
	 *
	 * @param string $content The content about to be rendered.
	 */
	public static function enqueue( string $content ): void {
		if ( ! Settings::get( 'syntaxHighlight' ) || ! self::available() ) {
			return;
		}

		$languages = self::languages_in( $content );
		if ( array() === $languages ) {
			return;
		}

		wp_enqueue_script( 'prism', PTERODOC_URL . self::VENDOR . 'prism.js', array(), VERSION, true );

		$previous = 'prism';
		foreach ( self::resolve( $languages ) as $grammar ) {
			$file = self::VENDOR . 'components/prism-' . $grammar . '.min.js';
			if ( ! file_exists( PTERODOC_DIR . $file ) ) {
				continue;
			}

			$handle = 'prism-' . $grammar;
			wp_enqueue_script( $handle, PTERODOC_URL . $file, array( $previous ), VERSION, true );
			$previous = $handle;
		}

		if ( self::wants_line_numbers( $content ) ) {
			$file = self::VENDOR . 'plugins/line-numbers/prism-line-numbers.min.js';
			if ( file_exists( PTERODOC_DIR . $file ) ) {
				wp_enqueue_script( 'prism-line-numbers', PTERODOC_URL . $file, array( $previous ), VERSION, true );
				$previous = 'prism-line-numbers';
			}
		}

		// Only when a fence on this page actually carries a range: pterodoc
		// writes them into the block comment, which is what is being searched.
		if ( str_contains( $content, 'pterodocHighlight' ) ) {
			$file = self::VENDOR . 'plugins/line-highlight/prism-line-highlight.min.js';
			if ( file_exists( PTERODOC_DIR . $file ) ) {
				wp_enqueue_script( 'prism-line-highlight', PTERODOC_URL . $file, array( $previous ), VERSION, true );
			}
		}
	}

	/**
	 * Whether any code block on the page will show line numbers.
	 *
	 * @param string $content The content about to be rendered.
	 */
	private static function wants_line_numbers( string $content ): bool {
		$setting = Settings::get( 'codeLineNumbers' );

		if ( 'always' === $setting ) {
			return true;
		}
		if ( 'off' === $setting ) {
			return false;
		}

		$prefix = Settings::get( 'classPrefix' );
		$prefix = is_string( $prefix ) && '' !== $prefix ? $prefix : 'pterodoc';

		return str_contains( $content, $prefix . '-line-numbers' );
	}
}
