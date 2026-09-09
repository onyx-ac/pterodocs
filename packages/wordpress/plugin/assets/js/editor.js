/**
 * pterodocs's controls in the block inspector.
 *
 * No block type is registered. This adds attributes and one panel to the core
 * blocks pterodocs already emits, which is what keeps stored content ordinary
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

	/** Blocks that can carry pterodocs attributes, and which ones. */
	var SUPPORTED = {
		'core/columns': [ 'pterodocsWidth', 'pterodocsScrollModel' ],
		'core/column': [
			'pterodocsSidebarMobile',
			'pterodocsSidebarAnimation',
			'pterodocsSidebarSticky'
		],
		'core/page-list': [
			'pterodocsSidebarCollapsible',
			'pterodocsSidebarCollapsedDepth'
		],
		'core/group': [ 'pterodocsBreadcrumbSeparator' ],
		'core/code': [
			'pterodocsCodeCopy',
			'pterodocsCodeWrap',
			'pterodocsCodeLineNumbers'
		],
		'core/table': [ 'pterodocsTableScroll' ]
	};

	/**
	 * Declare the attributes, so the editor keeps them and serialises them into
	 * the block comment.
	 */
	wp.hooks.addFilter(
		'blocks.registerBlockType',
		'pterodocs/attributes',
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
		var entity = wp.coreData.useEntityProp( 'root', 'site', 'pterodocs_settings' );
		var value = entity && entity[ 0 ];

		return value && 'object' === typeof value ? value : {};
	}

	/**
	 * Whether a block carries one of pterodocs's own classes.
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
					? __( 'Default', 'pterodocs' ) + ' (' + resolved.label + ')'
					: __( 'Default', 'pterodocs' )
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
				{ value: 'on', label: __( 'On', 'pterodocs' ) },
				{ value: 'off', label: __( 'Off', 'pterodocs' ) }
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
		var prefix = settings.classPrefix || 'pterodocs';
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
					__( 'Width', 'pterodocs' ),
					attributes.pterodocsWidth,
					[
						{ value: 'full', label: __( 'Full width', 'pterodocs' ) },
						{ value: 'wide', label: __( 'Wide', 'pterodocs' ) },
						{ value: 'content', label: __( 'Content width', 'pterodocs' ) }
					],
					settings.width,
					set( 'pterodocsWidth' ),
					__( 'Applied with the theme’s own alignment, so it lines up with other full-width blocks.', 'pterodocs' )
				),
				inherit(
					__( 'Scrolling', 'pterodocs' ),
					attributes.pterodocsScrollModel,
					[
						{ value: 'page', label: __( 'Page scrolls, sidebar sticks', 'pterodocs' ) },
						{ value: 'panes', label: __( 'Sidebar and content scroll separately', 'pterodocs' ) }
					],
					settings.scrollModel,
					set( 'pterodocsScrollModel' )
				)
			];
		}

		if ( 'core/column' === name ) {
			if ( ! hasClass( attributes, prefix, 'docs-nav' ) ) {
				return null;
			}

			return [
				inherit(
					__( 'On small screens', 'pterodocs' ),
					attributes.pterodocsSidebarMobile,
					[
						{ value: 'bottom-sheet', label: __( 'Bottom sheet', 'pterodocs' ) },
						{ value: 'drawer', label: __( 'Side drawer', 'pterodocs' ) },
						{ value: 'inline', label: __( 'Stay in the flow', 'pterodocs' ) },
						{ value: 'hidden', label: __( 'Hide', 'pterodocs' ) }
					],
					settings.sidebarMobile,
					set( 'pterodocsSidebarMobile' )
				),
				inherit(
					__( 'Animation', 'pterodocs' ),
					attributes.pterodocsSidebarAnimation,
					[
						{ value: 'slide', label: __( 'Slide', 'pterodocs' ) },
						{ value: 'fade', label: __( 'Fade', 'pterodocs' ) },
						{ value: 'none', label: __( 'None', 'pterodocs' ) }
					],
					settings.sidebarAnimation,
					set( 'pterodocsSidebarAnimation' ),
					__( 'Reduced-motion settings always win, whatever is chosen here.', 'pterodocs' )
				),
				inheritToggle(
					__( 'Stick while the page scrolls', 'pterodocs' ),
					attributes.pterodocsSidebarSticky,
					settings.sidebarSticky,
					set( 'pterodocsSidebarSticky' )
				)
			];
		}

		if ( 'core/page-list' === name ) {
			var collapsible =
				undefined === attributes.pterodocsSidebarCollapsible
					? settings.sidebarCollapsible
					: attributes.pterodocsSidebarCollapsible;

			var items = [
				inheritToggle(
					__( 'Collapsible sections', 'pterodocs' ),
					attributes.pterodocsSidebarCollapsible,
					settings.sidebarCollapsible,
					set( 'pterodocsSidebarCollapsible' )
				)
			];

			if ( collapsible ) {
				items.push(
					el( RangeControl, {
						label: __( 'Expanded down to level', 'pterodocs' ),
						value:
							undefined === attributes.pterodocsSidebarCollapsedDepth
								? settings.sidebarCollapsedDepth
								: attributes.pterodocsSidebarCollapsedDepth,
						min: 0,
						max: 6,
						allowReset: true,
						resetFallbackValue: undefined,
						__nextHasNoMarginBottom: true,
						help: __( 'The path to the page being read is always expanded.', 'pterodocs' ),
						onChange: set( 'pterodocsSidebarCollapsedDepth' )
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
					label: __( 'Separator', 'pterodocs' ),
					value: attributes.pterodocsBreadcrumbSeparator || '',
					placeholder: settings.breadcrumbSeparator || '›',
					__nextHasNoMarginBottom: true,
					help: __( 'Swapped in when the page is displayed, so changing it needs no re-sync.', 'pterodocs' ),
					onChange: function ( next ) {
						set( 'pterodocsBreadcrumbSeparator' )( '' === next ? undefined : next );
					}
				} )
			];
		}

		if ( 'core/code' === name ) {
			return [
				inheritToggle(
					__( 'Copy button', 'pterodocs' ),
					attributes.pterodocsCodeCopy,
					settings.codeCopy,
					set( 'pterodocsCodeCopy' )
				),
				inheritToggle(
					__( 'Wrap long lines', 'pterodocs' ),
					attributes.pterodocsCodeWrap,
					settings.codeWrap,
					set( 'pterodocsCodeWrap' )
				),
				inherit(
					__( 'Line numbers', 'pterodocs' ),
					attributes.pterodocsCodeLineNumbers,
					[
						{ value: 'auto', label: __( 'When the document asked for them', 'pterodocs' ) },
						{ value: 'always', label: __( 'Always', 'pterodocs' ) },
						{ value: 'off', label: __( 'Never', 'pterodocs' ) }
					],
					settings.codeLineNumbers,
					set( 'pterodocsCodeLineNumbers' )
				)
			];
		}

		if ( 'core/table' === name ) {
			return [
				inheritToggle(
					__( 'Scroll sideways when too wide', 'pterodocs' ),
					attributes.pterodocsTableScroll,
					settings.tableScroll,
					set( 'pterodocsTableScroll' )
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
		'pterodocs/inspector',
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
							{ title: __( 'Documentation', 'pterodocs' ), initialOpen: false },
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
		}, 'withPterodocsControls' )
	);
} )( window.wp );
