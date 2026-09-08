/**
 * The pterodoc settings page.
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

	var OPTION = 'pterodoc_settings';

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
			el( 'h1', null, __( 'pterodoc', 'pterodoc' ) ),
			el(
				'p',
				null,
				__(
					'How documentation published by pterodoc is displayed. Every setting here is a default: a block can override it from the editor.',
					'pterodoc'
				)
			),
			el(
				Notice,
				{ status: 'info', isDismissible: false },
				__(
					'pterodoc rewrites a page’s content on every sync, so an override set on a block in the editor is replaced the next time that page is published. Settings on this page are never touched by a sync.',
					'pterodoc'
				)
			),
			el(
				Panel,
				null,

				el(
					PanelBody,
					{ title: __( 'Layout', 'pterodoc' ), initialOpen: true },
					choice(
						__( 'Width', 'pterodoc' ),
						'width',
						[
							{ value: 'full', label: __( 'Full width', 'pterodoc' ) },
							{ value: 'wide', label: __( 'Wide', 'pterodoc' ) },
							{ value: 'content', label: __( 'Content width', 'pterodoc' ) }
						],
						__( 'Applied with the theme’s own alignment classes.', 'pterodoc' )
					),
					text(
						__( 'Gutter', 'pterodoc' ),
						'gutter',
						__( 'from the theme’s spacing scale', 'pterodoc' ),
						__( 'Horizontal space around the text. Left empty, the theme’s own spacing scale is used.', 'pterodoc' )
					),
					text(
						__( 'Reading width', 'pterodoc' ),
						'measure',
						__( 'from the theme’s content width', 'pterodoc' ),
						__( 'How wide a paragraph is allowed to get. Code and tables ignore this and run to the full column.', 'pterodoc' )
					),
					text(
						__( 'Class prefix', 'pterodoc' ),
						'classPrefix',
						'pterodoc',
						__( 'Must match render.classPrefix in your pterodoc config. Change it here rather than re-syncing.', 'pterodoc' )
					)
				),

				el(
					PanelBody,
					{ title: __( 'Sidebar', 'pterodoc' ), initialOpen: false },
					toggle( __( 'Collapsible sections', 'pterodoc' ), 'sidebarCollapsible' ),
					el( RangeControl, {
						label: __( 'Expanded down to level', 'pterodoc' ),
						value: values.sidebarCollapsedDepth,
						min: 0,
						max: 6,
						__nextHasNoMarginBottom: true,
						help: __( 'The path to the page being read is always expanded.', 'pterodoc' ),
						onChange: function ( next ) {
							update( 'sidebarCollapsedDepth', next );
						}
					} ),
					toggle(
						__( 'Stick while the page scrolls', 'pterodoc' ),
						'sidebarSticky',
						__( 'The sidebar then scrolls on its own once it is taller than the space it has.', 'pterodoc' )
					),
					text(
						__( 'Greatest height', 'pterodoc' ),
						'sidebarMaxHeight',
						'calc(100vh - 6rem)',
						__( 'Any CSS length. Its contents scroll when they do not fit.', 'pterodoc' )
					),
					text(
						__( 'Distance from the top', 'pterodoc' ),
						'sidebarStickyTop',
						'2rem',
						__( 'Raise this if your theme has a fixed header.', 'pterodoc' )
					),
					choice( __( 'On small screens', 'pterodoc' ), 'sidebarMobile', [
						{ value: 'bottom-sheet', label: __( 'Bottom sheet', 'pterodoc' ) },
						{ value: 'drawer', label: __( 'Side drawer', 'pterodoc' ) },
						{ value: 'inline', label: __( 'Stay in the flow', 'pterodoc' ) },
						{ value: 'hidden', label: __( 'Hide', 'pterodoc' ) }
					] ),
					choice(
						__( 'Animation', 'pterodoc' ),
						'sidebarAnimation',
						[
							{ value: 'slide', label: __( 'Slide', 'pterodoc' ) },
							{ value: 'fade', label: __( 'Fade', 'pterodoc' ) },
							{ value: 'none', label: __( 'None', 'pterodoc' ) }
						],
						__( 'A reader who has asked for reduced motion gets none of these, whatever is chosen.', 'pterodoc' )
					),
					choice(
						__( 'Scrolling', 'pterodoc' ),
						'scrollModel',
						[
							{ value: 'page', label: __( 'Page scrolls, sidebar sticks', 'pterodoc' ) },
							{ value: 'panes', label: __( 'Sidebar and content scroll separately', 'pterodoc' ) }
						],
						__( 'Separate panes look more like an application, but fight themes with a fixed header.', 'pterodoc' )
					)
				),

				el(
					PanelBody,
					{ title: __( 'Code', 'pterodoc' ), initialOpen: false },
					toggle(
						__( 'Syntax highlighting', 'pterodoc' ),
						'syntaxHighlight',
						__( 'Only the languages a page actually uses are loaded.', 'pterodoc' )
					),
					toggle( __( 'Copy button', 'pterodoc' ), 'codeCopy' ),
					choice( __( 'Line numbers', 'pterodoc' ), 'codeLineNumbers', [
						{ value: 'auto', label: __( 'When the document asked for them', 'pterodoc' ) },
						{ value: 'always', label: __( 'Always', 'pterodoc' ) },
						{ value: 'off', label: __( 'Never', 'pterodoc' ) }
					] ),
					toggle( __( 'Wrap long lines', 'pterodoc' ), 'codeWrap' )
				),

				el(
					PanelBody,
					{ title: __( 'Tables', 'pterodoc' ), initialOpen: false },
					toggle(
						__( 'Scroll sideways when too wide', 'pterodoc' ),
						'tableScroll',
						__( 'The table gets its own scrolling region, reachable from the keyboard.', 'pterodoc' )
					)
				),

				el(
					PanelBody,
					{ title: __( 'Breadcrumb', 'pterodoc' ), initialOpen: false },
					text(
						__( 'Separator', 'pterodoc' ),
						'breadcrumbSeparator',
						'›',
						__( 'Left empty, whatever pterodoc wrote into the page is kept.', 'pterodoc' )
					)
				),

				el(
					PanelBody,
					{ title: __( 'Appearance', 'pterodoc' ), initialOpen: false },
					choice(
						__( 'Colour scheme', 'pterodoc' ),
						'colorScheme',
						[
							{ value: 'auto', label: __( 'Follow the reader’s setting', 'pterodoc' ) },
							{ value: 'light', label: __( 'Light', 'pterodoc' ) },
							{ value: 'dark', label: __( 'Dark', 'pterodoc' ) }
						],
						__( 'Colours come from your theme’s palette either way; this only decides which end of it.', 'pterodoc' )
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
					state.saving ? __( 'Saving…', 'pterodoc' ) : __( 'Save settings', 'pterodoc' )
				)
			)
		);
	}

	function mount() {
		var node = document.getElementById( 'pterodoc-settings' );

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
