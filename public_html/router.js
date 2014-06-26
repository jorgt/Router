"use strict";

/**
 * @author Jorg 
 * @version 0.1
 * 
 * TL;DR
 * Simple router. Register hash routes and execute functions when found.
 * Supports route variables.
 * 
 * Usage.
 * 
 * To register a route:
 *     Router.go('/home', function(route) { 
 *          //route has the value of your current route
 *     });
 *
 * To register a route with a variable bit:
 *     Router.go('/home/:myvar', function(route, variables) { 
 *          //variables has your registered variables
 *          //route has the value of your current route
 *     });
 * 
 * Set a default route in case no matches are found:
 *     Router.otherwise('/home'); 
 *  
 * To get an array of registered routes:
 *     Router.getRegisteredRoutes();
 *     
 * Do the initial route checking when you're done adding routes:
 *      Router.run();
 *      
 * All of this can be chained! Below a small but complete example.
 *      Router
 *          .go('/home', func)
 *          .go('/another', func)
 *          .otherwise('/home')
 *          .run()
 *          
 * @param {Object} object The object to which Router is appended. 
 */
(function(object) {
    "use strict";

    /**
     * Cross Browser Array Filter 
     * (from http://underscorejs.org/ - Thanks Jeremey, you're awesome)
     * 
     * @private
     * 
     * @param {Object} obj The object to filter
     * @param {Function} predicate The function used to filter
     * @param {Object} context Optional. Inject a possible context (scope)
     */
    var _filter = function(obj, predicate, context) {
        var results = [];
        if (obj === null)
            return results;
        if (Array.prototype.filter && obj.filter === Array.prototype.filter)
            return obj.filter(predicate, context);
        each(obj, function(value, index, list) {
            if (predicate.call(context, value, index, list))
                results.push(value);
        });
        return results;
    };

    /**
     * Cross Browser array map 
     * (from http://underscorejs.org/ - Thanks Jeremey, you're awesome)
     * 
     * @private
     * 
     * @param {Object} obj The object to filter
     * @param {Function} iterator The function used to filter
     * @param {Object} context Optional. Inject a possible context (scope)
     */
    var _map = function(obj, iterator, context) {
        var results = [];
        if (obj === null)
            return results;
        if (Array.prototype.map && obj.map === Array.prototype.map)
            return obj.map(iterator, context);
        each(obj, function(value, index, list) {
            results.push(iterator.call(context, value, index, list));
        });
        return results;
    };

    var _events = (function() {
        var _events = [];

        function addEvent(name, params) {
            _events[name] = new CustomEvent(name, {detail: params});
        }

        var e = {
            registerEvent: function(name, params) {
                addEvent(name, params);
            },
            dispatch: function(name) {
                object.dispatchEvent(_events[name]);
            }
        };

        return e;
    })();

    object.addEventListener("test", function(e) {
        console.log(e);
        console.log(document.links);
    });

    _events.registerEvent('routerHashChange');
    _events.dispatch('routerHashChange', {route: window.location.hash});

    /**
     * this is the singleton that will hold all our routing information
     * 
     * @private
     */
    var _routerHelper = false;

    /**
     * This function instantiates the router helper object.
     * 
     * @returns {Object} _routerObject
     */
    var _routerObject = {};

    /**
     * All the registered routes
     * 
     * @returns {Array} routes
     */
    _routerObject.getRegisteredRoutes = function() {
        return _routerHelper.getRegisteredRoutes();
    };

    /**
     * Sets a route. Callback is optional, if it's not a function the default
     * will be used.
     * 
     * @param {String} route the actual hash route
     * @param {Function} func callback when route is invoked
     * @returns {Object} _routerObject
     */
    _routerObject.go = function(route, func) {
        if (typeof func !== 'function') {
            throw new TypeError("Callback is not a function");
        }
        _routerHelper.routes[route] = func;
        return _routerObject;
    };

    /**
     * This route is executed when a non registered route is detected
     * 
     * @param {String} route a default hash route
     * @returns {Object} _routerObject
     */
    _routerObject.otherwise = function(route) {
        _routerHelper.default = route;
        return _routerObject;
    };

    /**
     * Because the hash change event is not triggered upon the initial start of the page,
     * Run makes sure the initial routing happens. This will either allow the a registered
     * route to fire, or route to the default if it's unknown
     */
    _routerObject.run = function() {
        _routerHelper.handleHash(_routerHelper.getHash());
    };

    /**
     * Class for routing. Does the heavy lifting like registering
     * the event handlers, registering, matching and executing route 
     * functions.
     * 
     * @this _RouterHelperClass
     * @constructor
     * @private
     */
    function _RouterHelperClass() {

        //default route. Is set by the "otherwise" function in the routerObject.
        this.default = false;

        //used in the regular expression that sorts out the variables. This determines
        //the characters allowed in your url variable. 
        this.charsAllowed = '[a-zA-Z0-9-_]';
        this.defaultAction = function(_hash) {
            console.log('Router:', 'Default action for', _hash);
        };
        this.routes = new Array();

        //Cross browser event. use eventListener when available, otherwise use attachEvent for older
        //IE's. If all else fails, just poll the current hash on a 100ms interval.
        if (window.addEventListener) {
            window.addEventListener("hashchange", this.onHashChange.bind(this), false);
        } else if (window.attachEvent) {
            window.attachEvent("onhashchange", this.onHashChange.bind(this));
        } else {
            //limiting the polling function's scope as well. don't forget to bind the current
            //context to the onHashChange function.
            (function(_func) {
                var hash = window.location.hash;
                setInterval(function() {
                    if (window.location.hash !== hash) {
                        _func();
                        hash = window.location.hash;
                    }
                }.bind(this), 100);
            })(this.onHashChange.bind(this));
        }
    }

    /**
     * Router Helper Class prototype
     */
    _RouterHelperClass.prototype = {
        onHashChange: function(event) {
            console.log(event)
            this.handleHash(this.getHash());
            return false;
        },
        handleHash: function(_hash) {
            //if the route exists straight up, no need for mapping
            if (this.routes[_hash]) {
                this.routes[_hash].call(this, _hash);
            } else {
                var temp = []; 				//array containing variable names from route
                var variables = [];     	//array containing mapped variables
                var hash = this.getHash();  //hash, to access in callback
                var cAllowed = this.charsAllowed;

                var routes = _filter(this.getRegisteredRoutes(), function(val) {
                    var regex = '^\/' + _map(val.split('/').splice(1), function(v, index) {
                        if (v.substring(0, 1) === ':') {
                            temp.push(v.substring(1));
                            return '(' + cAllowed + '+)';
                        } else {
                            return v;
                        }
                    }).join('\/') + '$';

                    var matches = hash.match(regex);
                    if (matches) {
                        for (var i = 0; i < temp.length; i++) {
                            variables[temp[i]] = matches[i + 1];
                        }
                        return true;
                    } else {
                        return false;
                    }
                });

                //the FIRST MATCH is executed in case of conflicting routes.
                if (routes.length > 0) {
                    this.routes[routes[0]].call(this, _hash, variables);
                }
            }
        },
        setHash: function(_route) {
            window.location.hash = _route;
        },
        getHash: function() {
            return window.location.hash.substring(1);
        },
        getRegisteredRoutes: function() {
            var keys = [];
            for (var key in this.routes) {
                keys.push(key);
            }
            return keys;
        }
    };

    /*
     * finally, instantiate the router helper object and attach
     * the router to the object passed to the function.
     */
    if (!object.Router) {
        if (_routerHelper === false) {
            _routerHelper = new _RouterHelperClass();
        }
        object.Router = _routerObject;
    }
})(window);	