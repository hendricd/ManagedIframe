// @require Ext.dom.Element,Error.js
// @uses CSS.js
// @define Ext.ux.ManagedIframe.Element
    Ext.define('Ext.ux.ManagedIframe.Element', function(MIFElement) {

        var MIF,
            EC = Ext.cache,
            DOC = window.document,

            // @private add Listeners
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
            // @private remove Listeners
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

        return {

            /* Begin Definitions */
            extend  : 'Ext.dom.Element',

            requires : [
                'Ext.dom.Element',
                'Ext.ux.ManagedIframe.Error'
            ],
            uses : [
                'Ext.ux.ManagedIframe.CSS'
            ],

            /* End Definitions */

            visibilityMode : Ext.Element.ASCLASS,   //nosize for hiding

            /**
             * @cfg {Boolean} eventsFollowFrameLinks
             * True to raise the 'dataavailable' event anytime
             * the frame document is reloaded (including when the user follows a link to another page)
             * Note: the load event is always fired
             * @default false
             */
            eventsFollowFrameLinks : false,

            focusOnLoad : Ext.isIE,

            /**
             * @cfg {Array} propagateEvents
             * A collection of events relayed from the iframe element's document to the MIFElement itself
             * Using this collection, keyup, keydown, mouse and other document-level events can be monitored.  The following events
             * are always raised on the MIFElement:
               <ul><li>dataavailable - fires when the frame document DOM is ready(same-origin only)</li>
               <li>load</li><li>beforeunload/li><li>unload</li>/li><li>reset</li>/li><li>error</li>/li><li>message (via postMessage)</li></ul>
                @default null
             */
            propagateEvents : null,


            /**
             * @cfg {Boolean} sizeToContent
             * True to inject content size (width/height) monitoring into same-origin frames.  If enabled,
             * the iframe Element is resized to reflect the size of the nested document
             * contents.
             * @default false
             */
            sizeToContent : false,


            /**
             * @cfg {Boolean} seamlessEmulation
             * True to emulate the seamless attribute on browsers that do not yet support this HTML5 feature.  When enabled,
             * all stylesheets from the parent document context are replicated to the embedded frame (same-origin only).
             */
            seamlessEmulation  : true,

            /**
             * @cfg {Array} seamlessStyles
             * (Optional) An Array of style rules used for seamless emulation.  If specified, only the rule attributes declared
             * are set on the BODY Element of the child document. If NOT defined,
             * all parent document style sheets/rules are propagated to the child document if seamlessEmulation is True.
             * @default [ 'font-size', 'background-color',  'font-family', 'background-image', 'background-repeat', 'color']
             */
            seamlessStyles : [ 'font-size', 'background-color',  'font-family', 'background-image', 'background-repeat', 'color'],

            constructor : function(element, forceNew, doc) {

                var id,
                    dom = (typeof element == "string")
                        ? (doc || DOC).getElementById(element)
                        : (element || {}).dom || element;

                if (!dom) {
                    return null;
                }

                id = dom.id;

                /**
                 * The DOM element
                 * @type HTMLElement
                 */
                this.dom = dom;

                // set an "el" property that references "this".  This allows
                // Ext.util.Positionable methods to operate on this.el.dom since it
                // gets mixed into both Element and Component
                this.el = this;

                /**
                 * The DOM element ID
                 * @type String
                 */
                id = this.id = id || Ext.id(dom);

                this.setName(this.dom.name || id);

                this.dom.manager = this;

                var cache = Ext.Element.getDocumentCache(this.dom, true);

                if (!forceNew && cache[id] && cache[id].el) {
                    cache[id].el = this;
                } else {
                    Ext.Element.addToCache(this);
                }

                this.isManagedIframeElement = true;

                /*
                 * Sets up the events required to maintain the state machine
                 */
                // Hook the Iframes loaded/state handlers
                Ext.isGecko || Ext.isWebkit || this.on(
                    Ext.isOpera ? 'DOMFrameContentLoaded' : 'readystatechange',
                    this._loadHandler,
                    this,
                    /**
                     * Opera still fires LOAD events for images within the FRAME as well,
                     * so we'll buffer hopefully catching one of the later events
                     */
                    Ext.isOpera ? {buffer: this.operaLoadBuffer|| 2000} : null
                );

                this.on({

                    'dataavailable' : function(e, target){
                        //set current frameAction for downstream listeners
                        if(e) {
                            Ext.apply(e, {
                                frameAction     : this._frameAction,
                                frameResetting  : this.isReset
                            });
                        }
                    },
                    load : this._loadHandler,
                    scope : this
                });

                this._unHook();

                this.isSeamless = this.isSeamless || !!dom.seamless;
                this.setSeamless(this.isSeamless);

            },

            /**
             * If sufficient privilege exists, returns the frame's current window object.
             * @return {Window} The frame Window object.
             */
            getWindow : function() {
                var dom = this.dom, win = null;
                try {
                    win = (dom && dom.contentWindow) || (dom && window.frames[dom.name]) || null;
                } catch (gwEx) {}
                return win;
            },

            /**
             * If sufficient privilege exists, returns the frame's current document
             * as an HTMLElement.
             * @param {Boolean} assertAccess (optional) False to return the document regardless of
                    what domain served the page.
             * @return {HTMLElement} The frame document or false if access to document object was denied.
             */
            getFrameDocument : function(assertAccess) {
                var win = this.getWindow() || {}, doc = null;
                try {
                    doc = (this.dom && this.dom.contentDocument) || win.document;
                } catch (gdEx) {
                    doc = false; // signifies probable access restriction or frame has become detached from the DOM
                }
                return (doc && Ext.isDocument(doc, assertAccess !== false)) ? doc : false;
            },

            /**
             * Returns the frame's current HTML document object as an
             * {@link Ext.Element}.
             * @return {Ext.Element} The document
             */
            getDoc : function() {
                return this.fly(this.getFrameDocument());
            },


            /**
             * If sufficient privilege exists, returns the frame's current document
             * body as an HTMLElement.
             *
             * @return {Ext.Element} The frame document body or Null if access to
             *         document object was denied.
             */
            getBody : function() {
                var d;
                return (d = this.getFrameDocument()) ? this.get( d.body) : null;
            },

            /**
             * If sufficient privilege exists, returns the current document head as an {@link Ext.Element}.
             * @return Ext.Element The document head
             * @method
             */
            getHead: function() {
                var d;
                return (d = this.getFrameDocument()) ? this.get( d.head || d.getElementsByTagName("head")[0] ) : null;
            },

            /*
             * Convert an HTMLElement (by id or reference) to a Flyweight Element
             */
            get : function(el){
                var doc = this.getFrameDocument();
                return doc ? Ext.get(el, doc) : null;
            },


            fly  : function(el, named) {
                var me = this,
                    doc = me.getFrameDocument()

                if(!doc || !el) {
                    return null;
                }

                return Ext.fly(el, named, doc);
            },

            /**
             * Creates a {@link Ext.CompositeElement} for child nodes based on the
             * passed CSS selector (the selector should not contain an id).
             *
             * @param {String} selector The CSS selector
             * @param {Boolean} [composite] True to create a unique Ext.dom.CompositeElementLite for each element. Defaults to a shared flyweight object.
             * @return {Ext.CompositeElement/Ext.CompositeElementLite} The composite element
             */
            select : function(selector, composite) {
                var d;
                return (d = this.getFrameDocument()) ? Ext.dom.Element.select(selector, composite, d) : d=null;
            },

            /**
             * Selects frame document child nodes based on the passed CSS selector
             * (the selector should not contain an id).
             *
             * @param {String} selector The CSS selector
             * @return {Array} An array of the matched nodes
             */
            query : function(selector) {
                var d;
                return (d = this.getFrameDocument()) ?  Ext.DomQuery.select(selector, d) : d=null;
            },

            /**
             * If sufficient privilege exists, returns the frames current URI via frame's document object
             * @return {string} The frame document's current URI or the last know URI if permission was denied.
             */
            getDocumentURI : function() {

                var URI, d;
                try {
                    URI = this.src && (d = this.getFrameDocument()) ? d.location.href: null;
                } catch (ex) {} // will fail on NON-same-origin domains
                return URI || (Ext.isFunction(this.src) ? this.src() : this.src);
            },

           /**
            * Attempt to retrieve the frames current URI via frame's Window object
            * @return {string} The frame document's current URI or the last know URI if permission was denied.
            */
            getWindowURI : function() {
                var URI, w, me = this;
                try {
                    URI = (w = me.getWindow()) ? w.location.href : null;
                } catch (ex) {
                } // will fail on NON-same-origin domains
                return URI || (Ext.isFunction(me.src) ? me.src() : me.src);
            },

            /**

             * Scrolls a frame document's child element into view within the passed container.
             * Note:
             * @param {String} child The id of the element to scroll into view.
             * @param {Mixed} container (optional) The container element to scroll (defaults to the frame's document.body).  Should be a
             * string (id), dom node, or Ext.Element reference with an overflow style setting.
             * @param {Boolean} hscroll (optional) False to disable horizontal scroll (defaults to true)
             * @return {Ext.ux.ManagedIframe.Element} this
             */
            scrollChildIntoView : function(child, container , hscroll) {
                var me = this,
                    doc = me.getFrameDocument(),
                    f;
                if(doc){
                    container = (container ? Ext.getDom(container, true, doc) : null) || (!Ext.isWebKit && Ext.isDocumentStrict(doc) ? doc.documentElement : doc.body);
                    if(f = me.fly(child)) {
                        f.scrollIntoView(container, hscroll);
                    }
                }
                return me;
            },

            /**
             * @private
             * Evaluate the Iframes readyState/load event to determine its
             * 'load' state, and raise the 'dataavailable' and other events when
             * applicable.
             */
            _loadHandler : function(e, target, options) {
                e = e || {};
                var me = this,
                    rstatus = (e.type == 'readystatechange') ? (me.dom||{}).readyState : e.type ;

                if ( me._frameAction || me.isReset ) {

                    me.isReset && e.stopEvent && e.stopEvent();
                    switch (rstatus) {

                        case 'domready' : // MIF
                        case 'DOMFrameContentLoaded' :

                            me._onDocReady (rstatus, e);
                            break;

                        case 'interactive':   // IE/ Legacy Opera
                            me.domReady = me.loaded = false;
                            me.isReset || me.assertOnReady();  //for IE, begin polling here as IE7 holds the DOM a bit longer
                            break;
                        case 'complete' :
                            me.loaded = true;
                            break;
                        case 'load' : // Gecko, Opera, IE
                            me.loaded = true;
                            Ext.apply(e, {
                                frameAction     : me._frameAction,
                                frameResetting  : me.isReset
                            });
                            me._onDocLoaded(rstatus, e);
                            me.dispatchCallbacks(e, target, options);
                            break;

                        case 'error':
                            me.fireDOMEvent('error', null, {message: e.message});
                            me._frameAction = false;
                            break;
                        default :
                    }

                    me.frameState = rstatus;
                }

            },

            /*
             *  @private DOM Ready handler
             */
            _onDocReady  : function(status, e) {
                var me=this,
                    reset = me.isReset;

                me.domReady = true;

                try {
                    if(!reset && me.focusOnLoad) {
                        me.focus();
                    }
                } catch(ex){ }

                //raise internal private event regardless of state.
                me.fireDOMEvent('datasetchanged');

                // Only raise if hook injection succeeded (same origin)
                if (!reset && !me.domReadyFired &&  me._frameAction && me._renderHooks()) {

                    me.emulateSeamless();

                    if(me.sizeToContent) {

                        // calculate and report the current size of the frame documents and autoAdjust the MIFElement size
                        me.loadFunction(
                            { name : 'setHostSize', fn : me.self.resizeMonitorImplementation },
                            false,
                            true  //and execute!
                        );
                    }

                    me.domReadyFired = true;
                    me.fireDOMEvent('dataavailable');
                }
                if(reset) {
                    me.fireDOMEvent('reset');
                }
            },

            /*
             *  @private loaded handler
             */
            _onDocLoaded  : function(status, e) {

                var me = this;
                /*
                 * this is necessary to permit other browsers a chance to raise dataavailable during
                 * page transitions (eventsFollowFrameLinks)
                 */
                if (!me.isReset && me._frameAction && !me.domReady) {
                    me._onDocReady();
                }

                me._frameAction = !!me.eventsFollowFrameLinks;


                me.domReadyFired = me.isReset = me.domReady = false;
                me._targetURI = null;
            },

            /*
             *  @private
             *  Dispatch a new (or copied) Generic event with the current Element as the event target
             */
            fireDOMEvent : function(eventName,  e,  args) {
                if(this.hasListeners(eventName)) {
                    return new Ext.EventObjectImpl(e || {type : eventName, detail : args}).injectEvent(this);
                }
            },

            /**
             * @private execScript sandbox and messaging interface
             */
            _renderHooks : function() {

                var me = this,
                    writable;

                me._windowContext = null;
                Ext.destroy( me.CSS);
                delete me.CSS;
                me._hooked = false;

                try {

                    if (me.writeScript([
                        '(function(){(window.hostMIF = parent.document.getElementById("',
                            me.id ,
                             '").manager)._windowContext=',
                            (Ext.isIE ? 'window' : '{eval:function(s){return new Function("return ("+s+")")();}}'),
                            ';})()'
                            ].join(''))
                        ) {

                        var win = me.getWindow(),
                            doc = me.getFrameDocument();

                        /*
                         * Route all desired events through the proxy for normalization
                         */
                        if(doc && win) {
                            me._frameProxy || (me._frameProxy = Ext.bind(me.self.eventProxy, me));

                            Ext.each(me.getFrameEvents() || [] , function(frameEvent) {

                                var context,
                                    method = frameEvent.method || this._frameProxy;

                                switch(frameEvent.context) {
                                    case 'body':
                                        context = doc.body || doc.documentElement;
                                        break;
                                    case 'document':
                                        context =  doc;
                                        break;
                                    case 'window':
                                        context = win;
                                        break;
                                    case 'parent':
                                        context = window;
                                        break;
                                    case null:
                                    case undefined:
                                        break;
                                    default:
                                       if(frameEvent.context && Ext.isString(frameEvent.context)) {
                                          context = w[frameEvent.context];
                                        }
                                }
                                if(context) {
                                    addListener(
                                        context,
                                        frameEvent.event,
                                        method,
                                        false
                                    );
                                }

                            }, me);

                        }
                    }

                } catch (ex) {}
                finally {

                    writable = me.domWritable();
                    me.CSS = writable && doc && Ext.create( 'Ext.ux.ManagedIframe.CSS', doc);

                    if(writable && !Ext.supports.postMessage) {
                        // provide postMessage event management and window.onmessage features to the frame
                        me.loadFunction(
                            { name : '_postMessageImpl', fn : me.self.postMessageImplementation },
                            false,
                            true  //and execute!
                        );
                    }
                }
                return (me._hooked = writable);
            },

            /** @private : clear all event listeners and Sandbox hooks
             * This returns the Element to an un-managed state.
             */
            _unHook : function() {

                var me = this,
                    frameEvents = me.getFrameEvents() || [],
                    win = me.getWindow(),
                    doc = me.getFrameDocument();

                if (me._hooked) {
                    try{
                        me._windowContext && (me._windowContext.hostMIF = null);
                    }catch(uhex){}

                    me._windowContext = null;
                    // <debug>
                    if(!doc || !win) {
                        console.warn('MIFElement._unHook :: LEAK WARNING! The MIFElement has listeners set on the underlying frame, \
                                or child elements but, the document or window objects of the frame are no longer accessible.  The frame \
                                may have been removed from the DOM structure before this method was called.')
                    }
                    // </debug>

                    if(me._frameProxy && doc && win) {
                        Ext.each(frameEvents , function(frameEvent) {
                            var context,
                                method = frameEvent.method || this._frameProxy;

                            switch(Ext.isString(frameEvent.context) && frameEvent.context) {
                                case 'body':
                                    context = doc.body || doc.documentElement;
                                    break;
                                case 'document':
                                    context = doc;
                                    break;
                                case 'window':
                                     context = win;
                                     break;
                                case 'parent':
                                     context = window;
                                     break;
                                default:
                                    if(frameEvent.context) {
                                        context = w[frameEvent.context];
                                    }
                            }
                            if(context) {
                                removeListener(context, frameEvent.event, method, false);
                            }

                        }, me);

                    }

                }

                me.callbacks = [];
                if(doc) {
                    Ext.Element.clearDocumentCache(doc);
                }

                Ext.destroy(me.CSS);
                delete me.CSS;
                me.domReady = me.domFired = me._hooked = false;
                me._frameAction = !!me.eventsFollowFrameLinks;
            },

            /*
             *
             * Extend this method further to attach additional listeners to the frame after each load operation
             */
            getFrameEvents : function(){
                var array = Ext.Array,
                    ie = Ext.isIE8m;

                if(!Ext.isArray(this._frameEvents)) {

                    //TODO: validate IE7,8,9 vs 10

                    this._frameEvents = [
                      { event : 'focus',    context : ie ? null : 'window' },
                      { event : 'blur',     context : ie ? null : 'window' },
                      { event : 'focusin',  context : ie ? 'document' : null },
                      { event : 'focusout',  context : ie ? 'document' : null },
                      { event : 'resize',   context : 'window' },
                      { event : 'beforeunload', context : 'window' },
                      { event : 'scroll',   context : 'document' }
                    ];

                    //Append propagation events to the binding list
                    array.each(array.from(this.propagateEvents || []), function(event) {
                        if(event) {
                            this._frameEvents.push({event : event, context : 'document'});
                        }
                    }, this);
                }

                return this._frameEvents;
            },

            /**
             * Returns the general 'DOM modification capability' (same-origin status) of the frame.
             * @return {Boolean} accessible If True, the frame's inner document DOM can be manipulated,
             * queried, and Event Listeners set.
             */
            domWritable : function() {
                return  !!this._windowContext &&
                        !!Ext.isDocument(this.getFrameDocument(), true); //test access
            },

            /**
             * @private
             */
            hasListeners : function(type) {
                var me = this,
                    cache = me.$cache || {},
                    events = cache.events || {},
                    listeners = events[type] || [];

                return !!listeners.length;
            },


            /**
             * Sends a message body to the Iframe window context using window.postMessage function.
             * <p>Note: For browsers without postMessage support (IE6 && 7), ManagedIFrame provides
             * feature emulation support for postMessage, onmessage, and addEventListener('message'..) or
             * attachEvent('onmessage',..) FOR SAME-ORIGIN FRAMES ONLY.</p>
             *
             * @param {Mixed} data The message payload to send
                <p>Note: IE versions less than 10 require string payloads. Complex objects passed
                for IE will be serialized to JSON prior to submission</p>
             * @param {String} origin The domain URI intended as the recipient of the message,
                               defaults to the current document URI of the frame document or "*" (any domain)
                               if the document URI cannot be determined.
             */
            postMessage : function(data, origin) {
                data = data || '';
                var win = this.getWindow(),
                    args,
                    emulation;

                if(win && win.postMessage) {
                    emulation  = !!win.postMessage.emulation;
                    origin = (origin || this.getDocumentURI() || document.location.href || '').replace(/([^:]+:\/\/[^\/]+).*/, '$1') || '*';

                    // <IE10 only supports string payloads
                    if(data &&
                        !emulation &&   //emulation supports native objects, so no need to JSONfy
                        Ext.isIE9m &&
                        !Ext.isString(data) )
                        {
                            data = Ext.encode(data);
                    }

                    if(emulation) {
                        win.postMessage(data, origin, Ext.global);
                    } else {
                        win.postMessage(data, origin);
                    }


                } else {
                    // <debug>
                    console.error('No postMessage support');
                    // </debug>
                }
            },

            /**
             * Loads the frame Element with the response from a form submit to the
             * specified URL with the ManagedIframe.Element as it's submit target.
             *
             * @param {Object} submitCfg A config object containing any of the following options:
             * <pre><code>
             *      myIframe.submitAsTarget({
             *         form : formPanel.form,  //optional Ext.FormPanel, Ext form element, or HTMLFormElement
             *         url: &quot;your-url.php&quot;,
             *         action : (see url) ,
             *         params: {param1: &quot;foo&quot;, param2: &quot;bar&quot;}, // or URL encoded string or function that returns either
             *         callback: yourFunction,  //optional, called with the signature (event, target, evOptions)
             *         scope: yourObject, // optional scope for the callback
             *         method: 'POST', //optional form.method
             *         encoding : "multipart/form-data" //optional, default = HTMLForm default
             *      });
             *
             * </code></pre>
             * @return {Ext.ux.ManagedIFrame.Element} this
             *
             */
            submitAsTarget : function(submitCfg){

                var opt = submitCfg || {},
                    doc = this.getParentDocument(),
                    form = Ext.getDom(
                            opt.form ? opt.form.form || opt.form: null, false, doc) ||
                      Ext.DomHelper.append(doc.body, {
                        tag: 'form',
                        cls : 'x-hide-offsets x-mif-form',
                        encoding : 'multipart/form-data'
                      }),
                    formFly = new Ext.Element.fly(form, '_dynaForm'),
                    formState = Ext.copyTo({}, form, 'target,method,encoding,enctype,action'),
                    encoding = opt.encoding || form.encoding,
                    method = opt.method || form.method || 'POST';

                formFly.set({
                   target  : this.dom.name,
                   method  : method,
                   encoding: encoding,
                   action  : opt.url || opt.action || form.action
                });

                if(method == 'POST' || !!opt.enctype){
                    formFly.set({enctype : opt.enctype || form.enctype || encoding});
                }

                var hiddens, hd, ps;
                // add any additional dynamic params
                if(opt.params && (ps = Ext.isFunction(opt.params) ? opt.params() : opt.params)){
                    hiddens = [];

                    Ext.iterate(ps = (typeof ps == 'string'? Ext.urlDecode(ps, false): ps),
                        function(n, v){

                            Ext.fly(hd = doc.createElement('input')).set({
                                type : 'hidden',
                                name : n,
                                value: v
                            });
                            form.appendChild(hd);
                            hiddens.push(hd);
                        });
                }

                if(Ext.isFunction(opt.callback)) {  //use the internal event to dispatch the callback
                    this.on('datasetchanged', opt.callback, opt.scope || this, {single:true, submitOptions : opt});
                }

                this._frameAction = true;
                this._targetURI = location.href;

                form.submit();

                // remove dynamic inputs
                if(hiddens) {
                    Ext.each(hiddens, Ext.removeNode, Ext);
                }

                //Remove if dynamically generated, restore state otherwise
                if(formFly.hasClass('x-mif-form')){
                    formFly.remove();
                }else{
                    formFly.set(formState);
                }

                formFly = null;
                return this;
            },

             /**
             * Sets the embedded Iframe name property (also updating the window.frames hash for < IE9)
             *
             * @param {String} name
             */
            setName : function(name) {
                var dom = this.dom,
                    frames = Ext.global.frames;

                if(dom.name && Ext.isIE8m && name !== dom.name) {
                    delete frames[dom.name];
                }
                this.set({name : name || ''});
                if(name && Ext.isIE8m) {
                    frames[name] = dom;
                }

            },

            /**
             * @cfg {String} resetUrl Frame document reset string for use with the {@link #Ext.ux.ManagedIFrame.Element-reset} method.
             * Defaults:<p> For IE on SSL domains - the current value of Ext.SSL_SECURE_URL<p> "about:blank" for all others.
             */
            resetUrl : (function() {
                return Ext.isIE && Ext.isSecure ? 'javascript:\'\'' : 'about:blank';
            })(),


            setPropagateEvents : function(events) {

                this.propagateEvents = (Ext.isArray(events) && events.length) ? events : false;
                delete this._frameEvents;

            },

            /**
             * Toggles the embedded Iframe seamless property.
             * @param {Boolean} seamless
             * @return {Ext.ux.ManagedIframe.Element} this
             * <p>Notes:
             * When seamless is set, browsers that do not support the feature will get emulation treatment.
             * The following will be attempted for seamless emulation:
             * For IE: <ul>
                <li>marginwidth , marginheight,
                vspace, and hspace properties will be removed</li>
                <li>allowtransparency will be enabled</li>
                <li>vpace will be set to off</li>
                </ul>
             * </p>
             */
            setSeamless : function(seamless) {

                seamless = !!seamless;
                var me = this,
                    frame = me.dom;

                if(frame) {
                    me.set(Ext.apply(
                        {
                            seamless    : seamless ? 'seamless' : undefined,
                            marginwidth : seamless ? '0' : undefined,
                            marginheight: seamless ? '0' : undefined,
                            vspace      : seamless ? '0' : undefined,
                            hspace      : seamless ? '0' : undefined
                        },
                        Ext.isIE9m ? {
                            allowtransparency : (seamless ? 'true' : undefined)  //required for IE
                        } : {}
                        )
                    );
                }

                me.isSeamless = seamless;
                me.emulateSeamless();
                return me;
            },


            /**
             * Emulate HTML5 seamless mode.
             * @private
             */
            emulateSeamless : function() {

                var me = this,
                    frame = me.dom,
                    frameParent,
                    base,
                    head,
                    doc,
                    body,
                    style,
                    id,
                    array = Ext.Array,
                    i, len, ds,
                    seamless = !!me.isSeamless,
                    styles,
                    supports = me.self.supports,
                    cssText,
                    CSS = me.CSS,
                    parentDoc = me.getParentDocument(),
                    sheet,
                    seamlessAssets = me.seamlessAssets || (me.seamlessAssets = []);


                if(!frame || !me._frameAction) {
                    return;
                }

                doc = me.getFrameDocument();
                head = me.getHead();
                body = me.getBody();

                if(head) {
                    //<base> tag (child links are resolved/rendered in parent context)
                    base = head.child('base') ||
                        (seamless && head.createChild({tag : 'base'}, head.dom.firstChild));

                    if(base && seamless) {
                        base.set({
                            href : location.href,
                            target : '_parent'
                        });
                    } else if(base) {
                        base.remove();
                    }

                    /**
                     * If specified on the MIFElement, the seamlessStyles (of the iframe's immediate parent)
                     * will also be applied to the BODY Element of the frame document
                     */
                    me.seamlessStyles = me.seamlessStyles || ['height'];
                    frameParent = me.parent();
                    if( body ) {

                        //Gather the style props from the immediate parent
                        styles = (frameParent && frameParent.getStyle(array.from(me.seamlessStyles), false)) || {};
                        styles.height = 'auto';

                        if(seamless) {
                            body.applyStyles(styles);
                        } else {
                            style = body.dom.style;
                            for (var name in styles) {
                                if (styles.hasOwnProperty(name)) {
                                    style[style.removeProperty ? 'removeProperty' : 'removeAttribute'](name);
                                }
                            }
                        }

                    }

                } else {
                    return;
                }

                //inherited styles
                if( me.seamlessEmulation &&
                    !supports.seamless &&
                    doc &&
                    CSS ) {

                    //Under emulation, the frame is always size to the content (??)
                    me.sizeToContent = seamless;

                    if(!seamless) {
                        Ext.destroy(
                            array.map(seamlessAssets, function(id) { return Ext.get(id, doc); })
                        );
                        delete me.seamlessAssets;
                        return;
                    }

                    // Otherwise, Replicate all parent styleSheets
                    ds = parentDoc.styleSheets || [];

                    for (i = 0, len = ds.length; i < len; i++) {
                        sheet = ds[i];
                        if( sheet &&
                            !sheet.disabled &&
                            (cssText = CSS.getCssText(sheet))
                            ) {
                                id = Ext.id(null, 'seamless-style-');
                                if(CSS.createStyleSheet( cssText, id )) {
                                    seamlessAssets.push(id);
                                }
                        }
                    }

                }

            },


            /**
             * Sets the embedded Iframe src property. Note: invoke the function with
             * no arguments to refresh the iframe based on the current src value.
             *
             * @param {String/Function} url (Optional) A string or reference to a Function that
             *            returns a URI string when called
             * @param {Boolean} discardUrl (Optional) If not passed as <tt>false</tt>
             *            the URL of this action becomes the default SRC attribute
             *            for this iframe, and will be subsequently used in future
             *            setSrc calls (emulates autoRefresh by calling setSrc
             *            without params).
             * @param {Function} callback (Optional) A callback function invoked when the
             *            frame document has been fully loaded.
             * @param {Object} scope (Optional) scope by which the callback function is
             *            invoked.
             * @return {Ext.ux.ManagedIframe.Element} this
             */
            setSrc : function(url, discardUrl, callback, scope) {

                var me = this,
                    s,
                    src = url || this.src || this.resetUrl;

                me._unHook();
                me.queueCallback(callback, scope || me);

                if(discardUrl !== true) {
                    me.src = src;
                }

                s = me._targetURI = (Ext.isFunction(src) ? src() || '' : src);

                try {
                    me._frameAction = true; // signal listening now
                    me.dom.src = s;
                } catch (ex) {
                    me._frameAction = me.eventsFollowFrameLinks;
                } finally {
                    me._frameAction && (Ext.isIE || me.assertOnReady());
                }
                return me;
            },

            /**
             * Sets the embedded Iframe location using its replace method (precluding a history update).
             * Note: invoke the function with no arguments to refresh the iframe based on the current src value.
             *
             * @param {String/Function} url (Optional) A string or reference to a Function that
             *            returns a URI string when called
             * @param {Boolean} discardUrl (Optional) If not passed as <tt>false</tt>
             *            the URL of this action becomes the default SRC attribute
             *            for this iframe, and will be subsequently used in future
             *            setSrc calls (emulates autoRefresh by calling setSrc
             *            without params).
             * @param {Function} callback (Optional) A callback function invoked when the
             *            frame document has been fully loaded.
             * @param {Object} scope (Optional) scope by which the callback function is
             *            invoked.
             * Note: This method should only be considered for same-origin frames, as the location object
             *        will NOT be accessible for a foreign domain.
             *
             */
            setLocation : function(url, discardUrl, callback, scope) {

                var me = this,
                    s,
                    src = url || me.src || me.resetUrl;

                me._unHook();

                me.queueCallback(callback, scope || me);

                s = me._targetURI = (Ext.isFunction(src) ? src() || '' : src);
                if (discardUrl !== true) {
                    me.src = src;
                }

                try {
                    me._frameAction = true; // signal listening now
                    me.getWindow().location.replace(s);
                } catch (ex) {
                    me._frameAction = me.eventsFollowFrameLinks;
                } finally {
                    me._frameAction && (Ext.isIE || me.assertOnReady());
                }
                return me;
            },

            /**
             * Resets the frame to a neutral (blank document) state
             *
             * @param {String}
             *            src (Optional) A specific reset string (eg. 'about:blank')
             *            to use for resetting the frame.
             * @param {Function}
             *            callback (Optional) A callback function invoked when the
             *            frame reset is complete.
             * @param {Object}
             *            scope (Optional) scope by which the callback function is
             *            invoked.
             */
            reset : function(src, callback, scope) {

                var me = this,
                    s = src,
                    win,
                    writable = me.domWritable();

                me._unHook();
                me.isReset = true;
                me.queueCallback(callback, scope);

                s = Ext.isFunction(src) ? src() : s;
                s = me._targetURI = Ext.isEmpty(s, true) ? me.resetUrl: s;

                if(writable && (win = me.getWindow()) ) {
                    win.location.replace(s);   //same origin only, preserving history if possible
                } else {
                    me.dom.src = s;
                }
                return me;
            },


            /**
            * @private
            */
            queueCallback : function( fn, scope, args){
                var me=this;
                if(typeof fn == 'function') {
                    me.callbacks = me.callbacks || [];
                    me.callbacks.push(Ext.bind(fn, scope || me, args || []));
                }
                return me;
            },

            /**
            * @private
            */
            dispatchCallbacks : function(e, target, options){
                var me = this;
                if(me.callbacks && me.callbacks.length) {
                    while(me.callbacks.length) {
                        me.callbacks.shift()(e, target, options);
                    }
                }
            },

           /**
            * @private
            * Regular Expression filter pattern for script tag removal.
            * @cfg {regexp} scriptRE script removal RegeXp
            * Default: "/(?:<script.*?>)((\n|\r|.)*?)(?:<\/script>)/gi"
            */
            scriptRE : /(?:<script.*?>)((\n|\r|.)*?)(?:<\/script>)/gi,

            /**
             * Write(replacing) string content into the IFrames document structure
             * @param {String} content The new string content or DOMHelper config which represents the DOM structure
             * @param {Boolean} loadScripts
             * (optional) true to also render and process embedded scripts
             * @param {Function} callback (Optional) A callback function invoked when the
             * frame document has been written and fully loaded. @param {Object}
             * scope (Optional) scope by which the callback function is invoked.
             */
            update : function(content, loadScripts, callback, scope) {

                var me = this;
                content = String(Ext.DomHelper.markup(content || ''));

                content = (loadScripts !== false) ? content : content.replace(me.scriptRE, '');
                var doc;
                if ((doc = me.getFrameDocument()) && !!content.length) {
                    me._unHook();
                    me.src = null;
                    me.queueCallback(callback, scope || this);

                    me._targetURI = null;
                    me._frameAction = true;

                    if(me.statics().supports.srcdoc) {
                        me.dom.srcdoc = content;
                        me.assertOnReady();
                    } else {
                        doc.open();
                        doc.write(content);
                        me.assertOnReady();
                        doc.close();
                    }

                } else if(Ext.isFunction(callback)) {
                    Ext.callback(callback, scope || me);
                }

                return me;
            },

            /*
             * @inherit
             */
            setHTML: function(html) {
                return this.update.apply(this, arguments);
            },

            /**
             * Returns the innerHTML of the frame documents
             * @arg {Boolean} outer true to return the entire document HTML, false to return on the body innerHTML
             * (Note: Available for same-origin frames only)
             */
            getHTML: function(outer) {
                var body, doc;
                if(this.dom) {
                    doc = this.getFrameDocument() || {};
                    body = doc.body
                    return body ? (!!outer ? doc.documentElement.outerHTML : body.innerHTML ) : '';
                }
            },

            /**
             * Executes a Midas command on the current document, current selection, or the given range.
             * @param {String} command The command string to execute in the frame's document context.
             * @param {Booloean} userInterface (optional) True to enable user interface (if supported by the command)
             * @param {Mixed} value (optional)
             * @param {Boolean} validate If true, the command is validated to ensure it's invocation is permitted.
             * @return {Boolean} indication whether command execution succeeded
             */
            execCommand : function(command, userInterface, value, validate) {

                var doc, assert, me = this;
                if ((doc = me.getFrameDocument()) && !!command) {
                    try{
                        if(Ext.isIE) {
                            me.focus();
                        }
                        assert = validate && Ext.isFunction(doc.queryCommandEnabled)
                            ? doc.queryCommandEnabled(command)
                            : true;

                        return assert && doc.execCommand(command, !!userInterface, value);
                    }catch(eex){return false;}
                }
                return false;
            },


            /**
             * Sets the current DesignMode attribute of the Frame's document
             * @param {Boolean/String} active True (or "on"), to enable designMode
             *
             */
            setDesignMode : function(active) {
                var doc;
                if(doc = this.getFrameDocument()) {
                    doc.designMode = (/on|true/i).test(String(active))? 'On': 'Off';
                }
                return this;
            },

            onMessage : function(e) {
                this.fireDOMEvent('message', e);
            },

            /**
             * Print the contents of the Iframes (if we own the document)
             * @return {Ext.ux.ManagedIFrame.Element} this
             */
            print : function() {
                var me = this;
                try {
                    var win;
                    if( win = me.getWindow()){
                        Ext.isIE && win.focus();
                        win.print();
                    }
                } catch (ex) {
                    // <debug>
                    var Err = me.statics().Error;
                    Err.raise(
                        { msg     : Err.message.printexception || ex.description || ex.message,
                          error   : ex,
                          win     : win
                        }
                    );
                    // </debug>
                }
                return me;
            },

            /**
             * Write a script block into the iframe's document
             * @param {String} block A valid (executable) script source block.
             * @param {object} attributes Additional Script tag attributes to apply to the script
             * Element (for other language specs [vbscript, Javascript] etc.) <p>
             * Note: writeScript will only work after a successful iframe.(Updater)
             * update or after same-domain document has been hooked, otherwise an
             * exception is raised.
             */
            writeScript : function(block, attributes) {
                var head, script, doc;

                attributes = Ext.apply({}, attributes || {}, {
                    type : "text/javascript",
                    text : block
                });

                try {
                    doc = this.getFrameDocument();
                    if (doc && typeof doc.getElementsByTagName != 'undefined') {

                        if (!(head = this.getHead() )) {

                            // some browsers (Webkit, Safari) do not auto-create
                            // head elements during document.write
                            head = this.get(doc.createElement("head"));
                            doc.getElementsByTagName("html")[0].appendChild(head.dom);
                            doc.head = doc.head || head.dom;
                        }

                        if (head && (script = doc.createElement("script"))) {

                            for (var attrib in attributes) {
                                if (attributes.hasOwnProperty(attrib) && attrib in script) {
                                    script[attrib] = attributes[attrib];
                                }
                            }
                            return !!head.appendChild(script);
                        }
                    }

                } catch (ex) {
                } finally {
                    script = head = null;
                }
                return false;
            },

            /**
             * eval a javascript code block(string) within the context of the
             * Iframes' window object.
             * @param {String} block A valid ('eval'able) script source block.
             * @param {Boolean} useDOM  if true, inserts the function
             * into a dynamic script tag, false does a simple eval on the function
             * definition. (useful for debugging) <p> Note: will only work after a
             * successful iframe.(Updater) update or after same-domain document has
             * been hooked, otherwise an exception is raised.
             * @return {Mixed}
             */
            execScript : function(block, useDOM) {
                var me = this,
                    context,
                    blockText = Ext.isArray(block) ? block.join('\n') : block || '';

                if(!blockText) {
                    // <debug>
                        console.warn('MIFElement.execScript: No script the execute');
                    // </debug>
                    return false;
                }
                if (me.domWritable()) {
                    try {
                        if (useDOM) {
                            me.writeScript(blockText);
                        } else {
                            context = me._windowContext;

                            /* iframe::window.eval MAY not appear on IE until this is called first! == insane */
                            if (!context.eval && context.execScript) {
                                context.execScript("null");
                            }

                            return context.eval(blockText);
                        }

                    } catch (ex) {
                        return false;
                    }
                } else {
                    var Err = me.self.Error;
                    throw new Err(
                        { msg : Err.message['execscript-secure-context'],
                         script : blockText
                        });
                }
                return true;
            },


            /**
             * Eval a function definition into the iframe window context.
             * @param {String/Object} fn Name of the function or function map
             * object: {name:'encodeHTML',fn:Ext.util.Format.htmlEncode}
             * @param {Boolean} useDOM  if true, inserts the fn into a dynamic script tag,
             * false does a simple eval on the function definition
             * @param {Boolean} invokeIt if true, the function specified is also executed in the
             * Window context of the frame. Function arguments are not supported.
             * @example <pre><code> var trim = function(s){ return s.replace(/^\s+|\s+$/g,''); };
             * iframe.loadFunction('trim');
             * iframe.loadFunction({name:'myTrim',fn:String.prototype.trim || trim});</code></pre>
             */
            loadFunction : function(fn, useDOM, invokeIt) {
                var name = fn.name || fn,
                    fnSrc = fn.fn || window[fn];


                if(!name || !Ext.isString(name)) {
                    // <debug>
                        console.warn('MIFElement.loadFunction: Function name is required');
                    // </debug>
                    return this;
                }

                if(fnSrc) {
                    this.execScript(name + '=' + fnSrc, useDOM); // fn.toString coercion
                    if(invokeIt) {
                        this.execScript(name + '()'); // no args only
                    }
                }
                return this;
            },

            /**
             * @private
             * Poll the Iframes document structure to determine DOM ready
             * state, and raise the 'domready' event when applicable.
             */
            assertOnReady : function() {

                if ( this.isReset) { return; }
                // initialise the counter
                var n = 0, frame = this, domReady = false,
                    body, l, doc,
                    max = frame.domReadyRetries || 5000, //default max 5 seconds
                    atTarget = false,
                    startLocation = (frame.getFrameDocument() || {location : {}}).location.href,
                    fileSize, href,
                    notDefined = /undefined|unknown/i,
                    array = Ext.Array,

                    assertion = function(targetURI) { // DOM polling for IE and others
                        if ( this.domReady) {
                                return;
                            }
                        if(doc = this.getFrameDocument()) {

                            // wait for location.href transition
                            // null href is a 'same-origin' document access violation,
                            // this assumes the DOM is built when the browser updates the href
                            href = doc.location.href || '';
                            atTarget = !targetURI || (href && (href != startLocation || array.indexOf(href, targetURI) > -1));

                            /*
                             * On IE, when !(Transfer-Encoding: chunked), document.fileSize is populated when
                             * the DOM is ready
                             */
                            fileSize = 0;
                            try {  //IE/Webkit/Opera? will report the fileSize of the document when the DOM is ready
                                fileSize = notDefined.test(typeof doc.fileSize) ? 0 : parseFloat(doc.fileSize);
                                }catch(errFilesize){}

                            domReady = (!!fileSize) || (atTarget && (body = doc.body) && !!(body.innerHTML || '').length );

                            if(domReady) {
                                return this._loadHandler.call(this, { type : 'domready'});
                            }
                        }
                        frame.loaded || (++n > max) || Ext.defer(assertion, 2, this, array.from(arguments) ); // try again
                    };
                assertion.call(frame, frame._targetURI);
            },

            /**
             * Tries to focus the element. Any exceptions are caught and ignored.
             * @param {Number} defer (optional) Milliseconds to defer the focus
             * @return {Ext.ux.ManagedIframe.Element} this
             */
            focus: function(defer) {
                var me = this,
                    win = me.getWindow();

                if(win) {
                    try {
                        if (Number(defer)) {
                            Ext.defer(me.focus, defer, me, [null]);
                        } else {
                            win.focus();
                        }
                    } catch(e) {}
                }
                win = null;
                return me;
            },

            /**
             * Tries to blur the element. Any exceptions are caught and ignored.
             * @return {Ext.ux.ManagedIframe.Element} this
             */
            blur: function() {
                var me = this,
                    win = me.getWindow();
                if(win) {
                    try {
                        win.blur();
                    } catch(e) {}
                }
                win = null;
                return me;
            },

            /**
             * <p>Removes this element's dom reference.  Note that event and cache removal is handled at {@link Ext#removeNode Ext.removeNode}</p>
             */
            remove: function() {

                var me = this,
                    dom = me.dom;

                if (dom) {
                    me.reset();
                    me.setName('');
                    dom.manager = null;
                }
                me.callParent();
            },

            inheritableStatics : {

                //Give MIFElement a static reference to the Error class
                Error :  Ext.ux.ManagedIframe.Error,

                /** @private
                 * @static
                 * DOMFrameReadyHandler -- Dispatches the captured event to the target MIF.Element
                 */
                DOMFrameReadyHandler : function(e ,target) {
                    var frame;

                    try {
                        frame = e.target ? e.target.manager : null;
                    } catch (rhEx) {        //nested (foreign) iframes will throw when accessing target
                    }

                    if(frame) {
                        Ext.Function.defer(
                            frame._loadHandler,
                            1,
                            frame
                            [ e ]
                        );
                    }
                },

                /** @private
                 * @static
                 * Frame document event proxy
                 */
                eventProxy : function(e, target) {

                    var me = this, res,
                        eventable = false,
                        view = me.getWindow(),
                        event,
                        result,
                        isClick,
                        doc,
                        docEl,
                        body,
                        calcPageOffset = false;

                    e = e || view.event;

                    if (me.dom) {
                        eventable = true;
                        switch(e.type) {

                            case 'unload':
                            case 'beforeunload':
                                //eventable = false;  //handled on the frame itself
                                break;
                            case 'focusin':
                            case 'focusout':
                                break;
                            case 'blur':
                            case 'focus':
                                if(Ext.isIE8m) {
                                    eventable = false;
                                }
                            case 'resize':

                                //IE handles (blur, focus, resize) on the IFRAME Element itself, so let's not fire them twice.
                            case 'scroll':
                                break;

                            case 'message':
                                break;
                            default:
                                isClick = /click$/.test(e.type);
                                eventable = isClick || /^(key|mouse)/.test(e.type);
                                calcPageOffset = isClick || /^mouse/.test(e.type);
                        }

                        //relay subscribed events to the Element instance (if listeners are present)
                        if(eventable) {

                            event = new Ext.EventObjectImpl(e);
                            event.type = e.type == 'resize' ? 'contentresize' : e.type;
                            event.type = e.type == 'focusin' ? 'focus' : e.type;
                            event.type = e.type == 'focusout' ? 'blur' : e.type;

                            if( me.hasListeners(event.type) ) {

                                if(calcPageOffset) {
                                     // Get the left-based iframe position
                                    var iframeXY = Ext.Element.getTrueXY(me.dom);
                                        // Get the left-based XY position.
                                        // This is because the consumer of the injected event (Ext.EventManager) will
                                        // perform its own RTL normalization.
                                    event.frameXY = Ext.EventManager.getPageXY(e);

                                    // the event from the inner document has XY relative to that document's origin,
                                    // so adjust it to use the origin of the iframe in the outer document:
                                    event.xy = [iframeXY[0] + event.frameXY[0] , iframeXY[1] + event.frameXY[1] ];

                                }

                                //Raise the event on the iframeElement itself
                                result = Ext.EventManager.fireEvent(event, me );
                            }

                        }
                        if(e.type == 'beforeunload' ) {
                            me._unHook();  // same-domain unloads should unhook for next document rendering
                        }

                        return result;
                    }

                },

                Flyweight  : Ext.Element.Fly,

                /**
                 * @static
                 * Monitor the size of same-origin frame documents,
                 * nomally injected into the frame document after load event has fired.
                 */
                resizeMonitorImplementation : function() {

                    var body = document.body, style, width, height, me ,
                        el = body || document.documentElement || body;

                    if( el) {
                        style = el.style;
                        width =  parseFloat(style.width || el.width || el.offsetWidth) || '"100%"',
                        height = parseFloat(style.height || el.height || el.offsetHeight) || 20,
                        me = arguments.callee;

                        parent.postMessage(
                            JSON.stringify(
                                { "MIFDispatch" : (window.frameElement || {}).id || null,
                                    "method" : 'setHeight',
                                    "args"  : height //{ "height" : height , "width" : width }
                            }),
                            '*'
                        );
                    }

                    window.addEventListener('load',  me, false);

                    if(!me.hooked && window.addEventListener) {
                        window.addEventListener('resize',  me, false);
                        window.addEventListener('beforeunload', function() {
                            window.removeEventListener('resize',  me, false);
                        },false);
                        me.hooked = true;
                    }

                },

                /**
                 * @static
                 * postMessage Emulation
                 */
                postMessageImplementation : function() {

                    var type = 'message',
                        win = window,
                        doc = win.document,
                        standards = false,
                        createEvent = ('createEvent' in doc) ?
                            (standards = true) &&
                            function(data, origin, source) {

                                var event = doc.createEvent('MessageEvent');
                                event.initMessageEvent(type, false,  false, data, String(origin));
                                event.view = source;
                                event.source = source;  //this cannot be set!
                                return event;
                            } :
                            function(data, origin, source) {  //IE
                                var event = doc.createEventObject();
                                event.bubbles = false;
                                event.cancelable = false;
                                event.data = data;
                                event.origin = String(origin);
                                event.view = event.source = source;
                                event.lastEventId = '';
                                return event;
                            },
                        onmessage = function(e) {
                            if(typeof win.onmessage == 'function') {
                                win.onmessage(e);
                            }
                        },
                        toOriginURI = function(uri) {
                            return (uri || '').replace(/([^:]+:\/\/[^\/]+).*/, '$1') || '';
                        };

                    (window.postMessage  = function(data, origin, sourceView) {

                        var source = sourceView || this;
                        if(!origin) {
                            throw "postMessage: target origin is required.";
                        } else if(origin != '*' && toOriginURI(origin).indexOf(doc.domain) < 0 ) {
                            throw "postMessage: Security violation, origin domain is not resolvable.";
                        }

                        var event = createEvent(data, origin, source),
                            args = standards ? [event] : ['on' + type, event],
                            // account for Safari 2,3 transitions over the years
                            context = standards ? ('dispatchEvent' in win ? win : doc) : win,
                            dispatch = context.dispatchEvent || context.fireEvent ||
                                function() {
                                    // <debug>
                                    console.warn('postMessage Emulation: Could not resolve a suitable dispatcher for the "message" event');
                                    // </debug>
                                }
                        onmessage.call(win, event);
                        dispatch.apply(context, args);

                    }).emulation = true;

                },

                /**
                 * @static
                 * Dispatch MIFElement methods from trusted frame documents
                 */
                DOMFrameMessageHandler : function(e) {

                    var toOriginURI = function(uri) {
                            return (uri || '').replace(/([^:]+:\/\/[^\/]+).*/, '$1') || '';
                        },
                        origin = e.origin,
                        frame,
                        data = e.data,
                        view = e.view || e.source,
                        cmd = Ext.isString(data) ? Ext.decode(data, true) : data;

                        if( Ext.isObject(cmd) &&
                            (origin && origin == toOriginURI(document.location.href)) &&
                            view &&
                            cmd.method &&
                            (frame = Ext.get(view.frameElement)) &&
                            frame.sizeToContent &&
                            frame.isManagedIframeElement &&
                            frame.dom
                              ) {

                                if(cmd.method in frame) {
                                    frame[cmd.method].apply(frame, Ext.Array.from(cmd.args) );
                                    frame.highlight();
                                }

                        }
                        //console.warn('onmessage ', frame , cmd || e.data, view);


                },

                /**
                 * @static
                 * Feature detection block for IFRAMEs
                 */
                supports   : {}

            }
        };

    }, function() {

        var El = this,
            testFrame = document.createElement('iframe'),
            DFCset = false;

        El.addMethods = function(o) {
            Ext.apply( El.prototype, o);
        };

        Ext.EventManager.on(window, 'message', El.DOMFrameMessageHandler, El);

        // for standards-based UA's
        if(window.addEventListener) {
            window.addEventListener("DOMFrameContentLoaded", El.DOMFrameReadyHandler, false);
            DFCset = true;
        }
        Ext.EventManager.on(window, 'beforeunload', function() {
            Ext.EventManager.un(window, 'message', El.DOMFrameMessageHandler, El);
            if(DFCset) {
                window.removeEventListener("DOMFrameContentLoaded", El.DOMFrameReadyHandler, false);
            }
            El = null;
        });

        Ext.apply(El.supports , {
            //srcdoc   : 'srcdoc' in  testFrame,
            seamless : 'seamless' in  testFrame,
            sandbox  : 'sandbox' in  testFrame,
            allowfullscreen : 'allowfullscreen' in testFrame
        });
        testFrame = null;

    });

