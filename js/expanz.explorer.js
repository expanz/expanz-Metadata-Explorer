/*
 *                EXPANZ Metadata Explorer
 *
 *
 */


/*
 *   On Ready (once the page loads, do: )
 *          :setup the bindings (using Knockout.js) that connection Username/Password/Login to the DOM elements
 */

$(document).ready( function() {
	
        var URLProtocols = [ 'http://', 'https://' ];

	var Bindings = {
                URLProtocols: ko.observableArray( URLProtocols ),
                chosenURLProtocol: ko.observable( URLProtocols[0] ),
                URLEndpoint: ko.observable('test.expanz.com/...')
                };
        Bindings.Lookup = ListAvailableSites( Bindings );
	ko.applyBindings( Bindings );

        
});

function error( message ){
   $('#error').append( 'Error: ' + message );
}

var treeBase;

/*
 *   Actions
 *         :top-level functions issued by user input or server request
 */

function ListAvailableSites( fields ){
   return function apply( event ){

      var endpoint = $('#endpoint').val();

      treeBase = new ExplorerTree(  endpoint.split('/')[0].replace(/\./g, '_'),
                                    new TreeNode( $('#main')
                                                   .html('<div id=\'error\'></div>')
                                                   .css('width','2500px')
                                                   )
                                    );
      
      var url = fields['chosenURLProtocol']() + endpoint;
      var channel = SendGetRequest( url );

      treeBase.channel = channel;

      channel( 'ListAvailableSites',
               parseListAvailableSitesResponse( ListActivitiesForSite( channel ), treeBase, error ),
	       error
               );
      return false;
   }
}

function ListActivitiesForSite( channel ){
   return function apply( appsite ){

      channel(   'ListActivitiesForSite?site=' + appsite.id,
         	     parseListActivitiesForSiteResponse( GetSchemaForActivity(channel, appsite), appsite, error ),
		     error
         	     );
   }
}

function GetSchemaForActivity( channel, appsite ){
   return function apply( activity ){

      channel(   'GetSchemaForActivity?site=' + appsite.id + '&activity=' + activity.id,
         	  parseGetSchemaForActivityResponse( activity, error ),
		  error
         	  );
   }
}


function parseListAvailableSitesResponse( nextLink, mother ){
	return function apply( xml ){

            var appSites = $(xml).find("AppSites");
	    if( appSites ){
               $(appSites).find('AppSite').each( function(){
                  var appsite = new AppSite( $(this).attr('id'),
                                             $(this).attr('name'),
                                             $(this).attr('authenticationMode')
                                             );
                  appsite.channel = mother.channel;
                  mother.append( appsite );
                  eval( nextLink )( appsite );
               });
	    }
            else{
               eval( error )( 'Unable to find any Application Sites from the Endpoint. Is your Endpoint URL correct?\n' + xml );
            }
      }
}

function parseListActivitiesForSiteResponse( nextLink, mother ){
	return function apply( xml ){

            var activities = $(xml).find("Activities");
	    if( activities ){
               $(activities).find('Activity').each( function(){

                  if( $(this).attr('name') || $(this).attr('id') ) {
                     var activity = new Activity(  $(this).attr('id'),
                                                   $(this).attr('name')
                                                   );
                     activity.channel = mother.channel;
                     mother.append( activity );
                  }
               });
	    }
            else{
               eval( error )( 'Unable to find any Activities from this Application Site.\n' + xml );
            }
      }
}



function parseGetSchemaForActivityResponse( mother ){
	return function apply( xml ){

            var activity = $(xml).find("Activity");
	    if( activity ){
               // NOTE: Activity has a bunch of extra fields here. $(activity).find('Activity').attr(...)
               $(activity).find('Field').each( function(){
                  var field = new Field(  $(this).attr('name'),
                                          $(this).attr('label') ?    $(this).attr('label') :    '',
                                          $(this).attr('class') ?    $(this).attr('class') :    '',
                                          $(this).attr('colName') ?  $(this).attr('colName') :  '',
                                          $(this).attr('datatype') ? $(this).attr('datatype') : '',
                                          $(this).attr('value') ?    $(this).attr('value') :    '',
                                          $(this).attr('disabled') ? $(this).attr('disabled') : '',
                                          $(this).attr('null') ?     $(this).attr('null') :     '',
                                          $(this).attr('valid') ?    $(this).attr('valid') :    ''
                                          );
                  mother.append( field );
               });

               $(activity).find('Method').each( function(){
                  var method = new Method(   $(this).attr('name'),
                                             $(this).attr('description') ?    $(this).attr('description') :    '',
                                             $(this).attr('returns') ?    $(this).attr('returns') :    '',
                                             $(this).attr('isDataPublication') ?    $(this).attr('isDataPublication') :    ''
                                             );
                  mother.append( method );

                  $(this).find('Parameter').each( function(){
                     var parameter = new Parameter(   $(this).attr('name'),
                                                      $(this).attr('datatype') ? $(this).attr('datatype') : ''
                                                      );
                     method.append( parameter );
                  });
               });
	    }
            else{
               // error
            }
      }
}



