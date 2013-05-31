/*
 * Copyright 2007-2013, Active Group, Inc.  All rights reserved.
 * ******************************************************************************
 * This file is distributed on an AS IS BASIS WITHOUT ANY WARRANTY; without even
 * the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * ***********************************************************************************
 * @version 4.2 beta-1
 * [For Ext 4.2 or higher only]
 *
 * License: Ext.ux.ManagedIframe.Component, Ext.ux.ManagedIframe.Element, and multidom.js
 * are licensed under the terms of the Open Source GPL 3.0 license:
 * http://www.gnu.org/licenses/gpl.html
 *
 * Commercial use is prohibited without a Commercial Developement License. See
 * http://licensing.theactivegroup.com.
 *
 */
// @define Ext.ux.ManagedIframe.Component
// @require Ext.Component
// @uses Ext.ux.ManagedIframe.Error,Ext.ux.ManagedIframe.Element

    /**
     * @class Ext.ux.ManagedIframe.Component
     * @extends Ext.Component
     */
    Ext.define('Ext.ux.ManagedIframe.Component', function(){

        var Element = Ext.Element,
            DomHelper = Ext.DomHelper,
            slice = Array.prototype.slice,
            truthy = /(true|yes|on|1)$/i;

        return {

        /* Begin Definitions */
        extend      : 'Ext.Component',
        alias       : 'widget.miframe',
        uses :      [ 'Ext.ux.ManagedIframe.Element', 'Ext.ux.ManagedIframe.Error' ],

        /* End Definitions */

        isManagedIframe : true,

        /*
         * @inherit
         */
        autoScroll  : false,

        cls         : Ext.baseCSSPrefix + 'miframe-component',

        baseCls     : Ext.baseCSSPrefix + 'miframe',
        validateOnBlur : false,

        /*
         * @inherit
         */
        hideMode    : 'nosize',

        focusable  : true,

        /*
         * Configured setters/getters
         */
        config : {

            /**
             * @property {Ext.ux.ManagedIframe.Element} iframeElement
             * A runtime reference to the underlying Ext.ux.ManagedIframe.Element
             */
            iframeElement : undefined,

            /**
             * @cfg {String} frameName
             * Name applied to the IFRAME Element
             * @default the Element id assigned to the underlying IFRAME Element
             */
            iframeName   : undefined,

            /**
             * @property {Ext.core.Element} iframeShim
             * A runtime reference to the shimming agent
             */
            iframeShim  : undefined,

             /**
             * @cfg {String} iframeStyle
             * (optional) Style string or object configuration representing
             * the desired style attributes to apply to the embedded IFRAME.
             * @default 'z-index:2;top:0;left:0;height:100%; width:100%;'
             */
            iframeStyle : null,

             /**
             * @cfg {Boolean/String} iframeBorder
             * True or 'yes' to render a border around the IFRAME Element.
             * @default false
             */
            iframeBorder  :  false,

            /**
             * @cfg {Boolean/String} iframeSeamless
             * True to force the IFRAME Element into seamless mode for browsers that support the attribute's HTML5 pecification.
             * If True (for UA's that do not support the attribute) MIF will emulate equivalent features (same-origin documents only).
             * @default false
             */
            iframeSeamless : false,

            /**
             * @cfg {Boolean/String} iframeAllowfullscreen
             * True to this attribute can be set to true if the frame is ALLOWED to be placed into full screen mode by
             * calling its element.mozRequestFullScreen() or element.webkitRequestFullScreen() or methods. If false, the element can't be placed into full screen mode.
             * @default false
             */
            iframeAllowfullscreen  : false,

            /**
             * @cfg {Boolean} emulateSeamless
             * True to emulate the seamless attribute on browsers that do not yet support this HTML5 feature.  When enabled,
             * all stylesheets from the parent document context are replicated to the embedded frame (same-origin only).
             */
            emulateSeamless : true,


            /**
             * @cfg {Array} propagateEvents
             * A collection of events relayed from the iframe element's document to the Component itself (for use within MVC Controllers)
             * Using this collection, keyup, keydown, mouse and other document-level events can be monitored.  The following events
             * are always routed to the Component:
               <ul><li>dataavailable - fires when the frame document DOM is ready(same-origin only)</li>
               <li>load</li><li>beforeunload/li><li>unload</li>/li><li>reset</li>/li><li>error</li>/li><li>message (via postMessage)</li></ul>
             * <p> All participating event listeners are called with the following argument signature:
                (MIFComponent, MIFElement, event, target, options)
               </p>
             * <p> Notes:
               1. events 'focus', 'blur', and 'resize' will always be removed from this collection as these events are already
                  supported by the Component
               2. To keep the Component performant, limit the event list to only what is necessary.
                  </p>
                @default []
             */
            propagateEvents  : [],


             /**
             * @cfg {Boolean/Array/String} iframeSandbox
             * True or Array of permissive access attributes as defined by the HTML5 specification
             *
             *  if Supported by the browser, with solely the sandbox attribute specified, the framed content is no longer allowed to:
                Instantiate plugins
                Execute script
                Open popup windows
                Submit forms
                Access storage (HTML5 localStorage, sessionStorage, cookies, etc.)
                Send XMLHttpRequests
                Access the parent window's DOM
                Use HTCs, binary behaviors, or data binding
             * Specific access attributes my be specified:
             @default : [ 'allow-same-origin', 'allow-forms', 'allow-scripts', 'allow-top-navigation' ]
            <p>Note:

            When the embedded document has the same origin as the main page, it is strongly discouraged to use both 'allow-scripts' and 'allow-same-origin' at the same time, as that allows the embedded document to programmatically remove the sandbox attribute. Although it is accepted, this case is no more secure than not using the sandbox attribute.
            Sandboxing in general is only of minimal help if the attacker can arrange for the potentially hostile content to be displayed in the user's browser outside a sandboxed iframe. It is recommended that such content should be served from a separate dedicated domain, to limit the potential damage.
            */
            iframeSandbox  :  false, //[ 'allow-same-origin', 'allow-forms', 'allow-scripts', 'allow-top-navigation', 'allow-popups' ],

             /**
             * @cfg {Boolean/String} iframeScroll
             * 'auto','yes', or 'no' to enable or force scrolling on the IFRAME Element.
             * @default 'auto'
             */
            iframeScroll  :  'auto',

            /**
             * @cfg {Boolean/String} iframeTransparency
             * True to enable transparent background on the IFRAME. (IE requires this setting to be true to permit transparent
             * backgrounds on IFRAMES)
             * @default true
             */
            iframeTransparency  : Ext.isIE9m,

            /**
             * @cfg {String} iframeCls
             * (optional) Additional className added to the rendered IFRAME element
             */
            iframeCls   : undefined ,

            /**
             * @cfg {String} shimStyle
             * (optional) Style string representing
             * the desired style attributes to apply to the shimming agent (image tag).
             * @default 'position:absolute;top:0;left:0;display:none;z-index:20;height:100%;width:100%;'
             */
            shimStyle   : undefined,

            /**
             * @cfg {String} shimCls
             * (optional) Additional className added to the rendered shimming agent (image tag)
             */
            shimCls     : undefined,

            /**
             * @cfg {String} shimUrl
             * (optional) Url of the shimming agent image resource.
             * @default  Ext.BLANK_IMAGE_URL
             */
            shimUrl     : undefined,

            /**
             * @cfg {Boolean} eventsFollowFrameLinks
             * True to raise the 'dataavailable' event anytime
             * the frame document is reloaded (including when the user follows a link to another page) unless {link: seamless} seamless is False
             * Note: the load event is always fired
             * @default true
             */
            eventsFollowFrameLinks : true,


            /**
             * @cfg {String} defaultSrc
             * (optional) default Uri to load into the frame if the {link src} property is not defined
             */
            defaultSrc  : null,

            /**
             * @cfg {String} src
             * (optional) initial Uri to load into the frame
             */
            src         : null,

            /**
             * @cfg {Boolean} autoMask
             * True to display a loadMask during 'class-initiated' content changes
             */
            autoMask    : true,

            /**
             * @cfg {String} maskMessage
             * default message text rendered during masking operations
             */
            maskMessage : 'Loading...',

            /**
             * @cfg {String} resetUrl
             * (optional) Uri to load into the frame during initialization only
             * @default undefined
             */
            resetUrl    : undefined,

            /**
             * @cfg {String} iframeAriaRole
             * Aria role to apply to the underlying IFRAME
             * @default 'presentation'
             */
            iframeAriaRole    : 'presentation',

            /**
             * @cfg {String} unsupportedText
             * default message text rendered when IFRAMEs are disabled
             */
            unsupportedText : 'IFrames are disabled'

        },

        /*
         * @private
         */
        constructor: function(config) {
            var me = this;
            config = config || {};

            delete config.items;
            delete config.contentEl;

            me.callParent(arguments);
            me.initConfig(config);
            me.shimRequestCount = 0;

        },

        /*
         * @private
         */
        renderTpl: [
            '<iframe {seamless} class="',Ext.baseCSSPrefix,'miframe-element {iframeCls}"  ',
                '<tpl if="iframeName"> name="{iframeName}" </tpl>',
                '<tpl if="iframeStyle"> style="{iframeStyle}" </tpl>',
                '<tpl if="iframeRole"> role="{iframeRole}" </tpl>',
                '<tpl if="allowfullscreen"> allowfullscreen </tpl>',
                ' scrolling="{scroll}" ',
                '<tpl if="src"> src ="{src}" </tpl>',
                '<tpl if="iframeSandbox"> {iframeSandbox} </tpl>',
                '<tpl if="iframeTransparency"> allowtransparency="true" </tpl>',
            '>{unsupportedText}</iframe>',
            '<img class="',Ext.baseCSSPrefix,'miframe-shim {shimCls}" galleryimg="no" src="{shimUrl}" style="{shimStyle}" />',
            {
                compiled: true,
                disableFormats: true
            }
        ],

        /*
         * @private
         */
        renderSelectors: {
            iframeElement: 'iframe.'+Ext.baseCSSPrefix+'miframe-element',
            iframeShim   : 'img.'   +Ext.baseCSSPrefix+'miframe-shim'
        },

        /*
         * @private
         */
        initRenderData: function() {

            var me = this,
                scroll = me.getIframeScroll(),
                sandbox = me.getIframeSandbox() || null,
                seamless = me.getIframeSeamless() ? 'seamless="seamless"' : false,
                supports = Ext.ux.ManagedIframe.Element.supports;

            if(supports.sandbox) {
                if(Ext.isArray(sandbox) ) {
                    sandbox = !!sandbox.length ? 'sandbox="' + sandbox.join(' ') + '"' : true;
                }
                if(Ext.isBoolean(sandbox) ) {
                    sandbox = sandbox ? 'sandbox' : '';
                }

            } else {
                sandbox = false;
            }

            return Ext.apply(
                me.callParent() || {},
                {
                    iframeStyle         : me.getIframeStyle() || '',
                    iframeBorder        : truthy.test( String(me.getIframeBorder()) ) ? '1' : '0',
                    iframeCls           : me.getIframeCls() || '',
                    iframeRole          : me.getIframeAriaRole(),
                    iframeName          : me.getIframeName(),
                    iframeTransparency  : truthy.test(me.getIframeTransparency() ) ,
                    iframeSandbox       : sandbox || '',
                    allowfullscreen     : me.getIframeAllowfullscreen() && supports.allowfullscreen,
                    seamless            : seamless || '',
                    scroll              : /auto|scroll$/i.test(scroll) ? scroll : truthy.test(scroll) ? 'yes' : 'no' ,
                    shimUrl             : me.getShimUrl() || Ext.BLANK_IMAGE_URL,
                    shimCls             : me.getShimCls() || '',
                    shimStyle           : 'display:none;' + (me.getShimStyle() || ''),
                    unsupportedText     : me.unsupportedText || ''
                });
        },

        contentTpl        : undefined ,

        initContent: function() {},

        /*
         * @private
         */
        afterRender : function() {
            var me = this,
                frameComp,
                frame,
                shim,
                propagates,
                array = Ext.Array,
                followLinks = !!me.getEventsFollowFrameLinks();

            me.callParent( arguments );

            if(shim = me.getIframeShim()) {
                shim.autoBoxAdjust = false;
                shim.setVisibilityMode(Element.DISPLAY);
            }

            if(frame = me.getIframeElement() ) {

                //convert the iframe element to a ux.MIF.Element
                me.setIframeElement( frame = new Ext.ux.ManagedIframe.Element(frame.dom, true));

                //Suppress dataavailable event chatter during initialization
                frame.eventsFollowFrameLinks = false;
                me.setIframeSeamless(me.getIframeSeamless());

                /*
                 * Propagate defined events (from the frame Element directly to the Component Observable
                 * (for use in Controllers, etc)
                 */

                propagates = array.difference(
                    me.getPropagateEvents() || [],
                    ['blur', 'focus', 'resize']  //Exclude events managed by AbstractComponent itself
                );

                frame.setPropagateEvents(propagates);

                var relay = me.onFrameEvent,
                    listen = {scope : me };

                array.each(
                    array.unique( [ 'dataavailable', 'load', 'unload', 'beforeunload', 'reset', 'error', 'resize', 'contentresize' ].concat(propagates ||[])),
                    function(event) {
                        listen[event] = relay;
                    },
                    me
                );

                me.mon(frame, listen);

                me.mon(frame, {   // loadMask bindings
                    error   : me.onFrameLoad,
                    load    : me.onFrameLoad,
                    scope   : me
                });

                var src = me.getSrc() || me.getDefaultSrc();
                if(me.autoLoad) {

                    frame.isReset = Ext.isIE;
                    me.setEventsFollowFrameLinks(followLinks);

                } else if(src || me.data || me.html) {

                    Ext.Function.defer(
                        frame.reset,
                        100,        //permit layout to quiesce
                        frame,
                        [
                            me.resetUrl,
                            function(){
                                var me = this;
                                me.setEventsFollowFrameLinks(followLinks);
                                if(src) {
                                    me.setSrc();
                                } else if(me.data || me.html) {
                                    me.update(me.data || me.html);
                                }

                            },
                            me
                        ]
                    );
                }
            }


        },

        /*
         * @private
         * Relay subscribed frame events to the component (for use in Controllers etc)
         */
        onFrameEvent : function(e, target) {
            var me = this,
                frame = me.getIframeElement(),
                type = e && e.type;

            if(type &&  me.hasListeners[type]) {
                return me.fireEvent(type, me, frame, e, target);
            }

        },


        // private
        getContentTarget: function() {
            return this.getIframeElement();
        },

        /*
         * @private
         */
        onFrameLoad : function(e) {
            if(this.getAutoMask()) {
                this.setLoading(false);
            }
            var el = this.getIframeElement(),
                doc = el.getFrameDocument() || {};

        },

        /*
         * Setter - Changes the current src attribute of the IFRAME, applying a loadMask
         * over the frame (if autoMask is true)
         * Note: call without the uri argument to simply refresh the frame with the current src value
         * @param {Function} callback (Optional) A callback function invoked when the
         *            frame document has been fully loaded.
         * @param {Object} scope (Optional) scope by which the callback function is
         *            invoked.
         */
        setSrc  : function(uri, callback, scope) {
            var me = this, frame;

            uri = uri || me.getSrc() || me.getDefaultSrc();

            if(uri && me.rendered && (frame = me.getIframeElement())) {
                if(me.getAutoMask() && me.isVisible(true)) {
                    me.setLoading(me.getMaskMessage() || '');
                }

                frame.setSrc( uri, false, callback, scope);
            }
            me.src = uri;
            return me;
        },

        /*
         * Resets the IFRAME Element to a neutral (empty) state, and clears the integral shim
         * and clears any active load masks
         */
        reset  : function(resetUrl, callback, scope){
            var me = this, frameEl;

            if(frameEl = me.getIframeElement()) {
                frameEl.reset.apply(frameEl, slice.call(arguments,0) );
                if(me.rendered)
                    {
                        me.toggleShim(false);
                        me.setLoading(false);
                }
            }
            return me;
        },

        /*
         * @private setter partner
         */
        setFrameAttribute : function(name, value) {
            var me = this, frameEl, attrs = name;

            if(me.rendered && (frameEl = me.getIframeElement())) {
                if( Ext.isString(name) )
                    {
                        attrs = {};
                        attrs[name] = Ext.value(value, undefined);
                    }
                if( Ext.isObject(attrs) )
                    {
                        frameEl.set(attrs);
                    }
            }
            return me;
        },

        /*
         * @private setter partner
         */
        applyIframeAriaRole : function(role) {
            var me = this;
            me.setFrameAttribute('role', role);
            return role;
        },

        /*
         * @private setter partner
         *
         */
        applyIframeBorder : function(border) {
            var me = this;
            border = truthy.test(border);

            // 1 = 3D inset,  0 = none
            me.setFrameAttribute('frameBorder', border ? '1' : '0');
            return border;
        },

        getIframeName : function() {
            var me = this,
                name = me.iframeName,
                frame = me.getIframeElement();

            if(me.rendered && frame && frame.dom) {
                name = frame.dom.name;
            }
            return name;
        },

        /*
         * @private setter partner
         */
        applyIframeName : function(name) {
            var me = this;
            me.setFrameAttribute('name', name || undefined);
            return name || '';
        },

        /*
         * @private setter partner
         */
        applyIframeSandbox : function(enabled) {

            var me = this,
                sandbox,
                frame =  me.getIframeElement();

            if(me.rendered && frame) {
                if(Ext.isBoolean(enabled) ) {
                    sandbox = enabled ? 'sandbox' : false;
                }
                if(Ext.isArray(enabled) ) {
                    sandbox = !!enabled.length ?  sandbox.join(' ') : 'sandbox';
                }

                me.setFrameAttribute('sandbox', sandbox || undefined);

            }

            return enabled;
        },

        /*
         * @private setter partner
         */
        applyIframeSeamless : function(enabled) {

            var me = this,
                frame =  me.getIframeElement();

            if(me.rendered && frame) {
                frame.setSeamless(enabled);
            }
            return enabled;

        },

        /**
         * @private setter partner
         * Asserts a valid scrolling setting for the IFRAME
         * @param {Boolean/String} scroll true/yes to allow the IFRAME to scroll.
         */
        applyIframeScroll : function(scroll) {
            var value = scroll,
                me = this,
                frame =  me.getIframeElement();

            //assert  auto, true, or false
            if(!/(auto|scroll)$/i.test(value)) {
                value = truthy.test(String(scroll) );
            }

            if( frame && me.rendered) {
                me.setFrameAttribute('scrolling', value == 'auto' ? value : truthy.test(value) ? 'yes' : 'no');

                var style = {'overflow' : /(auto|scroll)$/i.test(value) ? value : truthy.test(value) ? 'scroll' : 'hidden' };
                frame.applyStyles(style);

                if(frame.domWritable()) {  //same origin only
                    frame.getBody().applyStyles(style);
                }
            }

            return value;
        },

        /*
         * @private setter partner
         */
        applyIframeAllowfullscreen  : function(allow) {
            var me = this,
                frame = me.getIframeElement();

            if( me.rendered && frame ) {
                me.setFrameAttribute('allowfullscreen', !!allow ? 'allowfullscreen': undefined );
            }
            return !!allow;
        },

        /*
         * @private setter partner
         */
        applyIframeTransparency  : function(transparency) {
            var me = this,
                frame = me.getIframeElement(),
                transparent = truthy.test(transparency);

            if( me.rendered && frame ) {
                var style = {'background-color':  transparent ? 'transparent' : '' };
                //< IE9 madness
                me.setFrameAttribute('allowtransparency', transparent ? 'allowtransparency': undefined );
                frame.applyStyles(style);

                if(frame.domWritable()) {  //same origin only
                    frame.getBody().applyStyles(style);
                }
            }
            return transparent;
        },

        /*
         * @private setter partner
         */
        applyEventsFollowFrameLinks  : function(follows) {
            var frame = this.getIframeElement();

            follows = !!follows;
            if( frame ) {
                frame.eventsFollowFrameLinks = follows;
            }

            return follows;
        },

        /*
         * @private setter partner
         */
        applyResetUrl : function(url) {
            var frame = this.getIframeElement();

            if(frame) {
                frame.resetUrl = Ext.value(url , '');
            }
            return url;
        },

        /*
         * @private setter partner
         */
        applyShimUrl : function(url) {
            var shim = this.getIframeShim();

            if(shim) {
                shim.dom.src = String(url || Ext.BLANK_IMAGE_URL);
            }
            return url;
        },

        /**
         * @private
         * Ensure the IFRAME itself is the focus target for the Component
         * @returns {Ext.ux.ManagedIframe.Element} the focus holding element.
         */
        getFocusEl: function() {
            return this.getIframeElement();
        },

        /**
         * Update(replacing) the document content of the IFRAME.
         * @param {Mixed} htmlOrData
         * If this component has been configured with a template via the tpl config
         * then it will use this argument as data to populate the frame.
         * If this component was not configured with a template, the components
         * content area (iframe) will be updated via Ext.ux.ManagedIframe.Element update
         * @param {Boolean} loadScripts (optional) Defaults to false
         * @param {Function} callback (optional) Callback to execute when scripts have finished loading
         * @param {Object} scope (optional) execution context of the the callback
         */
        update : function(htmlOrData, loadScripts, callback, scope) {
            var me = this,
                content = htmlOrData;

            if (me.contentTpl && (Ext.isArray(content) || Ext.isObject(content))) {
                me.data = content;
                content = me.applyTemplate('contentTpl', content || {});
            }

            if (me.rendered) {
                if(me.getAutoMask() && me.isVisible(true)) {
                    me.setLoading(me.getMaskMessage() || '');
                }

                var frame = me.getContentTarget();
                Ext.defer(
                    function(){
                        frame.update(content, loadScripts, callback, scope);
                        Ext.defer(this.setLoading, 100, this ,[false]);
                    },
                    me.getAutoMask() ? 100 : 10 ,
                    me,
                    [ ]
                );
            }
            return me;
        },

        /*
        * override to provide custom Template output
        */
        applyTemplate : function(tpl, content) {
            var me=this;
            if(tpl && Ext.isString(tpl)) {
                tpl= me.getTpl(tpl);
            }
            if(tpl.isTemplate){
                return tpl.apply(content);
            }
        },

        /*
        * Toggles visibility of the (frontal) transparent shim agent for the frame.  Used primarily for masking the frame during drag operations.
        * The transparent shim visibility is usually managed via a request counter to manage automatic shim operations.  Calling this method with
        * a value of false resets the internal usage counter of the feature and forcefully hides the shimming agent.
        * @param {Boolean} enable True to activate the shim, False to explicitly hide the shim agent, and no argument (or undefined) for
        * internal reference count support.
        * @return {Ext.core.Element} the rendered shim.
        */
        toggleShim  : function( enable ) {
            var me = this,
                shim = me.getIframeShim();

            if(me.rendered && shim) {
                if( enable) {
                    shim.isVisible() || shim.show();
                    ++me.shimRequestCount;
                } else {
                    if (  (enable === false) || --me.shimRequestCount < 1) {
                        shim.hide();
                        me.shimRequestCount = 0;
                    }
                }

            }
            return shim;
        },

        /**
         * @private
         * Frame must be reset here BEFORE the FRAME's parent is removed from the layout
         */
        beforeDestroy : function() {
            var frame = this.getIframeElement();
            if(frame) {
                frame.reset();
            }
            this.callParent();
        }

    };  //eo def

});


