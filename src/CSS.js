// @define Ext.ux.ManagedIframe.CSS
    /**
     * @class Ext.ux.ManagedIframe.CSS
     * Stylesheet interface object
     * @version 4.2.0
     * @author Doug Hendricks. doug[always-At]theactivegroup.com
     * @donate <a target="tag_donate" href="http://donate.theactivegroup.com"><img border="0" src="http://www.paypal.com/en_US/i/btn/x-click-butcc-donate.gif" border="0" alt="Make a donation to support ongoing development"></a>
     * @copyright 2007-2013, Active Group, Inc.  All rights reserved.
     * @license <a href="http://www.gnu.org/licenses/gpl.html">GPL 3.0</a>
     */
    Ext.define('Ext.ux.ManagedIframe.CSS' , function(MIFCss) {
        var camelRe = /(-[a-z])/gi,
            camelFn = function(m, a){ return a.charAt(1).toUpperCase(); },
            trim = Ext.String.trim,
            CSS;

        return {
            rules : null,
            requires : ['Ext.String'],
            constructor: function(hostDocument) {

                hostDocument = hostDocument || document;
                if (Ext.isDocument(hostDocument, true) ) {
                    this.doc = hostDocument;
                }
                CSS = this;
            },

            /** @private */
            destroy  :  function(){  return this.doc = this.rules = null; },

            /**
             * Creates a stylesheet from a text blob of rules. These rules
             * will be wrapped in a STYLE tag and appended to the HEAD of
             * the document.
             *
             * @param {String} cssText The text containing the css rules
             * @param {String} id An (optional) id to add to the stylesheet for later removal
             * @return {StyleSheet}
             */
            createStyleSheet : function(cssText, id) {
                var ss,
                    doc = this.doc;

                if (!doc)return;
                var head = doc.head || doc.getElementsByTagName("head")[0];
                var rules = doc.createElement("style");
                rules.setAttribute("type", "text/css");
                Ext.isString(id) && rules.setAttribute("id", id);

                if (Ext.isIE) {
                    head.appendChild(rules);
                    ss = rules.styleSheet;
                    ss.cssText = cssText;
                } else {
                    try {
                        rules.appendChild(doc.createTextNode(cssText));
                    } catch (e) {
                        rules.cssText = cssText;
                    }
                    head.appendChild(rules);
                    ss = rules.styleSheet
                            ? rules.styleSheet
                            : (rules.sheet || doc.styleSheets[doc.styleSheets.length - 1]);
                }
                this.cacheStyleSheet(ss);
                return ss;
            },

            /**
             * Removes a style or link tag by id
             *
             * @param {String}
             *            id The id of the tag
             */
            removeStyleSheet : function(id) {
                var doc = this.doc;
                if (!doc || !id)return;
                var existing = doc.getElementById(id);
                if (existing) {
                    existing.parentNode.removeChild(existing);
                }
            },

            /**
             * Dynamically swaps an existing stylesheet reference for a new one
             *
             * @param {String} id The id of an existing link tag to remove
             * @param {String} url The href of the new stylesheet to include
             */
            swapStyleSheet : function(id, url) {
                var doc = this.doc;
                if (!doc)return;
                this.removeStyleSheet(id);
                var ss = doc.createElement("link");
                ss.setAttribute("rel", "stylesheet");
                ss.setAttribute("type", "text/css");
                Ext.isString(id) && ss.setAttribute("id", id);
                ss.setAttribute("href", url);
                (doc.head || doc.getElementsByTagName("head")[0]).appendChild(ss);
            },

            /**
             * Refresh the rule cache if you have dynamically added stylesheets
             * @return {Object} An object (hash) of rules indexed by selector
             */
            refreshCache : function() {
                return this.getRules(true);
            },

            // private
            cacheStyleSheet : function(ss, media) {
                this.rules = this.rules || {};
                var array = Ext.Array;

                array.each(array.from(ss.cssRules || ss.rules ),
                    function(rule){
                      try{  this.hashRule(rule, ss, media); } catch(er){}
                }, this);

                //IE @imports
                array.each(array.from(ss.imports),
                    function(sheet){
                       try{  sheet && this.cacheStyleSheet(sheet, this.resolveMedia([sheet, sheet.parentStyleSheet])); }catch(e){}
                } ,this);


            },

             // @private
            hashRule  :  function(rule, sheet, asMedia) {

                var mediaSelector = asMedia || this.resolveMedia(rule);

                //W3C @media
                if( rule.cssRules || rule.rules) {
                    this.cacheStyleSheet(rule, this.resolveMedia([rule, rule.parentRule ]));
                }

                //W3C @imports
                if(rule.styleSheet) {
                    this.cacheStyleSheet(rule.styleSheet, this.resolveMedia([rule, rule.ownerRule, rule.parentStyleSheet]));
                }

                if(rule.selectorText) {
                    Ext.each((mediaSelector || '').split(','),
                       function(media){
                            media = trim(media);
                            this.rules[((media ? media + ':' : '') + rule.selectorText).toLowerCase()] = rule;
                    }, this);
                }

           },

           /**
            * @private
            * @param {Object/Array} rules CSS Rule (or array of Rules/sheets) to evaluate media types.
            * @return a comma-delimited string of media types.
            */
           resolveMedia  : function(rules, debug){
                var media,
                    array = Ext.Array;

                array.each(
                    array.clean(array.from(rules)),
                    function(rule){
                        if(rule && rule.media && rule.media.length){
                            media = rule.media;
                            return false;
                        }
                    },
                    this
                );

                return media && (media.mediaText || String(media)) || '';
             },

            /**
             * Gets all css rules for the document
             *
             * @param {Boolean}
             *            refreshCache true to refresh the internal cache
             * @return {Object} An object (hash) of rules indexed by
             *         selector
             */
            getRules : function(refreshCache) {
                if (!this.rules || refreshCache) {
                    this.rules = {};
                    var doc = this.doc;
                    if (doc) {
                        var ds = doc.styleSheets;
                        for (var i = 0, len = ds.length; i < len; i++) {
                            try {
                                this.cacheStyleSheet(ds[i]);
                            } catch (e) {}
                        }
                    }
                }
                return this.rules;
            },

           /**
            * Gets an an individual CSS rule by selector(s)
            * @param {String/Array} selector The CSS selector or an array of selectors to try. The first selector that is found is returned.
            * @param {Boolean} refreshCache true to refresh the internal cache if you have recently updated any rules or added styles dynamically
            * @param {String} mediaSelector Name of optional CSS media context (eg. print, screen(default))
            * @return {CSSRule} The CSS rule or null if one is not found
            */
            getRule : function(selector, refreshCache, mediaSelector) {

                var select,
                    media = trim(mediaSelector || 'screen' ).toLowerCase(),
                    rs = this.getRules(refreshCache) || {};

                selector = Ext.Array.from(selector);

                //return first match only
                for(var i = 0; i < selector.length; i++){
                    select = trim(media + (selector[i] || '')).toLowerCase();
                    if(select && rs[select]){
                        return rs[select];
                    }
                }
                return null;
            },

           /**
            * Updates a rule property
            * @param {String/Array} selector If it's an array it tries each selector until it finds one. Stops immediately once one is found.
            * @param {String} property The css property or a cssText specification eg `"color:red;font-weight:bold;text-decoration:underline"`
            * @param {String} value The new value for the property
            * @param {String} mediaSelector Name(s) of optional media contexts. Multiple may be specified, delimited by commas (eg. print,screen)
            * @return {Boolean} true If a rule was found and updated
            */
            updateRule : function(selector, property, value, mediaSelector){
                var media = (mediaSelector || '').split(','),
                    array = Ext.Array,
                    args  = array.from(arguments),
                    styles;

                if(!media.length) {
                    media = [''];
                }

                array.each( media, function(mediaSelect){

                    if(!Ext.isArray(selector)){
                        var rule = this.getRule(selector, false, mediaSelect);
                        if(rule){
                            // 2 arg form means cssText sent, so parse it and update each style
                            if (args.length == 2 || (args.length == 4 && Ext.isEmpty(value)) ) {
                                styles = Ext.Element.parseStyles(property);
                                for (property in styles) {
                                    if(styles.hasOwnProperty(property)) {
                                        rule.style[property.replace(camelRe, camelFn)] = styles[property];
                                    }
                                }
                            } else {
                                rule.style[property.replace(camelRe, camelFn)] = value;
                            }
                            return true;
                        }
                    }else{
                        for(var i = 0; i < selector.length; i++){
                            if(this.updateRule(selector[i], property, value, mediaSelect)){
                                return true;
                            }
                        }
                    }
                    return false;

                 }, this);
            },

            /**
            * Returns the combined (or singular) cssText value of an entire styleSheet or single rule.
            * @param {Object} styleSheet The styleSheet object to be parsed
            * @return {String} the Combined string result of the query
            */
            getCssText  : function(styleSheet) {

                var me = this,
                    array = Ext.Array,
                    rules,
                    ruleText = [];

                if(styleSheet && styleSheet.cssText) {
                    return styleSheet.cssText;
                }

                rules = array.from(styleSheet && (styleSheet.cssRules || styleSheet.rules ));

                if(rules && rules.length) {
                    ruleText = array.map(rules,
                        function(rule) {

                            return ('cssText' in rule) ? rule.cssText || '' :
                                        rule.selectorText + ' {' + ((rule.style || {}).cssText || '') + '}';
                        }
                    );
                }

                return ruleText.length ? ruleText.join(' ') : '';

            }
        }
    });