/*
 *    Send Request
 *        :manage the sending of XML requests to the server, and dispatching of response handlers
 */

function SendGetRequest( url ){
   return function SendRequest( method, responseHandler, error ){

      $.ajax({
         type: 'POST',
	 url: _URLproxy,
	 data: { url: url + method },
	 dataType: "string",
	 processData: true,
	 complete: function( HTTPrequest ){
	    if( HTTPrequest.status != 200 ){
               eval( error )( 'There was a problem with the last request.' );
            } else {
	       var response = HTTPrequest.responseText;
	          if( responseHandler ){
                     var xml = response.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
		     eval( responseHandler )( xml );
		  } 
	    }
	 }
      });
 
   }
}




function TreeNode( jQobj ) {
   this.jQobj = function(){ return jQobj; };
}

function ExplorerTree( id, baseTreeNode ) {
   this.id = id;
   this.mother = baseTreeNode;

   this.children = [];
   this.append = function( appsite ){
                        appsite.mother = this;
                        this.children.push( appsite );

                        treeBase.mother.jQobj().append( appsite.htmlContainer() );
                        this.jQobj().append( appsite.html() );
                        appsite.setupTabClickHandler();
                        };
   this.getChild = function( id ){
      for( i=0; i < this.children.length; i++ )
         if( this.children[i].id == id )
            return this.children[i];
   };
   this.getAll = function(){ return this.children; };

   // constructor
   this.mother.jQobj().append(
            '<div class="vertical_section appserver" id="' + this.id + '">' +
            '\t<div class="title">Application Sites</div>' +
            '</div>'
            );
   this.jQobj = function(){
      var jQobj = this.mother.jQobj().find('#' + this.id + '.appserver.vertical_section');
      this.jQobj = function( obj ){ return function(){ return obj; } }( jQobj );
      return jQobj;
   };
}

function AppSite( id, name, authenticationMode ) {
   this.id = id;
   this.name = name;
   this.authenticationMode = authenticationMode;

   this.children = [];
   this.append = function( activity ){
                        activity.mother = this;
                        this.children.push( activity );

                        treeBase.mother.jQobj().append( activity.htmlContainer() );
                        this.jQobj().append( activity.html() );
                        activity.setupTabClickHandler();
                        };
   this.getChild = function( id ){
      for( i=0; i < this.children.length; i++ )
         if( this.children[i].cssId == id )
            return this.children[i];
      return { id: '' };
   };
   this.getAll = function(){ return this.children; };

   this.html = function() {
      var markup =   '<div class="horizontaltab" id="' + this.id + '">' +
                     '\t<span class="title">' + this.name + '</span>' +
                     '</div>';
      return markup;
   };
   this.htmlContainer = function(){
      var markup =   '<div class="vertical_section dynamicshow appsite" id="' + this.id + '">' +
                     '\t<div class="title">Activities</div>' +
                     '</div>';
      return markup;
   };
   this.jQobj = function(){
      if( this.mother ){
         var jQobj = treeBase.mother.jQobj().find('#' + this.id + '.appsite.vertical_section');
         this.jQobj = function( obj ){ return function(){ return obj; } }( jQobj );
         return jQobj;
      }
      return $('#' + this.id + '.appsite.vertical_section');
      };
   this.jQTabObj = function(){
      var jQobj = this.mother.jQobj().find( '#' + this.id + '.horizontaltab' );
      this.jQTabObj = function( obj ){ return function(){ return obj; } }( jQobj );
      return jQobj;
   };

   this.setupTabClickHandler = function(){
      setupTabClickHandler( this );
   };
   this.show = function(){
      this.jQobj().show();
   };
   this.hide = function(){
      this.jQobj().hide();
   };

}

