/*
 * Copyright 2007-2013, Active Group, Inc.  All rights reserved.
 * ******************************************************************************
 * This file is distributed on an AS IS BASIS WITHOUT ANY WARRANTY; without even
 * the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * ***********************************************************************************
 * @version 4.2 beta 1
 * [For Ext 4.2+ only]
 *
 * License: Ext.ux.ManagedIframe.Component, Ext.ux.ManagedIframe.Element, and multidom.js
 * are licensed under the terms of the Open Source GPL 3.0 license:
 * http://www.gnu.org/licenses/gpl.html
 *
 * Commercial use is prohibited without a Commercial Developement License. See
 * http://licensing.theactivegroup.com.

 Note:  This release in functionally MATCHED to Ext 4.2.0+
 *
 */
//@tag dom,core
//@require Ext.Supports,Ext.dom.AbstractElement

(function(Ext){
    //Ext.enableGarbageCollector = false;

    var Element         = Ext.core.Element,
        AbstractElement = Ext.dom.AbstractElement,
        EventManager    = Ext.EventManager,
        DOC         = document,
        DC          = Ext.documentCache = {},
        OP          = Object.prototype,
        toString    = OP.toString,
        bodyTag     = /^body/i,
        HTMLDoc     = '[object HTMLDocument]',
        objTypes = {
            array : '[object Array]',
            object : '[object Object]',
            complex : /object|array/i
        },
        slice           = Array.prototype.slice,
        methodRE        = /^(function|object)$/i,
        opacityRe       = /alpha\(opacity=(.*)\)/i,
        trimRe          = /^\s+|\s+$/g,
        wordsRe         = /\w/g,
        whitespaceRe    = /\s/,
        spacesRe        = /\s+/,
        HIDDEN          = 'hidden',
        VISIBILITY      = "visibility",
        DISPLAY         = "display",
        NONE            = "none",
        PADDING         = 'padding',
        MARGIN          = 'margin',
        BORDER          = 'border',
        LEFT            = '-left',
        RIGHT           = '-right',
        TOP             = '-top',
        BOTTOM          = '-bottom',
        WIDTH           = '-width',
        MATH = Math,
        visFly,
        // special markup used throughout Ext when box wrapping elements
        borders     = {l: BORDER + LEFT + WIDTH, r: BORDER + RIGHT + WIDTH, t: BORDER + TOP + WIDTH, b: BORDER + BOTTOM + WIDTH},
        paddings    = {l: PADDING + LEFT, r: PADDING + RIGHT, t: PADDING + TOP, b: PADDING + BOTTOM},
        margins     = {l: MARGIN + LEFT, r: MARGIN + RIGHT, t: MARGIN + TOP, b: MARGIN + BOTTOM},
        validIdRe   = /^[a-z0-9_\-]+$/i,
        // @private add/remove Listeners
        addListener = function () {
            var handler;
            if (window.addEventListener) {  //favor Standards-compliant browsers
                handler = function F(el, eventName, fn, capture) {
                    el.addEventListener(eventName, fn, !!capture);
                };
            } else if (window.attachEvent) {
                handler = function F(el, eventName, fn, capture) {
                    el.attachEvent("on" + eventName, fn);
                };
            } else {
                handler = function F(){};
            }
            var F = null; //Gbg collect
            return handler;
        }(),
        removeListener = function() {
            var handler;
            if (window.removeEventListener) { //favor Standards-compliant browsers
                handler = function F(el, eventName, fn, capture) {
                    el.removeEventListener(eventName, fn, (capture));
                };
            } else if (window.detachEvent) {
                handler = function F(el, eventName, fn) {
                    el.detachEvent("on" + eventName, fn);
                };
            } else {
                handler = function F(){};
            }
            var F = null; //Gbg collect
            return handler;
        }();


    Ext.supports.ComputedStyle = function() {
        var view = document.defaultView;
        return !!view && Ext.isFunction(view.getComputedStyle);  //coerce assertion to bool
    }();


    Element.addMethods({
        remove : function(){
            var me = this,
                dom = me.dom;

            if (dom) {
                Ext.removeNode(dom);
                delete me.dom;   //remove this AFTER listeners/caches are cleared for document resolution
             }
        },

        getParentDocument : function(){
            return this.dom.ownerDocument || Element.getParentDocument(this.dom);
        },

        // private
        addStyles : function(sides, styles){
            var totalSize = 0,
                sidesArr = sides.match(wordsRe),
                i = 0,
                len = sidesArr.length,
                side,
                styleSides = [];

            if(len == 1) {
                totalSize += MATH.abs(parseFloat(this.getStyle( styles[sidesArr[0] ] ) ) || 0 );
            } else {
                for (; i < len; i++) {
                    side = sidesArr[i];
                    styleSides.push(styles[side]);
                }
                //Gather all at once, returning a hash
                styleSides = this.getStyles.apply(this, styleSides);

                for (i=0; i < len; i++) {
                    side = sidesArr[i];
                    totalSize += MATH.abs(parseFloat(styleSides[styles[side]]) || 0);
                }
            }
            return totalSize;
        },



        /**
         * Returns the current scroll position of the element.
         * @return {Object} An object containing the scroll position in the format {left: (scrollLeft), top: (scrollTop)}
         */
        getScroll : function() {
            var d = this.dom,
                doc = Ext.isDocument(d) ? d : this.getParentDocument(),
                body = doc.body,
                win,
                docElement = doc.documentElement,
                l,
                t,
                ret;

            if (d == doc || d == body || 'navigator' in d) {
                win = doc.defaultView || doc.parentWindow;

                if( typeof win.pageYOffset == 'number' ) {

                    t = win.pageYOffset;
                    l = win.pageXOffset;

                } else if( body && ( body.scrollLeft || body.scrollTop ) ) {

                    t = body.scrollTop;
                    l = body.scrollLeft;

                } else if( docElement && ( docElement.scrollLeft || docElement.scrollTop ) ) {

                    t = docElement.scrollTop;
                    l = docElement.scrollLeft;
                }

                ret = {
                    left: l || 0 ,
                    top : t || 0
                };

            } else {
                ret = {
                    left: d.scrollLeft,
                    top : d.scrollTop
                };
            }
            return ret;
        },

        /**
         * Scrolls this element into view within the passed container.
         * @param {String/HTMLElement/Ext.Element} container (optional) The container element to scroll (defaults to document.body).  Should be a
         * string (id), dom node, or Ext.Element.
         * @param {Boolean} hscroll (optional) False to disable horizontal scroll (defaults to true)
         * @return {Ext.dom.Element} this
         */
        scrollIntoView : function(container, hscroll) {

            var el = this.dom;

            container = Ext.getDom(container) || this.getParentDocument().body;
            var offsets = this.getOffsetsTo(container),
                topContainer = /body|html|\#document$/i.test(container.nodeName) || 'navigator' in container,
                cFly    = Ext.fly(container, '_scroll'),
                scroll  = cFly.getScroll(),
            // el's box
                left    = offsets[0] + ( topContainer ? 0 : scroll.left),
                top     = offsets[1] + ( topContainer ? 0 : scroll.top),
                bottom  = top + el.offsetHeight,
                right   = left + el.offsetWidth,
            // ct's box
                viewSize = cFly.getViewSize(),
                ctBottom = scroll.top + viewSize.height,
                ctRight = scroll.left + viewSize.width,
                scrollEl = container,
                newTop  = scroll.top,
                newLeft = scroll.left;

            if(topContainer){
                 scrollEl = this.getParentDocument();
                 scrollEl = scrollEl.defaultView || scrollEl.parentWindow;
            }

            if (el.offsetHeight > viewSize.height ||  top < scroll.top) {
                newTop = top;
            } else if (bottom  > ctBottom) {
                newTop = bottom -  viewSize.height;
            }

            if (hscroll !== false &&
                 (left - scroll.left < 1 || ctRight > 0 ) ) {
                    newLeft = left;
            }

            if(scrollEl.scrollTo ) {
                scrollEl.scrollTo( newLeft || 0, newTop);
            } else
                {
                    scrollEl.scrollTop = newTop;
                    scrollEl.scrollLeft = newLeft || 0;
                }

            return this;
        },

        // @private
        scrollChildIntoView: function(child, hscroll, scrollParents) {
            var parent,
                fly = Ext.fly(child, '_scrollChildIntoView');

            if(scrollParents )
                {
                    while(fly.dom && fly.dom != this.dom) {
                        fly.scrollIntoView(fly.dom.parentNode, hscroll);
                        fly.dom.parentNode && fly.attach(fly.dom.parentNode);
                    }
            } else
                {
                    fly.scrollIntoView(this, hscroll);
                }

        },

        /**
         * Set the size of this Element. If animation is true, both width and height will be animated concurrently.
         * @param {Number/String} width The new width. This may be one of:
         *
         * - A Number specifying the new width in this Element's {@link #defaultUnit}s (by default, pixels).
         * - A String used to set the CSS width style. Animation may **not** be used.
         * - A size object in the format `{width: widthValue, height: heightValue}`.
         *
         * @param {Number/String} height The new height. This may be one of:
         *
         * - A Number specifying the new height in this Element's {@link #defaultUnit}s (by default, pixels).
         * - A String used to set the CSS height style. Animation may **not** be used.
         *
         * @param {Boolean/Object} [animate] true for the default animation or a standard Element animation config object
         * @return {Ext.dom.Element} this
         */
        setSize: function(width, height) {
            var me = this,
                style = me.dom.style,
                empty = Ext.isEmpty;

            if (Ext.isObject(width)) {
                // in case of object from getSize()
                height = width.height;
                width = width.width;
            }

            if(!empty(width)) {
                style.width = Element.addUnits(width);
            }
            if(!empty(height)) {
                style.height = Element.addUnits(height);
            }
            return me;
        },

        getViewSize: function() {
            var doc = this.getParentDocument(),
                dom = this.dom,
                win = doc.defaultView || doc.parentWindow;

            if (dom == doc || dom == doc.body || 'navigator' in dom) {
                return {
                    width: Element.getViewportWidth(win),
                    height: Element.getViewportHeight(win)
                };
            }
            else {
                return {
                    width: dom.clientWidth,
                    height: dom.clientHeight
                };
            }
        },

        /**
        * Gets an object with all CSS positioning properties. Useful along with setPostioning to get
        * snapshot before performing an update and then restoring the element.
        * @return {Object}
        */
        getPositioning : function(){

            var styles = this.getStyles('left', 'top', 'position', 'right', 'bottom', 'z-index'),
                l = styles.left,
                t = styles.top;

            return Ext.apply(styles,
              {
                "right" : l ? "" : styles.right,
                "bottom" : t ? "" : styles.bottom
              });
        },

        /**
         * Translates the passed page coordinates into left/top css values for this element
         * @param {Number/Array} x The page x or an array containing [x, y]
         * @param {Number} y (optional) The page y, required if x is not an array
         * @return {Object} An object with left and top properties. e.g. {left: (value), top: (value)}
         */
        translatePoints: function(x, y) {

            var ext = Ext,
                me = this,
                styles = me.getStyles('position', 'top', 'left'),
                relative = styles.position == 'relative',
                o = me.getXY(),
                left = parseFloat(styles.left),
                top = parseFloat(styles.top);

            if (ext.isArray(x)) {
                 y = x[1];
                 x = x[0];
            }
            if (!ext.isNumber(left)) {
                left = relative ? 0 : me.dom.offsetLeft;
            }
            if (!ext.isNumber(top)) {
                top = relative ? 0 : me.dom.offsetTop;
            }
            left = (ext.isNumber(x)) ? x - o[0] + left : undefined;
            top = (ext.isNumber(y)) ? y - o[1] + top : undefined;
            return {
                left: left,
                top: top
            };
        },

        getBox: function(contentBox, local) {
            var me = this,
                xy,
                left,
                top,
                paddingW,
                bordersW,
                l, r, t, b, w, h, bx;

            if (!local) {
                xy = me.getXY();
                left = xy[0];
                top = xy[1];
            } else {
                left = parseFloat(me.getStyle("left")) || 0;
                top = parseFloat(me.getStyle("top")) || 0;
            }
            w = me.getWidth();
            h = me.getHeight();
            if (!contentBox) {
                bx = {
                    x: left,
                    y: top,
                    0: left,
                    1: top,
                    width: w,
                    height: h
                };
            } else {

                paddingW = me.getStyles(paddings.l, paddings.r, paddings.t, paddings.b);
                bordersW = me.getStyles(borders.l,  borders.r,  borders.t,  borders.b);

                l = (parseFloat(bordersW[borders.l]) || 0) + (parseFloat(paddingW[paddings.l]) || 0);
                r = (parseFloat(bordersW[borders.r]) || 0) + (parseFloat(paddingW[paddings.r]) || 0);
                t = (parseFloat(bordersW[borders.t]) || 0) + (parseFloat(paddingW[paddings.t]) || 0);
                b = (parseFloat(bordersW[borders.b]) || 0) + (parseFloat(paddingW[paddings.b]) || 0);

                bx = {
                    x: left + l,
                    y: top + t,
                    0: left + l,
                    1: top + t,
                    width: w - (l + r),
                    height: h - (t + b)
                };
            }
            bx.right = bx.x + bx.width;
            bx.bottom = bx.y + bx.height;

            return bx;
        },

        /*
         * Method to return numeric style properties either in 'px' or
         * converted from (pt, em, etc)
         * @param {String} prop The style property whose value is returned.
         * @return {String} The current value of the style property for this element.
         * @method
         */
        getPixelStyle  : function(){
            var isPix = /^\-?\d+(px)?$/i,
                isFontSize = /fontsize|font-size/i;
            return (document.defaultView && Ext.isFunction(document.defaultView.getComputedStyle) )
                ? Element.prototype.getStyle
                :function(prop){
                    var value = this.getStyle.apply(this, slice.call(arguments, 0 )),
                        me = this,
                        dom = me.dom;

                    if (!isPix.test(value)) {
                        var style = dom.style,
                            leftStyle = style.left,
                            runtimeStyleLeft = dom.runtimeStyle.left;

                        dom.runtimeStyle.left = dom.currentStyle.left;
                        style.left = isFontSize.test(prop) ? "1em" : (value || 0);
                        value = style.pixelLeft;
                        style.left = leftStyle;
                        dom.runtimeStyle.left = runtimeStyleLeft;
                        if(Ext.isNumber(value)) {
                            value = value + 'px';
                        }
                    }
                    return value;
                };
        }(),

        /**
         * Returns a child element of this element given its `id`.
         * @method getById
         * @member Ext.dom.AbstractElement
         * @param {String} id The id of the desired child element.
         * @param {Boolean} [asDom=false] True to return the DOM element, false to return a
         * wrapped Element object.
         */
        getById  : document.querySelector ?
            function (id, asDom, doc) {
                // for normal elements getElementById is the best solution, but if the el is
                // not part of the document.body, we have to resort to querySelector
                var dom = (doc || DOC).getElementById(id) ||
                          this.dom.querySelector('#'+Ext.escapeId(id));
                return asDom ? dom : (dom ? Ext.get(dom) : null);
            } :
            function (id, asDom, doc) {
                var dom = (doc || DOC).getElementById(id);
                return asDom ? dom : (dom ? Ext.get(dom) : null);
            },


        isVisible : function(deep) {
            var me = this,
                dom = me.dom,
                stopNode = dom.ownerDocument.documentElement;

            if (!visFly) {
                visFly = new Element.Fly();
            }

            while (dom !== stopNode) {
                // We're invisible if we hit a nonexistent parentNode or a document
                // fragment or computed style visibility:hidden or display:none
                if (!dom || dom.nodeType === 11 || dom.hidden === true || (visFly.attach(dom)).isStyle(VISIBILITY, HIDDEN) || visFly.isStyle(DISPLAY, NONE)) {
                    delete visFly.dom;
                    return false;
                }
                // Quit now unless we are being asked to check parent nodes.
                if (!deep) {
                    break;
                }
                dom = dom.parentNode;
            }
            delete visFly.dom;
            return true;
        },

        getCache: function() {
            var me = this;

            // Note that we do not assign an ID to the calling object here.
            // An Ext.dom.Element will have one assigned at construction, and an Ext.dom.Element.Fly must not have one.
            // We assign an ID to the DOM element if it does not have one.
            me.$cache = me.$cache || Element.getElementCache(me.dom, true);

            return me.$cache;
        }

    });

    Element.Fly.addMethods ({

        attach: function (dom) {

            // Attach to the passed DOM element. The same code as in Ext.Fly
            this.dom = dom;
            // Use cached data if there is existing cached data for the referenced DOM element,
            // otherwise it will be created when needed by getCache.
            this.$cache = Element.getElementCache(dom, true);
            return this;
        }

    });

    Ext.apply(Ext, {

        id    : function(el, prefix) {
            var me = this,
                sandboxPrefix = "";
                el = Ext.getDom(el, true) || {};

            if (!el.id) {
                if ( el === document) {
                    el.id = me.documentId;
                } else if (el === window) {
                    el.id = me.windowId;
                } else {

                    if (me.isSandboxed) {
                        if (!me.uniqueGlobalNamespace) {
                            me.getUniqueGlobalNamespace();
                        }
                        sandboxPrefix = me.uniqueGlobalNamespace + "-";
                    }
                    // ID collision avoidance
                    if(!prefix) {
                        if(Ext.isDocument(el)) {

                            prefix = 'ext-doc';
                        }else if(DOC !== Element.getParentDocument(el)) {
                            //El is a child of another document
                            prefix = 'ext-doc-gen';
                        }
                    }
                    el.id = sandboxPrefix + (prefix || "ext-gen") + (++Ext.idSeed);
                }
            }
            return el.id;
        },

        fly : function(el, named, doc) {
                var me = this,
                    ret = null,
                    doc = doc || document,
                    docCache,
                    id, cached, flys;


                if(!doc || !el) {
                    return ret;
                }
                named = named || '_global';
                el = Ext.getDom(el, false, doc);
                if (el) {
                    docCache = Element.getDocumentCache(el, true);
                    flys = docCache.__flyweights || (docCache.__flyweights = {skipGarbageCollection : true});
                    cached = flys[named] || (flys[named] = {});
                    id = Ext.id(el);

                    /*
                    * maintain a Frame-localized cache of Flyweights
                    */
                    (ret = cached[id] = cached[id] || (cached[id] = new Ext.Element.Fly())).attach(el);
                }

                return ret;
            },


        removeNode : function(n){

             var dom = n ? n.dom || n : null,
                 el, elc, elCache = Element.getDocumentCache(dom, false) || {}, parent;

            //clear out any references if found in the cache(s)
            if(dom && (elc = elCache[dom.id]) && (el = elc.el) ){
                if(el.dom){
                    Ext.enableNestedListenerRemoval ? EventManager.purgeElement(el.dom, true) : EventManager.removeAll(el.dom);
                }
                delete elCache[dom.id];
                delete el.$cache;
                delete el.dom;
                el = null;
            }
            //No removal for window, documents, or bodies
            if(!Ext.isWindow(dom) && !Ext.isDocument(dom) && !bodyTag.test(dom.tagName)){
                (parent = dom.parentElement || dom.parentNode) && parent.removeChild(dom);
            }
            dom = parent = null;
        },


        /**
         * HTMLDocument assertion with optional accessibility testing
         * @param {HTMLELement} el The DOM Element to test
         * @param {Boolean} testOrigin (optional) True to test "same-origin" access
         *
         */
        isDocument : function(el, testOrigin){
            var elm, test = false;
            try {
                elm = el ? el.dom || el : null;
                test = !!elm && (toString.apply(elm) == HTMLDoc || elm.nodeType == 9);
                if(test && testOrigin){
                    test = !!elm.location;
                }
            }catch(e){test = false;}
            return test;
        },

        isWindow : function(el){
            var elm = el ? el.dom || el : null;
            return elm ? ('navigator' in elm && 'self' in elm) || toString.apply(elm) == "[object Window]" : false;
        },

        /**
         * Returns true if an object's member reference is a callable function
         * @argument {Object} object
         * @argument {String} member The string name of the referenced object's member to be tested
         * (Member should be limited to those universally implemented as methods)
         */

        isHostMethod : function(obj, member){
            if(typeof obj != 'undefined') {
                var t = typeof obj[member];
                return methodRE.test(t) || t == 'unknown';
            }
            return false;
        },

        isHostObjectProperty : function(obj, member) {
            return typeof obj != 'undefined' ? methodRE.test(typeof obj[member]) : false;
		},

        isComplex : function(obj){
           return !!obj && objTypes.complex.test(typeof obj);
        },

        isElement : function(obj){
            if(obj){
                var o = obj.dom || obj;
                return !!o.tagName || (/\[object html/i).test(toString.apply(o));
            }
            return false;
        },

        isDOMEvent : function(obj){
            return toString.apply(obj) == '[object Event]' || (Ext.isObject(obj) && !Ext.type(obj.constructor) && (window.event && obj.clientX && obj.clientX === window.event.clientX));
        },

        isDocumentStrict : function(doc) {
            return (doc && doc.compatMode && doc.compatMode != "BackCompat");
        },

        addCacheEntry: function(id, el, dom) {
            dom = dom || (el && el.dom);


            var cache = Element.getDocumentCache(dom, true) || {},
                key = id || (el && el.id) || dom.id,
                entry = cache[key] || (cache[key] = {
                    data: {},
                    events: {},

                    dom: dom,

                    // Skip garbage collection for special elements (window, document, iframes)
                    skipGarbageCollection: !!(dom.getElementById || dom.navigator)
                });

            if (el) {
                el.$cache = entry;
                // Inject the back link from the cache in case the cache entry
                // had already been created by Ext.fly. Ext.fly creates a cache entry with no el link.
                entry.el = el;
            }

            return entry;
        },

        updateCacheEntry: function(cacheItem, dom){
            cacheItem.dom = dom;
            if (cacheItem.el) {
                cacheItem.el.dom = dom;
            }
            return cacheItem;
        }

    });

    //give getDom document context support
    Ext.getDom = function (el, strict, doc) {
        doc = doc || DOC;
        if (!el || !doc) { return null; }
        if (el.dom) {
            return el.dom;
        }
        else if (typeof el == "string") {
            var e = doc.getElementById(el);
            if (e && Ext.isIE && strict) {
                if (el != e.getAttribute("id")) {
                    return null;
                }
            }
            return e;
        } else {
            return el;
        }
    };

    Ext.apply( EventManager, {

        addListener: function(element, eventName, fn, scope, options) {
            // Check if we've been passed a "config style" event.
            if (typeof eventName !== 'string') {
                EventManager.prepareListenerConfig(element, eventName);
                return;
            }

            var dom = element.dom || Ext.getDom(element),
                bind, wrap, cache, id, cacheItem, capture,
                elementCache;


            // create the wrapper function
            options = options || {};

            bind = EventManager.normalizeEvent(eventName, fn);
            wrap = EventManager.createListenerWrap(dom, eventName, bind.fn, scope, options);

            // add all required data into the event cache
            cache = EventManager.getEventListenerCache(element.dom ? element : dom, eventName);
            eventName = bind.eventName;

            if (!dom.addEventListener) {
                id = EventManager.normalizeId(dom);

                // If there's no id we don't have any events bound, so we never
                // need to clone at this point.
                if (id) {
                    elementCache = Element.getElementCache(dom, true);
                    cacheItem = elementCache[eventName];
                    if (cacheItem && cacheItem.firing) {
                        // If we're in the middle of firing we want to update the class
                        // cache reference so it is different to the array we referenced
                        // when we started firing the event. Though this is a more difficult
                        // way of not mutating the collection while firing, a vast majority of
                        // the time we won't be adding listeners for the same element/event type
                        // while firing the same event.
                        cache = EventManager.cloneEventListenerCache(dom, eventName);
                    }
                }
            }

            capture = !!options.capture;
            cache.push({
                fn: fn,
                wrap: wrap,
                scope: scope,
                capture: capture
            });

            if(dom.addEventListener) {
                dom.addEventListener(eventName, wrap, capture);
            } else {
                // If cache length is 1, it means we're binding the first event
                // for this element for this type
                if (cache.length === 1) {

                    id = EventManager.normalizeId(dom, true);
                    elementCache = Ext.addCacheEntry(id, null, dom);
                    fn = Ext.Function.bind(EventManager.handleSingleEvent, EventManager, [dom, eventName], true);
                    elementCache[eventName] = {
                        firing: false,
                        fn: fn
                    };
                    dom.attachEvent('on' + eventName, fn);
                }
            }

            if (dom === document && eventName == 'mousedown') {
                EventManager.stoppedMouseDownEvent.addListener(wrap);
            }
        },

        // Handle the case where the window/document already has an id attached.
        // In this case we still want to return our custom window/doc id.
        normalizeId: function(dom, force) {
            var id;
            if (dom === Ext.global.document) {
                id = Ext.documentId;

            } else if (dom === Ext.global) {
                id = Ext.windowId;
            } else if(Ext.isWindow(dom) || Ext.isDocument(dom)) {
                force = true;
            } else {
                id = dom.id;
            }
            if (!id && force) {
                id = EventManager.getId(dom);
            }
            return id;
        },


        // Only called for IE
        handleSingleEvent: function(e, dom, eventName) {
            // Don't create a copy here, since we fire lots of events and it's likely
            // that we won't add an event during a fire. Instead, we'll handle this during
            // the process of adding events
            var listenerCache = EventManager.getEventListenerCache(dom, eventName),
                attachItem = Element.getElementCache(dom, true)[eventName],
                len, i;

            // Typically this will never occur, however, the framework allows the creation
            // of synthetic events in Ext.EventObject. As such, it makes it possible to fire
            // off the same event on the same element during this method.
            if (!attachItem || attachItem.firing) {
                return;
            }

            attachItem.firing = true;
            for (i = 0, len = listenerCache.length; i < len; ++i) {
                listenerCache[i].wrap(e);
            }
            attachItem.firing = false;

        },

        // fires the given event through the listeners collection
        fireEvent: function(e, dom) {

            dom = (dom || {}).dom || dom;

            if(!e || !e.type || !dom ) return;

            var listenerCache = EventManager.getEventListenerCache(dom, e.type),
                len, i, ret;

            for (i = 0, len = listenerCache.length; i < len; ++i) {
                if(ret !== false) {
                    ret = listenerCache[i].wrap(e);
                } else {
                    break;
                }
            }
            return ret;

        },

        /**
        * Removes all event handers from an element.  Typically you will use {@link Ext.core.Element#removeAllListeners}
        * directly on an Element in favor of calling this version.
        * @param {String/HTMLElement} el The id or html element from which to remove all event handlers.
        */
        removeAll : function(element){
            var el = element.dom ? element : Ext.get(element),
                cache, events, eventName;

            if (!el) {
                return;
            }
            cache = el.$cache || el.getCache();
            events = (cache || {}).events || {};

            for (eventName in events) {
                if (events.hasOwnProperty(eventName)) {
                    this.removeListener(el, eventName);
                    delete events[eventName];
                }
            }
        },

         /**
         * Get the id of the element. If one has not been assigned, automatically assign it.
         * @param {Mixed} element The element to get the id for.
         * @return {String} id
         */
        getId : function(element) {
            var id, ext = Ext;

            var el = ext.getDom(element);

            id = Ext.id(el);

            //Flyweights or core.Element subclasses are used here if passed:
            ext.addCacheEntry(id, null, element);
            return id;
        },

        /**
         * Get the event cache for a particular element
         * @private
         * @param {HTMLElement} element The element
         * @return {Array} The events for the element
         */
        getEventCache : function(element) {
            var elementCache, eventCache, id, docCache;
            if (!element) {
                return [];
            }

            if (element.$cache) {
                elementCache = element.$cache;
            } else {
                elementCache = Element.getElementCache(element, true);
            }
            return elementCache.events || (elementCache.events = {});
        },

        /**
         * Gets the x & y coordinate from the event
         * @param {Object} event The event
         * @return {Number[]} The x/y coordinate
         */
        getPageXY: function(event) {
            event = event.browserEvent || event;
            var x = event.pageX,
                y = event.pageY,
                doc = event.target.ownerDocument,
                docEl = doc && doc.documentElement,
                body = doc && doc.body;

            // pageX/pageY not available (undefined, not null), use clientX/clientY instead
            if (!x && x !== 0) {
                x = event.clientX + (docEl && docEl.scrollLeft || body && body.scrollLeft || 0) - (docEl && docEl.clientLeft || body && body.clientLeft || 0);
                y = event.clientY + (docEl && docEl.scrollTop  || body && body.scrollTop  || 0) - (docEl && docEl.clientTop  || body && body.clientTop  || 0);
            }
            return [x, y];
        }

    });

    Ext.override(Ext.EventObjectImpl, {

         /**
         * Returns true if the target of this event is a child of el.  Unless the allowEl parameter is set, it will return false if if the target is el.
         * Example usage:<pre><code>
    // Handle click on any child of an element
    Ext.getBody().on('click', function(e){
        if(e.within('some-el')){
            alert('Clicked on a child of some-el!');
        }
    });

    // Handle click directly on an element, ignoring clicks on child nodes
    Ext.getBody().on('click', function(e,t){
        if((t.id == 'some-el') && !e.within(t, true)){
            alert('Clicked directly on some-el!');
        }
    });
    </code></pre>
         * @param {String/HTMLElement/Ext.Element} el The id, DOM element or Ext.Element to check
         * @param {Boolean} related (optional) true to test if the related target is within el instead of the target
         * @param {Boolean} allowEl (optional) true to also check if the passed element is the target or related target
         * @return {Boolean}
         */
        within : function(el, related, allowEl){
            if(el){
                var t = related ? this.getRelatedTarget() : this.getTarget(),
                    doc = Element.getParentDocument(t) || document,
                    result;

                if (t) {
                    result = Ext.fly(el, '_within', doc).contains(t);
                    if (!result && allowEl) {
                        result = t == Ext.getDom(el, false, doc);
                    }
                    return result;
                }
            }
            return false;
        },

        // Expanded for 'message' support
        setEvent: Ext.EventObject.setEvent = function(event, freezeEvent){
            var me = this, button, options;

            if (event === me || (event && event.browserEvent)) { // already wrapped
                return event;
            }
            me.browserEvent = event;
            if (event) {
                // normalize buttons
                button = event.button ? me.btnMap[event.button] : (event.which ? event.which - 1 : -1);
                if (me.clickRe.test(event.type) && button == -1) {
                    button = 0;
                }
                options = {
                    type: event.type,
                    button: button,
                    shiftKey: event.shiftKey,
                    // mac metaKey behaves like ctrlKey
                    ctrlKey: event.ctrlKey || event.metaKey || false,
                    altKey: event.altKey,
                    // in getKey these will be normalized for the mac
                    keyCode: event.keyCode,
                    charCode: event.charCode,
                    // cache the targets for the delayed and or buffered events
                    target: Ext.EventManager.getTarget(event),
                    relatedTarget: Ext.EventManager.getRelatedTarget(event),
                    currentTarget: event.currentTarget,
                    xy: (freezeEvent ? me.getXY() : null),
                    data : event.data,
                    origin : event.origin,
                    ports : event.ports,
                    source : event.source,
                    lastEventId : event.lastEventId,
                    view  : event.view
                };

            } else {
                options = {
                    button: -1,
                    shiftKey: false,
                    ctrlKey: false,
                    altKey: false,
                    keyCode: 0,
                    charCode: 0,
                    target: null,
                    xy: [0, 0],
                    view : null,
                    source : null,
                    data : null,
                    origin : null,
                    ports : null,
                    relatedTarget : null
                };
            }
            Ext.apply(me, options);
            return me;
        },


        /**
         * Injects a DOM event using the data in this object and (optionally) a new target.
         * This is a low-level technique and not likely to be used by application code. The
         * currently supported event types are:
         * <p><b>HTMLEvents</b></p>
         * <ul>
         * <li>load</li>
         * <li>beforeunload</li>
         * <li>unload</li>
         * <li>select</li>
         * <li>change</li>
         * <li>submit</li>
         * <li>reset</li>
         * <li>resize</li>
         * <li>scroll</li>
         * </ul>
         * <p><b>MouseEvents</b></p>
         * <ul>
         * <li>click</li>
         * <li>dblclick</li>
         * <li>mousedown</li>
         * <li>mouseup</li>
         * <li>mouseover</li>
         * <li>mousemove</li>
         * <li>mouseout</li>
         * </ul>
         * <p><b>UIEvents</b></p>
         * <ul>
         * <li>focusin</li>
         * <li>focusout</li>
         * <li>activate</li>
         * <li>focus</li>
         * <li>blur</li>
         * </ul>
         * Additionally, custom event types may fired.
         * @param {Ext.Element/HTMLElement} target (optional) If specified, the target for the event. This
         * is likely to be used when relaying a DOM event. If not specified, {@link #getTarget}
         * is used to determine the target.
         */
        injectEvent: Ext.EventObject.injectEvent = (function () {
            var API,
                dispatchers = {}, // keyed by event type (e.g., 'mousedown')
                crazyIEButtons;

            // Good reference: http://developer.yahoo.com/yui/docs/UserAction.js.html

            // IE9 has createEvent, but this code causes major problems with htmleditor (it
            // blocks all mouse events and maybe more). TODO

            if (!Ext.isIE && document.createEvent) { // if (DOM compliant)
                API = {
                    createHtmlEvent: function (doc, type, bubbles, cancelable) {
                        var event = doc.createEvent('HTMLEvents');

                        event.initEvent(type, bubbles, cancelable);
                        return event;
                    },

                    createEvent : function(doc, type , event, bubbles, cancelable) {
                        var event = doc.createEvent( 'Event');
                        event.initEvent(type, !!Ext.value(bubbles, false), !!Ext.value(cancelable, false));
                        return event;
                    },

                    createMessageEvent : function(doc, type , bubbles, cancelable, data, origin, lastEventId, source, ports) {
                        var event = doc.createEvent('MessageEvent');
                        event.initMessageEvent(type, !!Ext.value(bubbles, false), !!Ext.value(cancelable, false), data, origin, lastEventId, source, ports);
                        return event;
                    },

                    createMouseEvent: function (doc, type, bubbles, cancelable, detail,
                                                clientX, clientY, ctrlKey, altKey, shiftKey, metaKey,
                                                button, relatedTarget) {
                        var event = doc.createEvent('MouseEvents'),
                            view = doc.defaultView || window;

                        if (event.initMouseEvent) {
                            event.initMouseEvent(type, bubbles, cancelable, view, detail,
                                        clientX, clientY, clientX, clientY, ctrlKey, altKey,
                                        shiftKey, metaKey, button, relatedTarget);
                        } else { // old Safari
                            event = doc.createEvent('UIEvents');
                            event.initEvent(type, bubbles, cancelable);
                            event.view = view;
                            event.detail = detail;
                            event.screenX = clientX;
                            event.screenY = clientY;
                            event.clientX = clientX;
                            event.clientY = clientY;
                            event.ctrlKey = ctrlKey;
                            event.altKey = altKey;
                            event.metaKey = metaKey;
                            event.shiftKey = shiftKey;
                            event.button = button;
                            event.relatedTarget = relatedTarget;
                        }

                        return event;
                    },

                    createUIEvent: function (doc, type, bubbles, cancelable, detail) {
                        var event = doc.createEvent('UIEvents'),
                            view = doc.defaultView || doc.parentWindow ||  window;

                        event.initUIEvent(type, bubbles, cancelable, view, detail);
                        return event;
                    },

                    createKeyEvent : function(doc, type, bubbles, cancelable, ctrlKey,
                                altKey, shiftKey, metaKey, keyCode, charCode) {
                        var event,
                            view = doc.defaultView ||  doc.parentWindow ||  window;
                        try {
                            event = doc.createEvent('KeyEvents');
                            //account for legacy Firefox problems
                            event.initKeyEvent(type, bubbles, cancelable, view, ctrlKey,
                                altKey, shiftKey, metaKey, keyCode, charCode);

                        } catch(e) {
                            try {

                                //try to create generic event - will fail in Safari 2.x
                                event = doc.createEvent("Events");

                            } catch (uierror){

                                //the above failed, so create a UIEvent for Safari 2.x
                                event = doc.createEvent("UIEvents");

                            } finally {

                                event.initEvent(type, bubbles, cancelable);

                                Ext.apply(event, {
                                    ctrlKey : ctrlKey,
                                    altKey  : altKey,
                                    shiftKey : shiftKey,
                                    metaKey : metaKey,
                                    keyCode : keyCode,
                                    charCode : charCode
                                });

                            }
                        }
                        return event;

                    },

                    fireEvent: function (target, type, event) {
                        target.dispatchEvent(event);
                    },

                    fixTarget: function (target) {
                        // Safari3 doesn't have window.dispatchEvent()
                        if (Ext.isWindow(target) && !target.dispatchEvent) {
                            return target.document;
                        }

                        return target;
                    }
                };
            } else if (document.createEventObject) { // else if (IE)
                crazyIEButtons = { 0: 1, 1: 4, 2: 2 };

                API = {
                    createHtmlEvent: function (doc, type, bubbles, cancelable) {
                        var event = doc.createEventObject();
                        event.bubbles = bubbles;
                        event.cancelable = cancelable;
                        return event;
                    },

                    createEvent: function(doc, type, event, bubbles, cancelable) {
                        var options = Ext.apply ({ type : 'on'+ type, bubbles : !!Ext.value(bubbles, true), cancelable : !!Ext.value(cancelable, false) });
                        return Ext.apply(doc.createEventObject(), options);
                    },

                    createMessageEvent : function(doc, type , bubbles, cancelable, data, origin, lastEventId, source, ports) {
                        return Ext.apply( doc.createEventObject(), {
                            bubbles : !!bubbles,
                            cancelable : !!cancelable,
                            data : data,
                            origin : origin,
                            source : source,
                            lastEventId : lastEventId
                        });
                    },

                    createMouseEvent: function (doc, type, bubbles, cancelable, detail,
                                                clientX, clientY, ctrlKey, altKey, shiftKey, metaKey,
                                                button, relatedTarget) {

                        return Ext.apply(doc.createEventObject(), {
                            bubbles : bubbles,
                            cancelable : cancelable,
                            detail : detail,
                            screenX : clientX,
                            screenY : clientY,
                            clientX : clientX,
                            clientY : clientY,
                            ctrlKey : ctrlKey,
                            altKey : altKey,
                            shiftKey : shiftKey,
                            metaKey : metaKey,
                            button : crazyIEButtons[button] || button,
                            relatedTarget : relatedTarget // cannot assign to/fromElement
                        });
                    },

                    createUIEvent: function (doc, type, bubbles, cancelable, detail) {
                        var event = doc.createEventObject();
                        event.bubbles = bubbles;
                        event.cancelable = cancelable;
                        event.detail = detail;
                        return event;
                    },

                    createKeyEvent : function(doc, type, bubbles, cancelable, ctrlKey,
                                altKey, shiftKey, metaKey, keyCode, charCode) {

                        return Ext.apply(doc.createEventObject() , {
                            bubbles : bubbles,
                            cancelable : cancelable,
                            view    : doc.defaultView ||  doc.parentWindow ||  window,
                            ctrlKey : ctrlKey,
                            altKey  : altKey,
                            shiftKey : shiftKey,
                            metaKey : metaKey,
                            /*
                             * IE doesn't support charCode explicitly. CharCode should
                             * take precedence over any keyCode value for accurate
                             * representation.
                             */
                            keyCode : (charCode > 0) ? charCode : keyCode
                        });

                    },

                    fireEvent: function (target, type, event) {
                        target.fireEvent('on' + type, event);
                    },

                    fixTarget: function (target) {
                        if (Ext.isDocument(target)) {
                            // IE6,IE7 thinks window==document and doesn't have window.fireEvent()
                            // IE6,IE7 cannot properly call document.fireEvent()
                            return target.documentElement;
                        }

                        return target;
                    }
                };
            }

            if(API) {
                //----------------
                // KeyEvents

               Ext.Object.each({
                        keypress: true,
                        keydown: true,
                        keyup  : true
                    },
                    function (name, value) {
                        dispatchers[name] = function (targetEl, srcEvent) {
                            var e = API.createKeyEvent(targetEl.ownerDocument, name, value, value, srcEvent.ctrlKey,
                                    srcEvent.altKey, srcEvent.shiftKey, srcEvent.metaKey, srcEvent.keyCode, srcEvent.charCode);
                            srcEvent.browserEvent = e;
                            return API.fireEvent(targetEl, name, e);
                        };
                    });

                //----------------
                // HTMLEvents

                Ext.Object.each({
                        load:   [false, false],
                        unload: [false, false],
                        beforeunload: [false, true],
                        select: [true, false],
                        change: [true, false],
                        submit: [true, true],
                        reset:  [true, false],
                        resize: [true, false],
                        scroll: [true, false]
                    },
                    function (name, value) {
                        var bubbles = value[0], cancelable = value[1];
                        dispatchers[name] = function (targetEl, srcEvent) {
                            var e = API.createHtmlEvent(targetEl.ownerDocument, name, bubbles, cancelable);
                            srcEvent.browserEvent = e;
                            return API.fireEvent(targetEl, name, e);
                        };
                    });

                //Dynamic, generic, yet cached for re-use
                function createEventDispatcher (type, event) {
                    return dispatchers[type] = function (targetEl, srcEvent) {
                        var e = API.createEvent(targetEl.ownerDocument, type, srcEvent);
                        srcEvent.browserEvent = e;
                        return API.fireEvent(targetEl, type, e);
                    };
                }

                (function createMessageEventDispatcher (type, detail) {
                    return (dispatchers[type] = function (targetEl, srcEvent) {

                        var be = srcEvent.browserEvent || srcEvent,
                            e = API.createMessageEvent(
                                targetEl.ownerDocument || targetEl.document,
                                type,
                                false,
                                false,
                                be.data,
                                be.origin,
                                be.lastEventId,
                                be.source,
                                be.ports
                            );
                        srcEvent.browserEvent = e;
                        return API.fireEvent(targetEl, type, e);
                    });
                })('message');

                //----------------
                // MouseEvents

                function createMouseEventDispatcher (type, detail) {
                    var cancelable = (type != 'mousemove');
                    return function (targetEl, srcEvent) {
                        var xy = srcEvent.getXY(),
                            e = API.createMouseEvent(targetEl.ownerDocument, type, true, cancelable,
                                        detail, xy[0], xy[1], srcEvent.ctrlKey, srcEvent.altKey,
                                        srcEvent.shiftKey, srcEvent.metaKey, srcEvent.button,
                                        srcEvent.relatedTarget);
                        srcEvent.browserEvent = e;
                        return API.fireEvent(targetEl, type, e);
                    };
                }

                Ext.each(['click', 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mousemove', 'mouseout'],
                    function (eventName) {
                        dispatchers[eventName] = createMouseEventDispatcher(eventName, 1);
                    });

                //----------------
                // UIEvents

                Ext.Object.each({
                        focusin:  [true, false],
                        focusout: [true, false],
                        activate: [true, true],
                        focus:    [false, false],
                        blur:     [false, false]
                    },
                    function (name, value) {
                        var bubbles = value[0], cancelable = value[1];
                        dispatchers[name] = function (targetEl, srcEvent) {
                            var e = API.createUIEvent(targetEl.ownerDocument, name, bubbles, cancelable, 1);
                            srcEvent.browserEvent = e;
                            return API.fireEvent(targetEl, name, e);
                        };
                    });


            } else {
                dispatchers = {};

            }

            function cannotInject (target, srcEvent) {
            }

            return function (target) {
                var me = this,
                    dispatcher = dispatchers[me.type] || (API && createEventDispatcher(me.type, me.browserEvent)) || cannotInject,
                    t = target ? (target.dom || target) : me.getTarget();

                return API ? dispatcher( API.fixTarget(t), me) : null;
            };
        }()) // call to produce method
    });

    //statics
    Element.addInheritableStatics({

    /**
         * Retrieves Ext.dom.Element objects. {@link Ext#get} is alias for {@link Ext.dom.Element#get}.
         *
         * **This method does not retrieve {@link Ext.Component Component}s.** This method retrieves Ext.dom.Element
         * objects which encapsulate DOM elements. To retrieve a Component by its ID, use {@link Ext.ComponentManager#get}.
         *
         * Uses simple caching to consistently return the same object. Automatically fixes if an object was recreated with
         * the same id via AJAX or DOM.
         *
         * @param {String/HTMLElement/Ext.Element} el The id of the node, a DOM Node or an existing Element.
         * @return {Ext.dom.Element} The Element object (or null if no matching element was found)
         * @static
         * @inheritable
         */
        get: function(el, doc) {
            var me = this,
                El = Ext.dom.Element,
                extEl,
                dom,
                id,
                cache;

            if (!el) {
                return null;
            }

            // Ext.get(flyweight) must return an Element instance, not the flyweight
            if (el.isFly) {
                el = el.dom;
            }

            if (typeof el == "string") { // element id
                if (!(dom = (doc || DOC).getElementById(el))) {
                    return null;
                }
                cache = Element.getDocumentCache(dom, true);
                if (cache[el] && cache[el].el) {
                    extEl = cache[el].el;
                    extEl.dom = dom;
                } else {
                    extEl = me.addToCache(new El(dom));
                }
                return extEl;
            } else if (el.tagName) { // dom element
                if (!(id = el.id)) {
                    id = Ext.id(el);
                }
                cache = Element.getDocumentCache(el, true);
                if (cache[id] && cache[id].el) {
                    extEl = cache[id].el;
                    extEl.dom = el;
                } else {
                    extEl = me.addToCache(new El(el));
                }
                return extEl;
            } else if (el instanceof me) {
                if (!Ext.isDocument(el)) {
                    // refresh dom element in case no longer valid,
                    // catch case where it hasn't been appended
                    el.dom = el.getParentDocument().getElementById(el.id) || el.dom;
                }
                return el;
            } else if (el.isComposite) {
                return el;
            } else if (Ext.isArray(el)) {
                return me.select(el);
            } else if (Ext.isDocument(el)) {
                // create a bogus element object representing the document object

                var docEl = Ext.Object.chain(El.prototype);
                docEl.dom = el;
                // set an "el" property on the element that references itself.
                // This allows Ext.util.Positionable methods to operate on
                // this.el.dom since it gets mixed into both Element and Component
                docEl.el = docEl;
                docEl.isDocument = true;
                docEl.id = Ext.id(el);
                me.addToCache(docEl);
                if(!me.docEl && docEl === document) {
                    me.docEl = docEl;
                }
                return docEl;
            }
            return null;
        },

        addToCache : function(el, id) {

            if (el) {
                Ext.addCacheEntry(id, el);
            }
            return el;
        },

        // private method for getting and setting element data
        data: function(el, key, value) {
            el = this.get(el);
            if (!el) {
                return null;
            }
            var c = el.getCache().data || {};
            if (arguments.length == 2) {
                return c[key];
            } else {
                return (c[key] = value);
            }
        },

        /*
         * method to return the document context of a passed HTMLElement
         * @static
         */
        getParentDocument : function(el, accessTest){

            var doc, dom= null, ext = Ext;

            try{
                dom = ext.getDom(el); //will fail if El.dom is non "same-origin" document
            }catch(ex){}

            if(dom) {
                doc = ext.isDocument(dom) ? dom : (dom.ownerDocument || dom.document);
            }
            if(doc && accessTest) {
                 doc = ext.isDocument(doc, accessTest) ? doc : null;
            }
            return doc;
        },


        getDocumentCache  : function(element, create, cacheId) {
            var elDoc = Element.getParentDocument(element);

            if(elDoc === document) {
                return Ext.cache;
            }
            //Now test to ensure the foreign document is accessible
            if(elDoc && Ext.isDocument(elDoc ,true) ) {
                cacheId = cacheId || Ext.id(elDoc);
                return DC[cacheId] || (create !== false ? (DC[cacheId] = {}) : null);
            }

        },

        /*
         * Return a reference to the cache block stored in the documentCache or Ext.cache
         */
        getElementCache : function(el, create, sourceDocument) {
            el = (el || {}).dom || el;
            create = !!create;

            var cache = null,
                docCache,
                id;

            if(el) {
                if(typeof el == 'string' &&
                    (el === Ext.windowId || el === Ext.documentId)
                    ) {
                        docCache = Ext.cache;
                        id = el;
                } else {
                    docCache = Element.getDocumentCache(sourceDocument || el, create);
                }
                if(docCache) {
                    id = id || el.id || Ext.id(el);
                    cache = docCache[id] || (create ? Ext.addCacheEntry(id, null, el) : null);
                }
            }
            return cache;
        },

        //Purge all listener and cache entries for a document cache
        clearDocumentCache : function(doc){
            // Purge all elements in the cache
            var el,
                dom,
                cache = Element.getDocumentCache(doc, false),
                id = doc && Ext.id(doc),
                entry;

            if(cache) {
                delete cache.__flyweights;
                for (el in cache) {
                    if (cache.hasOwnProperty(el)) {
                        entry = cache[el];
                        dom = entry.el || entry.dom;
                        !dom || Ext.EventManager.removeAll(dom);
                    }
                }
                if(id) delete DC[id];
            }

        },

        getXY : function(el) {

            var fly = (el && el.dom) ? el : Ext.fly(el),
                p,
                pe,
                b,
                bt,
                bl,
                x = 0,
                y = 0,
                scroll,
                hasAbsolute,
                styles,
                doc = fly.dom.ownerDocument,
                bd = (doc.body || doc.documentElement),
                ret = [0,0];

            el = fly.dom;

            if(el && el != doc.body && el != doc.documentElement){
                hasAbsolute = fly.isStyle("position", "absolute");

                if (el.getBoundingClientRect) {
                    b = el.getBoundingClientRect();
                    scroll = Ext.fly(doc, '_docs').getScroll();
                    ret = [Math.round(b.left + (scroll.left || 0) ), Math.round(b.top + (scroll.top || 0))];
                } else {
                    p = el;

                    while (p) {
                        pe = Ext.fly(p, '_parents');

                        x += p.offsetLeft;
                        y += p.offsetTop;

                        hasAbsolute = hasAbsolute || pe.isStyle("position", "absolute");

                        if (Ext.isGecko) {
                            styles = pe.getStyles("borderTopWidth","borderLeftWidth","overflow") || {};
                            y += bt = parseFloat(styles.borderTopWidth) || 0;
                            x += bl = parseFloat(styles.borderLeftWidth) || 0;

                            if (p != el && styles.overflow != 'visible') {
                                x += bl;
                                y += bt;
                            }
                        }
                        p = p.offsetParent;
                    }

                    if (Ext.isSafari && hasAbsolute) {
                        x -= bd.offsetLeft;
                        y -= bd.offsetTop;
                    }

                    if (Ext.isGecko && !hasAbsolute) {
                        styles = Ext.fly(bd, '_bodyStyle').getStyles("borderLeftWidth", "borderTopWidth") || {};
                        x += parseFloat(styles.borderLeftWidth) || 0;
                        y += parseFloat(styles.borderTopWidth) || 0;
                    }

                    p = el.parentNode;
                    while (p && p != bd) {
                        if (!Ext.isOpera || (p.tagName != 'TR' && !Ext.fly(p, '_parents').isStyle("display", "inline"))) {
                            x -= p.scrollLeft;
                            y -= p.scrollTop;
                        }
                        p = p.parentNode;
                    }
                    ret = [x,y];
                }
                var flies = Ext.dom.AbstractElement._flyweights;
                delete flies['_parents'];
                delete flies['_bodyStyle'];
                delete flies['_docs'];
            }
            return ret;
        },

        isDocumentStrict : function(doc) {
            doc = doc || DOC;
            return (doc && doc.compatMode && doc.compatMode != "BackCompat");
        },

        /**
         * Retrieves the document height
         * @static
         * @return {Number} documentHeight
         */
        getDocumentHeight: function(win) {
            win = win || window;
            var doc = this.getParentDocument(win);
            return Math.max(!this.isDocumentStrict(doc) ? doc.body.scrollHeight : doc.documentElement.scrollHeight, this.getViewportHeight(win));
        },

        /**
         * Retrieves the document width
         * @static
         * @return {Number} documentWidth
         */
        getDocumentWidth: function(win) {
            win = win || window;
            var doc = this.getParentDocument(win);
            return Math.max(!this.isDocumentStrict(doc) ? doc.body.scrollWidth : doc.documentElement.scrollWidth, this.getViewportWidth(win));
        },

        /**
         * Retrieves the viewport height of the window.
         * @static
         * @return {Number} viewportHeight
         */
        getViewportHeight: function(win){
            win = win || window;
            var doc = win.document;
            return Ext.isIE9m ?
                   (this.isDocumentStrict(doc) ? doc.documentElement.clientHeight : doc.body.clientHeight) :
                   win.innerHeight;
        },


        /**
         * Retrieves the viewport width of the window.
         * @static
         * @return {Number} viewportWidth
         */
        getViewportWidth: function(win) {
            win = win || window;
            var doc = win.document;
            return (!this.isDocumentStrict(doc) && !Ext.isOpera) ? doc.body.clientWidth :
                   Ext.isIE9m ? doc.documentElement.clientWidth : win.innerWidth;
        },

        /**
         * Retrieves the viewport size of the window.
         * @static
         * @return {Object} object containing width and height properties
         */
        getViewSize : function(win) {
            win = win || window;
            return {
                width   : this.getViewportWidth(win),
                height  : this.getViewportHeight(win)
            };
        },

        /**
         * Returns the top Element that is located at the passed coordinates
         * @static
         * @param {Number} x The x coordinate
         * @param {Number} x The y coordinate
         * @param {HTMLElement} doc The targeted document context
         * @return {Ext.FlyWeight} The found Element
         */
        fromPoint: function(x, y, doc) {
            doc = this.getParentDocument(doc || DOC);
            return doc ? Ext.fly(doc.elementFromPoint(x, y), '_fromPoint' ) : null;
        }



    });

    Ext.get = function(el, doc) {
        return Element.get(el, doc);
    };
    var useDocForId = !(Ext.isIE6 || Ext.isIE7 || Ext.isIE8);

    if (Ext.isIE) {
        Element.prototype.getById = function (id, asDom, doc) {
            var dom = this.dom,
                cached, el, ret;

            if (dom) {
                // for normal elements getElementById is the best solution, but if the el is
                // not part of the document.body, we need to use all[]
                el = (useDocForId && (doc || this.getParentDocument()).getElementById(id)) || dom.all[id];
                if (el) {
                    if (asDom) {
                        ret = el;
                    } else {
                        // calling El.get here is a real hit (2x slower) because it has to
                        // redetermine that we are giving it a dom el.
                        cached = (Element.getDocumentCache(el, false) || {})[id];
                        if (cached && cached.el) {
                            ret = cached.el;
                            ret.dom = el;
                        } else {
                            ret = Element.addToCache(new Element(el));
                        }
                    }
                    return ret;
                }
            }

            return asDom ? Ext.getDom(id) : Element.get(id);
        };
    }

    Ext.getDetachedBody = function (doc) {
        var detachedEl = AbstractElement.detachedBodyEl;

        if (!detachedEl) {
            detachedEl = (doc || DOC).createElement('div');
            AbstractElement.detachedBodyEl = detachedEl = new AbstractElement.Fly(detachedEl);
            detachedEl.isDetachedBody = true;
        }

        return detachedEl;
    };

    Ext.getElementById = function (id, doc) {
        var el = (doc || DOC).getElementById(id),
            detachedBodyEl;

        if (!el && (detachedBodyEl = AbstractElement.detachedBodyEl) && validIdRe.test(id)) {
            el = detachedBodyEl.dom.querySelector('#' + id);
        }

        return el;
    };

    if (Ext.isIE) {
        Ext.getElementById = function (id, doc) {
            var el = (doc || DOC).getElementById(id),
                detachedBodyEl;

            if (!el && (detachedBodyEl = AbstractElement.detachedBodyEl)) {
                el = detachedBodyEl.dom.all[id];
            }

            return el;
        };
    } else if (!document.querySelector) {
        Ext.getDetachedBody = Ext.getBody;

        Ext.getElementById = function (id, doc) {
            return (doc || DOC).getElementById(id);
        };
    }

    Ext.apply( Ext.supports, {

        postMessage : 'postMessage' in window || 'postMessage' in document,

        Event : function(){

            var tagMap = {
                  'select':'input',
                  'change':'input',
                  'submit':'form',
                  'reset':'form',
                  'load':'img',
                  'error':'img',
                  'abort':'img'
                },
                cache = {},      //Cached results
                onPrefix = /^on/i,
                isHostMethod = Ext.isHostMethod,
                //Normalize HTMLElements, browser objects (or direct nodeNames) to a hash
                getSetup = function(eventName, el){

                    if(typeof eventName != 'string') {
                        return null;
                    }
                    var El, nodeName;

                    if(el && typeof el != 'string') {
                        El = Ext.getDom(el);
                        if(El) {
                            nodeName = 'navigator' in El ? '#window' : El.nodeName;
                        }
                    } else
                        {
                            //possible high level object (#window, #document, form, button) by nodeName
                            nodeName = el || tagMap[eventName] || 'div';
                        }
                    return { nodeName  : String(nodeName || '').toLowerCase(),
                            eventName : eventName.toLowerCase(),
                            el        : El
                        };
                };

            /*
             * Event Feature Detection (DOM L2 Events)
             * @param {String} eventName The event name to test (an 'on' prefix is permitted)
             * @param {HTMLElement/String/Object} tagNameOrEl (optional) The string tagName of the Element or an existing
             *    Ext.core.Element or HTMLElement (or other) instance to use for the test.
             * @param {Boolean} noPrefix true to exclude 'on' prefix from the analysis
             * @return {Boolean}
             * Note: This detection algorithm will NOT support MutationEvents or those which the Gecko(and related) engines
             * do not expose via the their APIs: (DOMContentLoaded, etc)
               @example
                var supports = Ext.supports;
                supports.Event('scroll' ,  '#document')  or supports.Event('scroll' ,  document)
                supports.Event('contextmenu' );
                supports.Event('input', 'input');   //Tests for the latest 'oninput' event on HTML5 input elements
                supports.Event('error', Ext.get('myImage') );

               Note: It is also possible to feature detect events for other Browser objects:
                  Ext.supports.Event('progress', new XMLHttpRequest() );
             */
            return function (eventName, tagNameOrEl, noPrefix) {

                var el,
                    shortName   = String(eventName || '').replace(onPrefix,''),
                    isSupported = false,
                    elementTest = getSetup(shortName, tagNameOrEl),
                    hashKey,
                    dynamicEl = false;

                eventName   = (shortName ? ((noPrefix !== true) ? 'on' + shortName : eventName ) : '').toLowerCase();

                if(!eventName || !elementTest) return false;  //nothing to analyze

                hashKey =  elementTest.nodeName ? elementTest.nodeName + ':' + elementTest.eventName : null;

                //Use a previously cached result if available
                if(hashKey && cache.hasOwnProperty(hashKey)) {
                    return cache[hashKey];
                }

                el = elementTest.el;

                if(!el && elementTest.nodeName) {
                    switch(elementTest.nodeName) {
                        case '#window':     el = window; break;
                        case '#document':   el = document; break;
                        case 'html':        el = document.documentElement; break;
                        default :
                            el = document.createElement(elementTest.nodeName);
                            dynamicEl = true;
                    }
                }

                if(el) {
                    isSupported = (eventName in el && el[eventName] === null )  // legacy IE will set null on supported DOM2 events
                        || isHostMethod(el, eventName);

                    if (!isSupported) {
                        if(isHostMethod(el, 'setAttribute') ) {
                            el.setAttribute(eventName, 'return;');
                            isSupported = isHostMethod(el, eventName);
                            el.removeAttribute(eventName);
                        } else
                            {
                                el[eventName] = 'return;';
                                isSupported = isHostMethod(el, eventName);
                                el[eventName] = undefined;
                            }
                    }
                }
                el = null;

                //cache and return result for future tests (no hashKey implies something other than DOM Element/object is tested)
                if(hashKey) {
                    cache[hashKey] = isSupported;
                }
                return isSupported;
            };
        }(),

        /*
         * Tests whether a style attribute (and optional value) is supported) by the UA
         * @param {String} prop The style attribute to test (eg: 'border-top')
         * @param {Mixed} value (optional) value to use in the test.
         * @param {Boolean} forced true to ignore cached results
         * @return {Boolean}
         * @method
         * Note: position:fixed is still an ellusive on test IE6
         @example
            var needsFraming = !Ext.supports.Style('border-radius');
         */
        Style : (function(){
            var cache = {},
                el = document.createElement('div'),
                normalize = Ext.bind(Element.normalize, Element);

            return function(prop, value, forced) {
                var camel = normalize(prop), key;

                if(!camel) {
                    return false;
                }

                key = camel + ':' + (value || "");

                if(!forced && cache.hasOwnProperty(key) ) {
                    return cache[key];
                }else {
                    var supported = false;

                    if(el.runtimeStyle) {
                        try{
                            el.style[camel] = value || "";  //may throw if the value is unsupported
                            //compare its effect on runtimeStyle
                            supported = el.runtimeStyle[camel] !== undefined;
                        } catch(e) {
                        }
                    }else {
                        var view = document.defaultView;
                        if(view && view.getComputedStyle){
                            var cs = (view.getComputedStyle(el, null)||{})[camel];
                            supported = cs !== undefined;
                            if(value){
                                el.innerHTML = '<div style="'+prop+':'+value+'"></div>';
                                supported = supported && el.firstChild.style[camel] != "";
                            }
                        }
                    }
                    return cache[key] = supported;
                }
            };

        })()
    });


    /**
     * Emulate window.postMessage/onmessage for legacy UA's that do not support it
     */
    if(!Ext.supports.postMessage) {
        var global = Ext.global,
            URIre = /([^:]+:\/\/[^\/]+).*/;

        Ext.applyIf(global, {
            postMessage  : function(data, origin, source) {

                source = source || this;
                if(!origin) {
                    throw "postMessage: target origin is required.";
                }
                origin = (origin != '*') ? String(origin).replace(URIre, '$1') : String(DOC.location.href).replace(URIre, '$1');
                if(origin.indexOf(DOC.domain) < 0 ) {
                    throw "postMessage: Security violation, target origin " + origin + " is not resolvable.";
                }
                //inject a 'message' event into the global context
                origin = origin || "*";
                var event = new Ext.EventObjectImpl({
                    type    : 'message',
                    data    : data,
                    source  : source,
                    view    : source,
                    origin  : origin
                });

                event.injectEvent(global);

                /* if present, call the default onmessage handler */
                if(typeof global.onmessage == 'function') {
                    return global.onmessage(event.browserEvent);
                }
            }
        });

    }

}(window.Ext));
