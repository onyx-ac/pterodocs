/**
 * pterodocs front-end behaviour.
 *
 * Everything here is an enhancement of markup that already works. The server
 * has decided which branches of the sidebar are open, so the first paint is
 * correct; this adds the buttons that change that decision, the sheet on small
 * screens, and the copy button's behaviour. With the script blocked the tree is
 * fully expanded, the sheet trigger never appears, and the page is still a
 * usable documentation page.
 *
 * No build step: it runs as shipped, which is also what makes it auditable.
 */

( function () {
	'use strict';

	var focusable =
		'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

	/* ------------------------------------------------------------------
	 * Sidebar
	 * --------------------------------------------------------------- */

	/**
	 * Give every branch of a tree a toggle.
	 *
	 * The link and the toggle become siblings in a row, so the toggle can be
	 * operated without following the link — a category page is a real page, and
	 * expanding it should not navigate away from where you are.
	 *
	 * @param {Element} tree The rendered page list.
	 */
	function enhanceTree( tree ) {
		var items = tree.querySelectorAll( 'li' );
		var counter = 0;

		Array.prototype.forEach.call( items, function ( item ) {
			var list = item.querySelector( ':scope > ul' );
			var link = item.querySelector( ':scope > a' );

			if ( ! list || ! link ) {
				return;
			}

			item.classList.add( 'pd-branch' );

			var row = document.createElement( 'div' );
			row.className = 'pd-row';
			link.parentNode.insertBefore( row, link );
			row.appendChild( link );

			// The wrapper is what animates: a grid row cannot be interpolated
			// from nothing to auto, but 0fr to 1fr interpolates cleanly.
			var collapse = document.createElement( 'div' );
			collapse.className = 'pd-collapse';
			list.parentNode.insertBefore( collapse, list );
			collapse.appendChild( list );

			counter += 1;
			var id = 'pd-branch-' + counter;
			collapse.id = id;

			var open = item.classList.contains( 'pd-open' );

			var toggle = document.createElement( 'button' );
			toggle.type = 'button';
			toggle.className = 'pd-twisty';
			toggle.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
			toggle.setAttribute( 'aria-controls', id );
			toggle.setAttribute(
				'aria-label',
				( link.textContent || '' ).trim()
			);
			row.appendChild( toggle );

			toggle.addEventListener( 'click', function () {
				var nowOpen = ! item.classList.contains( 'pd-open' );
				item.classList.toggle( 'pd-open', nowOpen );
				toggle.setAttribute( 'aria-expanded', nowOpen ? 'true' : 'false' );
			} );
		} );

		// Only now, so the pre-script collapsed state never flashes.
		tree.classList.add( 'is-enhanced' );
	}

	/* ------------------------------------------------------------------
	 * The sheet
	 * --------------------------------------------------------------- */

	/**
	 * Wire the trigger, the scrim and the sheet together.
	 *
	 * @param {Element} nav The navigation column.
	 */
	function enhanceSheet( nav ) {
		var mobile = nav.getAttribute( 'data-pd-mobile' );

		if ( 'bottom-sheet' !== mobile && 'drawer' !== mobile ) {
			return;
		}

		var root = nav.closest( '.pd-docs' ) || document;
		var trigger = root.querySelector( '.pd-sheet-trigger' );
		var scrim = root.querySelector( '.pd-sheet-scrim' );
		var main = root.querySelector( '.pd-main' );

		if ( ! trigger || ! scrim ) {
			return;
		}

		// The trigger ships hidden so it can never appear without this handler.
		trigger.hidden = false;

		var previous = null;

		function open() {
			previous = document.activeElement;
			nav.classList.add( 'is-open' );
			scrim.hidden = false;
			// Two frames, so the transition has a start value to move from.
			requestAnimationFrame( function () {
				scrim.classList.add( 'is-open' );
			} );
			trigger.setAttribute( 'aria-expanded', 'true' );
			document.body.style.overflow = 'hidden';
			if ( main ) {
				main.setAttribute( 'inert', '' );
			}

			var first = nav.querySelector( focusable );
			if ( first ) {
				first.focus();
			}
		}

		function close() {
			nav.classList.remove( 'is-open' );
			scrim.classList.remove( 'is-open' );
			trigger.setAttribute( 'aria-expanded', 'false' );
			document.body.style.overflow = '';
			if ( main ) {
				main.removeAttribute( 'inert' );
			}

			window.setTimeout( function () {
				if ( ! nav.classList.contains( 'is-open' ) ) {
					scrim.hidden = true;
				}
			}, 250 );

			if ( previous && previous.focus ) {
				previous.focus();
			}
		}

		function isOpen() {
			return nav.classList.contains( 'is-open' );
		}

		trigger.addEventListener( 'click', function () {
			if ( isOpen() ) {
				close();
			} else {
				open();
			}
		} );

		scrim.addEventListener( 'click', close );

		document.addEventListener( 'keydown', function ( event ) {
			if ( ! isOpen() ) {
				return;
			}
			if ( 'Escape' === event.key ) {
				close();
				return;
			}
			if ( 'Tab' !== event.key ) {
				return;
			}

			// Keep focus inside the sheet while it is covering the page.
			var stops = nav.querySelectorAll( focusable );
			if ( 0 === stops.length ) {
				return;
			}
			var first = stops[ 0 ];
			var last = stops[ stops.length - 1 ];

			if ( event.shiftKey && document.activeElement === first ) {
				event.preventDefault();
				last.focus();
			} else if ( ! event.shiftKey && document.activeElement === last ) {
				event.preventDefault();
				first.focus();
			}
		} );

		// Following a link inside the sheet should close it, or the reader
		// lands on the new page with the sheet still covering it.
		nav.addEventListener( 'click', function ( event ) {
			if ( isOpen() && event.target.closest( 'a[href]' ) ) {
				close();
			}
		} );

		if ( 'bottom-sheet' === mobile ) {
			enableDrag( nav, close );
		}
	}

	/**
	 * Let a bottom sheet be pushed away.
	 *
	 * Only downward drags that start at the top of the sheet count, so a drag
	 * meant to scroll a long list of pages is never mistaken for a dismissal.
	 *
	 * @param {Element}  sheet The sheet.
	 * @param {Function} close Called when the drag passes the threshold.
	 */
	function enableDrag( sheet, close ) {
		var startY = 0;
		var delta = 0;
		var dragging = false;

		sheet.addEventListener(
			'pointerdown',
			function ( event ) {
				if ( 'mouse' === event.pointerType || sheet.scrollTop > 0 ) {
					return;
				}
				dragging = true;
				startY = event.clientY;
				delta = 0;
				sheet.style.transition = 'none';
			},
			{ passive: true }
		);

		sheet.addEventListener(
			'pointermove',
			function ( event ) {
				if ( ! dragging ) {
					return;
				}
				delta = Math.max( 0, event.clientY - startY );
				sheet.style.transform = 'translateY(' + delta + 'px)';
			},
			{ passive: true }
		);

		function end() {
			if ( ! dragging ) {
				return;
			}
			dragging = false;
			sheet.style.transition = '';
			sheet.style.transform = '';

			if ( delta > 80 ) {
				close();
			}
		}

		sheet.addEventListener( 'pointerup', end, { passive: true } );
		sheet.addEventListener( 'pointercancel', end, { passive: true } );
	}

	/* ------------------------------------------------------------------
	 * Copy
	 * --------------------------------------------------------------- */

	/**
	 * Copy a code block's text.
	 *
	 * The text is read from the `code` element rather than the wrapper, so the
	 * button's own label is never part of what lands on the clipboard.
	 *
	 * @param {Element} button The copy button.
	 */
	function enhanceCopy( button ) {
		button.addEventListener( 'click', function () {
			var wrapper = button.closest( '.pd-code' );
			var code = wrapper && wrapper.querySelector( 'pre code' );

			if ( ! code ) {
				return;
			}

			var text = code.textContent || '';

			function done() {
				button.classList.add( 'is-done' );
				window.setTimeout( function () {
					button.classList.remove( 'is-done' );
				}, 1600 );
			}

			if ( navigator.clipboard && navigator.clipboard.writeText ) {
				navigator.clipboard.writeText( text ).then( done, fallback );
			} else {
				fallback();
			}

			// Older browsers, and any page not served over a secure context.
			function fallback() {
				var area = document.createElement( 'textarea' );
				area.value = text;
				area.setAttribute( 'readonly', '' );
				area.style.position = 'fixed';
				area.style.opacity = '0';
				document.body.appendChild( area );
				area.select();
				try {
					document.execCommand( 'copy' );
					done();
				} catch ( error ) {
					// Nothing useful to do; leave the button as it was.
				}
				document.body.removeChild( area );
			}
		} );
	}

	/* ------------------------------------------------------------------
	 * Start
	 * --------------------------------------------------------------- */

	function start() {
		var trees = document.querySelectorAll( '.pd-tree--collapsible' );
		Array.prototype.forEach.call( trees, enhanceTree );

		var navs = document.querySelectorAll( '.pd-nav' );
		Array.prototype.forEach.call( navs, enhanceSheet );

		var buttons = document.querySelectorAll( '[data-pd-copy]' );
		Array.prototype.forEach.call( buttons, enhanceCopy );
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', start );
	} else {
		start();
	}
} )();
