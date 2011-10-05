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

var treeHead;

/*
 *   Actions
 *         :top-level functions issued by user input or server request
 */

function ListAvailableSites( fields ){
   return function apply( event ){

      var endpoint = $('#endpoint').val();

      treeHead = new TreeNode();
      treeHead.Section.jQ =   function(){ 
                                 var jQobj =    $('#main')
                                                   .html('<div id="error"></div>')
                                                   .css('width','2500px');
                                 treeHead.Section.jQ = function(){ return jQobj; };
                                 return jQobj;
                              };

      appserver = new Appserver( endpoint.split('/')[0].replace(/\./g, '_') );
      treeHead.append( appserver );
      appserver.show();
      
      var url = fields['chosenURLProtocol']() + endpoint;
      var channel = SendGetRequest( url );

      appserver.channel = channel;

      channel( 'ListAvailableSites',
               parseListAvailableSitesResponse( ListActivitiesForSite( channel ), appserver, error ),
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

      channel(   'GetSchemaForActivity?site=' + appsite.id + '&activity=' + activity.rawId,
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




function TreeNode( ) {
   
   this.init = function(){};

   this.mother = null;
   this.children = new Array();
   this.append = function( child ){
                        child.mother = this;
                        this.children.push( child );
                        child.init( this );

                        treeHead.Section.jQ().append( child.Section.html() );
                        this.Section.jQ().append( child.Tab.html() );
                        child.setupTabClickHandler();
                        };
   this.getChild = function( id ){
      for( i=0; i < this.children.length; i++ )
         if( this.children[i].id == id )
            return this.children[i];
   };
   this.getAll =  function(){ 
                     if( this.children.length < 1 )   this.load();
                     return this.children;
                  };
   this.load = function(){};
   
   this.Tab = {
               jQ: function(){},
               html: function(){}
               };
   this.Section = {
               jQ: function(){},
               html: function(){}
               };

   this.setupTabClickHandler = function(){
      setupTabClickHandler( this );
   };
   this.show = function(){
      if( this.children.length < 1 )   this.load();

      this.Tab.jQ().toggleClass('clicked');
      this.Section.jQ().show();
      $("html,body").animate(
                     { 
                        scrollLeft: this.Section.jQ().position().left - document.body.clientWidth + this.Section.jQ().width(),
                        scrollTop: 0 
                     }, "slow"
                     );
   };
   this.hide = function(){
      this.Section.jQ().hide();
      this.Tab.jQ().toggleClass('clicked');
   };

}


function Tab( mother, id, cls, title, secondTitle ) {
      this.mother = mother;
      this.id = id;
      this.cls = cls;
      this.title = title;
      this.secondTitle = secondTitle;

      this.jQ =  function(){
                        if( this.mother ){
                           var jQobj = this.mother.Section.jQ().find( '#' + this.id + '.horizontaltab' );
                           this.jQ = function( obj ){ return function(){ return obj; } }( jQobj );
                           return jQobj;
                        }
                        return $( '#' + this.id + '.horizontaltab' );
                  };
      this.html = function(){
                        var markup = '<div class="horizontaltab';
                        markup += this.cls? ' ' + this.cls: ''; 
                        markup +=   '" id="' + this.id + '">' +
                                    '\t<span class="title">' + this.title + '</span>';
                        markup += this.secondTitle? '\t<span class="text">' + this.secondTitle + '</span>': '';
                        markup += '</div>';
                        return markup;
                  };
}

function Section( mother, id, cls, title ) {
      this.mother = mother;
      this.id = id;
      this.cls = cls;
      this.title = title;

      this.jQ = function(){ 
                  var jQobj = $('#' + this.id + '.' + this.mother.id + '.' + this.cls + '.vertical_section');
                  if( jQobj ){
                     this.jQ = function(){

                        //if( this.mother ){
                        //   var jQobj = treeHead.Section.jQ().find('#' + id + '.' + cls + '.vertical_section');
                        //   this.jQobj = function( obj ){ return function(){ return obj; } }( jQobj );
                        //   return jQobj;
                        //}
                        return jQobj;
                     };
                     return jQobj;
                  }
                  return $('#' + this.id + this.cls + '.vertical_section');
               };
      this.html = function( contents ){
                           var results = '<div class="vertical_section dynamicshow ' + this.cls + ' ' + this.mother.id + '" id="' + this.id + '">' +
                                    '\t<div class="title">' + this.title + '</div>';
                           results += contents? contents: '';
                           results += '</div>';
                           return results;
                  };
      this.append =  function( contents ){
                        this.htmlold = this.html;
                        this.html = function( moreContents ){
                                       return moreContents? this.htmlold( contents + moreContents ):
                                                            this.htmlold( contents );
                                    };
                     };
}




Appserver.prototype = new TreeNode();
function Appserver( id ) {
   this.id = id;

   this.children = new Array();

   // constructor
   this.init = function( mother ){
      this.mother = mother;
      this.Section = new Section( this.mother, this.id, 'appserver', 'Application Sites' );
      this.Tab = { jQ: this.Section.jQ, html: function(){} };
   };

   this.setupTabClickHandler = function(){};
   this.show = function(){
      this.Section.jQ().show();
   };
}

AppSite.prototype = new TreeNode();
function AppSite( id, name, authenticationMode ) {
   this.id = id;
   this.name = name;
   this.authenticationMode = authenticationMode;

   this.children = new Array();

   this.init = function( mother ){
      this.mother = mother;
      this.Section = new Section( this.mother, this.id, 'appsite', 'Activities' );
      this.Tab = new Tab( this.mother, this.id, 'appsite', this.name );
   };
}

Activity.prototype = new TreeNode();
function Activity( id, name ) {
   this.rawId = id;
   this.name = name;
   this.id = id.replace(/\./g, '_');

   this.children = new Array();

   this.load = function() {
      GetSchemaForActivity( this.channel, this.mother )( this );
      return true;
   };

   this.init = function( mother ){
      this.mother = mother;
      this.Section = new Section( this.mother, this.id, 'activity', 'Fields' );
      this.Tab = new Tab( this.mother, this.id, 'activity', this.name, '(' + this.rawId + ')' );
   };
}

Field.prototype = new TreeNode();
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

   this.children = new Array();

   this.init = function( mother ){
      this.mother = mother;
      this.Section = new Section( this.mother, name, 'field', 'Field' );
      this.Tab = new Tab( this.mother, this.name, 'field', this.name );

      this.Section.append( fieldPreviewMarkup( this ) );
   };

}


function fieldPreviewMarkup( field ){
      var markup = generatePairMarkup( 'Name', field.name );
      if( $(field).attr('label') != '' )      markup += generatePairMarkup( 'Label', field.label );
      if( $(field).attr('class') != '' )      markup += generatePairMarkup( 'Class', field.className );
      if( $(field).attr('colName') != '' )    markup += generatePairMarkup( 'ColumnName', field.colName );
      if( $(field).attr('datatype') != '' )   markup += generatePairMarkup( 'Datatype', field.datatype );
      if( $(field).attr('value') != '' )      markup += generatePairMarkup( 'Value', field.value );
      if( $(field).attr('disabled') != '' )   markup += generatePairMarkup( 'Disabled?', field.disabled );
      if( $(field).attr('null') != '' )       markup += generatePairMarkup( 'Null Value', field.nulValue);
      if( $(field).attr('valid') != '' )      markup += generatePairMarkup( 'Valid', field.valid );

      markup += '</div>';
      return markup;
}
   

Method.prototype = new TreeNode();
function Method( name, description, returns, isDataPublication ) {
   this.name = name;
   this.description = description;
   this.returns = returns;
   this.isDataPublication = isDataPublication;

   this.children = new Array();

   this.init = function( mother ){
      this.mother = mother;

      this.Section = new Section( this.mother, this.name, 'method', 'Method' );
      this.Tab = new Tab( this.mother, this.name, 'method', this.name );

      this.Section.append( methodPreviewMarkup( this ) );
   };

   this.append = function( child ){
                        child.mother = this;
                        this.children.push( child );
                        child.init( this );

                        this.Section.jQ().append( child.Tab.html() );
                        child.setupTabClickHandler();
                        };
   
   function loadParameters (){
      if( this.children ) {
         for( i=0; i < this.children.length; i++ )
            this.Section.jQ().append( this.children[i].html() );
         this.loadParameters = function(){};
      }
   };

   //this.show = function(){
   //   loadParameters();
   //   this.prototype.show();
   //};
}

function methodPreviewMarkup( method ) {

      var markup = '<div class="details">';
      markup += generatePairMarkup( 'Name', method.name );
      if( $(method).attr('label') != '' )   markup += generatePairMarkup( 'Description', method.description );
      if( $(method).attr('class') != '' )   markup += generatePairMarkup( 'Returns', method.returns );
      if( $(method).attr('colName') != '' ) markup += generatePairMarkup( 'Is Data Publication?', method.isDataPublication );
      markup + '</div>';   // div details
      
      return markup;
};

Parameter.prototype = new TreeNode();
function Parameter( name, datatype ) {
   this.name = name;
   this.datatype = datatype;

   this.children = new Array();

   this.init = function( mother ){
      this.mother = mother;
      this.Tab = new Tab( this.mother, this.name + '.' + this.mother.name, 'Parameter', this.name );
      this.Tab.jQ().append( parameterPreviewMarkup( this ) );
   
      // TODO: this object has no vertical_section, so this function should be deprecated
      this.Section.jQ = function(){};
      this.Section.html = function(){};
      
   };
      
   function parameterPreviewMarkup( parameter ){
      markup += '<div class="details">';
      markup += generatePairMarkup( 'Name', $(parameter).attr('name') );
      if( $(parameter).attr('label') != '' )    markup += generatePairMarkup( 'Datatype', $(parameter).attr('datatype') );
      markup += '</div>';  // details

      return markup;
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
   node.Tab.jQ().click( function(){
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


