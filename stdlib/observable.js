//
// Observable JS
//

function Observable() {
}

Observable.prototype.subscribe = function(f) {
    if (!this.subscribers) {
        this.subscribers = [f];
    } else {
        this.subscribers.push(f);
    }
    return this;
};

// Observable values
Publisher.prototype = new Observable();
Publisher.prototype.constructor = Publisher;

function Publisher(v) {
    this.value = v;
}

Publisher.prototype.set = function(v) {
    this.value = v;
    if (this.subscribers) {
        var me = this;
        this.subscribers.forEach(function(f) {
            f(me);
        });
    }
    return this;
};

Publisher.prototype.get = function() {
    return this.value;
};


// Observable computations.  observer() takes a list of observables
// and a callback function and returns an observable.  Any time
// a value is requested AND an input has changed, the given callback
// is executed, and its return value is returned.
Observer.prototype = new Observable();
Observer.prototype.constructor = Observer;
function Observer(args, f) {
    this.valid = false;
    this.f = f;
    this.args = args;

    var me = this;  // Avoid 'this' ambiguity.
    args.forEach(function(o) {
        if (o.get && o.subscribe) {
            o.subscribe(function (val, obs) {
                if (me.valid) {
                    me.valid = false;
                    if (me.subscribers) {
                        me.subscribers.forEach(function(f) {
                            f(me);
                        });
                    }
                }
            });
        }
    });
}

Observer.prototype.get = function() {
   if (this.valid) {
     return this.value;
   } else {
     var vals = this.args.map(function(o){
         return o.get && o.subscribe ? o.get() : o;
     });

     var oldValue = this.value;
     this.value = this.f.apply(null, vals);
     this.valid = true;

     if (this.value !== oldValue && this.subscribers) {
         var me = this;
         this.subscribers.forEach(function(f) {
             f(me);
         });
     }

     return this.value;
   }
};

function observer(args, f) {
    return new Observer(args, f);
}

// Handy function to lift a raw function into the observable realm
function lift(f) {
    return function() {
       var args = Array.prototype.slice.call(arguments);
       return observer(args, f);
    };
}


// Handy function to capture the current state of an object containing observables
function snapshot(o) {
    if (typeof o === 'object') {
        if (o.get && o.subscribe) {
            return snapshot( o.get() );
        } else {
            if (o.constructor === Array) {
                return o.map(snapshot);
            } else {
                var o2 = {};
                var k;
                for (k in o) {
                    if (o.hasOwnProperty(k)) {
                        o2[k] = snapshot(o[k]);
                    }
                }
                return o2;
            }
        }
    } else {
        return o;
    }
}

function publisher(v) {
    return new Publisher(v);
}

define({
    Observable: Observable,
    Publisher: Publisher,
    publisher: publisher,
    Observer: Observer,
    observer: observer,
    lift: lift,
    snapshot: snapshot,

    // deprecated aliases
    observe: publisher,
    thunk: observer
});

