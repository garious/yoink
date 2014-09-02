
yoink.js
========

yoink.js is a small and simple module loader for JavaScript.  The API and design
goals are very similar to RequireJS, but Yoink cuts the fat.  The implementation
is much smaller and simpler, and the plugin model is especially simple.

Yoink modules are simple.  Here is the "Hello World" of Yoink modules:

~~~javascript
define("Hello world!");
~~~

Add Yoink, load your module, and use it to construct the DOM.

~~~html
<html>
    <body>
        <script type="text/javascript" src="yoink.js"></script>
        <script type="text/javascript">
            YOINK.require(['helloworld.js'], function(hello) {
                document.body.appendChild(hello);
            });
        </script>
    </body>
</html>
~~~

Yoink modules may load other modules.  Modules are downloaded and interpreted in
parallel.


~~~javascript
require(['helloworld.js', 'goodbye.js'], function(hello, goodbye) {
    var e = document.createElement('div');
    e.appendChild(hello);
    e.appendChild(goodbye);
    define(e);
});
~~~

To download a module that tells you what modules to download, call require
as many times as you need.  'define()' can be called after any number of
asynchronous calls.

~~~javascript
require(['a.js'], function(a) {

    require(a.moreDeps, function(b, c, d) {
        define( document.createTextNode(a.message + b.message) );
    });

});
~~~

Modules know where they are.  Modules are loaded with a local variable 'baseUrl'
that tells module authors where the module is with respect to the root directory.  Module
authors can use this value to reference external resources, such as an image file inside
the module directory.

~~~javascript
var e = document.createElement('img');
e.src = yoink.baseUrl + '/favicon.png'; 
define(e);
~~~

Yoink caches modules, but sometimes you want multiple caches.  For example, jQuery
plugins modify jQuery, so you may want a cache with just jQuery and another with
a second copy of jQuery that plugins stomp all over.

~~~javascript
function exportJQuery(text, yoink, callback) {
    YOINK.interpreters.js(text + '\n' + 'define( jQuery.noConflict(true) );', yoink, callback);
}

function onReady($) {
    // jQuery UI requires jQuery.  Therefore its 'onReady' callback must return a second set 
    // of dependencies and callback.

    // jQuery UI requires that jQuery be in the global namespace when it is interpreted.
    window.jQuery = $;

    var deps = [
        {path: 'jquery-ui-1.8.16.custom.min.js', interpreter: exportJQuery}
    ];

    require(deps, function(jQuery) { define(jQuery.noConflict(true)); });
}

// Create a separate resource loader, so that jQuery UI can whomp its personal copy of jQuery.
YOINK.require(['/jquery/jquery-mod.js'], onReady);
~~~

