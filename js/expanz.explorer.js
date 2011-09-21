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
                URLEndpoint: ko.observable('test.expanz.com/...'),
                };
        Bindings.Lookup = ListAvailableSites( Bindings );
	ko.applyBindings( Bindings );

        
});

function error( message ){
   $('#error').append( 'Error: ' + message );
}

var treeBase = new ExplorerTree( $('body') );

/*
 *   Actions
 *         :top-level functions issued by user input or server request
 */

function ListAvailableSites( fields ){
   return function apply( event ){

      var endpoint = $('#endpoint').val();

      treeBase = new ExplorerTree( $('#container') );
      treeBase.jQobj().html('<div id=\'error\'></div>');
      
      var url = fields['chosenURLProtocol']() + endpoint;
      var channel = SendGetRequest( url );
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
                     mother.append( activity );
                     eval( nextLink )( activity );
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

               mother.jQobj().toggle(  function(){ $(this).find('.field,.method,.parameter').show(); },
                                       function(){ $(this).find('.field,.method,.parameter').hide(); }
                                       );

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






function ExplorerTree( jQobj ) {
   this.rootJQObj = jQobj;
   this.jQobj = function(){ return this.rootJQObj; }

   this.children = [];
   this.append = function( appsite ){
                        appsite.mother = this;
                        this.children.push( appsite );
                        this.jQobj().append( appsite.html() );
                        };
   this.getChild = function( id ){
      for( i=0; i < this.children.length; i++ )
         if( this.children[i].id == id )
            return this.children[i];
   };
   this.getAll = function(){ return this.children; };
}

function AppSite( id, name, authenticationMode ) {
   this.id = id;
   this.name = name;
   this.authenticationMode = authenticationMode;

   this.children = [];
   this.append = function( activity ){
                        activity.mother = this;
                        this.children.push( activity );
                        this.jQobj().append( activity.html() );
                        };
   this.getChild = function( id ){
      for( i=0; i < this.children.length; i++ )
         if( this.children[i].cssId == id )
            return this.children[i];
      return { id: '' };
   };
   this.getAll = function(){ return this.children; };

   this.html = function() {
      var markup =   '<div class=\'appsite\' id=\'' + this.id + '\'>' +
                     '\t<span class=\'name\'>Application Site: ' + this.name + '</span>' +
                     '</div>';
      return markup;
   };
   this.jQobj = function(){
      if( this.mother ){
         var jQobj = this.mother.jQobj().find('#' + this.id + '.appsite');
         this.jQobj = function( obj ){ return function(){ return obj; } }( jQobj );
         return jQobj;
      }
      return $('#' + this.id + '.appsite');
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
                     this.jQobj().append( field.html() );
                     };
   this.getAll = function(){ return this.fields.concat( this.methods ); };
   this.getChild = function( name ){
      for( i=0; i < this.children.length; i++)
         if( this.children[i].name = name )
            return this.children[i];
      return { name: '' };
   }

   this.html = function(){
      var markup =   '<div class=\'activity\' id=\'' + this.cssId + '\'>' +
                     '\t<span class=\'name\'>Activity: ' + this.name + '</span>' +
                     '\t<span class=\'id\'>' + this.id + '</span>' +
                     '</div>';
      return markup;
   };
   this.jQobj = function(){
      if( this.mother ){
         var jQobj = this.mother.jQobj().find('#' + this.cssId + '.activity');
         this.jQobj = function( obj ){ return function(){ return obj; } }( jQobj );
         return jQobj;
      }
      return $('#' + this.cssId + '.activity');
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
      var markup =   '<div class=\'field\' id=\'' + this.name + '\' style=\'display: none\'>' +
                     '<span class=\'title\'>Field</span>';
                  
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
         var jQobj = this.mother.jQobj().find('#' + this.id + '.field');
         this.jQobj = function( obj ){ return function(){ return obj; } }( jQobj );
         return jQobj;
      }
      return $('#' + this.id + '.field');
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
                           };
   this.getChild = function( name ){
      for( i=0; i < this.children.length; i++ )
         if( this.children[i].name == name )
            return this.children[i];
      return { name: '' };
   };
   this.getAll = function(){ return this.children; };


   this.html = function() {
      var markup =   '<div class=\'method\' id=\'' + this.name + '\' style=\'display: none\'>' +
                     '<span class=\'title\'>Method</span>';

      markup += generatePairMarkup( 'Name', this.name );
      if( $(this).attr('label') != '' )   markup += generatePairMarkup( 'Description', this.description );
      if( $(this).attr('class') != '' )   markup += generatePairMarkup( 'Returns', this.returns );
      if( $(this).attr('colName') != '' ) markup += generatePairMarkup( 'Is Data Publication?', this.isDataPublication );

      markup += '</div>';
      return markup;

   };
   this.jQobj = function(){
      if( this.mother ){
         var jQobj = this.mother.jQobj().find('#' + this.name + '.method');
         this.jQobj = function( obj ){ return function(){ return obj; } }( jQobj );
         return jQobj;
      }
      return $('#' + this.id + '.method');
      };
}

function Parameter( name, datatype ) {
   this.name = name;
   this.datatype = datatype;

   this.html = function(){
      var markup =   '<div class=\'parameter\' id=\'' + $(this).attr('name') + '\' style=\'display: none\'>' +
                     '<span class=\'title\'>Parameter</span>';

      markup += generatePairMarkup( 'Name', $(this).attr('name') );
      if( $(this).attr('label') != '' )    markup += generatePairMarkup( 'Datatype', $(this).attr('datatype') );

      markup += '</div>';
      return markup;
   };
   this.jQobj = function(){
      if( this.mother ){
         var jQobj = this.mother.jQobj().find('#' + this.id + '.parameter');
         this.jQobj = function( obj ){ return function(){ return obj; } }( jQobj );
         return jQobj;
      }
      return $('#' + this.id + '.parameter');
      };
}





function generatePairMarkup( key, value ){

   return   '\t\t\t<div class=\'pair\'>' +
            '<span class=\'name key\'>' + key + '</span>' +
            '<span class=\'name val\'>' + value + '</span>' +
            '</div>';
}


