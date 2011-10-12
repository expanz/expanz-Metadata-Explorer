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
var previewpane;

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
                                                   .html('<div id="error"></div>');
                                 treeHead.Section.jQ = function(){ return jQobj; };
                                 return jQobj;
                              };

      appserver = new Appserver( endpoint.split('/')[0].replace(/\./g, '_') );
      treeHead.append( appserver );
      appserver.show();

      previewpane = new PreviewPane( treeHead );
      treeHead.Section.jQ().append( previewpane.html() );
      
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
                        scrollLeft: $('#main').css('width'),   //this.Section.jQ().position().left - document.body.clientWidth + this.Section.jQ().width(),
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
                        return jQobj;
                     };
                     return jQobj;
                  }
                  return $('#' + this.id + this.cls + '.vertical_section');
               };
      this.html = function( contents ){
                           var markup = '<div class="vertical_section dynamicshow ' + this.cls + ' ' + this.mother.id + '" id="' + this.id + '">' +
                                    '\t<div class="title">' + this.title + '</div>';
                           markup += contents? contents: '';
                           markup += '</div>';
                           return markup;
                  };
      this.append =  function( contents ){
                        this.htmlold = this.html;
                        this.html = function( moreContents ){
                                       return moreContents? this.htmlold( contents + moreContents ):
                                                            this.htmlold( contents );
                                    };
                     };
}

function PreviewPane( container ) {
   this.container = container;

   this.jQ = function(){ 
                  var jQobj = this.container.Section.jQ().find('#previewpane.vertical_section');
                  if( jQobj ){
                     this.jQ = function(){
                        return jQobj;
                     };
                     return jQobj;
                  }
                  return $('#previewpane');
               };


   var htmlTitle = '\t<div class="title">Preview Pane</div>';

   this.html = function(){
      var markup =   '<div id="previewpane" class="vertical_section dynamicshow pane">';
      markup +=      htmlTitle;
      markup +=      '</div>';   // previewpane

      return markup;
   };
   
   this.appendCode = function( id, cls, title, contents ){

      var markup =      '\t\t<div class="code ' + cls + '" id="' + id + '">';
      markup +=         '\t\t<div class="title">' + title + '</div>';
      markup +=         '\t\t\t<textarea rows="10" cols="100">';
      markup +=         '\t\t\t</textarea>';
      markup +=         '\t\t</div>';  //code

      this.jQ().append( markup );
      this.jQ().find('#' + id + '.' + cls + ' > textarea').text( contents );
   };

   this.clear = function(){
      this.jQ().html( htmlTitle );
   };

   this.visible = false;
   this.show = function(){
      this.jQ().show();
      this.visible = true;
   };
   this.hide = function(){
      this.jQ().hide();
      this.visible = false;
      this.clear();
   };

}

Appserver.prototype = new TreeNode();
function Appserver( id ) {
   TreeNode.call(this);
   this.id = id.replace( /:/g, '_' );
   this.rawId = id;

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
   TreeNode.call(this);

   this.id = id;
   this.name = name;
   this.authenticationMode = authenticationMode;

   this.init = function( mother ){
      this.mother = mother;
      this.Section = new Section( this.mother, this.id, 'appsite', 'Activities' );
      this.Tab = new Tab( this.mother, this.id, 'appsite', this.name );
   };
}

Activity.prototype = new TreeNode();
function Activity( id, name ) {
   TreeNode.call(this);

   this.rawId = id;
   this.name = name;
   this.id = id.replace(/\./g, '_');

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
   TreeNode.call(this);

   this.name = name;
   this.label = label;
   this.className = className;
   this.colName = colName;
   this.datatype = datatype;
   this.value = value;
   this.disabled = disabled;
   this.nullValue = nullValue;
   this.valid = valid;

   this.init = function( mother ){
      this.mother = mother;
      this.Section = new Section( this.mother, name, 'field', 'Field' );
      this.Tab = new Tab( this.mother, this.name, 'field', this.name );

      this.Section.append( this.previewMarkup() );
   };

   this.previewMarkup = function(){
      var markup = generatePairMarkup( 'Name', this.name );
      if( this.label != '' )      markup += generatePairMarkup( 'Label', this.label );
      if( this.className != '' )      markup += generatePairMarkup( 'Class', this.className );
      if( this.colName != '' )    markup += generatePairMarkup( 'ColumnName', this.colName );
      if( this.datatype != '' )   markup += generatePairMarkup( 'Datatype', this.datatype );
      if( this.value != '' )      markup += generatePairMarkup( 'Value', this.value );
      if( this.disabled != '' )   markup += generatePairMarkup( 'Disabled?', this.disabled );
      if( this.nullValue != '' )       markup += generatePairMarkup( 'Null Value', this.nulValue);
      if( this.valid != '' )      markup += generatePairMarkup( 'Valid', this.valid );

      markup += '</div>';
      return markup;
   };

   this.jsSdkCode = function(){

      var code =  '<div class="errorContainer">\n';
      code +=     '\t<span class="error" data-bind="text: ' + this.name + '.error"></span>\n';
      code +=     '</div>\n';
      code +=     '\n';
      code +=     '<div class="textinput">\n';
      code +=     '\t<span class="label" data-bind="text: ' + this.name + '.label"></span>\n';
      code +=     '\t<input type="text" data-bind="value: ' + this.name + '.value" />\n';
      code +=     '</div>\n';

      return code;
   };

   this.flexSdkCode = function(){

      var code =  '<controls:LabelEx fieldId="' + this.name + '" />\n';
      code +=     '<controls:TextInputEx fieldId="' + this.name + '" />';

      return code;
   };

   this.wp7SdkCode = function(){

      var code =  '<ec:LabelEx FieldId="' + this.name + '" />\n';
      code +=     '<ec:TextBoxEx FieldId="' + this.name + '" />';

      return code;
   };


   this.show = function(){
      this.__proto__.show.call(this);
      previewpane.show();
      previewpane.appendCode( this.name, 'JS', 'JavaScript SDK: ' + this.name, this.jsSdkCode() );
      previewpane.appendCode( this.name, 'Flex', 'Flex/ActionScript SDK: ' + this.name, this.flexSdkCode() );
      previewpane.appendCode( this.name, 'WP7', 'Silverlight/Windows-Phone-7 SDK: ' + this.name, this.wp7SdkCode() );
   };
   this.hide = function(){
      this.__proto__.hide.call(this);
      previewpane.hide();
   };
}
   