function Activity( id, name ) {
   this.id = id;
   this.name = name;

   this.cssId = id.replace(/\./g, '_');

   this.children = [];
   this.append = function( field ){
                     field.mother = this;
                     this.children.push( field );

                     treeBase.mother.jQobj().append( field.htmlContainer() );
                     this.jQobj().append( field.html() );
                     field.setupTabClickHandler();
                     };
   this.getAll = function(){ 
      if( this.children.length < 1 )   this.load();
      return this.children;
   };
   this.getChild = function( name ){
      if( this.children.length < 1 )   this.load();
      for( i=0; i < this.children.length; i++)
         if( this.children[i].name = name )
            return this.children[i];
      return { name: '' };
   }

   this.load = function() {
      GetSchemaForActivity( this.channel, this.mother )( this );
      return true;
   };

   this.html = function(){
      var markup =   '<div class=\'horizontaltab\' id=\'' + this.cssId + '\'>' +
                     '\t<span class=\'title\'>' + this.name + '</span>' +
                     '\t<span class=\'id\'>' + this.id + '</span>' +
                     '</div>';
      return markup;
   };
   this.htmlContainer = function(){
      var markup =   '<div class="vertical_section dynamicshow activity ' + this.mother.id + '" id="' + this.cssId + '">' +
                     '\t<div class="title">Fields</div>' +
                     '</div>';
      return markup;
   }
   this.jQobj = function(){
      if( this.mother ){
         var jQobj = treeBase.mother.jQobj().find('#' + this.cssId + '.' + this.mother.id + '.activity.vertical_section');
         this.jQobj = function( obj ){ return function(){ return obj; } }( jQobj );
         return jQobj;
      }
      return $('#' + this.cssId + '.activity.vertical_section');
      };
   this.jQTabObj = function(){
      var jQobj = this.mother.jQobj().find( '#' + this.cssId + '.horizontaltab' );
      this.jQTabObj = function( obj ){ return function(){ return obj; } }( jQobj );
      return jQobj;
   };

   this.setupTabClickHandler = function(){
      setupTabClickHandler( this );
   };
   this.show = function(){
      if( this.children.length < 1 )   this.load();
      this.jQobj().show();
   };
   this.hide = function(){
      this.jQobj().hide();
   };
   
}

function Field( name, label, className, colName, datatype, value, disabled, nullValue, valid ){
   this.name = name;
   this.label = label;
   this.className = className;
   this.colName = colName;
   this.datatype = datatype;
   this.value = value;
   this.disabled = disabled;
   this.nullValue = nullValue;
   this.valid = valid;

   this.html = function(){
      var markup =   '<div class="horizontaltab" id="' + this.name + '" >' +
                     '<span class="title">+' + this.name + '</span>' +
                     '</div>';
      return markup;
   };

   this.htmlContainer = function(){
      var markup =   '<div class="vertical_section dynamicshow field ' + this.mother.cssId + '" id="' + this.name + '" >' +
                     '<div class=\'title\'>Field</div>';
                  
      markup += generatePairMarkup( 'Name', this.name );
      if( $(this).attr('label') != '' )      markup += generatePairMarkup( 'Label', this.label );
      if( $(this).attr('class') != '' )      markup += generatePairMarkup( 'Class', this.className );
      if( $(this).attr('colName') != '' )    markup += generatePairMarkup( 'ColumnName', this.colName );
      if( $(this).attr('datatype') != '' )   markup += generatePairMarkup( 'Datatype', this.datatype );
      if( $(this).attr('value') != '' )      markup += generatePairMarkup( 'Value', this.value );
      if( $(this).attr('disabled') != '' )   markup += generatePairMarkup( 'Disabled?', this.disabled );
      if( $(this).attr('null') != '' )       markup += generatePairMarkup( 'Null Value', this.nulValue);
      if( $(this).attr('valid') != '' )      markup += generatePairMarkup( 'Valid', this.valid );

      markup += '</div>';
      return markup;
   };
   
   this.jQobj = function(){
      if( this.mother ){
         var jQobj = treeBase.mother.jQobj().find('#' + this.name + '.' + this.mother.cssId + '.field.vertical_section');
         this.jQobj = function( obj ){ return function(){ return obj; } }( jQobj );
         return jQobj;
      }
      return $('#' + this.name + '.field.vertical_section');
      };
   this.jQTabObj = function(){
      var jQobj = this.mother.jQobj().find( '#' + this.name + '.horizontaltab' );
      if( jQobj ){
         this.jQTabObj = function( obj ){ return function(){ return obj; } }( jQobj );
         return jQobj;
      }
      return $( '#' + this.name + '.horizontaltab' );
   };

   this.setupTabClickHandler = function(){
      setupTabClickHandler( this );
   };
   this.show = function(){
      this.jQobj().show();
   };
   this.hide = function(){
      this.jQobj().hide();
   };

}


