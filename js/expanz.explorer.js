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

/*
 *   Actions
 *         :top-level functions issued by user input or server request
 */

function ListAvailableSites( fields ){
   return function apply( event ){

      $('#container').html('<div id=\'error\'></div>');
      
      var url = fields['chosenURLProtocol']() + fields['URLEndpoint']();
      var channel = SendGetRequest( url );
      channel( 'ListAvailableSites',
               parseListAvailableSitesResponse( ListActivitiesForSite( channel ), $('#container'), error ),
	       error
               );
      return false;
   }
}

function ListActivitiesForSite( channel ){
   return function apply( siteName, jQObj ){

      channel(   'ListActivitiesForSite?site=' + siteName,
         	     parseListActivitiesForSiteResponse( GetSchemaForActivity(channel, siteName), jQObj, error ),
		     error
         	     );
   }
}

function GetSchemaForActivity( channel, site ){
   return function apply( activity, jQObj ){

      channel(   'GetSchemaForActivity?site=' + site + '&activity=' + activity,
         	  parseGetSchemaForActivityResponse( jQObj, error ),
		  error
         	  );
   }
}


function parseListAvailableSitesResponse( nextLink, jQObj ){
	return function apply( xml ){

            var cxml = xml.replace(/&lt;/g, "<").replace(/&gt;/g, ">");

            var appSites = $(cxml).find("AppSites");
	    if( appSites ){
               $(appSites).find('AppSite').each( function(){
                  jQObj.append(  '<div class=\'appsite\' id=\'' + $(this).attr('id') + '\'>' +
                                 '\t<span class=\'name\'>Application Site: ' + $(this).attr('name') + '</span>' +
                                 '</div>'
                                 );
                  // is authenticationMode $(this).attr('authenticationMode') necessary?
                  eval( nextLink )( $(this).attr('id'), $('#' + $(this).attr('id') + '.appsite') );
               });
	    }
            else{
               eval( error )( 'Unable to find any Application Sites from the Endpoint. Is your Endpoint URL correct?\n' + xml );
            }
      }
}

function parseListActivitiesForSiteResponse( nextLink, jQObj ){
	return function apply( xml ){

            var cxml = xml.replace(/&lt;/g, "<").replace(/&gt;/g, ">");

            var activities = $(cxml).find("Activities");
	    if( activities ){
               $(activities).find('Activity').each( function(){

                  if( $(this).attr('name') || $(this).attr('id') ) {
                     var cssId = $(this).attr('id').replace(/\./g, '_'); //$(this).attr('name') ? $(this).attr('name') : $(this).attr('id').replace(/\./g, '_');

                     if( cssId == 'Config' ) console.log( $(this) );

                     jQObj.append(  '<div class=\'activity\' id=\'' + cssId + '\'>' +
                                    '\t<span class=\'name\'>Activity: ' + $(this).attr('name') + '</span>' +
                                    '\t<span class=\'id\'>' + $(this).attr('id') + '</span>' +
                                    '</div>'
                                    );
                     eval( nextLink )( $(this).attr('id'), $('#' + cssId + '.activity') );
                  }
               });
	    }
            else{
               eval( error )( 'Unable to find any Activities from this Application Site.\n' + xml );
            }
      }
}

function generateFieldMarkup( key, value ){

   return   '\t\t\t<div class=\'pair\'>' +
            '<span class=\'name key\'>' + key + '</span>' +
            '<span class=\'name val\'>' + value + '</span>' +
            '</div>';
}


function parseGetSchemaForActivityResponse( jQObj ){
	return function apply( xml ){

            var cxml = xml.replace(/&lt;/g, "<").replace(/&gt;/g, ">");

            var activity = $(cxml).find("Activity");
	    if( activity ){

               jQObj.toggle(  function(){ $(this).find('.field,.method').show(); },
                              function(){ $(this).find('.field,.method').hide(); }
                              );

               // NOTE: Activity has a bunch of extra fields here. $(activity).find('Activity').attr(...)

               $(activity).find('Field').each( function(){
                  jQObj.append(  '<div class=\'field\' id=\'' + $(this).attr('name') + '\'>' +
                                 '<span class=\'title\'>Field</span>' +
                                 '</div>' );

                  var jQFieldObj = jQObj.find('#' + $(this).attr('name') + '.field' );
                  jQFieldObj.css('display', 'none');

                  if( $(this).attr('name') ) jQFieldObj.append(  generateFieldMarkup( 'Name', $(this).attr('name') ) );
                  if( $(this).attr('label') ) jQFieldObj.append( generateFieldMarkup( 'Label', $(this).attr('label') ) );
                  if( $(this).attr('class') ) jQFieldObj.append( generateFieldMarkup( 'Class', $(this).attr('class') ) );
                  if( $(this).attr('colName') ) jQFieldObj.append(  generateFieldMarkup( 'ColumnName', $(this).attr('colName') ) );
                  if( $(this).attr('datatype') ) jQFieldObj.append( generateFieldMarkup( 'Datatype', $(this).attr('datatype') ) );
                  if( $(this).attr('value') ) jQFieldObj.append( generateFieldMarkup( 'Value', $(this).attr('value') ) );
                  if( $(this).attr('disabled') ) jQFieldObj.append( generateFieldMarkup( 'Disabled?', $(this).attr('disabled') ) );
                  if( $(this).attr('null') ) jQFieldObj.append(  generateFieldMarkup( 'Null Value', $(this).attr('null') ) );
                  if( $(this).attr('valid') ) jQFieldObj.append( generateFieldMarkup( 'Valid', $(this).attr('valid') ) );

               });

               $(activity).find('Method').each( function(){
                  jQObj.append(  '<div class=\'method\' id=\'' + $(this).attr('name') + '\'>' +
                                 '<span class=\'title\'>Method</span>' +
                                 '</div>' );

                  var jQMethodObj = jQObj.find('#' + $(this).attr('name') + '.method' );
                  jQMethodObj.css('display', 'none');

                  if( $(this).attr('name') ) jQMethodObj.append(  generateFieldMarkup( 'Name', $(this).attr('name') ) );
                  if( $(this).attr('label') ) jQMethodObj.append( generateFieldMarkup( 'Description', $(this).attr('description') ) );
                  if( $(this).attr('class') ) jQMethodObj.append( generateFieldMarkup( 'Returns', $(this).attr('returns') ) );
                  if( $(this).attr('colName') ) jQMethodObj.append(  generateFieldMarkup( 'Is Data Publication?', $(this).attr('isDataPublication') ) );

                  $(this).find('Parameter').each( function(){

                     jQMethodObj.append(  '<div class=\'method\' id=\'' + $(this).attr('name') + '\'>' +
                                          '<span class=\'title\'>Parameter</span>' +
                                          '</div>' );

                     var jQParameterObj = jQObj.find('#' + $(this).attr('name') + '.parameter' );

                     if( $(this).attr('name') ) jQParameterObj.append(  generateFieldMarkup( 'Name', $(this).attr('name') ) );
                     if( $(this).attr('label') ) jQParameterObj.append( generateFieldMarkup( 'Datatype', $(this).attr('datatype') ) );
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
		     eval( responseHandler )( response );
		  } 
	    }
	 }
      });
 
   }
}


/*
 *   Private Variables
 *
 */

var _URLproxy = '../expanz-Proxy/proxy.php';


