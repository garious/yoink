//
// yoink, a simple resource loader.  XMLHttpRequest is the only dependency.
//

var YOINK = (function () {
    'use strict';

    var debugLevel = 0;

    function setDebugLevel(n) {
        debugLevel = n;
    }

    function jsonInterpreter(text) {
        return JSON.parse(text);
    }

    function jsInterpreter(text, require, callback, params) {
        // Note: Chrome/v8 requires the outer parentheses.  Firefox/spidermonkey does fine without.
        var f_str = '(function (yoink, require, define) {"use strict";' + text + '})';
        var f;
        if (typeof window !== 'undefined' && window.execScript) {
          // Special handling for Internet Explorer
          /*global tmp: true*/
          window.execScript('tmp = ' + f_str);
          f = tmp;
        } else {
          f = eval(f_str);
        }
        f({
            baseUrl: require.base,
            fileUrl: require.url,
            define: callback,
            require: require,
            params: params
        }, require, callback);
    }

    var defaultInterpreters = {
        json: jsonInterpreter,
        js: jsInterpreter
    };

    function Clone() {}
    function clone(o) {
        Clone.prototype = o;
        return new Clone();
    }

    function passthrough(x) {
        return x;
    }

    function interpret(rsc, url, params, interpreter, interpreters, cache, moduleCache, callback) {
        // Look up an interpreter for the URL's file extension
        if (!interpreter) {
            var ext = url.substring(url.lastIndexOf('.') + 1, url.length).toLowerCase();
            interpreter = interpreters[ext] || passthrough;
        }

        // Interpret the resource
        if (interpreter.length === 1) {
            callback(interpreter(rsc));
        } else {
            // Provide loaded module with a version of loader that pulls modules 
            // relative to the directory of the url we are currently loading.
            var base = url.substring(0, url.lastIndexOf('/'));
            var require = mkGetResources(base, cache, moduleCache, interpreters);
            require.base = base;
            require.url = url;
            interpreter(rsc, require, callback, params);
        }
    }

    // Download a text file asynchronously
    function getFile(path, callback) {
        var req = new XMLHttpRequest();
        function onReadyStateChanged() {
            if (req.readyState === 4) {
                callback(req.responseText, req.status || 200);
            }
        }
        req.onreadystatechange = onReadyStateChanged;
        req.open('GET', path, true);
        req.send();
    }

    // System-wide cache of what to do once a resource has been downloaded.
    var plans = {};

    function interpretFile(interpreters, cache, moduleCache, u, str, httpCode, callback) {
        if (httpCode >= 200 && httpCode < 300) {
            if (debugLevel > 0) {
                console.log("yoink: interpreting '" + u.path + "'");
            }
            interpret(str, u.path, u.params, u.interpreter, interpreters, cache, moduleCache, callback);
        } else if (u.onError) {
            var rsc = u.onError(httpCode);
            callback(rsc);
        } else {
            throw str;
        }
    }

    function evaluateModule(f, url, params, cache, moduleCache, interpreters, callback) {
        // Provide loaded module with a version of loader that pulls modules 
        // relative to the directory of the url we are currently loading.
        var base = url.substring(0, url.lastIndexOf('/'));
        var require = mkGetResources(base, cache, moduleCache, interpreters);
        f({
            baseUrl: base,
            fileUrl: url,
            define: callback,
            require: require,
            params: params
        });
    }

    function serializeParams(o) {
        var xs = [];
        for(var k in o) {
            if (o.hasOwnProperty(k)) {
                xs.push(k + '=' + encodeURIComponent(o[k]));
            }
        }
        return xs.join('&');
    }

    function getResource(interpreters, cache, moduleCache, url, onInterpreted) {
        var id = url.path;

        // Add URL parameters to resource ID
        if (url.params) {
            var ps = serializeParams(url.params);
            if (ps) {
                 id += '?' + ps;
            }
        }

        // A new callback that executes the plan created later in this function.
        function callback(rsc) {
            cache[id] = rsc; // Cache the result
            // Execute the plan
            var plan = plans[id];
            delete plans[id];
            plan(rsc);
        }

        function onFile(str, httpCode) {
            interpretFile(interpreters, cache, moduleCache, url, str, httpCode, callback);
        }

        var rsc = cache[id];

        function action(rsc) {
            plan(rsc);
            onInterpreted(rsc);
        }

        if (rsc === undefined) {
            // Is anyone else already downloading this file?
            var plan = plans[id];
            if (plan === undefined) {
                // Create a plan for what we will do with this module
                plans[id] = onInterpreted;

                if (moduleCache[id]) {
                    // Is this in our module cache?
                    if (debugLevel > 0) {
                        console.log("yoink: executing preloaded module '" + id + "'");
                    }
                    evaluateModule(moduleCache[id], url.path, url.params, cache, moduleCache, interpreters, callback);
                } else {
                    getFile(id, onFile);
                }
            } else {
                // Add ourselves to the plan.  The plan is effectively a FIFO queue of actions.
                plans[id] = action;
            }
        } else {
            onInterpreted(rsc);  // Skip downloading
        }
    }

    function resolve(base, url) {
        var p = url.path || url;
        var ps = url.params || {};
        var f = url.interpreter || null;
        if (base !== '' && p.charAt(0) !== '/' && p.indexOf('://') === -1) {
            p = base + '/' + p;
        }

        // Normalize the path
        p = p.replace(/[^.\/]+[\/]\.\.[\/]/g, '');  // Remove redundant '%s/..' items.
        return {path: p, params: ps, interpreter: f, onError: url.onError};
    }

    function parseQueryString(query) {
        var pl = /\+/g;
        function decode(s) {
            return decodeURIComponent(s.replace(pl, " "));
        }
        var match;
        var search = /([^&=]+)=?([^&]*)/g;
        var urlParams = {};
        while (match = search.exec(query))
            urlParams[decode(match[1])] = decode(match[2]);
        return urlParams;
    }

    function mkGetResources(base, cache, moduleCache, interpreters) {

        function getResources(urls, callback) {
            var len = urls.length; // How many things we need to interpret
            var i;
            var rscs = [];         // For the results of interpreting files
            var cnt = 0;           // For counting what we've downloaded

            function mkOnInterpreted(i) {
                return function (rsc) {
                    rscs[i] = rsc;
                    cnt += 1;  // Index of the next item to interpret

                    if (cnt === len) {
                        callback.apply(null, rscs);
                    }
                };
            }

            if (len === 0) {
                callback();
            } else {
                for (i = 0; i < len; i += 1) {
                    var u = resolve(base, urls[i]);
                    getResource(interpreters, cache, moduleCache, u, mkOnInterpreted(i));
                }
            }
        }

        return getResources;
    }

    // Resource Loader constructor
    function resourceLoader(base, cache, moduleCache, interpreters) {
        base = base || '';
        cache = cache || {};
        moduleCache = moduleCache || {};
        interpreters = interpreters || clone(defaultInterpreters);

        return {getResources: mkGetResources(base, cache, moduleCache, interpreters)};
    }

    function require(urls, callback) {
        return resourceLoader().getResources(urls, callback);
    }

    return {
        parseQueryString: parseQueryString,
        setDebugLevel: setDebugLevel,
        require: require,
        resourceLoader: resourceLoader,
        interpreters: defaultInterpreters
    };
}());

// Return YOINK as the last evaluated expression for anyone using eval() in strict mode
YOINK;