function Method( name, description, returns, isDataPublication ) {
   this.name = name;
   this.description = description;
   this.returns = returns;
   this.isDataPublication = isDataPublication;

   this.children = [];
   this.append = function( parameter ){
                           parameter.mother = this;
                           this.children.push( parameter );

                           this.jQobj().append( parameter.html() );
                           parameter.setupTabClickHandler();
                           };
   this.getChild = function( name ){
      for( i=0; i < this.children.length; i++ )
         if( this.children[i].name == name )
            return this.children[i];
      return { name: '' };
   };
   this.getAll = function(){ return this.children; };


   this.html = function() {
      var markup =   '<div class="horizontaltab" id="' + this.name + '" >' +
                     '<span class="title">fn ' + this.name + '</span>' +
                     '</div>';
      return markup;

      

   };
   this.htmlContainer = function() {
      var markup =   '<div class="vertical_section dynamicshow method ' + this.mother.cssId + '" id="' + this.name + '">' +
                     '\t<div class="title">Method</div>';


      markup += '<div class="details">';
      markup += generatePairMarkup( 'Name', this.name );
      if( $(this).attr('label') != '' )   markup += generatePairMarkup( 'Description', this.description );
      if( $(this).attr('class') != '' )   markup += generatePairMarkup( 'Returns', this.returns );
      if( $(this).attr('colName') != '' ) markup += generatePairMarkup( 'Is Data Publication?', this.isDataPublication );
      markup + '</div>';   // div details
      
      markup += '</div>';  // div vertical_section

      this.loadParameters();
      return markup;
   };
   this.loadParameters = function(){
      if( this.children ) {
         for( i=0; i < this.children.length; i++ )
            this.jQobj().append( this.children[i].html() );
         this.loadParameters = function(){};
      }
   };

   this.jQobj = function(){
      if( this.mother ){
         var jQobj = treeBase.mother.jQobj().find('#' + this.name + '.' + this.mother.cssId + '.method.vertical_section');
         this.jQobj = function( obj ){ return function(){ return obj; } }( jQobj );
         return jQobj;
      }
      return $('#' + this.name + '.method.vertical_section');
      };
   this.jQTabObj = function(){
      var jQobj = this.mother.jQobj().find( '#' + this.name + '.horizontaltab' );
      if( jQobj ){
         this.jQTabObj = function( obj ){ return function(){ return obj; } }( jQobj );
         return jQobj;
      }
      return $( '#' + this.name + '.horizontaltab' );
   };

   this.setupTabClickHandler = function(){
      setupTabClickHandler( this );
   };
   this.show = function(){
      this.loadParameters();
      this.jQobj().show();
   };
   this.hide = function(){
      this.jQobj().hide();
   };
}

function Parameter( name, datatype ) {
   this.name = name;
   this.datatype = datatype;

   this.html = function(){
      var markup =   '<div class="horizontaltab ' + this.mother.name + '" id="' + this.name + '">' +
                     '<span class=\'title\'>Parameter</span>';

      markup += '<div class="details">';
      markup += generatePairMarkup( 'Name', $(this).attr('name') );
      if( $(this).attr('label') != '' )    markup += generatePairMarkup( 'Datatype', $(this).attr('datatype') );
      markup += '</div>';  // details

      markup += '</div>';  //horizontaltab
      return markup;
   };
   // TODO: this object has no vertical_section, so this function should be deprecated
   this.jQobj = function(){
      if( this.mother ){
         var jQobj = this.mother.jQobj().find('#' + this.id + '.parameter');
         this.jQobj = function( obj ){ return function(){ return obj; } }( jQobj );
         return jQobj;
      }
      return $('#' + this.id + '.parameter');
      };
   this.jQTabObj = function(){
      var jQobj = this.mother.jQobj().find( '#' + this.name + '.' + this.mother.name + '.horizontaltab' );
      this.jQTabObj = function( obj ){ return function(){ return obj; } }( jQobj );
      return jQobj;
   };

   this.setupTabClickHandler = function(){
      console.log( 'Parameter: ' + this.name + ' had setupTabClickHandler() called on it.' );
   };
   this.show = function(){
      console.log( 'Parameter: ' + this.name + ' had show() called on it.' );
   };
   this.hide = function(){
      console.log( 'Parameter: ' + this.name + ' had hide() called on it.' );
   };
}





function generatePairMarkup( key, value ){

   return   '\t\t\t<div class=\'pair\'>' +
            '<span class=\'name val\'>' + value + '</span>' +
            '<span class=\'name key\'>' + key + '</span>' +
            '</div>';
}



// [ appsite, activity, field, parameter ]
var currentDisplay = [];

function setupTabClickHandler( node ){
   node.jQTabObj().click( function(){
      var verticalsToDrop = currentDisplay.length;
      
      if( $(this).parent().hasClass('appsite') )  verticalsToDrop -= 1;
      if( $(this).parent().hasClass('activity') )  verticalsToDrop -= 2;
      if( $(this).parent().hasClass('field') || $(this).parent().hasClass('method') )  verticalsToDrop -= 3;
      if( $(this).parent().hasClass('parameter') )  verticalsToDrop -= 4;
         
      for( i=verticalsToDrop; i>0; i-- )
         currentDisplay.pop().hide();

      currentDisplay.push( node );
      node.show();
   });
}


