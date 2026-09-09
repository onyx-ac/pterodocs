/**
 * The pterodocs settings page.
 *
 * Built from @wordpress/components so it reads as the same interface as the
 * block inspector, and it writes the same option the inspector reads, so a
 * "Default" in a block and a value here are two views of one setting.
 *
 * No build step: wp.element.createElement rather than JSX.
 */

( function ( wp ) {
	'use strict';

	if ( ! wp || ! wp.element || ! wp.components ) {
		return;
	}

	var el = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var __ = wp.i18n.__;

	var Panel = wp.components.Panel;
	var PanelBody = wp.components.PanelBody;
	var SelectControl = wp.components.SelectControl;
	var ToggleControl = wp.components.ToggleControl;
	var TextControl = wp.components.TextControl;
	var RangeControl = wp.components.RangeControl;
	var Button = wp.components.Button;
	var Notice = wp.components.Notice;
	var Spinner = wp.components.Spinner;

	var OPTION = 'pterodocs_settings';

	function Settings() {
		var editEntityRecord = wp.data.useDispatch( 'core' ).editEntityRecord;
		var saveEditedEntityRecord = wp.data.useDispatch( 'core' ).saveEditedEntityRecord;

		var state = wp.data.useSelect( function ( query ) {
			var store = query( 'core' );
			var record = store.getEditedEntityRecord( 'root', 'site' );

			return {
				settings: record,
				// Presence of any field is a sturdier "loaded" than matching the
				// resolver's argument list, which is an implementation detail.
				loaded: !! record && Object.keys( record ).length > 0,
				saving: store.isSavingEntityRecord( 'root', 'site' )
			};
		}, [] );

		var values = ( state.settings && state.settings[ OPTION ] ) || {};

		function update( key, value ) {
			var next = {};
			next[ OPTION ] = Object.assign( {}, values );
			next[ OPTION ][ key ] = value;
			editEntityRecord( 'root', 'site', undefined, next );
		}

		function save() {
			saveEditedEntityRecord( 'root', 'site' );
		}

		function choice( label, key, options, help ) {
			return el( SelectControl, {
				label: label,
				value: values[ key ],
				options: options,
				help: help,
				__nextHasNoMarginBottom: true,
				onChange: function ( next ) {
					update( key, next );
				}
			} );
		}

		function toggle( label, key, help ) {
			return el( ToggleControl, {
				label: label,
				checked: !! values[ key ],
				help: help,
				__nextHasNoMarginBottom: true,
				onChange: function ( next ) {
					update( key, next );
				}
			} );
		}

		function text( label, key, placeholder, help ) {
			return el( TextControl, {
				label: label,
				value: values[ key ] || '',
				placeholder: placeholder,
				help: help,
				__nextHasNoMarginBottom: true,
				onChange: function ( next ) {
					update( key, next );
				}
			} );
		}

		if ( ! state.loaded ) {
			return el( Spinner, null );
		}

		return el(
			Fragment,
			null,
			el( 'h1', null, __( 'pterodocs', 'pterodocs' ) ),
			el(
				'p',
				null,
				__(
					'How documentation published by pterodocs is displayed. Every setting here is a default: a block can override it from the editor.',
					'pterodocs'
				)
			),
			el(
				Notice,
				{ status: 'info', isDismissible: false },
				__(
					'pterodocs rewrites a page’s content on every sync, so an override set on a block in the editor is replaced the next time that page is published. Settings on this page are never touched by a sync.',
					'pterodocs'
				)
			),
			el(
				Panel,
				null,

				el(
					PanelBody,
					{ title: __( 'Layout', 'pterodocs' ), initialOpen: true },
					choice(
						__( 'Width', 'pterodocs' ),
						'width',
						[
							{ value: 'full', label: __( 'Full width', 'pterodocs' ) },
							{ value: 'wide', label: __( 'Wide', 'pterodocs' ) },
							{ value: 'content', label: __( 'Content width', 'pterodocs' ) }
						],
						__( 'Applied with the theme’s own alignment classes.', 'pterodocs' )
					),
					text(
						__( 'Gutter', 'pterodocs' ),
						'gutter',
						__( 'from the theme’s spacing scale', 'pterodocs' ),
						__( 'Horizontal space around the text. Left empty, the theme’s own spacing scale is used.', 'pterodocs' )
					),
					text(
						__( 'Reading width', 'pterodocs' ),
						'measure',
						__( 'from the theme’s content width', 'pterodocs' ),
						__( 'How wide a paragraph is allowed to get. Code and tables ignore this and run to the full column.', 'pterodocs' )
					),
					text(
						__( 'Class prefix', 'pterodocs' ),
						'classPrefix',
						'pterodocs',
						__( 'Must match render.classPrefix in your pterodocs config. Change it here rather than re-syncing.', 'pterodocs' )
					)
				),

				el(
					PanelBody,
					{ title: __( 'Sidebar', 'pterodocs' ), initialOpen: false },
					toggle( __( 'Collapsible sections', 'pterodocs' ), 'sidebarCollapsible' ),
					el( RangeControl, {
						label: __( 'Expanded down to level', 'pterodocs' ),
						value: values.sidebarCollapsedDepth,
						min: 0,
						max: 6,
						__nextHasNoMarginBottom: true,
						help: __( 'The path to the page being read is always expanded.', 'pterodocs' ),
						onChange: function ( next ) {
							update( 'sidebarCollapsedDepth', next );
						}
					} ),
					toggle(
						__( 'Stick while the page scrolls', 'pterodocs' ),
						'sidebarSticky',
						__( 'The sidebar then scrolls on its own once it is taller than the space it has.', 'pterodocs' )
					),
					text(
						__( 'Greatest height', 'pterodocs' ),
						'sidebarMaxHeight',
						'calc(100vh - 6rem)',
						__( 'Any CSS length. Its contents scroll when they do not fit.', 'pterodocs' )
					),
					text(
						__( 'Distance from the top', 'pterodocs' ),
						'sidebarStickyTop',
						'2rem',
						__( 'Raise this if your theme has a fixed header.', 'pterodocs' )
					),
					choice( __( 'On small screens', 'pterodocs' ), 'sidebarMobile', [
						{ value: 'bottom-sheet', label: __( 'Bottom sheet', 'pterodocs' ) },
						{ value: 'drawer', label: __( 'Side drawer', 'pterodocs' ) },
						{ value: 'inline', label: __( 'Stay in the flow', 'pterodocs' ) },
						{ value: 'hidden', label: __( 'Hide', 'pterodocs' ) }
					] ),
					choice(
						__( 'Animation', 'pterodocs' ),
						'sidebarAnimation',
						[
							{ value: 'slide', label: __( 'Slide', 'pterodocs' ) },
							{ value: 'fade', label: __( 'Fade', 'pterodocs' ) },
							{ value: 'none', label: __( 'None', 'pterodocs' ) }
						],
						__( 'A reader who has asked for reduced motion gets none of these, whatever is chosen.', 'pterodocs' )
					),
					choice(
						__( 'Scrolling', 'pterodocs' ),
						'scrollModel',
						[
							{ value: 'page', label: __( 'Page scrolls, sidebar sticks', 'pterodocs' ) },
							{ value: 'panes', label: __( 'Sidebar and content scroll separately', 'pterodocs' ) }
						],
						__( 'Separate panes look more like an application, but fight themes with a fixed header.', 'pterodocs' )
					)
				),

				el(
					PanelBody,
					{ title: __( 'Code', 'pterodocs' ), initialOpen: false },
					toggle(
						__( 'Syntax highlighting', 'pterodocs' ),
						'syntaxHighlight',
						__( 'Only the languages a page actually uses are loaded.', 'pterodocs' )
					),
					toggle( __( 'Copy button', 'pterodocs' ), 'codeCopy' ),
					choice( __( 'Line numbers', 'pterodocs' ), 'codeLineNumbers', [
						{ value: 'auto', label: __( 'When the document asked for them', 'pterodocs' ) },
						{ value: 'always', label: __( 'Always', 'pterodocs' ) },
						{ value: 'off', label: __( 'Never', 'pterodocs' ) }
					] ),
					toggle( __( 'Wrap long lines', 'pterodocs' ), 'codeWrap' )
				),

				el(
					PanelBody,
					{ title: __( 'Tables', 'pterodocs' ), initialOpen: false },
					toggle(
						__( 'Scroll sideways when too wide', 'pterodocs' ),
						'tableScroll',
						__( 'The table gets its own scrolling region, reachable from the keyboard.', 'pterodocs' )
					)
				),

				el(
					PanelBody,
					{ title: __( 'Breadcrumb', 'pterodocs' ), initialOpen: false },
					text(
						__( 'Separator', 'pterodocs' ),
						'breadcrumbSeparator',
						'›',
						__( 'Left empty, whatever pterodocs wrote into the page is kept.', 'pterodocs' )
					)
				),

				el(
					PanelBody,
					{ title: __( 'Appearance', 'pterodocs' ), initialOpen: false },
					choice(
						__( 'Colour scheme', 'pterodocs' ),
						'colorScheme',
						[
							{ value: 'auto', label: __( 'Follow the reader’s setting', 'pterodocs' ) },
							{ value: 'light', label: __( 'Light', 'pterodocs' ) },
							{ value: 'dark', label: __( 'Dark', 'pterodocs' ) }
						],
						__( 'Colours come from your theme’s palette either way; this only decides which end of it.', 'pterodocs' )
					)
				)
			),
			el(
				'p',
				{ style: { marginTop: '1.5rem' } },
				el(
					Button,
					{
						variant: 'primary',
						isBusy: state.saving,
						disabled: state.saving,
						onClick: save
					},
					state.saving ? __( 'Saving…', 'pterodocs' ) : __( 'Save settings', 'pterodocs' )
				)
			)
		);
	}

	function mount() {
		var node = document.getElementById( 'pterodocs-settings' );

		if ( ! node ) {
			return;
		}

		if ( wp.element.createRoot ) {
			wp.element.createRoot( node ).render( el( Settings ) );
		} else {
			wp.element.render( el( Settings ), node );
		}
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', mount );
	} else {
		mount();
	}
} )( window.wp );
