/**
 * pterodoc's controls in the block inspector.
 *
 * No block type is registered. This adds attributes and one panel to the core
 * blocks pterodoc already emits, which is what keeps stored content ordinary
 * core markup that reads fine with the plugin turned off.
 *
 * The attributes have no `source`, so they live in the block comment and never
 * in the saved HTML. That matters: block validation compares saved markup with
 * what `save()` would produce, and markup we never touch cannot fail it. PHP
 * reads the same attributes off the parsed block at render time.
 *
 * Every control offers "Default", which stores nothing at all — an absent
 * attribute is what "inherit from the plugin settings" means.
 *
 * No build step: this uses wp.element.createElement rather than JSX, so the
 * file that ships is the file that was written.
 */

( function ( wp ) {
	'use strict';

	if ( ! wp || ! wp.hooks || ! wp.element ) {
		return;
	}

	var el = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var __ = wp.i18n.__;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var PanelBody = wp.components.PanelBody;
	var SelectControl = wp.components.SelectControl;
	var ToggleControl = wp.components.ToggleControl;
	var TextControl = wp.components.TextControl;
	var RangeControl = wp.components.RangeControl;

	/** Blocks that can carry pterodoc attributes, and which ones. */
	var SUPPORTED = {
		'core/columns': [ 'pterodocWidth', 'pterodocScrollModel' ],
		'core/column': [
			'pterodocSidebarMobile',
			'pterodocSidebarAnimation',
			'pterodocSidebarSticky'
		],
		'core/page-list': [
			'pterodocSidebarCollapsible',
			'pterodocSidebarCollapsedDepth'
		],
		'core/group': [ 'pterodocBreadcrumbSeparator' ],
		'core/code': [
			'pterodocCodeCopy',
			'pterodocCodeWrap',
			'pterodocCodeLineNumbers'
		],
		'core/table': [ 'pterodocTableScroll' ]
	};

	/**
	 * Declare the attributes, so the editor keeps them and serialises them into
	 * the block comment.
	 */
	wp.hooks.addFilter(
		'blocks.registerBlockType',
		'pterodoc/attributes',
		function ( settings, name ) {
			var names = SUPPORTED[ name ];

			if ( ! names ) {
				return settings;
			}

			var added = {};
			names.forEach( function ( attribute ) {
				// No `type` constraint beyond the obvious, and no default: the
				// absence of a value is what carries the meaning.
				added[ attribute ] = {};
			} );

			return Object.assign( {}, settings, {
				attributes: Object.assign( {}, settings.attributes, added )
			} );
		}
	);

	/**
	 * The plugin's site-wide settings, or an empty object while they load.
	 */
	function useSettings() {
		var entity = wp.coreData.useEntityProp( 'root', 'site', 'pterodoc_settings' );
		var value = entity && entity[ 0 ];

		return value && 'object' === typeof value ? value : {};
	}

	/**
	 * Whether a block carries one of pterodoc's own classes.
	 *
	 * @param {Object} attributes The block's attributes.
	 * @param {string} prefix     The configured class prefix.
	 * @param {string} suffix     The class to look for, without the prefix.
	 */
	function hasClass( attributes, prefix, suffix ) {
		var className = attributes && attributes.className;

		if ( 'string' !== typeof className ) {
			return false;
		}

		return className.split( /\s+/ ).indexOf( prefix + '-' + suffix ) !== -1;
	}

	/**
	 * A select whose first option inherits, and names what it would inherit.
	 */
	function inherit( label, value, options, fallback, onChange, help ) {
		var resolved = options.filter( function ( option ) {
			return option.value === fallback;
		} )[ 0 ];

		var labelled = [
			{
				value: '',
				/* translators: %s: the value inherited from the plugin settings. */
				label: resolved
					? __( 'Default', 'pterodoc' ) + ' (' + resolved.label + ')'
					: __( 'Default', 'pterodoc' )
			}
		].concat( options );

		return el( SelectControl, {
			label: label,
			value: undefined === value || null === value ? '' : value,
			options: labelled,
			help: help,
			__nextHasNoMarginBottom: true,
			onChange: function ( next ) {
				onChange( '' === next ? undefined : next );
			}
		} );
	}

	/**
	 * A tri-state toggle: on, off, or whatever the settings say.
	 */
	function inheritToggle( label, value, fallback, onChange ) {
		return inherit(
			label,
			undefined === value || null === value ? undefined : value ? 'on' : 'off',
			[
				{ value: 'on', label: __( 'On', 'pterodoc' ) },
				{ value: 'off', label: __( 'Off', 'pterodoc' ) }
			],
			fallback ? 'on' : 'off',
			function ( next ) {
				onChange( undefined === next ? undefined : 'on' === next );
			}
		);
	}

	/**
	 * The controls for one block.
	 */
	function controls( name, attributes, setAttributes, settings ) {
		var prefix = settings.classPrefix || 'pterodoc';
		var set = function ( key ) {
			return function ( value ) {
				var change = {};
				change[ key ] = value;
				setAttributes( change );
			};
		};

		if ( 'core/columns' === name ) {
			if ( ! hasClass( attributes, prefix, 'docs' ) ) {
				return null;
			}

			return [
				inherit(
					__( 'Width', 'pterodoc' ),
					attributes.pterodocWidth,
					[
						{ value: 'full', label: __( 'Full width', 'pterodoc' ) },
						{ value: 'wide', label: __( 'Wide', 'pterodoc' ) },
						{ value: 'content', label: __( 'Content width', 'pterodoc' ) }
					],
					settings.width,
					set( 'pterodocWidth' ),
					__( 'Applied with the theme’s own alignment, so it lines up with other full-width blocks.', 'pterodoc' )
				),
				inherit(
					__( 'Scrolling', 'pterodoc' ),
					attributes.pterodocScrollModel,
					[
						{ value: 'page', label: __( 'Page scrolls, sidebar sticks', 'pterodoc' ) },
						{ value: 'panes', label: __( 'Sidebar and content scroll separately', 'pterodoc' ) }
					],
					settings.scrollModel,
					set( 'pterodocScrollModel' )
				)
			];
		}

		if ( 'core/column' === name ) {
			if ( ! hasClass( attributes, prefix, 'docs-nav' ) ) {
				return null;
			}

			return [
				inherit(
					__( 'On small screens', 'pterodoc' ),
					attributes.pterodocSidebarMobile,
					[
						{ value: 'bottom-sheet', label: __( 'Bottom sheet', 'pterodoc' ) },
						{ value: 'drawer', label: __( 'Side drawer', 'pterodoc' ) },
						{ value: 'inline', label: __( 'Stay in the flow', 'pterodoc' ) },
						{ value: 'hidden', label: __( 'Hide', 'pterodoc' ) }
					],
					settings.sidebarMobile,
					set( 'pterodocSidebarMobile' )
				),
				inherit(
					__( 'Animation', 'pterodoc' ),
					attributes.pterodocSidebarAnimation,
					[
						{ value: 'slide', label: __( 'Slide', 'pterodoc' ) },
						{ value: 'fade', label: __( 'Fade', 'pterodoc' ) },
						{ value: 'none', label: __( 'None', 'pterodoc' ) }
					],
					settings.sidebarAnimation,
					set( 'pterodocSidebarAnimation' ),
					__( 'Reduced-motion settings always win, whatever is chosen here.', 'pterodoc' )
				),
				inheritToggle(
					__( 'Stick while the page scrolls', 'pterodoc' ),
					attributes.pterodocSidebarSticky,
					settings.sidebarSticky,
					set( 'pterodocSidebarSticky' )
				)
			];
		}

		if ( 'core/page-list' === name ) {
			var collapsible =
				undefined === attributes.pterodocSidebarCollapsible
					? settings.sidebarCollapsible
					: attributes.pterodocSidebarCollapsible;

			var items = [
				inheritToggle(
					__( 'Collapsible sections', 'pterodoc' ),
					attributes.pterodocSidebarCollapsible,
					settings.sidebarCollapsible,
					set( 'pterodocSidebarCollapsible' )
				)
			];

			if ( collapsible ) {
				items.push(
					el( RangeControl, {
						label: __( 'Expanded down to level', 'pterodoc' ),
						value:
							undefined === attributes.pterodocSidebarCollapsedDepth
								? settings.sidebarCollapsedDepth
								: attributes.pterodocSidebarCollapsedDepth,
						min: 0,
						max: 6,
						allowReset: true,
						resetFallbackValue: undefined,
						__nextHasNoMarginBottom: true,
						help: __( 'The path to the page being read is always expanded.', 'pterodoc' ),
						onChange: set( 'pterodocSidebarCollapsedDepth' )
					} )
				);
			}

			return items;
		}

		if ( 'core/group' === name ) {
			if ( ! hasClass( attributes, prefix, 'docs-breadcrumb' ) ) {
				return null;
			}

			return [
				el( TextControl, {
					label: __( 'Separator', 'pterodoc' ),
					value: attributes.pterodocBreadcrumbSeparator || '',
					placeholder: settings.breadcrumbSeparator || '›',
					__nextHasNoMarginBottom: true,
					help: __( 'Swapped in when the page is displayed, so changing it needs no re-sync.', 'pterodoc' ),
					onChange: function ( next ) {
						set( 'pterodocBreadcrumbSeparator' )( '' === next ? undefined : next );
					}
				} )
			];
		}

		if ( 'core/code' === name ) {
			return [
				inheritToggle(
					__( 'Copy button', 'pterodoc' ),
					attributes.pterodocCodeCopy,
					settings.codeCopy,
					set( 'pterodocCodeCopy' )
				),
				inheritToggle(
					__( 'Wrap long lines', 'pterodoc' ),
					attributes.pterodocCodeWrap,
					settings.codeWrap,
					set( 'pterodocCodeWrap' )
				),
				inherit(
					__( 'Line numbers', 'pterodoc' ),
					attributes.pterodocCodeLineNumbers,
					[
						{ value: 'auto', label: __( 'When the document asked for them', 'pterodoc' ) },
						{ value: 'always', label: __( 'Always', 'pterodoc' ) },
						{ value: 'off', label: __( 'Never', 'pterodoc' ) }
					],
					settings.codeLineNumbers,
					set( 'pterodocCodeLineNumbers' )
				)
			];
		}

		if ( 'core/table' === name ) {
			return [
				inheritToggle(
					__( 'Scroll sideways when too wide', 'pterodoc' ),
					attributes.pterodocTableScroll,
					settings.tableScroll,
					set( 'pterodocTableScroll' )
				)
			];
		}

		return null;
	}

	/**
	 * Add the panel, but only to blocks that have something to say.
	 */
	wp.hooks.addFilter(
		'editor.BlockEdit',
		'pterodoc/inspector',
		wp.compose.createHigherOrderComponent( function ( BlockEdit ) {
			// Split in two on purpose. The hook below must run on every render
			// of this component, and `isSelected` changes between renders — so
			// the decision that skips the hook entirely has to be the choice of
			// which component to render, not a branch inside one.
			function WithControls( props ) {
				var settings = useSettings();
				var items = props.isSelected
					? controls(
							props.name,
							props.attributes,
							props.setAttributes,
							settings
					  )
					: null;

				if ( ! items || ! items.length ) {
					return el( BlockEdit, props );
				}

				return el(
					Fragment,
					null,
					el( BlockEdit, props ),
					el(
						InspectorControls,
						null,
						el(
							PanelBody,
							{ title: __( 'Documentation', 'pterodoc' ), initialOpen: false },
							items.map( function ( item, index ) {
								return el(
									wp.element.Fragment,
									{ key: index },
									item
								);
							} )
						)
					)
				);
			}

			return function ( props ) {
				return SUPPORTED[ props.name ]
					? el( WithControls, props )
					: el( BlockEdit, props );
			};
		}, 'withPterodocControls' )
	);
} )( window.wp );
