(function() {
    var path = window.location.pathname;
    if (path === '/') {
        path = '/index';
    }
    path = path.substr(0, path.lastIndexOf('.')) || path;
    path += '.js';
    YOINK.setDebugLevel(1);
    YOINK.resourceLoader('', {}, window.PRELOADED_MODULES).getResources([
        {path: path, params: YOINK.parseQueryString(window.location.search.substring(1))}
    ], function(widget) {
        if (widget.getTitle) {
            document.title = widget.getTitle();
        }
        var nd = widget;
        if (typeof widget === 'string') {
            nd = document.createTextNode(widget);
        } else if (typeof widget.render === 'function')  {
            nd = widget.render();
            if (typeof nd.get == 'function') {
                var obs = nd;
                setInterval(function(){obs.get();}, 30);
                nd = obs.get();
            }
        }
        document.body.appendChild(nd);
    });
})();

