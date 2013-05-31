// @require Ext.Error
// @define Ext.ux.ManagedIframe.Error

    Ext.define( 'Ext.ux.ManagedIframe.Error', {
        extend  : 'Ext.Error',
        requires : ['Ext.Error'],

        statics : {
            raise : Ext.Error.raise,
            ignore: false,
            handle: function(){
                 return this.ignore;
            },
            message : {
                'execscript-secure-context': 'An attempt was made at script execution within a document context with restricted access.',
                'printexception': 'An Error was encountered attempting the print the frame contents (document access is likely restricted).'
            }
        }
    });

