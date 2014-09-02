//
// Tests!
//

var  deps = [
    'tag.js',
    'assert.js'
];

function onReady (tag, assert) {

    var t = tag.tag({name: 'p', contents: 'hello'});
    assert.assertEq(t.name, 'p');
    assert.assertEq(t.contents, 'hello');

    define('passed!');
}

require(deps, onReady);
    