Method.prototype = new TreeNode();
function Method( name, description, returns, isDataPublication ) {
   TreeNode.call(this);

   this.name = name;
   this.description = description;
   this.returns = returns;
   this.isDataPublication = isDataPublication;

   this.init = function( mother ){
      this.mother = mother;

      this.Section = new Section( this.mother, this.name, 'method', 'Method' );
      this.Tab = new Tab( this.mother, this.name, 'method', this.name );

      this.Section.append( this.previewMarkup( this ) );
   };

   this.append = function( child ){
                        child.mother = this;
                        this.children.push( child );
                        child.init( this );

                        this.Section.jQ().append( child.Tab.html() );
                        child.setupTabClickHandler();
                        };
   this.previewMarkup = function() {

      var markup = '<div class="details">';
      markup += generatePairMarkup( 'Name', this.name );
      if( this.description != '' )   markup += generatePairMarkup( 'Description', this.description );
      if( this.returns != '' )   markup += generatePairMarkup( 'Returns', this.returns );
      if( this.isDataPublication != '' ) markup += generatePairMarkup( 'Is Data Publication?', this.isDataPublication );
      markup + '</div>';   // div details
      
      return markup;
   };

   this.jsSdkCode = function(){

      var code =  '<script type="text/javascript">\n' +
                  '\tfunction mySuccessFunction( )  {  }\n' +
                  '\tfunction myErrorFunction( text ){\n' +
                  '\t\t//handle an error\n' +
                  '\t}\n' +
                  '</script>\n\n';
      code +=     '\t<button method-name="'+ this.name + '"\n' +
                  '\t\tdata-bind="click: Method"\n' + 
                  '\t\tonSuccess="mySuccessFunction" onError="myErrorFunction"\n'+
                  '\t>\n' +
                  '\t' + this.name + '</button>';
      return code;
   };

   this.flexSdkCode = function(){

      var code =  '<buttons:ButtonEx label="' + this.name + '" MethodName="' + this.name + '"/>';
      return code;
   };

   this.wp7SdkCode = function(){

      var code =  '<ec:ButtonEx Content="' + this.name + '" MethodName="' + this.name + '"/>';
      return code;
   };


   this.show = function(){
      this.__proto__.show.call(this);
      previewpane.show();
      previewpane.appendCode( this.name, 'JS', 'JavaScript SDK: ' + this.name, this.jsSdkCode() );
      previewpane.appendCode( this.name, 'Flex', 'Flex/ActionScript SDK: ' + this.name, this.flexSdkCode() );
      previewpane.appendCode( this.name, 'WP7', 'Silverlight/Windows-Phone-7 SDK: ' + this.name, this.wp7SdkCode() );
   };
   this.hide = function(){
      this.__proto__.hide.call(this);
      previewpane.hide();
   };
}

Parameter.prototype = new TreeNode();
function Parameter( name, datatype ) {
   TreeNode.call(this);

   this.name = name;
   this.datatype = datatype;

   this.init = function( mother ){
      this.mother = mother;
      this.Tab = new Tab( this.mother, this.name + '.' + this.mother.name, 'Parameter', this.name );
      this.Tab.jQ().append( this.previewMarkup() );
   
      // TODO: this object has no vertical_section, so this function should be deprecated
      this.Section.jQ = function(){};
      this.Section.html = function(){};
      
   };
      
   this.previewMarkup = function(){
      var markup = '<div class="details">';
      markup += generatePairMarkup( 'Name', this.name );
      if( this.datatype != '' )    markup += generatePairMarkup( 'Datatype', this.datatype );
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

      var screenWidth = (currentDisplay.length +1) * 400;
      if( previewpane.visible )  screenWidth += 850;
      $('#main').css('width', screenWidth.toString() + 'px');
   });
}


