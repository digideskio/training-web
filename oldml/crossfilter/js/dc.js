/*!
 *  dc 2.1.0-dev
 *  http://dc-js.github.io/dc.js/
 *  Copyright 2012-2015 Nick Zhu & the dc.js Developers
 *  https://github.com/dc-js/dc.js/blob/master/AUTHORS
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
(function() { function _dc(d3, crossfilter) {
'use strict';

/**
 * The entire dc.js library is scoped under the **dc** name space. It does not introduce
 * anything else into the global name space.
 *
 * Most `dc` functions are designed to allow function chaining, meaning they return the current chart
 * instance whenever it is appropriate.  The getter forms of functions do not participate in function
 * chaining because they necessarily return values that are not the chart.  Although some,
 * such as `.svg` and `.xAxis`, return values that are chainable d3 objects.
 * @namespace dc
 * @version 2.1.0-dev
 * @example
 * // Example chaining
 * chart.width(300)
 *      .height(300)
 *      .filter('sunday');
 */
/*jshint -W062*/
/*jshint -W079*/
var dc = {
    version: '2.1.0-dev',
    constants: {
        CHART_CLASS: 'dc-chart',
        DEBUG_GROUP_CLASS: 'debug',
        STACK_CLASS: 'stack',
        DESELECTED_CLASS: 'deselected',
        SELECTED_CLASS: 'selected',
        NODE_INDEX_NAME: '__index__',
        GROUP_INDEX_NAME: '__group_index__',
        DEFAULT_CHART_GROUP: '__default_chart_group__',
        EVENT_DELAY: 40,
        NEGLIGIBLE_NUMBER: 1e-10
    },
    _renderlet: null
};

dc.chartRegistry = function () {
    // chartGroup:string => charts:array
    var _chartMap = {};

    function initializeChartGroup (group) {
        if (!group) {
            group = dc.constants.DEFAULT_CHART_GROUP;
        }

        if (!_chartMap[group]) {
            _chartMap[group] = [];
        }

        return group;
    }

    return {
        has: function (chart) {
            for (var e in _chartMap) {
                if (_chartMap[e].indexOf(chart) >= 0) {
                    return true;
                }
            }
            return false;
        },

        register: function (chart, group) {
            group = initializeChartGroup(group);
            _chartMap[group].push(chart);
        },

        deregister: function (chart, group) {
            group = initializeChartGroup(group);
            for (var i = 0; i < _chartMap[group].length; i++) {
                if (_chartMap[group][i].anchorName() === chart.anchorName()) {
                    _chartMap[group].splice(i, 1);
                    break;
                }
            }
        },

        clear: function (group) {
            if (group) {
                delete _chartMap[group];
            } else {
                _chartMap = {};
            }
        },

        list: function (group) {
            group = initializeChartGroup(group);
            return _chartMap[group];
        }
    };
}();
/*jshint +W062 */
/*jshint +W079*/

dc.registerChart = function (chart, group) {
    dc.chartRegistry.register(chart, group);
};

dc.deregisterChart = function (chart, group) {
    dc.chartRegistry.deregister(chart, group);
};

dc.hasChart = function (chart) {
    return dc.chartRegistry.has(chart);
};

dc.deregisterAllCharts = function (group) {
    dc.chartRegistry.clear(group);
};

/**
 * Clear all filters on all charts within the given chart group. If the chart group is not given then
 * only charts that belong to the default chart group will be reset.
 * @memberof dc
 * @name filterAll
 * @param {String} [group]
 */
dc.filterAll = function (group) {
    var charts = dc.chartRegistry.list(group);
    for (var i = 0; i < charts.length; ++i) {
        charts[i].filterAll();
    }
};

/**
 * Reset zoom level / focus on all charts that belong to the given chart group. If the chart group is
 * not given then only charts that belong to the default chart group will be reset.
 * @memberof dc
 * @name refocusAll
 * @param {String} [group]
 */
dc.refocusAll = function (group) {
    var charts = dc.chartRegistry.list(group);
    for (var i = 0; i < charts.length; ++i) {
        if (charts[i].focus) {
            charts[i].focus();
        }
    }
};

/**
 * Re-render all charts belong to the given chart group. If the chart group is not given then only
 * charts that belong to the default chart group will be re-rendered.
 * @memberof dc
 * @name renderAll
 * @param {String} [group]
 */
dc.renderAll = function (group) {
    var charts = dc.chartRegistry.list(group);
    for (var i = 0; i < charts.length; ++i) {
        charts[i].render();
    }

    if (dc._renderlet !== null) {
        dc._renderlet(group);
    }
};

/**
 * Redraw all charts belong to the given chart group. If the chart group is not given then only charts
 * that belong to the default chart group will be re-drawn. Redraw is different from re-render since
 * when redrawing dc tries to update the graphic incrementally, using transitions, instead of starting
 * from scratch.
 * @memberof dc
 * @name redrawAll
 * @param {String} [group]
 */
dc.redrawAll = function (group) {
    var charts = dc.chartRegistry.list(group);
    for (var i = 0; i < charts.length; ++i) {
        charts[i].redraw();
    }

    if (dc._renderlet !== null) {
        dc._renderlet(group);
    }
};

/**
 * If this boolean is set truthy, all transitions will be disabled, and changes to the charts will happen
 * immediately
 * @memberof dc
 * @name disableTransitions
 * @type {Boolean}
 * @default false
 */
dc.disableTransitions = false;

dc.transition = function (selections, duration, callback, name) {
    if (duration <= 0 || duration === undefined || dc.disableTransitions) {
        return selections;
    }

    var s = selections
        .transition(name)
        .duration(duration);

    if (typeof(callback) === 'function') {
        callback(s);
    }

    return s;
};

/* somewhat silly, but to avoid duplicating logic */
dc.optionalTransition = function (enable, duration, callback, name) {
    if (enable) {
        return function (selection) {
            return dc.transition(selection, duration, callback, name);
        };
    } else {
        return function (selection) {
            return selection;
        };
    }
};

/**
 * @name units
 * @memberof dc
 * @type {{}}
 */
dc.units = {};

/**
 * The default value for `xUnits` for the [Coordinate Grid Chart](#coordinate-grid-chart) and should
 * be used when the x values are a sequence of integers.
 * It is a function that counts the number of integers in the range supplied in its start and end parameters.
 * @name integers
 * @memberof dc.units
 * @example
 * chart.xUnits(dc.units.integers) // already the default
 * @param {Number} start
 * @param {Number} end
 * @returns {Number}
 */
dc.units.integers = function (start, end) {
    return Math.abs(end - start);
};

/**
 * This argument can be passed to the `xUnits` function of the to specify ordinal units for the x
 * axis. Usually this parameter is used in combination with passing `d3.scale.ordinal()` to `.x`.
 * It just returns the domain passed to it, which for ordinal charts is an array of all values.
 * @name ordinal
 * @memberof dc.units
 * @example
 * chart.xUnits(dc.units.ordinal)
 *      .x(d3.scale.ordinal())
 * @param {*} start
 * @param {*} end
 * @param {Array<String>} domain
 * @returns {Array<String>}
 */
dc.units.ordinal = function (start, end, domain) {
    return domain;
};

/**
 * @name fp
 * @memberof dc.units
 * @type {{}}
 */
dc.units.fp = {};
/**
 * This function generates an argument for the [Coordinate Grid Chart's](#coordinate-grid-chart)
 * `xUnits` function specifying that the x values are floating-point numbers with the given
 * precision.
 * The returned function determines how many values at the given precision will fit into the range
 * supplied in its start and end parameters.
 * @name precision
 * @memberof dc.units.fp
 * @example
 * // specify values (and ticks) every 0.1 units
 * chart.xUnits(dc.units.fp.precision(0.1)
 * // there are 500 units between 0.5 and 1 if the precision is 0.001
 * var thousandths = dc.units.fp.precision(0.001);
 * thousandths(0.5, 1.0) // returns 500
 * @param {Number} precision
 * @returns {Function} start-end unit function
 */
dc.units.fp.precision = function (precision) {
    var _f = function (s, e) {
        var d = Math.abs((e - s) / _f.resolution);
        if (dc.utils.isNegligible(d - Math.floor(d))) {
            return Math.floor(d);
        } else {
            return Math.ceil(d);
        }
    };
    _f.resolution = precision;
    return _f;
};

dc.round = {};
dc.round.floor = function (n) {
    return Math.floor(n);
};
dc.round.ceil = function (n) {
    return Math.ceil(n);
};
dc.round.round = function (n) {
    return Math.round(n);
};

dc.override = function (obj, functionName, newFunction) {
    var existingFunction = obj[functionName];
    obj['_' + functionName] = existingFunction;
    obj[functionName] = newFunction;
};

dc.renderlet = function (_) {
    if (!arguments.length) {
        return dc._renderlet;
    }
    dc._renderlet = _;
    return dc;
};

dc.instanceOfChart = function (o) {
    return o instanceof Object && o.__dcFlag__ && true;
};

dc.errors = {};

dc.errors.Exception = function (msg) {
    var _msg = msg || 'Unexpected internal error';

    this.message = _msg;

    this.toString = function () {
        return _msg;
    };
};

dc.errors.InvalidStateException = function () {
    dc.errors.Exception.apply(this, arguments);
};

dc.dateFormat = d3.time.format('%m/%d/%Y');

dc.printers = {};

dc.printers.filters = function (filters) {
    var s = '';

    for (var i = 0; i < filters.length; ++i) {
        if (i > 0) {
            s += ', ';
        }
        s += dc.printers.filter(filters[i]);
    }

    return s;
};

dc.printers.filter = function (filter) {
    var s = '';

    if (typeof filter !== 'undefined' && filter !== null) {
        if (filter instanceof Array) {
            if (filter.length >= 2) {
                s = '[' + dc.utils.printSingleValue(filter[0]) + ' -> ' + dc.utils.printSingleValue(filter[1]) + ']';
            } else if (filter.length >= 1) {
                s = dc.utils.printSingleValue(filter[0]);
            }
        } else {
            s = dc.utils.printSingleValue(filter);
        }
    }

    return s;
};

dc.pluck = function (n, f) {
    if (!f) {
        return function (d) { return d[n]; };
    }
    return function (d, i) { return f.call(d, d[n], i); };
};

dc.utils = {};

dc.utils.printSingleValue = function (filter) {
    var s = '' + filter;

    if (filter instanceof Date) {
        s = dc.dateFormat(filter);
    } else if (typeof(filter) === 'string') {
        s = filter;
    } else if (dc.utils.isFloat(filter)) {
        s = dc.utils.printSingleValue.fformat(filter);
    } else if (dc.utils.isInteger(filter)) {
        s = Math.round(filter);
    }

    return s;
};
dc.utils.printSingleValue.fformat = d3.format('.2f');

// FIXME: these assume than any string r is a percentage (whether or not it
// includes %). They also generate strange results if l is a string.
dc.utils.add = function (l, r) {
    if (typeof r === 'string') {
        r = r.replace('%', '');
    }

    if (l instanceof Date) {
        if (typeof r === 'string') {
            r = +r;
        }
        var d = new Date();
        d.setTime(l.getTime());
        d.setDate(l.getDate() + r);
        return d;
    } else if (typeof r === 'string') {
        var percentage = (+r / 100);
        return l > 0 ? l * (1 + percentage) : l * (1 - percentage);
    } else {
        return l + r;
    }
};

dc.utils.subtract = function (l, r) {
    if (typeof r === 'string') {
        r = r.replace('%', '');
    }

    if (l instanceof Date) {
        if (typeof r === 'string') {
            r = +r;
        }
        var d = new Date();
        d.setTime(l.getTime());
        d.setDate(l.getDate() - r);
        return d;
    } else if (typeof r === 'string') {
        var percentage = (+r / 100);
        return l < 0 ? l * (1 + percentage) : l * (1 - percentage);
    } else {
        return l - r;
    }
};

dc.utils.isNumber = function (n) {
    return n === +n;
};

dc.utils.isFloat = function (n) {
    return n === +n && n !== (n | 0);
};

dc.utils.isInteger = function (n) {
    return n === +n && n === (n | 0);
};

dc.utils.isNegligible = function (n) {
    return !dc.utils.isNumber(n) || (n < dc.constants.NEGLIGIBLE_NUMBER && n > -dc.constants.NEGLIGIBLE_NUMBER);
};

dc.utils.clamp = function (val, min, max) {
    return val < min ? min : (val > max ? max : val);
};

var _idCounter = 0;
dc.utils.uniqueId = function () {
    return ++_idCounter;
};

dc.utils.nameToId = function (name) {
    return name.toLowerCase().replace(/[\s]/g, '_').replace(/[\.']/g, '');
};

dc.utils.appendOrSelect = function (parent, selector, tag) {
    tag = tag || selector;
    var element = parent.select(selector);
    if (element.empty()) {
        element = parent.append(tag);
    }
    return element;
};

dc.utils.safeNumber = function (n) { return dc.utils.isNumber(+n) ? +n : 0;};

dc.logger = {};

dc.logger.enableDebugLog = false;

dc.logger.warn = function (msg) {
    if (console) {
        if (console.warn) {
            console.warn(msg);
        } else if (console.log) {
            console.log(msg);
        }
    }

    return dc.logger;
};

dc.logger.debug = function (msg) {
    if (dc.logger.enableDebugLog && console) {
        if (console.debug) {
            console.debug(msg);
        } else if (console.log) {
            console.log(msg);
        }
    }

    return dc.logger;
};

dc.logger.deprecate = function (fn, msg) {
    // Allow logging of deprecation
    var warned = false;
    function deprecated () {
        if (!warned) {
            dc.logger.warn(msg);
            warned = true;
        }
        return fn.apply(this, arguments);
    }
    return deprecated;
};

dc.events = {
    current: null
};

/**
 * This function triggers a throttled event function with a specified delay (in milli-seconds).  Events
 * that are triggered repetitively due to user interaction such brush dragging might flood the library
 * and invoke more renders than can be executed in time. Using this function to wrap your event
 * function allows the library to smooth out the rendering by throttling events and only responding to
 * the most recent event.
 * @name events.trigger
 * @memberof dc
 * @example
 * chart.on('renderlet', function(chart) {
 *     // smooth the rendering through event throttling
 *     dc.events.trigger(function(){
 *         // focus some other chart to the range selected by user on this chart
 *         someOtherChart.focus(chart.filter());
 *     });
 * })
 * @param {Function} closure
 * @param {Number} [delay]
 */
dc.events.trigger = function (closure, delay) {
    if (!delay) {
        closure();
        return;
    }

    dc.events.current = closure;

    setTimeout(function () {
        if (closure === dc.events.current) {
            closure();
        }
    }, delay);
};

/**
 * The dc.js filters are functions which are passed into crossfilter to chose which records will be
 * accumulated to produce values for the charts.  In the crossfilter model, any filters applied on one
 * dimension will affect all the other dimensions but not that one.  dc always applies a filter
 * function to the dimension; the function combines multiple filters and if any of them accept a
 * record, it is filtered in.
 *
 * These filter constructors are used as appropriate by the various charts to implement brushing.  We
 * mention below which chart uses which filter.  In some cases, many instances of a filter will be added.
 * @name filters
 * @memberof dc
 * @type {{}}
 */
dc.filters = {};

/**
 * RangedFilter is a filter which accepts keys between `low` and `high`.  It is used to implement X
 * axis brushing for the [coordinate grid charts](#coordinate-grid-mixin).
 * @name RangedFilter
 * @memberof dc.filters
 * @param {Number} low
 * @param {Number} high
 * @returns {Array<Number>}
 * @constructor
 */
dc.filters.RangedFilter = function (low, high) {
    var range = new Array(low, high);
    range.isFiltered = function (value) {
        return value >= this[0] && value < this[1];
    };

    return range;
};

/**
 * TwoDimensionalFilter is a filter which accepts a single two-dimensional value.  It is used by the
 * [heat map chart](#heat-map) to include particular cells as they are clicked.  (Rows and columns are
 * filtered by filtering all the cells in the row or column.)
 * @name TwoDimensionalFilter
 * @memberof dc.filters
 * @param {Array<Number>} filter
 * @returns {Array<Number>}
 * @constructor
 */
dc.filters.TwoDimensionalFilter = function (filter) {
    if (filter === null) { return null; }

    var f = filter;
    f.isFiltered = function (value) {
        return value.length && value.length === f.length &&
               value[0] === f[0] && value[1] === f[1];
    };

    return f;
};

/**
 * The RangedTwoDimensionalFilter allows filtering all values which fit within a rectangular
 * region. It is used by the [scatter plot](#scatter-plot) to implement rectangular brushing.
 *
 * It takes two two-dimensional points in the form `[[x1,y1],[x2,y2]]`, and normalizes them so that
 * `x1 <= x2` and `y1 <- y2`. It then returns a filter which accepts any points which are in the
 * rectangular range including the lower values but excluding the higher values.
 *
 * If an array of two values are given to the RangedTwoDimensionalFilter, it interprets the values as
 * two x coordinates `x1` and `x2` and returns a filter which accepts any points for which `x1 <= x <
 * x2`.
 * @name RangedTwoDimensionalFilter
 * @memberof dc.filters
 * @param {Array<Array<Number>>} filter
 * @returns {Array<Array<Number>>}
 * @constructor
 */
dc.filters.RangedTwoDimensionalFilter = function (filter) {
    if (filter === null) { return null; }

    var f = filter;
    var fromBottomLeft;

    if (f[0] instanceof Array) {
        fromBottomLeft = [
            [Math.min(filter[0][0], filter[1][0]), Math.min(filter[0][1], filter[1][1])],
            [Math.max(filter[0][0], filter[1][0]), Math.max(filter[0][1], filter[1][1])]
        ];
    } else {
        fromBottomLeft = [[filter[0], -Infinity], [filter[1], Infinity]];
    }

    f.isFiltered = function (value) {
        var x, y;

        if (value instanceof Array) {
            if (value.length !== 2) {
                return false;
            }
            x = value[0];
            y = value[1];
        } else {
            x = value;
            y = fromBottomLeft[0][1];
        }

        return x >= fromBottomLeft[0][0] && x < fromBottomLeft[1][0] &&
               y >= fromBottomLeft[0][1] && y < fromBottomLeft[1][1];
    };

    return f;
};

/**
 * Base Mixin is an abstract functional object representing a basic dc chart object
 * for all chart and widget implementations. Methods from the Base Mixin are inherited
 * and available on all chart implementations in the DC library.
 * @name baseMixin
 * @memberof dc
 * @mixin
 * @param {Chart} _chart
 * @returns {Chart}
 */
dc.baseMixin = function (_chart) {
    _chart.__dcFlag__ = dc.utils.uniqueId();

    var _dimension;
    var _group;

    var _anchor;
    var _root;
    var _svg;
    var _isChild;

    var _minWidth = 200;
    var _defaultWidth = function (element) {
        var width = element && element.getBoundingClientRect && element.getBoundingClientRect().width;
        return (width && width > _minWidth) ? width : _minWidth;
    };
    var _width = _defaultWidth;

    var _minHeight = 200;
    var _defaultHeight = function (element) {
        var height = element && element.getBoundingClientRect && element.getBoundingClientRect().height;
        return (height && height > _minHeight) ? height : _minHeight;
    };
    var _height = _defaultHeight;

    var _keyAccessor = dc.pluck('key');
    var _valueAccessor = dc.pluck('value');
    var _label = dc.pluck('key');

    var _ordering = dc.pluck('key');
    var _orderSort;

    var _renderLabel = false;

    var _title = function (d) {
        return _chart.keyAccessor()(d) + ': ' + _chart.valueAccessor()(d);
    };
    var _renderTitle = true;
    var _controlsUseVisibility = true;

    var _transitionDuration = 750;

    var _filterPrinter = dc.printers.filters;

    var _mandatoryAttributes = ['dimension', 'group'];

    var _chartGroup = dc.constants.DEFAULT_CHART_GROUP;

    var _listeners = d3.dispatch(
        'preRender',
        'postRender',
        'preRedraw',
        'postRedraw',
        'filtered',
        'zoomed',
        'renderlet',
        'pretransition');

    var _legend;

    var _filters = [];
    var _filterHandler = function (dimension, filters) {
        dimension.filter(null);

        if (filters.length === 0) {
            dimension.filter(null);
        } else {
            dimension.filterFunction(function (d) {
                for (var i = 0; i < filters.length; i++) {
                    var filter = filters[i];
                    if (filter.isFiltered && filter.isFiltered(d)) {
                        return true;
                    } else if (filter <= d && filter >= d) {
                        return true;
                    }
                }
                return false;
            });
        }
        return filters;
    };

    var _data = function (group) {
        return group.all();
    };

    /**
     * Set or get the width attribute of a chart. See `.height` below for further description of the
     * behavior.
     * @name width
     * @memberof dc.baseMixin
     * @instance
     * @param {Number|Function} w
     * @returns {Number}
     */
    _chart.width = function (w) {
        if (!arguments.length) {
            return _width(_root.node());
        }
        _width = d3.functor(w || _defaultWidth);
        return _chart;
    };

    /**
     * Set or get the height attribute of a chart. The height is applied to the SVG element generated by
     * the chart when rendered (or rerendered). If a value is given, then it will be used to calculate
     * the new height and the chart returned for method chaining.  The value can either be a numeric, a
     * function, or falsy. If no value is specified then the value of the current height attribute will
     * be returned.
     *
     * By default, without an explicit height being given, the chart will select the width of its
     * anchor element. If that isn't possible it defaults to 200. Setting the value falsy will return
     * the chart to the default behavior
     * @name height
     * @memberof dc.baseMixin
     * @instance
     * @example
     * chart.height(250); // Set the chart's height to 250px;
     * chart.height(function(anchor) { return doSomethingWith(anchor); }); // set the chart's height with a function
     * chart.height(null); // reset the height to the default auto calculation
     * @param {Number|Function} h
     * @returns {Number}
     */
    _chart.height = function (h) {
        if (!arguments.length) {
            return _height(_root.node());
        }
        _height = d3.functor(h || _defaultHeight);
        return _chart;
    };

    /**
     * Set or get the minimum width attribute of a chart. This only applicable if the width is
     * calculated by dc.
     * @name minWidth
     * @memberof dc.baseMixin
     * @instance
     * @param {Number} w
     * @returns {Number}
     */
    _chart.minWidth = function (w) {
        if (!arguments.length) {
            return _minWidth;
        }
        _minWidth = w;
        return _chart;
    };

    /**
     * Set or get the minimum height attribute of a chart. This only applicable if the height is
     * calculated by dc.
     * @name minHeight
     * @memberof dc.baseMixin
     * @instance
     * @param {Number} h
     * @returns {Number}
     */
    _chart.minHeight = function (h) {
        if (!arguments.length) {
            return _minHeight;
        }
        _minHeight = h;
        return _chart;
    };

    /**
     * **mandatory**
     *
     * Set or get the dimension attribute of a chart. In dc a dimension can be any valid [crossfilter
     * dimension](https://github.com/square/crossfilter/wiki/API-Reference#wiki-dimension).
     *
     * If a value is given, then it will be used as the new dimension. If no value is specified then
     * the current dimension will be returned.
     * @name dimension
     * @memberof dc.baseMixin
     * @instance
     * @param {Dimension} d
     * @returns {Dimension}
     */
    _chart.dimension = function (d) {
        if (!arguments.length) {
            return _dimension;
        }
        _dimension = d;
        _chart.expireCache();
        return _chart;
    };

    /**
     * Set the data callback or retrieve the chart's data set. The data callback is passed the chart's
     * group and by default will return `group.all()`. This behavior may be modified to, for instance,
     * return only the top 5 groups.
     * @name data
     * @memberof dc.baseMixin
     * @instance
     * @example
     * chart.data(function(group) {
     *     return group.top(5);
     * });
     * @param {Function} [callback]
     * @returns {*}
     */
    _chart.data = function (callback) {
        if (!arguments.length) {
            return _data.call(_chart, _group);
        }
        _data = d3.functor(callback);
        _chart.expireCache();
        return _chart;
    };

    /**
     * **mandatory**
     *
     * Set or get the group attribute of a chart. In dc a group is a [crossfilter
     * group](https://github.com/square/crossfilter/wiki/API-Reference#wiki-group). Usually the group
     * should be created from the particular dimension associated with the same chart. If a value is
     * given, then it will be used as the new group.
     *
     * If no value specified then the current group will be returned.
     * If `name` is specified then it will be used to generate legend label.
     * @name group
     * @memberof dc.baseMixin
     * @instance
     * @param {Group} [group]
     * @param {String} [name]
     * @returns {Group}
     */
    _chart.group = function (group, name) {
        if (!arguments.length) {
            return _group;
        }
        _group = group;
        _chart._groupName = name;
        _chart.expireCache();
        return _chart;
    };

    /**
     * Get or set an accessor to order ordinal charts
     * @name ordering
     * @memberof dc.baseMixin
     * @instance
     * @param {Function} [orderFunction]
     * @returns {Function}
     */
    _chart.ordering = function (orderFunction) {
        if (!arguments.length) {
            return _ordering;
        }
        _ordering = orderFunction;
        _orderSort = crossfilter.quicksort.by(_ordering);
        _chart.expireCache();
        return _chart;
    };

    _chart._computeOrderedGroups = function (data) {
        var dataCopy = data.slice(0);

        if (dataCopy.length <= 1) {
            return dataCopy;
        }

        if (!_orderSort) {
            _orderSort = crossfilter.quicksort.by(_ordering);
        }

        return _orderSort(dataCopy, 0, dataCopy.length);
    };

    /**
     * Clear all filters associated with this chart.
     * @name filterAll
     * @memberof dc.baseMixin
     * @instance
     * @returns {Chart}
     */
    _chart.filterAll = function () {
        return _chart.filter(null);
    };

    /**
     * Execute d3 single selection in the chart's scope using the given selector and return the d3
     * selection.
     *
     * This function is **not chainable** since it does not return a chart instance; however the d3
     * selection result can be chained to d3 function calls.
     * @name select
     * @memberof dc.baseMixin
     * @instance
     * @example
     * // Similar to:
     * d3.select('#chart-id').select(selector);
     * @returns {Selection}
     */
    _chart.select = function (s) {
        return _root.select(s);
    };

    /**
     * Execute in scope d3 selectAll using the given selector and return d3 selection result.
     *
     * This function is **not chainable** since it does not return a chart instance; however the d3
     * selection result can be chained to d3 function calls.
     * @name selectAll
     * @memberof dc.baseMixin
     * @instance
     * @example
     * // Similar to:
     * d3.select('#chart-id').selectAll(selector);
     * @returns {Selection}
     */
    _chart.selectAll = function (s) {
        return _root ? _root.selectAll(s) : null;
    };

    /**
     * Set the svg root to either be an existing chart's root; or any valid [d3 single
     * selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying a dom
     * block element such as a div; or a dom element or d3 selection. Optionally registers the chart
     * within the chartGroup. This class is called internally on chart initialization, but be called
     * again to relocate the chart. However, it will orphan any previously created SVG elements.
     * @name anchor
     * @memberof dc.baseMixin
     * @instance
     * @param {anchorChart|anchorSelector|anchorNode} [a]
     * @param {chartGroup} [chartGroup]
     * @returns {Chart}
     */
    _chart.anchor = function (a, chartGroup) {
        if (!arguments.length) {
            return _anchor;
        }
        if (dc.instanceOfChart(a)) {
            _anchor = a.anchor();
            _root = a.root();
            _isChild = true;
        } else {
            _anchor = a;
            _root = d3.select(_anchor);
            _root.classed(dc.constants.CHART_CLASS, true);
            dc.registerChart(_chart, chartGroup);
            _isChild = false;
        }
        _chartGroup = chartGroup;
        return _chart;
    };

    /**
     * Returns the dom id for the chart's anchored location.
     * @name anchorName
     * @memberof dc.baseMixin
     * @instance
     * @return {String}
     */
    _chart.anchorName = function () {
        var a = _chart.anchor();
        if (a && a.id) {
            return a.id;
        }
        if (a && a.replace) {
            return a.replace('#', '');
        }
        return 'dc-chart' + _chart.chartID();
    };

    /**
     * Returns the root element where a chart resides. Usually it will be the parent div element where
     * the svg was created. You can also pass in a new root element however this is usually handled by
     * dc internally. Resetting the root element on a chart outside of dc internals may have
     * unexpected consequences.
     * @name root
     * @memberof dc.baseMixin
     * @instance
     * @param {Element} [rootElement]
     * @return {Element}
     */
    _chart.root = function (rootElement) {
        if (!arguments.length) {
            return _root;
        }
        _root = rootElement;
        return _chart;
    };

    /**
     * Returns the top svg element for this specific chart. You can also pass in a new svg element,
     * however this is usually handled by dc internally. Resetting the svg element on a chart outside
     * of dc internals may have unexpected consequences.
     * @name svg
     * @memberof dc.baseMixin
     * @instance
     * @param {SVGElement} [svgElement]
     * @return {SVGElement}
     */
    _chart.svg = function (svgElement) {
        if (!arguments.length) {
            return _svg;
        }
        _svg = svgElement;
        return _chart;
    };

    /**
     * Remove the chart's SVG elements from the dom and recreate the container SVG element.
     * @name resetSvg
     * @memberof dc.baseMixin
     * @instance
     * @return {SVGElement}
     */
    _chart.resetSvg = function () {
        _chart.select('svg').remove();
        return generateSvg();
    };

    function sizeSvg () {
        if (_svg) {
            _svg
                .attr('width', _chart.width())
                .attr('height', _chart.height());
        }
    }

    function generateSvg () {
        _svg = _chart.root().append('svg');
        sizeSvg();
        return _svg;
    }

    /**
     * Set or get the filter printer function. The filter printer function is used to generate human
     * friendly text for filter value(s) associated with the chart instance. By default dc charts use a
     * default filter printer `dc.printers.filter` that provides simple printing support for both
     * single value and ranged filters.
     * @name filterPrinter
     * @memberof dc.baseMixin
     * @instance
     * @param {Function} [filterPrinterFunction]
     * @return {Function}
     */
    _chart.filterPrinter = function (filterPrinterFunction) {
        if (!arguments.length) {
            return _filterPrinter;
        }
        _filterPrinter = filterPrinterFunction;
        return _chart;
    };

    /**
     #### .controlsUseVisibility
     If set, use the `visibility` attribute instead of the `display` attribute, for less disruption
     to layout. Default: true.
     **/
    _chart.controlsUseVisibility = function (_) {
        if (!arguments.length) {
            return _controlsUseVisibility;
        }
        _controlsUseVisibility = _;
        return _chart;
    };

    /**
    #### .turnOnControls() & .turnOffControls()
    Turn on/off optional control elements within the root element. dc currently supports the
    following html control elements.

    * root.selectAll('.reset') - elements are turned on if the chart has an active filter. This type
     of control element is usually used to store a reset link to allow user to reset filter on a
     certain chart. This element will be turned off automatically if the filter is cleared.
    * root.selectAll('.filter') elements are turned on if the chart has an active filter. The text
     content of this element is then replaced with the current filter value using the filter printer
     function. This type of element will be turned off automatically if the filter is cleared.

     The method (display or visibility) for turning on/off the controls depends on the
     `controlsUseVisibility` flag.

    **/
    /**
     * Turn on optional control elements within the root element. dc currently supports the
     * following html control elements.
     * * root.selectAll('.reset') - elements are turned on if the chart has an active filter. This type
     * of control element is usually used to store a reset link to allow user to reset filter on a
     * certain chart. This element will be turned off automatically if the filter is cleared.
     * * root.selectAll('.filter') elements are turned on if the chart has an active filter. The text
     * content of this element is then replaced with the current filter value using the filter printer
     * function. This type of element will be turned off automatically if the filter is cleared.
     * @name turnOnControls
     * @memberof dc.baseMixin
     * @instance
     * @return {Chart}
     */
    _chart.turnOnControls = function () {
        if (_root) {
            var attribute = _chart.controlsUseVisibility() ? 'visibility' : 'display';
            _chart.selectAll('.reset').style(attribute, null);
            _chart.selectAll('.filter').text(_filterPrinter(_chart.filters())).style(attribute, null);
        }
        return _chart;
    };

    /**
     * Turn off optional control elements within the root element.
     * @name turnOffControls
     * @memberof dc.baseMixin
     * @instance
     * @return {Chart}
     */
    _chart.turnOffControls = function () {
        if (_root) {
            var attribute = _chart.controlsUseVisibility() ? 'visibility' : 'display';
            var value = _chart.controlsUseVisibility() ? 'hidden' : 'none';
            _chart.selectAll('.reset').style(attribute, value);
            _chart.selectAll('.filter').style(attribute, value).text(_chart.filter());
        }
        return _chart;
    };

    /**
     * Set or get the animation transition duration (in milliseconds) for this chart instance.
     * @name transitionDuration
     * @memberof dc.baseMixin
     * @instance
     * @param {Number} [duration]
     * @return {Number}
     */
    _chart.transitionDuration = function (duration) {
        if (!arguments.length) {
            return _transitionDuration;
        }
        _transitionDuration = duration;
        return _chart;
    };

    _chart._mandatoryAttributes = function (_) {
        if (!arguments.length) {
            return _mandatoryAttributes;
        }
        _mandatoryAttributes = _;
        return _chart;
    };

    function checkForMandatoryAttributes (a) {
        if (!_chart[a] || !_chart[a]()) {
            throw new dc.errors.InvalidStateException('Mandatory attribute chart.' + a +
                                                      ' is missing on chart[#' + _chart.anchorName() + ']');
        }
    }

    /**
     * Invoking this method will force the chart to re-render everything from scratch. Generally it
     * should only be used to render the chart for the first time on the page or if you want to make
     * sure everything is redrawn from scratch instead of relying on the default incremental redrawing
     * behaviour.
     * @name render
     * @memberof dc.baseMixin
     * @instance
     * @return {Chart}
     */
    _chart.render = function () {
        _listeners.preRender(_chart);

        if (_mandatoryAttributes) {
            _mandatoryAttributes.forEach(checkForMandatoryAttributes);
        }

        var result = _chart._doRender();

        if (_legend) {
            _legend.render();
        }

        _chart._activateRenderlets('postRender');

        return result;
    };

    _chart._activateRenderlets = function (event) {
        _listeners.pretransition(_chart);
        if (_chart.transitionDuration() > 0 && _svg) {
            _svg.transition().duration(_chart.transitionDuration())
                .each('end', function () {
                    _listeners.renderlet(_chart);
                    if (event) {
                        _listeners[event](_chart);
                    }
                });
        } else {
            _listeners.renderlet(_chart);
            if (event) {
                _listeners[event](_chart);
            }
        }
    };

    /**
     * Calling redraw will cause the chart to re-render data changes incrementally. If there is no
     * change in the underlying data dimension then calling this method will have no effect on the
     * chart. Most chart interaction in dc will automatically trigger this method through internal
     * events (in particular [dc.redrawAll](#dcredrawallchartgroup)); therefore, you only need to
     * manually invoke this function if data is manipulated outside of dc's control (for example if
     * data is loaded in the background using `crossfilter.add()`).
     * @name redraw
     * @memberof dc.baseMixin
     * @instance
     * @return {Chart}
     */
    _chart.redraw = function () {
        sizeSvg();
        _listeners.preRedraw(_chart);

        var result = _chart._doRedraw();

        if (_legend) {
            _legend.render();
        }

        _chart._activateRenderlets('postRedraw');

        return result;
    };

    _chart.redrawGroup = function () {
        dc.redrawAll(_chart.chartGroup());
    };

    _chart.renderGroup = function () {
        dc.renderAll(_chart.chartGroup());
    };

    _chart._invokeFilteredListener = function (f) {
        if (f !== undefined) {
            _listeners.filtered(_chart, f);
        }
    };

    _chart._invokeZoomedListener = function () {
        _listeners.zoomed(_chart);
    };

    var _hasFilterHandler = function (filters, filter) {
        if (filter === null || typeof(filter) === 'undefined') {
            return filters.length > 0;
        }
        return filters.some(function (f) {
            return filter <= f && filter >= f;
        });
    };

    /**
     * Set or get the has filter handler. The has filter handler is a function that checks to see if
     * the chart's current filters include a specific filter.  Using a custom has filter handler allows
     * you to change the way filters are checked for and replaced.
     * @name hasFilterHandler
     * @memberof dc.baseMixin
     * @instance
     * @example
     * // default has filter handler
     * function (filters, filter) {
     *     if (filter === null || typeof(filter) === 'undefined') {
     *         return filters.length > 0;
     *     }
     *     return filters.some(function (f) {
     *         return filter <= f && filter >= f;
     *     });
     * }
     *
     * // custom filter handler (no-op)
     * chart.hasFilterHandler(function(filters, filter) {
     *     return false;
     * });
     * @param {Function} [hasFilterHandler]
     * @return {Chart}
     */
    _chart.hasFilterHandler = function (hasFilterHandler) {
        if (!arguments.length) {
            return _hasFilterHandler;
        }
        _hasFilterHandler = hasFilterHandler;
        return _chart;
    };

    /**
     * Check whether any active filter or a specific filter is associated with particular chart instance.
     * This function is **not chainable**.
     * @name hasFilter
     * @memberof dc.baseMixin
     * @instance
     * @param {*} [filter]
     * @return {Boolean}
     */
    _chart.hasFilter = function (filter) {
        return _hasFilterHandler(_filters, filter);
    };

    var _removeFilterHandler = function (filters, filter) {
        for (var i = 0; i < filters.length; i++) {
            if (filters[i] <= filter && filters[i] >= filter) {
                filters.splice(i, 1);
                break;
            }
        }
        return filters;
    };

    /**
     * Set or get the remove filter handler. The remove filter handler is a function that removes a
     * filter from the chart's current filters. Using a custom remove filter handler allows you to
     * change how filters are removed or perform additional work when removing a filter, e.g. when
     * using a filter server other than crossfilter.
     *
     * Any changes should modify the `filters` array argument and return that array.
     * @name removeFilterHandler
     * @memberof dc.baseMixin
     * @instance
     * @example
     * // default remove filter handler
     * function (filters, filter) {
     *     for (var i = 0; i < filters.length; i++) {
     *         if (filters[i] <= filter && filters[i] >= filter) {
     *             filters.splice(i, 1);
     *             break;
     *         }
     *     }
     *     return filters;
     * }
     *
     * // custom filter handler (no-op)
     * chart.removeFilterHandler(function(filters, filter) {
     *     return filters;
     * });
     * @param {Function} [removeFilterHandler]
     * @return {Chart}
     */
    _chart.removeFilterHandler = function (removeFilterHandler) {
        if (!arguments.length) {
            return _removeFilterHandler;
        }
        _removeFilterHandler = removeFilterHandler;
        return _chart;
    };

    var _addFilterHandler = function (filters, filter) {
        filters.push(filter);
        return filters;
    };

    /**
     * Set or get the add filter handler. The add filter handler is a function that adds a filter to
     * the chart's filter list. Using a custom add filter handler allows you to change the way filters
     * are added or perform additional work when adding a filter, e.g. when using a filter server other
     * than crossfilter.
     *
     * Any changes should modify the `filters` array argument and return that array.
     * @name addFilterHandler
     * @memberof dc.baseMixin
     * @instance
     * @example
     * // default add filter handler
     * function (filters, filter) {
     *     filters.push(filter);
     *     return filters;
     * }
     *
     * // custom filter handler (no-op)
     * chart.addFilterHandler(function(filters, filter) {
     *     return filters;
     * });
     * @param {Function} [addFilterHandler]
     * @return {Chart}
     */
    _chart.addFilterHandler = function (addFilterHandler) {
        if (!arguments.length) {
            return _addFilterHandler;
        }
        _addFilterHandler = addFilterHandler;
        return _chart;
    };

    var _resetFilterHandler = function (filters) {
        return [];
    };

    /**
     * Set or get the reset filter handler. The reset filter handler is a function that resets the
     * chart's filter list by returning a new list. Using a custom reset filter handler allows you to
     * change the way filters are reset, or perform additional work when resetting the filters,
     * e.g. when using a filter server other than crossfilter.
     *
     * This function should return an array.
     * @name resetFilterHandler
     * @memberof dc.baseMixin
     * @instance
     * @example
     * // default remove filter handler
     * function (filters) {
     *     return [];
     * }
     *
     * // custom filter handler (no-op)
     * chart.resetFilterHandler(function(filters) {
     *     return filters;
     * });
     * @param {Function} [resetFilterHandler]
     * @return {Chart}
     */
    _chart.resetFilterHandler = function (resetFilterHandler) {
        if (!arguments.length) {
            return _resetFilterHandler;
        }
        _resetFilterHandler = resetFilterHandler;
        return _chart;
    };

    function applyFilters () {
        if (_chart.dimension() && _chart.dimension().filter) {
            var fs = _filterHandler(_chart.dimension(), _filters);
            _filters = fs ? fs : _filters;
        }
    }

    _chart.replaceFilter = function (_) {
        _filters = [];
        _chart.filter(_);
    };

    /**
     * Filter the chart by the given value or return the current filter if the input parameter is missing.
     * @name filter
     * @memberof dc.baseMixin
     * @instance
     * @example
     * // filter by a single string
     * chart.filter('Sunday');
     * // filter by a single age
     * chart.filter(18);
     * @param {*} [filter]
     * @return {Chart}
     */
    _chart.filter = function (filter) {
        if (!arguments.length) {
            return _filters.length > 0 ? _filters[0] : null;
        }
        if (filter instanceof Array && filter[0] instanceof Array && !filter.isFiltered) {
            filter[0].forEach(function (d) {
                if (_chart.hasFilter(d)) {
                    _removeFilterHandler(_filters, d);
                } else {
                    _addFilterHandler(_filters, d);
                }
            });
        } else if (filter === null) {
            _filters = _resetFilterHandler(_filters);
        } else {
            if (_chart.hasFilter(filter)) {
                _removeFilterHandler(_filters, filter);
            } else {
                _addFilterHandler(_filters, filter);
            }
        }
        applyFilters();
        _chart._invokeFilteredListener(filter);

        if (_root !== null && _chart.hasFilter()) {
            _chart.turnOnControls();
        } else {
            _chart.turnOffControls();
        }

        return _chart;
    };

    /**
     * Returns all current filters. This method does not perform defensive cloning of the internal
     * filter array before returning, therefore any modification of the returned array will effect the
     * chart's internal filter storage.
     * @name filters
     * @memberof dc.baseMixin
     * @instance
     * @return {Array<*>}
     */
    _chart.filters = function () {
        return _filters;
    };

    _chart.highlightSelected = function (e) {
        d3.select(e).classed(dc.constants.SELECTED_CLASS, true);
        d3.select(e).classed(dc.constants.DESELECTED_CLASS, false);
    };

    _chart.fadeDeselected = function (e) {
        d3.select(e).classed(dc.constants.SELECTED_CLASS, false);
        d3.select(e).classed(dc.constants.DESELECTED_CLASS, true);
    };

    _chart.resetHighlight = function (e) {
        d3.select(e).classed(dc.constants.SELECTED_CLASS, false);
        d3.select(e).classed(dc.constants.DESELECTED_CLASS, false);
    };

    /**
     * This function is passed to d3 as the onClick handler for each chart. The default behavior is to
     * filter on the clicked datum (passed to the callback) and redraw the chart group.
     * @name onClick
     * @memberof dc.baseMixin
     * @instance
     * @param {*} datum
     */
    _chart.onClick = function (datum) {
        var filter = _chart.keyAccessor()(datum);
        dc.events.trigger(function () {
            _chart.filter(filter);
            _chart.redrawGroup();
        });
    };

    /**
     * Set or get the filter handler. The filter handler is a function that performs the filter action
     * on a specific dimension. Using a custom filter handler allows you to perform additional logic
     * before or after filtering.
     * @name filterHandler
     * @memberof dc.baseMixin
     * @instance
     * @example
     * // default filter handler
     * function(dimension, filter){
     *     dimension.filter(filter); // perform filtering
     *     return filter; // return the actual filter value
     * }
     *
     * // custom filter handler
     * chart.filterHandler(function(dimension, filter){
     *     var newFilter = filter + 10;
     *     dimension.filter(newFilter);
     *     return newFilter; // set the actual filter value to the new value
     * });
     * @param {Function} filterHandler
     * @return {Chart}
     */
    _chart.filterHandler = function (filterHandler) {
        if (!arguments.length) {
            return _filterHandler;
        }
        _filterHandler = filterHandler;
        return _chart;
    };

    // abstract function stub
    _chart._doRender = function () {
        // do nothing in base, should be overridden by sub-function
        return _chart;
    };

    _chart._doRedraw = function () {
        // do nothing in base, should be overridden by sub-function
        return _chart;
    };

    _chart.legendables = function () {
        // do nothing in base, should be overridden by sub-function
        return [];
    };

    _chart.legendHighlight = function () {
        // do nothing in base, should be overridden by sub-function
    };

    _chart.legendReset = function () {
        // do nothing in base, should be overridden by sub-function
    };

    _chart.legendToggle = function () {
        // do nothing in base, should be overriden by sub-function
    };

    _chart.isLegendableHidden = function () {
        // do nothing in base, should be overridden by sub-function
        return false;
    };

    /**
     * Set or get the key accessor function. The key accessor function is used to retrieve the key
     * value from the crossfilter group. Key values are used differently in different charts, for
     * example keys correspond to slices in a pie chart and x axis positions in a grid coordinate chart.
     * @name keyAccessor
     * @memberof dc.baseMixin
     * @instance
     * @example
     * // default key accessor
     * chart.keyAccessor(function(d) { return d.key; });
     * // custom key accessor for a multi-value crossfilter reduction
     * chart.keyAccessor(function(p) { return p.value.absGain; });
     * @param {Function} keyAccessor
     * @return {Chart}
     */
    _chart.keyAccessor = function (keyAccessor) {
        if (!arguments.length) {
            return _keyAccessor;
        }
        _keyAccessor = keyAccessor;
        return _chart;
    };

    /**
     * Set or get the value accessor function. The value accessor function is used to retrieve the
     * value from the crossfilter group. Group values are used differently in different charts, for
     * example values correspond to slice sizes in a pie chart and y axis positions in a grid
     * coordinate chart.
     * @name valueAccessor
     * @memberof dc.baseMixin
     * @instance
     * @example
     * // default value accessor
     * chart.valueAccessor(function(d) { return d.value; });
     * // custom value accessor for a multi-value crossfilter reduction
     * chart.valueAccessor(function(p) { return p.value.percentageGain; });
     * @param {Function} valueAccessor
     * @return {Chart}
     */
    _chart.valueAccessor = function (valueAccessor) {
        if (!arguments.length) {
            return _valueAccessor;
        }
        _valueAccessor = valueAccessor;
        return _chart;
    };

    /**
     * Set or get the label function. The chart class will use this function to render labels for each
     * child element in the chart, e.g. slices in a pie chart or bubbles in a bubble chart. Not every
     * chart supports the label function for example bar chart and line chart do not use this function
     * at all.
     * @name label
     * @memberof dc.baseMixin
     * @instance
     * @example
     * // default label function just return the key
     * chart.label(function(d) { return d.key; });
     * // label function has access to the standard d3 data binding and can get quite complicated
     * chart.label(function(d) { return d.data.key + '(' + Math.floor(d.data.value / all.value() * 100) + '%)'; });
     * @param {Function} labelFunction
     * @return {Chart}
     */
    _chart.label = function (labelFunction) {
        if (!arguments.length) {
            return _label;
        }
        _label = labelFunction;
        _renderLabel = true;
        return _chart;
    };

    /**
     * Turn on/off label rendering
     * @name renderLabel
     * @memberof dc.baseMixin
     * @instance
     * @param {Boolean} renderLabel
     * @return {Boolean}
     */
    _chart.renderLabel = function (renderLabel) {
        if (!arguments.length) {
            return _renderLabel;
        }
        _renderLabel = renderLabel;
        return _chart;
    };

    /**
     * Set or get the title function. The chart class will use this function to render the svg title
     * (usually interpreted by browser as tooltips) for each child element in the chart, e.g. a slice
     * in a pie chart or a bubble in a bubble chart. Almost every chart supports the title function;
     * however in grid coordinate charts you need to turn off the brush in order to see titles, because
     * otherwise the brush layer will block tooltip triggering.
     * @name title
     * @memberof dc.baseMixin
     * @instance
     * @example
     * // default title function just return the key
     * chart.title(function(d) { return d.key + ': ' + d.value; });
     * // title function has access to the standard d3 data binding and can get quite complicated
     * chart.title(function(p) {
     *    return p.key.getFullYear()
     *        + '\n'
     *        + 'Index Gain: ' + numberFormat(p.value.absGain) + '\n'
     *        + 'Index Gain in Percentage: ' + numberFormat(p.value.percentageGain) + '%\n'
     *        + 'Fluctuation / Index Ratio: ' + numberFormat(p.value.fluctuationPercentage) + '%';
     * });
     * @param {Function} titleFunction
     * @return {Function}
     */
    _chart.title = function (titleFunction) {
        if (!arguments.length) {
            return _title;
        }
        _title = titleFunction;
        return _chart;
    };

    /**
     * Turn on/off title rendering, or return the state of the render title flag if no arguments are
     * given.
     * @name renderTitle
     * @memberof dc.baseMixin
     * @instance
     * @param {Boolean} renderTitle
     * @return {Boolean}
     */
    _chart.renderTitle = function (renderTitle) {
        if (!arguments.length) {
            return _renderTitle;
        }
        _renderTitle = renderTitle;
        return _chart;
    };

    /**
     * A renderlet is similar to an event listener on rendering event. Multiple renderlets can be added
     * to an individual chart.  Each time a chart is rerendered or redrawn the renderlets are invoked
     * right after the chart finishes its transitions, giving you a way to modify the svg
     * elements. Renderlet functions take the chart instance as the only input parameter and you can
     * use the dc API or use raw d3 to achieve pretty much any effect.
     * @name renderlet
     * @memberof dc.baseMixin
     * @instance
     * @deprecated Use [Listeners](#Listeners) with a 'renderlet' prefix.
     * Generates a random key for the renderlet, which makes it hard to remove.
     * @example
     * // do this instead of .renderlet(function(chart) { ... })
     * chart.on("renderlet", function(chart){
     *     // mix of dc API and d3 manipulation
     *     chart.select('g.y').style('display', 'none');
     *     // its a closure so you can also access other chart variable available in the closure scope
     *     moveChart.filter(chart.filter());
     * });
     * @param {Function} renderletFunction
     * @return {Function}
     */
    _chart.renderlet = dc.logger.deprecate(function (renderletFunction) {
        _chart.on('renderlet.' + dc.utils.uniqueId(), renderletFunction);
        return _chart;
    }, 'chart.renderlet has been deprecated.  Please use chart.on("renderlet.<renderletKey>", renderletFunction)');

    /**
     * Get or set the chart group to which this chart belongs. Chart groups are rendered or redrawn
     * together since it is expected they share the same underlying crossfilter data set.
     * @name chartGroup
     * @memberof dc.baseMixin
     * @instance
     * @param {String} chartGroup
     * @return {String}
     */
    _chart.chartGroup = function (chartGroup) {
        if (!arguments.length) {
            return _chartGroup;
        }
        if (!_isChild) {
            dc.deregisterChart(_chart, _chartGroup);
        }
        _chartGroup = chartGroup;
        if (!_isChild) {
            dc.registerChart(_chart, _chartGroup);
        }
        return _chart;
    };

    /**
     * Expire the internal chart cache. dc charts cache some data internally on a per chart basis to
     * speed up rendering and avoid unnecessary calculation; however it might be useful to clear the
     * cache if you have changed state which will affect rendering.  For example if you invoke the
     * `crossfilter.add` function or reset group or dimension after rendering it is a good idea to
     * clear the cache to make sure charts are rendered properly.
     * @name expireCache
     * @memberof dc.baseMixin
     * @instance
     * @return {Chart}
     */
    _chart.expireCache = function () {
        // do nothing in base, should be overridden by sub-function
        return _chart;
    };

    /**
     * Attach a dc.legend widget to this chart. The legend widget will automatically draw legend labels
     * based on the color setting and names associated with each group.
     * @name legend
     * @memberof dc.baseMixin
     * @instance
     * @example
     * chart.legend(dc.legend().x(400).y(10).itemHeight(13).gap(5))
     * @param {dc.legend} [legend]
     * @return {dc.legend}
     */
    _chart.legend = function (legend) {
        if (!arguments.length) {
            return _legend;
        }
        _legend = legend;
        _legend.parent(_chart);
        return _chart;
    };

    /**
     * Returns the internal numeric ID of the chart.
     * @name chartID
     * @memberof dc.baseMixin
     * @instance
     * @return {String}
     */
    _chart.chartID = function () {
        return _chart.__dcFlag__;
    };

    /**
     * Set chart options using a configuration object. Each key in the object will cause the method of
     * the same name to be called with the value to set that attribute for the chart.
     * @name options
     * @memberof dc.baseMixin
     * @instance
     * @example
     * chart.options({dimension: myDimension, group: myGroup});
     * @param {{}} opts
     * @return {Chart}
     */
    _chart.options = function (opts) {
        var applyOptions = [
            'anchor',
            'group',
            'xAxisLabel',
            'yAxisLabel',
            'stack',
            'title',
            'point',
            'getColor',
            'overlayGeoJson'
        ];

        for (var o in opts) {
            if (typeof(_chart[o]) === 'function') {
                if (opts[o] instanceof Array && applyOptions.indexOf(o) !== -1) {
                    _chart[o].apply(_chart, opts[o]);
                } else {
                    _chart[o].call(_chart, opts[o]);
                }
            } else {
                dc.logger.debug('Not a valid option setter name: ' + o);
            }
        }
        return _chart;
    };

    /**
     * All dc chart instance supports the following listeners.
     * Supports the following events:
     * * 'renderlet' - This listener function will be invoked after transitions after redraw and render. Replaces the
     * deprecated `.renderlet()` method.
     * * 'pretransition' - Like `.on('renderlet', ...)` but the event is fired before transitions start.
     * * 'preRender' - This listener function will be invoked before chart rendering.
     * * 'postRender' - This listener function will be invoked after chart finish rendering including
     * all renderlets' logic.
     * * 'preRedraw' - This listener function will be invoked before chart redrawing.
     * * 'postRedraw' - This listener function will be invoked after chart finish redrawing
     * including all renderlets' logic.
     * * 'filtered' - This listener function will be invoked after a filter is applied, added or removed.
     * * 'zoomed' - This listener function will be invoked after a zoom is triggered.
     * @name on
     * @memberof dc.baseMixin
     * @instance
     * @example
     * .on('renderlet', function(chart, filter){...})
     * .on('pretransition', function(chart, filter){...})
     * .on('preRender', function(chart){...})
     * .on('postRender', function(chart){...})
     * .on('preRedraw', function(chart){...})
     * .on('postRedraw', function(chart){...})
     * .on('filtered', function(chart, filter){...})
     * .on('zoomed', function(chart, filter){...})
     * @param {String} event
     * @param {Function} listener
     * @return {Chart}
     */
    _chart.on = function (event, listener) {
        _listeners.on(event, listener);
        return _chart;
    };

    return _chart;
};

/**
 * Margin is a mixin that provides margin utility functions for both the Row Chart and Coordinate Grid
 * Charts.
 * @name marginMixin
 * @memberof dc
 * @mixin
 * @param {Chart} _chart
 * @returns {Chart}
 */
dc.marginMixin = function (_chart) {
    var _margin = {top: 10, right: 50, bottom: 30, left: 30};

    /**
     * Get or set the margins for a particular coordinate grid chart instance. The margins is stored as
     * an associative Javascript array.
     * @name margins
     * @memberof dc.marginMixin
     * @instance
     * @example
     * var leftMargin = chart.margins().left; // 30 by default
     * chart.margins().left = 50;
     * leftMargin = chart.margins().left; // now 50
     * @param {{top:Number, right: Number, left: Number, bottom: Number}} [margins={top: 10, right: 50, bottom: 30, left: 30}]
     * @returns {Chart}
     */
    _chart.margins = function (margins) {
        if (!arguments.length) {
            return _margin;
        }
        _margin = margins;
        return _chart;
    };

    _chart.effectiveWidth = function () {
        return _chart.width() - _chart.margins().left - _chart.margins().right;
    };

    _chart.effectiveHeight = function () {
        return _chart.height() - _chart.margins().top - _chart.margins().bottom;
    };

    return _chart;
};

/**
 * The Color Mixin is an abstract chart functional class providing universal coloring support
 * as a mix-in for any concrete chart implementation.
 * @name colorMixin
 * @memberof dc
 * @mixin
 * @param {Chart} _chart
 * @returns {Chart}
 */
dc.colorMixin = function (_chart) {
    var _colors = d3.scale.category20c();
    var _defaultAccessor = true;

    var _colorAccessor = function (d) { return _chart.keyAccessor()(d); };

    /**
     * Retrieve current color scale or set a new color scale. This methods accepts any function that
     * operates like a d3 scale.
     * @name colors
     * @memberof dc.colorMixin
     * @instance
     * @example
     * // alternate categorical scale
     * chart.colors(d3.scale.category20b());
     *
     * // ordinal scale
     * chart.colors(d3.scale.ordinal().range(['red','green','blue']));
     * // convenience method, the same as above
     * chart.ordinalColors(['red','green','blue']);
     *
     * // set a linear scale
     * chart.linearColors(["#4575b4", "#ffffbf", "#a50026"]);
     * @param {D3Scale} [colorScale=d3.scale.category20c()]
     * @returns {Chart}
     */
    _chart.colors = function (colorScale) {
        if (!arguments.length) {
            return _colors;
        }
        if (colorScale instanceof Array) {
            _colors = d3.scale.quantize().range(colorScale); // deprecated legacy support, note: this fails for ordinal domains
        } else {
            _colors = d3.functor(colorScale);
        }
        return _chart;
    };

    /**
     * Convenience method to set the color scale to d3.scale.ordinal with range `r`.
     * @name ordinalColors
     * @memberof dc.colorMixin
     * @instance
     * @param {Array<String>} r
     * @returns {Chart}
     */
    _chart.ordinalColors = function (r) {
        return _chart.colors(d3.scale.ordinal().range(r));
    };

    /**
     * Convenience method to set the color scale to an Hcl interpolated linear scale with range `r`.
     * @name linearColors
     * @memberof dc.colorMixin
     * @instance
     * @param {Array<Number>} r
     * @returns {Chart}
     */
    _chart.linearColors = function (r) {
        return _chart.colors(d3.scale.linear()
                             .range(r)
                             .interpolate(d3.interpolateHcl));
    };

    /**
     * Set or the get color accessor function. This function will be used to map a data point in a
     * crossfilter group to a color value on the color scale. The default function uses the key
     * accessor.
     * @name linearColors
     * @memberof dc.colorMixin
     * @instance
     * @example
     * // default index based color accessor
     * .colorAccessor(function (d, i){return i;})
     * // color accessor for a multi-value crossfilter reduction
     * .colorAccessor(function (d){return d.value.absGain;})
     * @param {Function} [colorAccessorFunction]
     * @returns {Function}
     */
    _chart.colorAccessor = function (colorAccessorFunction) {
        if (!arguments.length) {
            return _colorAccessor;
        }
        _colorAccessor = colorAccessorFunction;
        _defaultAccessor = false;
        return _chart;
    };

    // what is this?
    _chart.defaultColorAccessor = function () {
        return _defaultAccessor;
    };

    /**
     * Set or get the current domain for the color mapping function. The domain must be supplied as an
     * array.
     *
     * Note: previously this method accepted a callback function. Instead you may use a custom scale
     * set by `.colors`.
     * @name colorDomain
     * @memberof dc.colorMixin
     * @instance
     * @param {Array<String>} [domain]
     * @returns {Function}
     */
    _chart.colorDomain = function (domain) {
        if (!arguments.length) {
            return _colors.domain();
        }
        _colors.domain(domain);
        return _chart;
    };

    /**
     * Set the domain by determining the min and max values as retrieved by `.colorAccessor` over the
     * chart's dataset.
     * @name calculateColorDomain
     * @memberof dc.colorMixin
     * @instance
     * @returns {Chart}
     */
    _chart.calculateColorDomain = function () {
        var newDomain = [d3.min(_chart.data(), _chart.colorAccessor()),
                         d3.max(_chart.data(), _chart.colorAccessor())];
        _colors.domain(newDomain);
        return _chart;
    };

    /**
     * Get the color for the datum d and counter i. This is used internally by charts to retrieve a color.
     * @name getColor
     * @memberof dc.colorMixin
     * @instance
     * @param {*} d
     * @param {Number} [i]
     * @returns {String}
     */
    _chart.getColor = function (d, i) {
        return _colors(_colorAccessor.call(this, d, i));
    };

    /**
     * Get the color for the datum d and counter i. This is used internally by charts to retrieve a color.
     * @name colorCalculator
     * @memberof dc.colorMixin
     * @instance
     * @param {*} [colorCalculator]
     * @returns {*}
     */
    _chart.colorCalculator = function (colorCalculator) {
        if (!arguments.length) {
            return _chart.getColor;
        }
        _chart.getColor = colorCalculator;
        return _chart;
    };

    return _chart;
};

/**
 * Coordinate Grid is an abstract base chart designed to support a number of coordinate grid based
 * concrete chart types, e.g. bar chart, line chart, and bubble chart.
 * @name coordinateGridMixin
 * @memberof dc
 * @mixin
 * @mixes dc.colorMixin
 * @mixes dc.marginMixin
 * @mixes dc.baseMixin
 * @param {Chart} _chart
 * @returns {Chart}
 */
dc.coordinateGridMixin = function (_chart) {
    var GRID_LINE_CLASS = 'grid-line';
    var HORIZONTAL_CLASS = 'horizontal';
    var VERTICAL_CLASS = 'vertical';
    var Y_AXIS_LABEL_CLASS = 'y-axis-label';
    var X_AXIS_LABEL_CLASS = 'x-axis-label';
    var DEFAULT_AXIS_LABEL_PADDING = 12;

    _chart = dc.colorMixin(dc.marginMixin(dc.baseMixin(_chart)));

    _chart.colors(d3.scale.category10());
    _chart._mandatoryAttributes().push('x');

    function zoomHandler () {
        _refocused = true;
        if (_zoomOutRestrict) {
            _chart.x().domain(constrainRange(_chart.x().domain(), _xOriginalDomain));
            if (_rangeChart) {
                _chart.x().domain(constrainRange(_chart.x().domain(), _rangeChart.x().domain()));
            }
        }

        var domain = _chart.x().domain();
        var domFilter = dc.filters.RangedFilter(domain[0], domain[1]);

        _chart.replaceFilter(domFilter);
        _chart.rescale();
        _chart.redraw();

        if (_rangeChart && !rangesEqual(_chart.filter(), _rangeChart.filter())) {
            dc.events.trigger(function () {
                _rangeChart.replaceFilter(domFilter);
                _rangeChart.redraw();
            });
        }

        _chart._invokeZoomedListener();

        dc.events.trigger(function () {
            _chart.redrawGroup();
        }, dc.constants.EVENT_DELAY);

        _refocused = !rangesEqual(domain, _xOriginalDomain);
    }

    var _parent;
    var _g;
    var _chartBodyG;

    var _x;
    var _xOriginalDomain;
    var _xAxis = d3.svg.axis().orient('bottom');
    var _xUnits = dc.units.integers;
    var _xAxisPadding = 0;
    var _xElasticity = false;
    var _xAxisLabel;
    var _xAxisLabelPadding = 0;
    var _lastXDomain;

    var _y;
    var _yAxis = d3.svg.axis().orient('left');
    var _yAxisPadding = 0;
    var _yElasticity = false;
    var _yAxisLabel;
    var _yAxisLabelPadding = 0;

    var _brush = d3.svg.brush();
    var _brushOn = true;
    var _round;

    var _renderHorizontalGridLine = false;
    var _renderVerticalGridLine = false;

    var _refocused = false, _resizing = false;
    var _unitCount;

    var _zoomScale = [1, Infinity];
    var _zoomOutRestrict = true;

    var _zoom = d3.behavior.zoom().on('zoom', zoomHandler);
    var _nullZoom = d3.behavior.zoom().on('zoom', null);
    var _hasBeenMouseZoomable = false;

    var _rangeChart;
    var _focusChart;

    var _mouseZoomable = false;
    var _clipPadding = 0;

    var _outerRangeBandPadding = 0.5;
    var _rangeBandPadding = 0;

    var _useRightYAxis = false;

    /**
     * When changing the domain of the x or y scale, it is necessary to tell the chart to recalculate
     * and redraw the axes. (`.rescale()` is called automatically when the x or y scale is replaced
     * with `.x()` or `.y()`, and has no effect on elastic scales.)
     * @name rescale
     * @memberof dc.coordinateGridMixin
     * @instance
     * @returns {Chart}
     */
    _chart.rescale = function () {
        _unitCount = undefined;
        _resizing = true;
        return _chart;
    };

    /**
     * Get or set the range selection chart associated with this instance. Setting the range selection
     * chart using this function will automatically update its selection brush when the current chart
     * zooms in. In return the given range chart will also automatically attach this chart as its focus
     * chart hence zoom in when range brush updates. See the [Nasdaq 100
     * Index](http://dc-js.github.com/dc.js/) example for this effect in action.
     * @name rangeChart
     * @memberof dc.coordinateGridMixin
     * @instance
     * @param {Chart} [rangeChart]
     * @returns {Chart}
     */
    _chart.rangeChart = function (rangeChart) {
        if (!arguments.length) {
            return _rangeChart;
        }
        _rangeChart = rangeChart;
        _rangeChart.focusChart(_chart);
        return _chart;
    };

    /**
     * Get or set the scale extent for mouse zooms.
     * @name zoomScale
     * @memberof dc.coordinateGridMixin
     * @instance
     * @param {Array<*>} [extent]
     * @returns {Chart}
     */
    _chart.zoomScale = function (extent) {
        if (!arguments.length) {
            return _zoomScale;
        }
        _zoomScale = extent;
        return _chart;
    };

    /**
     * Get or set the zoom restriction for the chart. If true limits the zoom to origional domain of the chart.
     * @name zoomOutRestrict
     * @memberof dc.coordinateGridMixin
     * @instance
     * @param {Boolean} [zoomOutRestrict=true]
     * @returns {Chart}
     */
    _chart.zoomOutRestrict = function (zoomOutRestrict) {
        if (!arguments.length) {
            return _zoomOutRestrict;
        }
        _zoomScale[0] = zoomOutRestrict ? 1 : 0;
        _zoomOutRestrict = zoomOutRestrict;
        return _chart;
    };

    _chart._generateG = function (parent) {
        if (parent === undefined) {
            _parent = _chart.svg();
        } else {
            _parent = parent;
        }

        _g = _parent.append('g');

        _chartBodyG = _g.append('g').attr('class', 'chart-body')
            .attr('transform', 'translate(' + _chart.margins().left + ', ' + _chart.margins().top + ')')
            .attr('clip-path', 'url(#' + getClipPathId() + ')');

        return _g;
    };

    /**
     * Get or set the root g element. This method is usually used to retrieve the g element in order to
     * overlay custom svg drawing programatically. **Caution**: The root g element is usually generated
     * by dc.js internals, and resetting it might produce unpredictable result.
     * @name g
     * @memberof dc.coordinateGridMixin
     * @instance
     * @param {svg} [gElement]
     * @returns {Chart}
     */
    _chart.g = function (gElement) {
        if (!arguments.length) {
            return _g;
        }
        _g = gElement;
        return _chart;
    };

    /**
     * Set or get mouse zoom capability flag (default: false). When turned on the chart will be
     * zoomable using the mouse wheel. If the range selector chart is attached zooming will also update
     * the range selection brush on the associated range selector chart.
     * @name mouseZoomable
     * @memberof dc.coordinateGridMixin
     * @instance
     * @param {Boolean} [mouseZoomable]
     * @returns {Chart}
     */
    _chart.mouseZoomable = function (mouseZoomable) {
        if (!arguments.length) {
            return _mouseZoomable;
        }
        _mouseZoomable = mouseZoomable;
        return _chart;
    };

    /**
     * Retrieve the svg group for the chart body.
     * @name chartBodyG
     * @memberof dc.coordinateGridMixin
     * @instance
     * @param {svg} [chartBodyG]
     * @returns {Chart}
     */
    _chart.chartBodyG = function (chartBodyG) {
        if (!arguments.length) {
            return _chartBodyG;
        }
        _chartBodyG = chartBodyG;
        return _chart;
    };

    /**
     * **mandatory**
     *
     * Get or set the x scale. The x scale can be any d3
     * [quantitive scale](https://github.com/mbostock/d3/wiki/Quantitative-Scales) or
     * [ordinal scale](https://github.com/mbostock/d3/wiki/Ordinal-Scales).
     * @name x
     * @memberof dc.coordinateGridMixin
     * @instance
     * @example
     * // set x to a linear scale
     * chart.x(d3.scale.linear().domain([-2500, 2500]))
     * // set x to a time scale to generate histogram
     * chart.x(d3.time.scale().domain([new Date(1985, 0, 1), new Date(2012, 11, 31)]))
     * @param {d3.scale} [xScale]
     * @returns {Chart}
     */
    _chart.x = function (xScale) {
        if (!arguments.length) {
            return _x;
        }
        _x = xScale;
        _xOriginalDomain = _x.domain();
        _chart.rescale();
        return _chart;
    };

    _chart.xOriginalDomain = function () {
        return _xOriginalDomain;
    };

    /**
     * Set or get the xUnits function. The coordinate grid chart uses the xUnits function to calculate
     * the number of data projections on x axis such as the number of bars for a bar chart or the
     * number of dots for a line chart. This function is expected to return a Javascript array of all
     * data points on x axis, or the number of points on the axis. [d3 time range functions
     * d3.time.days, d3.time.months, and
     * d3.time.years](https://github.com/mbostock/d3/wiki/Time-Intervals#aliases) are all valid xUnits
     * function. dc.js also provides a few units function, see the [Utilities](#utilities) section for
     * a list of built-in units functions. The default xUnits function is dc.units.integers.
     * @name xUnits
     * @memberof dc.coordinateGridMixin
     * @instance
     * @example
     * // set x units to count days
     * chart.xUnits(d3.time.days);
     * // set x units to count months
     * chart.xUnits(d3.time.months);
     *
     * // A custom xUnits function can be used as long as it follows the following interface:
     * // units in integer
     * function(start, end, xDomain) {
     *      // simply calculates how many integers in the domain
     *      return Math.abs(end - start);
     * };
     *
     * // fixed units
     * function(start, end, xDomain) {
     *      // be aware using fixed units will disable the focus/zoom ability on the chart
     *      return 1000;
     * @param {Function} [xUnits]
     * @returns {Chart}
     */
    _chart.xUnits = function (xUnits) {
        if (!arguments.length) {
            return _xUnits;
        }
        _xUnits = xUnits;
        return _chart;
    };

    /**
     * Set or get the x axis used by a particular coordinate grid chart instance. This function is most
     * useful when x axis customization is required. The x axis in dc.js is an instance of a [d3
     * axis object](https://github.com/mbostock/d3/wiki/SVG-Axes#wiki-axis); therefore it supports any
     * valid d3 axis manipulation. **Caution**: The x axis is usually generated internally by dc;
     * resetting it may cause unexpected results.
     * @name xAxis
     * @memberof dc.coordinateGridMixin
     * @instance
     * @example
     * // customize x axis tick format
     * chart.xAxis().tickFormat(function(v) {return v + '%';});
     * // customize x axis tick values
     * chart.xAxis().tickValues([0, 100, 200, 300]);
     * @param {d3.svg.axis} [xAxis]
     * @returns {Chart}
     */
    _chart.xAxis = function (xAxis) {
        if (!arguments.length) {
            return _xAxis;
        }
        _xAxis = xAxis;
        return _chart;
    };

    /**
     * Turn on/off elastic x axis behavior. If x axis elasticity is turned on, then the grid chart will
     * attempt to recalculate the x axis range whenever a redraw event is triggered.
     * @name elasticX
     * @memberof dc.coordinateGridMixin
     * @instance
     * @param {Boolean} [elasticX=false]
     * @returns {Chart}
     */
    _chart.elasticX = function (elasticX) {
        if (!arguments.length) {
            return _xElasticity;
        }
        _xElasticity = elasticX;
        return _chart;
    };

    /**
     * Set or get x axis padding for the elastic x axis. The padding will be added to both end of the x
     * axis if elasticX is turned on; otherwise it is ignored.
     *
     * padding can be an integer or percentage in string (e.g. '10%'). Padding can be applied to
     * number or date x axes.  When padding a date axis, an integer represents number of days being padded
     * and a percentage string will be treated the same as an integer.
     * @name xAxisPadding
     * @memberof dc.coordinateGridMixin
     * @instance
     * @param {Number|String} [padding]
     * @returns {Chart}
     */
    _chart.xAxisPadding = function (padding) {
        if (!arguments.length) {
            return _xAxisPadding;
        }
        _xAxisPadding = padding;
        return _chart;
    };

    /**
     * Returns the number of units displayed on the x axis using the unit measure configured by
     * .xUnits.
     * @name xUnitCount
     * @memberof dc.coordinateGridMixin
     * @instance
     * @returns {Number}
     */
    _chart.xUnitCount = function () {
        if (_unitCount === undefined) {
            var units = _chart.xUnits()(_chart.x().domain()[0], _chart.x().domain()[1], _chart.x().domain());

            if (units instanceof Array) {
                _unitCount = units.length;
            } else {
                _unitCount = units;
            }
        }

        return _unitCount;
    };

    /**
     * Gets or sets whether the chart should be drawn with a right axis instead of a left axis. When
     * used with a chart in a composite chart, allows both left and right Y axes to be shown on a
     * chart.
     * @name useRightYAxis
     * @memberof dc.coordinateGridMixin
     * @instance
     * @param {Boolean} [useRightYAxis=false]
     * @returns {Chart}
     */
    _chart.useRightYAxis = function (useRightYAxis) {
        if (!arguments.length) {
            return _useRightYAxis;
        }
        _useRightYAxis = useRightYAxis;
        return _chart;
    };

    /**
     * Returns true if the chart is using ordinal xUnits ([dc.units.ordinal](#dcunitsordinal)), or false
     * otherwise. Most charts behave differently with ordinal data and use the result of this method to
     * trigger the appropriate logic.
     * @name isOrdinal
     * @memberof dc.coordinateGridMixin
     * @instance
     * @returns {Boolean}
     */
    _chart.isOrdinal = function () {
        return _chart.xUnits() === dc.units.ordinal;
    };

    _chart._useOuterPadding = function () {
        return true;
    };

    _chart._ordinalXDomain = function () {
        var groups = _chart._computeOrderedGroups(_chart.data());
        return groups.map(_chart.keyAccessor());
    };

    function compareDomains (d1, d2) {
        return !d1 || !d2 || d1.length !== d2.length ||
            d1.some(function (elem, i) { return elem.toString() !== d2[i].toString(); });
    }

    function prepareXAxis (g, render) {
        if (!_chart.isOrdinal()) {
            if (_chart.elasticX()) {
                _x.domain([_chart.xAxisMin(), _chart.xAxisMax()]);
            }
        } else { // _chart.isOrdinal()
            if (_chart.elasticX() || _x.domain().length === 0) {
                _x.domain(_chart._ordinalXDomain());
            }
        }

        // has the domain changed?
        var xdom = _x.domain();
        if (render || compareDomains(_lastXDomain, xdom)) {
            _chart.rescale();
        }
        _lastXDomain = xdom;

        // please can't we always use rangeBands for bar charts?
        if (_chart.isOrdinal()) {
            _x.rangeBands([0, _chart.xAxisLength()], _rangeBandPadding,
                          _chart._useOuterPadding() ? _outerRangeBandPadding : 0);
        } else {
            _x.range([0, _chart.xAxisLength()]);
        }

        _xAxis = _xAxis.scale(_chart.x());

        renderVerticalGridLines(g);
    }

    _chart.renderXAxis = function (g) {
        var axisXG = g.selectAll('g.x');

        if (axisXG.empty()) {
            axisXG = g.append('g')
                .attr('class', 'axis x')
                .attr('transform', 'translate(' + _chart.margins().left + ',' + _chart._xAxisY() + ')');
        }

        var axisXLab = g.selectAll('text.' + X_AXIS_LABEL_CLASS);
        if (axisXLab.empty() && _chart.xAxisLabel()) {
            axisXLab = g.append('text')
                .attr('class', X_AXIS_LABEL_CLASS)
                .attr('transform', 'translate(' + (_chart.margins().left + _chart.xAxisLength() / 2) + ',' +
                      (_chart.height() - _xAxisLabelPadding) + ')')
                .attr('text-anchor', 'middle');
        }
        if (_chart.xAxisLabel() && axisXLab.text() !== _chart.xAxisLabel()) {
            axisXLab.text(_chart.xAxisLabel());
        }

        dc.transition(axisXG, _chart.transitionDuration())
            .attr('transform', 'translate(' + _chart.margins().left + ',' + _chart._xAxisY() + ')')
            .call(_xAxis);
        dc.transition(axisXLab, _chart.transitionDuration())
            .attr('transform', 'translate(' + (_chart.margins().left + _chart.xAxisLength() / 2) + ',' +
                  (_chart.height() - _xAxisLabelPadding) + ')');
    };

    function renderVerticalGridLines (g) {
        var gridLineG = g.selectAll('g.' + VERTICAL_CLASS);

        if (_renderVerticalGridLine) {
            if (gridLineG.empty()) {
                gridLineG = g.insert('g', ':first-child')
                    .attr('class', GRID_LINE_CLASS + ' ' + VERTICAL_CLASS)
                    .attr('transform', 'translate(' + _chart.margins().left + ',' + _chart.margins().top + ')');
            }

            var ticks = _xAxis.tickValues() ? _xAxis.tickValues() :
                    (typeof _x.ticks === 'function' ? _x.ticks(_xAxis.ticks()[0]) : _x.domain());

            var lines = gridLineG.selectAll('line')
                .data(ticks);

            // enter
            var linesGEnter = lines.enter()
                .append('line')
                .attr('x1', function (d) {
                    return _x(d);
                })
                .attr('y1', _chart._xAxisY() - _chart.margins().top)
                .attr('x2', function (d) {
                    return _x(d);
                })
                .attr('y2', 0)
                .attr('opacity', 0);
            dc.transition(linesGEnter, _chart.transitionDuration())
                .attr('opacity', 1);

            // update
            dc.transition(lines, _chart.transitionDuration())
                .attr('x1', function (d) {
                    return _x(d);
                })
                .attr('y1', _chart._xAxisY() - _chart.margins().top)
                .attr('x2', function (d) {
                    return _x(d);
                })
                .attr('y2', 0);

            // exit
            lines.exit().remove();
        } else {
            gridLineG.selectAll('line').remove();
        }
    }

    _chart._xAxisY = function () {
        return (_chart.height() - _chart.margins().bottom);
    };

    _chart.xAxisLength = function () {
        return _chart.effectiveWidth();
    };

    /**
     * Set or get the x axis label. If setting the label, you may optionally include additional padding to
     * the margin to make room for the label. By default the padded is set to 12 to accomodate the text height.
     * @name xAxisLabel
     * @memberof dc.coordinateGridMixin
     * @instance
     * @param {String} [labelText]
     * @param {Number} [padding=12]
     * @returns {Chart}
     */
    _chart.xAxisLabel = function (labelText, padding) {
        if (!arguments.length) {
            return _xAxisLabel;
        }
        _xAxisLabel = labelText;
        _chart.margins().bottom -= _xAxisLabelPadding;
        _xAxisLabelPadding = (padding === undefined) ? DEFAULT_AXIS_LABEL_PADDING : padding;
        _chart.margins().bottom += _xAxisLabelPadding;
        return _chart;
    };

    _chart._prepareYAxis = function (g) {
        if (_y === undefined || _chart.elasticY()) {
            if (_y === undefined) {
                _y = d3.scale.linear();
            }
            var min = _chart.yAxisMin() || 0,
                max = _chart.yAxisMax() || 0;
            _y.domain([min, max]).rangeRound([_chart.yAxisHeight(), 0]);
        }

        _y.range([_chart.yAxisHeight(), 0]);
        _yAxis = _yAxis.scale(_y);

        if (_useRightYAxis) {
            _yAxis.orient('right');
        }

        _chart._renderHorizontalGridLinesForAxis(g, _y, _yAxis);
    };

    _chart.renderYAxisLabel = function (axisClass, text, rotation, labelXPosition) {
        labelXPosition = labelXPosition || _yAxisLabelPadding;

        var axisYLab = _chart.g().selectAll('text.' + Y_AXIS_LABEL_CLASS + '.' + axisClass + '-label');
        var labelYPosition = (_chart.margins().top + _chart.yAxisHeight() / 2);
        if (axisYLab.empty() && text) {
            axisYLab = _chart.g().append('text')
                .attr('transform', 'translate(' + labelXPosition + ',' + labelYPosition + '),rotate(' + rotation + ')')
                .attr('class', Y_AXIS_LABEL_CLASS + ' ' + axisClass + '-label')
                .attr('text-anchor', 'middle')
                .text(text);
        }
        if (text && axisYLab.text() !== text) {
            axisYLab.text(text);
        }
        dc.transition(axisYLab, _chart.transitionDuration())
            .attr('transform', 'translate(' + labelXPosition + ',' + labelYPosition + '),rotate(' + rotation + ')');
    };

    _chart.renderYAxisAt = function (axisClass, axis, position) {
        var axisYG = _chart.g().selectAll('g.' + axisClass);
        if (axisYG.empty()) {
            axisYG = _chart.g().append('g')
                .attr('class', 'axis ' + axisClass)
                .attr('transform', 'translate(' + position + ',' + _chart.margins().top + ')');
        }

        dc.transition(axisYG, _chart.transitionDuration())
            .attr('transform', 'translate(' + position + ',' + _chart.margins().top + ')')
            .call(axis);
    };

    _chart.renderYAxis = function () {
        var axisPosition = _useRightYAxis ? (_chart.width() - _chart.margins().right) : _chart._yAxisX();
        _chart.renderYAxisAt('y', _yAxis, axisPosition);
        var labelPosition = _useRightYAxis ? (_chart.width() - _yAxisLabelPadding) : _yAxisLabelPadding;
        var rotation = _useRightYAxis ? 90 : -90;
        _chart.renderYAxisLabel('y', _chart.yAxisLabel(), rotation, labelPosition);
    };

    _chart._renderHorizontalGridLinesForAxis = function (g, scale, axis) {
        var gridLineG = g.selectAll('g.' + HORIZONTAL_CLASS);

        if (_renderHorizontalGridLine) {
            var ticks = axis.tickValues() ? axis.tickValues() : scale.ticks(axis.ticks()[0]);

            if (gridLineG.empty()) {
                gridLineG = g.insert('g', ':first-child')
                    .attr('class', GRID_LINE_CLASS + ' ' + HORIZONTAL_CLASS)
                    .attr('transform', 'translate(' + _chart.margins().left + ',' + _chart.margins().top + ')');
            }

            var lines = gridLineG.selectAll('line')
                .data(ticks);

            // enter
            var linesGEnter = lines.enter()
                .append('line')
                .attr('x1', 1)
                .attr('y1', function (d) {
                    return scale(d);
                })
                .attr('x2', _chart.xAxisLength())
                .attr('y2', function (d) {
                    return scale(d);
                })
                .attr('opacity', 0);
            dc.transition(linesGEnter, _chart.transitionDuration())
                .attr('opacity', 1);

            // update
            dc.transition(lines, _chart.transitionDuration())
                .attr('x1', 1)
                .attr('y1', function (d) {
                    return scale(d);
                })
                .attr('x2', _chart.xAxisLength())
                .attr('y2', function (d) {
                    return scale(d);
                });

            // exit
            lines.exit().remove();
        } else {
            gridLineG.selectAll('line').remove();
        }
    };

    _chart._yAxisX = function () {
        return _chart.useRightYAxis() ? _chart.width() - _chart.margins().right : _chart.margins().left;
    };

    /**
     * Set or get the y axis label. If setting the label, you may optionally include additional padding
     * to the margin to make room for the label. By default the padded is set to 12 to accomodate the
     * text height.
     * @name yAxisLabel
     * @memberof dc.coordinateGridMixin
     * @instance
     * @param {String} [labelText]
     * @param {Number} [padding=12]
     * @returns {Chart}
     */
    _chart.yAxisLabel = function (labelText, padding) {
        if (!arguments.length) {
            return _yAxisLabel;
        }
        _yAxisLabel = labelText;
        _chart.margins().left -= _yAxisLabelPadding;
        _yAxisLabelPadding = (padding === undefined) ? DEFAULT_AXIS_LABEL_PADDING : padding;
        _chart.margins().left += _yAxisLabelPadding;
        return _chart;
    };

    /**
     * Get or set the y scale. The y scale is typically automatically determined by the chart implementation.
     * @name y
     * @memberof dc.coordinateGridMixin
     * @instance
     * @param {d3.scale} [yScale]
     * @returns {Chart}
     */
    _chart.y = function (yScale) {
        if (!arguments.length) {
            return _y;
        }
        _y = yScale;
        _chart.rescale();
        return _chart;
    };

    /**
     * Set or get the y axis used by the coordinate grid chart instance. This function is most useful
     * when y axis customization is required. The y axis in dc.js is simply an instance of a [d3 axis
     * object](https://github.com/mbostock/d3/wiki/SVG-Axes#wiki-_axis); therefore it supports any
     * valid d3 axis manipulation. **Caution**: The y axis is usually generated internally by dc;
     * resetting it may cause unexpected results.
     * @name yAxis
     * @memberof dc.coordinateGridMixin
     * @instance
     * @example
     * // customize y axis tick format
     * chart.yAxis().tickFormat(function(v) {return v + '%';});
     * // customize y axis tick values
     * chart.yAxis().tickValues([0, 100, 200, 300]);
     * @param {d3.svg.axis} [yAxis=d3.svg.axis().orient('left')]
     * @returns {Chart}
     */
    _chart.yAxis = function (yAxis) {
        if (!arguments.length) {
            return _yAxis;
        }
        _yAxis = yAxis;
        return _chart;
    };

    /**
     * Turn on/off elastic y axis behavior. If y axis elasticity is turned on, then the grid chart will
     * attempt to recalculate the y axis range whenever a redraw event is triggered.
     * @name elasticY
     * @memberof dc.coordinateGridMixin
     * @instance
     * @param {Boolean} [elasticY=false]
     * @returns {Chart}
     */
    _chart.elasticY = function (elasticY) {
        if (!arguments.length) {
            return _yElasticity;
        }
        _yElasticity = elasticY;
        return _chart;
    };

    /**
     * Turn on/off horizontal grid lines.
     * @name renderHorizontalGridLines
     * @memberof dc.coordinateGridMixin
     * @instance
     * @param {Boolean} [renderHorizontalGridLines=false]
     * @returns {Chart}
     */
    _chart.renderHorizontalGridLines = function (renderHorizontalGridLines) {
        if (!arguments.length) {
            return _renderHorizontalGridLine;
        }
        _renderHorizontalGridLine = renderHorizontalGridLines;
        return _chart;
    };

    /**
     * Turn on/off vertical grid lines.
     * @name renderVerticalGridLines
     * @memberof dc.coordinateGridMixin
     * @instance
     * @param {Boolean} [renderVerticalGridLines=false]
     * @returns {Chart}
     */
    _chart.renderVerticalGridLines = function (renderVerticalGridLines) {
        if (!arguments.length) {
            return _renderVerticalGridLine;
        }
        _renderVerticalGridLine = renderVerticalGridLines;
        return _chart;
    };

    /**
     * Calculates the minimum x value to display in the chart. Includes xAxisPadding if set.
     * @name xAxisMin
     * @memberof dc.coordinateGridMixin
     * @instance
     * @returns {*}
     */
    _chart.xAxisMin = function () {
        var min = d3.min(_chart.data(), function (e) {
            return _chart.keyAccessor()(e);
        });
        return dc.utils.subtract(min, _xAxisPadding);
    };

    /**
     * Calculates the maximum x value to display in the chart. Includes xAxisPadding if set.
     * @name xAxisMax
     * @memberof dc.coordinateGridMixin
     * @instance
     * @returns {*}
     */
    _chart.xAxisMax = function () {
        var max = d3.max(_chart.data(), function (e) {
            return _chart.keyAccessor()(e);
        });
        return dc.utils.add(max, _xAxisPadding);
    };

    /**
     * Calculates the minimum y value to display in the chart. Includes yAxisPadding if set.
     * @name yAxisMin
     * @memberof dc.coordinateGridMixin
     * @instance
     * @returns {*}
     */
    _chart.yAxisMin = function () {
        var min = d3.min(_chart.data(), function (e) {
            return _chart.valueAccessor()(e);
        });
        return dc.utils.subtract(min, _yAxisPadding);
    };

    /**
     * Calculates the maximum y value to display in the chart. Includes yAxisPadding if set.
     * @name yAxisMax
     * @memberof dc.coordinateGridMixin
     * @instance
     * @returns {*}
     */
    _chart.yAxisMax = function () {
        var max = d3.max(_chart.data(), function (e) {
            return _chart.valueAccessor()(e);
        });
        return dc.utils.add(max, _yAxisPadding);
    };

    /**
     * Set or get y axis padding for the elastic y axis. The padding will be added to the top of the y
     * axis if elasticY is turned on; otherwise it is ignored.
     *
     * padding can be an integer or percentage in string (e.g. '10%'). Padding can be applied to
     * number or date axes. When padding a date axis, an integer represents number of days being padded
     * and a percentage string will be treated the same as an integer.
     * @name yAxisPadding
     * @memberof dc.coordinateGridMixin
     * @instance
     * @param {Number|String} [padding=0]
     * @returns {Chart}
     */
    _chart.yAxisPadding = function (padding) {
        if (!arguments.length) {
            return _yAxisPadding;
        }
        _yAxisPadding = padding;
        return _chart;
    };

    _chart.yAxisHeight = function () {
        return _chart.effectiveHeight();
    };

    /**
     * Set or get the rounding function used to quantize the selection when brushing is enabled.
     * @name round
     * @memberof dc.coordinateGridMixin
     * @instance
     * @example
     * // set x unit round to by month, this will make sure range selection brush will
     * // select whole months
     * chart.round(d3.time.month.round);
     * @param {Function} [round]
     * @returns {Chart}
     */
    _chart.round = function (round) {
        if (!arguments.length) {
            return _round;
        }
        _round = round;
        return _chart;
    };

    _chart._rangeBandPadding = function (_) {
        if (!arguments.length) {
            return _rangeBandPadding;
        }
        _rangeBandPadding = _;
        return _chart;
    };

    _chart._outerRangeBandPadding = function (_) {
        if (!arguments.length) {
            return _outerRangeBandPadding;
        }
        _outerRangeBandPadding = _;
        return _chart;
    };

    dc.override(_chart, 'filter', function (_) {
        if (!arguments.length) {
            return _chart._filter();
        }

        _chart._filter(_);

        if (_) {
            _chart.brush().extent(_);
        } else {
            _chart.brush().clear();
        }

        return _chart;
    });

    _chart.brush = function (_) {
        if (!arguments.length) {
            return _brush;
        }
        _brush = _;
        return _chart;
    };

    function brushHeight () {
        return _chart._xAxisY() - _chart.margins().top;
    }

    _chart.renderBrush = function (g) {
        if (_brushOn) {
            _brush.on('brush', _chart._brushing);
            _brush.on('brushstart', _chart._disableMouseZoom);
            _brush.on('brushend', configureMouseZoom);

            var gBrush = g.append('g')
                .attr('class', 'brush')
                .attr('transform', 'translate(' + _chart.margins().left + ',' + _chart.margins().top + ')')
                .call(_brush.x(_chart.x()));
            _chart.setBrushY(gBrush, false);
            _chart.setHandlePaths(gBrush);

            if (_chart.hasFilter()) {
                _chart.redrawBrush(g, false);
            }
        }
    };

    _chart.setHandlePaths = function (gBrush) {
        gBrush.selectAll('.resize').append('path').attr('d', _chart.resizeHandlePath);
    };

    _chart.setBrushY = function (gBrush) {
        gBrush.selectAll('.brush rect')
            .attr('height', brushHeight());
        gBrush.selectAll('.resize path')
            .attr('d', _chart.resizeHandlePath);
    };

    _chart.extendBrush = function () {
        var extent = _brush.extent();
        if (_chart.round()) {
            extent[0] = extent.map(_chart.round())[0];
            extent[1] = extent.map(_chart.round())[1];

            _g.select('.brush')
                .call(_brush.extent(extent));
        }
        return extent;
    };

    _chart.brushIsEmpty = function (extent) {
        return _brush.empty() || !extent || extent[1] <= extent[0];
    };

    _chart._brushing = function () {
        var extent = _chart.extendBrush();

        _chart.redrawBrush(_g, false);

        if (_chart.brushIsEmpty(extent)) {
            dc.events.trigger(function () {
                _chart.filter(null);
                _chart.redrawGroup();
            }, dc.constants.EVENT_DELAY);
        } else {
            var rangedFilter = dc.filters.RangedFilter(extent[0], extent[1]);

            dc.events.trigger(function () {
                _chart.replaceFilter(rangedFilter);
                _chart.redrawGroup();
            }, dc.constants.EVENT_DELAY);
        }
    };

    _chart.redrawBrush = function (g, doTransition) {
        if (_brushOn) {
            if (_chart.filter() && _chart.brush().empty()) {
                _chart.brush().extent(_chart.filter());
            }

            var gBrush = dc.optionalTransition(doTransition, _chart.transitionDuration())(g.select('g.brush'));
            _chart.setBrushY(gBrush);
            gBrush.call(_chart.brush()
                      .x(_chart.x())
                      .extent(_chart.brush().extent()));
        }

        _chart.fadeDeselectedArea();
    };

    _chart.fadeDeselectedArea = function () {
        // do nothing, sub-chart should override this function
    };

    // borrowed from Crossfilter example
    _chart.resizeHandlePath = function (d) {
        var e = +(d === 'e'), x = e ? 1 : -1, y = brushHeight() / 3;
        return 'M' + (0.5 * x) + ',' + y +
            'A6,6 0 0 ' + e + ' ' + (6.5 * x) + ',' + (y + 6) +
            'V' + (2 * y - 6) +
            'A6,6 0 0 ' + e + ' ' + (0.5 * x) + ',' + (2 * y) +
            'Z' +
            'M' + (2.5 * x) + ',' + (y + 8) +
            'V' + (2 * y - 8) +
            'M' + (4.5 * x) + ',' + (y + 8) +
            'V' + (2 * y - 8);
    };

    function getClipPathId () {
        return _chart.anchorName().replace(/[ .#=\[\]]/g, '-') + '-clip';
    }

    /**
     * Get or set the padding in pixels for the clip path. Once set padding will be applied evenly to
     * the top, left, right, and bottom when the clip path is generated. If set to zero, the clip area
     * will be exactly the chart body area minus the margins.
     * @name clipPadding
     * @memberof dc.coordinateGridMixin
     * @instance
     * @param {Number} [padding=5]
     * @returns {Chart}
     */
    _chart.clipPadding = function (padding) {
        if (!arguments.length) {
            return _clipPadding;
        }
        _clipPadding = padding;
        return _chart;
    };

    function generateClipPath () {
        var defs = dc.utils.appendOrSelect(_parent, 'defs');
        // cannot select <clippath> elements; bug in WebKit, must select by id
        // https://groups.google.com/forum/#!topic/d3-js/6EpAzQ2gU9I
        var id = getClipPathId();
        var chartBodyClip = dc.utils.appendOrSelect(defs, '#' + id, 'clipPath').attr('id', id);

        var padding = _clipPadding * 2;

        dc.utils.appendOrSelect(chartBodyClip, 'rect')
            .attr('width', _chart.xAxisLength() + padding)
            .attr('height', _chart.yAxisHeight() + padding)
            .attr('transform', 'translate(-' + _clipPadding + ', -' + _clipPadding + ')');
    }

    _chart._preprocessData = function () {};

    _chart._doRender = function () {
        _chart.resetSvg();

        _chart._preprocessData();

        _chart._generateG();
        generateClipPath();

        drawChart(true);

        configureMouseZoom();

        return _chart;
    };

    _chart._doRedraw = function () {
        _chart._preprocessData();

        drawChart(false);
        generateClipPath();

        return _chart;
    };

    function drawChart (render) {
        if (_chart.isOrdinal()) {
            _brushOn = false;
        }

        prepareXAxis(_chart.g(), render);
        _chart._prepareYAxis(_chart.g());

        _chart.plotData();

        if (_chart.elasticX() || _resizing || render) {
            _chart.renderXAxis(_chart.g());
        }

        if (_chart.elasticY() || _resizing || render) {
            _chart.renderYAxis(_chart.g());
        }

        if (render) {
            _chart.renderBrush(_chart.g(), false);
        } else {
            _chart.redrawBrush(_chart.g(), _resizing);
        }
        _chart.fadeDeselectedArea();
        _resizing = false;
    }

    function configureMouseZoom () {
        if (_mouseZoomable) {
            _chart._enableMouseZoom();
        } else if (_hasBeenMouseZoomable) {
            _chart._disableMouseZoom();
        }
    }

    _chart._enableMouseZoom = function () {
        _hasBeenMouseZoomable = true;
        _zoom.x(_chart.x())
            .scaleExtent(_zoomScale)
            .size([_chart.width(), _chart.height()])
            .duration(_chart.transitionDuration());
        _chart.root().call(_zoom);
    };

    _chart._disableMouseZoom = function () {
        _chart.root().call(_nullZoom);
    };

    function constrainRange (range, constraint) {
        var constrainedRange = [];
        constrainedRange[0] = d3.max([range[0], constraint[0]]);
        constrainedRange[1] = d3.min([range[1], constraint[1]]);
        return constrainedRange;
    }

    /**
     * Zoom this chart to focus on the given range. The given range should be an array containing only
     * 2 elements (`[start, end]`) defining a range in the x domain. If the range is not given or set
     * to null, then the zoom will be reset. _For focus to work elasticX has to be turned off;
     * otherwise focus will be ignored.
     * @name focus
     * @memberof dc.coordinateGridMixin
     * @instance
     * @example
     * chart.on('renderlet', function(chart) {
     *     // smooth the rendering through event throttling
     *     dc.events.trigger(function(){
     *          // focus some other chart to the range selected by user on this chart
     *          someOtherChart.focus(chart.filter());
     *     });
     * })
     * @param {Array<Number>} [range]
     */
    _chart.focus = function (range) {
        if (hasRangeSelected(range)) {
            _chart.x().domain(range);
        } else {
            _chart.x().domain(_xOriginalDomain);
        }

        _zoom.x(_chart.x());
        zoomHandler();
    };

    _chart.refocused = function () {
        return _refocused;
    };

    _chart.focusChart = function (c) {
        if (!arguments.length) {
            return _focusChart;
        }
        _focusChart = c;
        _chart.on('filtered', function (chart) {
            if (!chart.filter()) {
                dc.events.trigger(function () {
                    _focusChart.x().domain(_focusChart.xOriginalDomain());
                });
            } else if (!rangesEqual(chart.filter(), _focusChart.filter())) {
                dc.events.trigger(function () {
                    _focusChart.focus(chart.filter());
                });
            }
        });
        return _chart;
    };

    function rangesEqual (range1, range2) {
        if (!range1 && !range2) {
            return true;
        } else if (!range1 || !range2) {
            return false;
        } else if (range1.length === 0 && range2.length === 0) {
            return true;
        } else if (range1[0].valueOf() === range2[0].valueOf() &&
            range1[1].valueOf() === range2[1].valueOf()) {
            return true;
        }
        return false;
    }

    /**
     * Turn on/off the brush-based range filter. When brushing is on then user can drag the mouse
     * across a chart with a quantitative scale to perform range filtering based on the extent of the
     * brush, or click on the bars of an ordinal bar chart or slices of a pie chart to filter and
     * unfilter them. However turning on the brush filter will disable other interactive elements on
     * the chart such as highlighting, tool tips, and reference lines. Zooming will still be possible
     * if enabled, but only via scrolling (panning will be disabled.)
     * @name brushOn
     * @memberof dc.coordinateGridMixin
     * @instance
     * @param {Boolean} [brushOn=true]
     * @return {Chart}
     */
    _chart.brushOn = function (brushOn) {
        if (!arguments.length) {
            return _brushOn;
        }
        _brushOn = brushOn;
        return _chart;
    };

    function hasRangeSelected (range) {
        return range instanceof Array && range.length > 1;
    }

    return _chart;
};

/**
 * Stack Mixin is an mixin that provides cross-chart support of stackability using d3.layout.stack.
 * @name stackMixin
 * @memberof dc
 * @mixin
 * @param {Chart} _chart
 * @returns {Chart}
 */
dc.stackMixin = function (_chart) {

    function prepareValues (layer, layerIdx) {
        var valAccessor = layer.accessor || _chart.valueAccessor();
        layer.name = String(layer.name || layerIdx);
        layer.values = layer.group.all().map(function (d, i) {
            return {
                x: _chart.keyAccessor()(d, i),
                y: layer.hidden ? null : valAccessor(d, i),
                data: d,
                layer: layer.name,
                hidden: layer.hidden
            };
        });

        layer.values = layer.values.filter(domainFilter());
        return layer.values;
    }

    var _stackLayout = d3.layout.stack()
        .values(prepareValues);

    var _stack = [];
    var _titles = {};

    var _hidableStacks = false;

    function domainFilter () {
        if (!_chart.x()) {
            return d3.functor(true);
        }
        var xDomain = _chart.x().domain();
        if (_chart.isOrdinal()) {
            // TODO #416
            //var domainSet = d3.set(xDomain);
            return function () {
                return true; //domainSet.has(p.x);
            };
        }
        if (_chart.elasticX()) {
            return function () { return true; };
        }
        return function (p) {
            //return true;
            return p.x >= xDomain[0] && p.x <= xDomain[xDomain.length - 1];
        };
    }

    /**
     * Stack a new crossfilter group onto this chart with an optional custom value accessor. All stacks
     * in the same chart will share the same key accessor and therefore the same set of keys.
     *
     * For example, in a stacked bar chart, the bars of each stack will be positioned using the same set
     * of keys on the x axis, while stacked vertically. If name is specified then it will be used to
     * generate the legend label.
     * @name stack
     * @memberof dc.stackMixin
     * @instance
     * @example
     * // stack group using default accessor
     * chart.stack(valueSumGroup)
     * // stack group using custom accessor
     * .stack(avgByDayGroup, function(d){return d.value.avgByDay;});
     * @param {CrossfilterGroup} group
     * @param {String} [name]
     * @param {Function} [accessor]
     * @returns {Chart}
     */
    _chart.stack = function (group, name, accessor) {
        if (!arguments.length) {
            return _stack;
        }

        if (arguments.length <= 2) {
            accessor = name;
        }

        var layer = {group: group};
        if (typeof name === 'string') {
            layer.name = name;
        }
        if (typeof accessor === 'function') {
            layer.accessor = accessor;
        }
        _stack.push(layer);

        return _chart;
    };

    dc.override(_chart, 'group', function (g, n, f) {
        if (!arguments.length) {
            return _chart._group();
        }
        _stack = [];
        _titles = {};
        _chart.stack(g, n);
        if (f) {
            _chart.valueAccessor(f);
        }
        return _chart._group(g, n);
    });

    /**
     * Allow named stacks to be hidden or shown by clicking on legend items.
     * This does not affect the behavior of hideStack or showStack.
     * @name hidableStacks
     * @memberof dc.stackMixin
     * @instance
     * @param {Boolean} hidableStacks
     * @returns {Chart}
     */
    _chart.hidableStacks = function (hidableStacks) {
        if (!arguments.length) {
            return _hidableStacks;
        }
        _hidableStacks = hidableStacks;
        return _chart;
    };

    function findLayerByName (n) {
        var i = _stack.map(dc.pluck('name')).indexOf(n);
        return _stack[i];
    }

    /**
     * Hide all stacks on the chart with the given name.
     * The chart must be re-rendered for this change to appear.
     * @name hideStack
     * @memberof dc.stackMixin
     * @instance
     * @param {String} stackName
     * @returns {Chart}
     */
    _chart.hideStack = function (stackName) {
        var layer = findLayerByName(stackName);
        if (layer) {
            layer.hidden = true;
        }
        return _chart;
    };

    /**
     * Show all stacks on the chart with the given name.
     * The chart must be re-rendered for this change to appear.
     * @name showStack
     * @memberof dc.stackMixin
     * @instance
     * @param {String} stackName
     * @returns {Chart}
     */
    _chart.showStack = function (stackName) {
        var layer = findLayerByName(stackName);
        if (layer) {
            layer.hidden = false;
        }
        return _chart;
    };

    _chart.getValueAccessorByIndex = function (index) {
        return _stack[index].accessor || _chart.valueAccessor();
    };

    _chart.yAxisMin = function () {
        var min = d3.min(flattenStack(), function (p) {
            return (p.y + p.y0 < p.y0) ? (p.y + p.y0) : p.y0;
        });

        return dc.utils.subtract(min, _chart.yAxisPadding());

    };

    _chart.yAxisMax = function () {
        var max = d3.max(flattenStack(), function (p) {
            return p.y + p.y0;
        });

        return dc.utils.add(max, _chart.yAxisPadding());
    };

    function flattenStack () {
        var valueses = _chart.data().map(function (layer) { return layer.values; });
        return Array.prototype.concat.apply([], valueses);
    }

    _chart.xAxisMin = function () {
        var min = d3.min(flattenStack(), dc.pluck('x'));
        return dc.utils.subtract(min, _chart.xAxisPadding());
    };

    _chart.xAxisMax = function () {
        var max = d3.max(flattenStack(), dc.pluck('x'));
        return dc.utils.add(max, _chart.xAxisPadding());
    };

    /**
     * Set or get the title function. Chart class will use this function to render svg title (usually interpreted by
     * browser as tooltips) for each child element in the chart, i.e. a slice in a pie chart or a bubble in a bubble chart.
     * Almost every chart supports title function however in grid coordinate chart you need to turn off brush in order to
     * use title otherwise the brush layer will block tooltip trigger.
     *
     * If the first argument is a stack name, the title function will get or set the title for that stack. If stackName
     * is not provided, the first stack is implied.
     * @name title
     * @memberof dc.stackMixin
     * @instance
     * @example
     * // set a title function on 'first stack'
     * chart.title('first stack', function(d) { return d.key + ': ' + d.value; });
     * // get a title function from 'second stack'
     * var secondTitleFunction = chart.title('second stack');
     * @param {String} [stackName]
     * @param {Function} [titleAccessor]
     * @returns {Chart}
     */
    dc.override(_chart, 'title', function (stackName, titleAccessor) {
        if (!stackName) {
            return _chart._title();
        }

        if (typeof stackName === 'function') {
            return _chart._title(stackName);
        }
        if (stackName === _chart._groupName && typeof titleAccessor === 'function') {
            return _chart._title(titleAccessor);
        }

        if (typeof titleAccessor !== 'function') {
            return _titles[stackName] || _chart._title();
        }

        _titles[stackName] = titleAccessor;

        return _chart;
    });

    /**
     * Gets or sets the stack layout algorithm, which computes a baseline for each stack and
     * propagates it to the next
     * @name stackLayout
     * @memberof dc.stackMixin
     * @instance
     * @param {Function} [stack=d3.layout.stack]
     * @returns {Chart}
     */
    _chart.stackLayout = function (stack) {
        if (!arguments.length) {
            return _stackLayout;
        }
        _stackLayout = stack;
        return _chart;
    };

    function visability (l) {
        return !l.hidden;
    }

    _chart.data(function () {
        var layers = _stack.filter(visability);
        return layers.length ? _chart.stackLayout()(layers) : [];
    });

    _chart._ordinalXDomain = function () {
        var flat = flattenStack().map(dc.pluck('data'));
        var ordered = _chart._computeOrderedGroups(flat);
        return ordered.map(_chart.keyAccessor());
    };

    _chart.colorAccessor(function (d) {
        var layer = this.layer || this.name || d.name || d.layer;
        return layer;
    });

    _chart.legendables = function () {
        return _stack.map(function (layer, i) {
            return {
                chart: _chart,
                name: layer.name,
                hidden: layer.hidden || false,
                color: _chart.getColor.call(layer, layer.values, i)
            };
        });
    };

    _chart.isLegendableHidden = function (d) {
        var layer = findLayerByName(d.name);
        return layer ? layer.hidden : false;
    };

    _chart.legendToggle = function (d) {
        if (_hidableStacks) {
            if (_chart.isLegendableHidden(d)) {
                _chart.showStack(d.name);
            } else {
                _chart.hideStack(d.name);
            }
            //_chart.redraw();
            _chart.renderGroup();
        }
    };

    return _chart;
};

/**
 * Cap is a mixin that groups small data elements below a _cap_ into an *others* grouping for both the
 * Row and Pie Charts.
 *
 * The top ordered elements in the group up to the cap amount will be kept in the chart, and the rest
 * will be replaced with an *others* element, with value equal to the sum of the replaced values. The
 * keys of the elements below the cap limit are recorded in order to filter by those keys when the
 * others* element is clicked.
 * @name capMixin
 * @memberof dc
 * @mixin
 * @param {Chart} _chart
 * @returns {Chart}
 */
dc.capMixin = function (_chart) {

    var _cap = Infinity;

    var _othersLabel = 'Others';

    var _othersGrouper = function (topRows) {
        var topRowsSum = d3.sum(topRows, _chart.valueAccessor()),
            allRows = _chart.group().all(),
            allRowsSum = d3.sum(allRows, _chart.valueAccessor()),
            topKeys = topRows.map(_chart.keyAccessor()),
            allKeys = allRows.map(_chart.keyAccessor()),
            topSet = d3.set(topKeys),
            others = allKeys.filter(function (d) {return !topSet.has(d);});
        if (allRowsSum > topRowsSum) {
            return topRows.concat([{'others': others, 'key': _othersLabel, 'value': allRowsSum - topRowsSum}]);
        }
        return topRows;
    };

    _chart.cappedKeyAccessor = function (d, i) {
        if (d.others) {
            return d.key;
        }
        return _chart.keyAccessor()(d, i);
    };

    _chart.cappedValueAccessor = function (d, i) {
        if (d.others) {
            return d.value;
        }
        return _chart.valueAccessor()(d, i);
    };

    _chart.data(function (group) {
        if (_cap === Infinity) {
            return _chart._computeOrderedGroups(group.all());
        } else {
            var topRows = group.top(_cap); // ordered by crossfilter group order (default value)
            topRows = _chart._computeOrderedGroups(topRows); // re-order using ordering (default key)
            if (_othersGrouper) {
                return _othersGrouper(topRows);
            }
            return topRows;
        }
    });

    /**
     * Get or set the count of elements to that will be included in the cap.
     * @name cap
     * @memberof dc.capMixin
     * @instance
     * @param {Number} [count=Infinity]
     * @returns {Number}
     */
    _chart.cap = function (count) {
        if (!arguments.length) {
            return _cap;
        }
        _cap = count;
        return _chart;
    };

    /**
     * Get or set the label for *Others* slice when slices cap is specified
     * @name othersLabel
     * @memberof dc.capMixin
     * @instance
     * @param {String} [label=Others]
     * @returns {String}
     */
    _chart.othersLabel = function (label) {
        if (!arguments.length) {
            return _othersLabel;
        }
        _othersLabel = label;
        return _chart;
    };

    /**
     * Get or set the grouper function that will perform the insertion of data for the *Others* slice
     * if the slices cap is specified. If set to a falsy value, no others will be added. By default the
     * grouper function computes the sum of all values below the cap.
     * @name othersGrouper
     * @memberof dc.capMixin
     * @instance
     * @example
     * chart.othersGrouper(function (data) {
     *     // compute the value for others, presumably the sum of all values below the cap
     *     var othersSum  = yourComputeOthersValueLogic(data)
     *
     *     // the keys are needed to properly filter when the others element is clicked
     *     var othersKeys = yourComputeOthersKeysArrayLogic(data);
     *
     *     // add the others row to the dataset
     *     data.push({'key': 'Others', 'value': othersSum, 'others': othersKeys });
     *
     *     return data;
     * });
     * @param {Function} [grouperFunction]
     * @returns {Function}
     */
    _chart.othersGrouper = function (grouperFunction) {
        if (!arguments.length) {
            return _othersGrouper;
        }
        _othersGrouper = grouperFunction;
        return _chart;
    };

    dc.override(_chart, 'onClick', function (d) {
        if (d.others) {
            _chart.filter([d.others]);
        }
        _chart._onClick(d);
    });

    return _chart;
};

/**
 * This Mixin provides reusable functionalities for any chart that needs to visualize data using bubbles.
 * @name bubbleMixin
 * @memberof dc
 * @mixin
 * @mixes dc.colorMixin
 * @param {Chart} _chart
 * @returns {Chart}
 */
dc.bubbleMixin = function (_chart) {
    var _maxBubbleRelativeSize = 0.3;
    var _minRadiusWithLabel = 10;

    _chart.BUBBLE_NODE_CLASS = 'node';
    _chart.BUBBLE_CLASS = 'bubble';
    _chart.MIN_RADIUS = 10;

    _chart = dc.colorMixin(_chart);

    _chart.renderLabel(true);

    _chart.data(function (group) {
        return group.top(Infinity);
    });

    var _r = d3.scale.linear().domain([0, 100]);

    var _rValueAccessor = function (d) {
        return d.r;
    };

    /**
     * Get or set the bubble radius scale. By default the bubble chart uses
     * `d3.scale.linear().domain([0, 100])` as its radius scale.
     * @name r
     * @memberof dc.bubbleMixin
     * @instance
     * @param {Number[]} [bubbleRadiusScale]
     * @returns {Number[]}
     */
    _chart.r = function (bubbleRadiusScale) {
        if (!arguments.length) {
            return _r;
        }
        _r = bubbleRadiusScale;
        return _chart;
    };

    /**
     * Get or set the radius value accessor function. If set, the radius value accessor function will
     * be used to retrieve a data value for each bubble. The data retrieved then will be mapped using
     * the r scale to the actual bubble radius. This allows you to encode a data dimension using bubble
     * size.
     * @name radiusValueAccessor
     * @memberof dc.bubbleMixin
     * @instance
     * @param {Function} [radiusValueAccessor]
     * @returns {Function}
     */
    _chart.radiusValueAccessor = function (radiusValueAccessor) {
        if (!arguments.length) {
            return _rValueAccessor;
        }
        _rValueAccessor = radiusValueAccessor;
        return _chart;
    };

    _chart.rMin = function () {
        var min = d3.min(_chart.data(), function (e) {
            return _chart.radiusValueAccessor()(e);
        });
        return min;
    };

    _chart.rMax = function () {
        var max = d3.max(_chart.data(), function (e) {
            return _chart.radiusValueAccessor()(e);
        });
        return max;
    };

    _chart.bubbleR = function (d) {
        var value = _chart.radiusValueAccessor()(d);
        var r = _chart.r()(value);
        if (isNaN(r) || value <= 0) {
            r = 0;
        }
        return r;
    };

    var labelFunction = function (d) {
        return _chart.label()(d);
    };

    var labelOpacity = function (d) {
        return (_chart.bubbleR(d) > _minRadiusWithLabel) ? 1 : 0;
    };

    _chart._doRenderLabel = function (bubbleGEnter) {
        if (_chart.renderLabel()) {
            var label = bubbleGEnter.select('text');

            if (label.empty()) {
                label = bubbleGEnter.append('text')
                    .attr('text-anchor', 'middle')
                    .attr('dy', '.3em')
                    .on('click', _chart.onClick);
            }

            label
                .attr('opacity', 0)
                .text(labelFunction);
            dc.transition(label, _chart.transitionDuration())
                .attr('opacity', labelOpacity);
        }
    };

    _chart.doUpdateLabels = function (bubbleGEnter) {
        if (_chart.renderLabel()) {
            var labels = bubbleGEnter.selectAll('text')
                .text(labelFunction);
            dc.transition(labels, _chart.transitionDuration())
                .attr('opacity', labelOpacity);
        }
    };

    var titleFunction = function (d) {
        return _chart.title()(d);
    };

    _chart._doRenderTitles = function (g) {
        if (_chart.renderTitle()) {
            var title = g.select('title');

            if (title.empty()) {
                g.append('title').text(titleFunction);
            }
        }
    };

    _chart.doUpdateTitles = function (g) {
        if (_chart.renderTitle()) {
            g.selectAll('title').text(titleFunction);
        }
    };

    /**
     * Get or set the minimum radius. This will be used to initialize the radius scale's range.
     * @name minRadius
     * @memberof dc.bubbleMixin
     * @instance
     * @param {Number} [radius=10]
     * @returns {Number}
     */
    _chart.minRadius = function (radius) {
        if (!arguments.length) {
            return _chart.MIN_RADIUS;
        }
        _chart.MIN_RADIUS = radius;
        return _chart;
    };

    /**
     * Get or set the minimum radius for label rendering. If a bubble's radius is less than this value
     * then no label will be rendered.
     * @name minRadiusWithLabel
     * @memberof dc.bubbleMixin
     * @instance
     * @param {Number} [radius=10]
     * @returns {Number}
     */

    _chart.minRadiusWithLabel = function (radius) {
        if (!arguments.length) {
            return _minRadiusWithLabel;
        }
        _minRadiusWithLabel = radius;
        return _chart;
    };

    /**
     * Get or set the maximum relative size of a bubble to the length of x axis. This value is useful
     * when the difference in radius between bubbles is too great.
     * @name maxBubbleRelativeSize
     * @memberof dc.bubbleMixin
     * @instance
     * @param {Number} [relativeSize=0.3]
     * @returns {Number}
     */
    _chart.maxBubbleRelativeSize = function (relativeSize) {
        if (!arguments.length) {
            return _maxBubbleRelativeSize;
        }
        _maxBubbleRelativeSize = relativeSize;
        return _chart;
    };

    _chart.fadeDeselectedArea = function () {
        if (_chart.hasFilter()) {
            _chart.selectAll('g.' + _chart.BUBBLE_NODE_CLASS).each(function (d) {
                if (_chart.isSelectedNode(d)) {
                    _chart.highlightSelected(this);
                } else {
                    _chart.fadeDeselected(this);
                }
            });
        } else {
            _chart.selectAll('g.' + _chart.BUBBLE_NODE_CLASS).each(function () {
                _chart.resetHighlight(this);
            });
        }
    };

    _chart.isSelectedNode = function (d) {
        return _chart.hasFilter(d.key);
    };

    _chart.onClick = function (d) {
        var filter = d.key;
        dc.events.trigger(function () {
            _chart.filter(filter);
            _chart.redrawGroup();
        });
    };

    return _chart;
};

/**
 * The pie chart implementation is usually used to visualize a small categorical distribution.  The pie
 * chart uses keyAccessor to determine the slices, and valueAccessor to calculate the size of each
 * slice relative to the sum of all values. Slices are ordered by `.ordering` which defaults to sorting
 * by key.
 * @name pieChart
 * @memberof dc
 * @mixes dc.capMixin
 * @mixes dc.colorMixin
 * @mixes dc.baseMixin
 * @example
 * // create a pie chart under #chart-container1 element using the default global chart group
 * var chart1 = dc.pieChart('#chart-container1');
 * // create a pie chart under #chart-container2 element using chart group A
 * var chart2 = dc.pieChart('#chart-container2', 'chartGroupA');
 * @param {String|node|d3.selection|dc.compositeChart} parent - Any valid
 * [d3 single selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying
 * a dom block element such as a div; or a dom element or d3 selection.  If the bar chart is a sub-chart
 * in a [Composite Chart](#composite-chart) then pass in the parent composite chart instance.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @returns {PieChart}
 */
dc.pieChart = function (parent, chartGroup) {
    var DEFAULT_MIN_ANGLE_FOR_LABEL = 0.5;

    var _sliceCssClass = 'pie-slice';
    var _emptyCssClass = 'empty-chart';
    var _emptyTitle = 'empty';

    var _radius,
        _givenRadius, // specified radius, if any
        _innerRadius = 0,
        _externalRadiusPadding = 0;

    var _g;
    var _cx;
    var _cy;
    var _minAngleForLabel = DEFAULT_MIN_ANGLE_FOR_LABEL;
    var _externalLabelRadius;
    var _chart = dc.capMixin(dc.colorMixin(dc.baseMixin({})));

    _chart.colorAccessor(_chart.cappedKeyAccessor);

    _chart.title(function (d) {
        return _chart.cappedKeyAccessor(d) + ': ' + _chart.cappedValueAccessor(d);
    });

    /**
     * Get or set the maximum number of slices the pie chart will generate. The top slices are determined by
     * value from high to low. Other slices exeeding the cap will be rolled up into one single *Others* slice.
     * @name slicesCap
     * @memberof dc.pieChart
     * @instance
     * @param {Number} [cap]
     * @returns {Chart}
     */
    _chart.slicesCap = _chart.cap;

    _chart.label(_chart.cappedKeyAccessor);
    _chart.renderLabel(true);

    _chart.transitionDuration(350);

    _chart._doRender = function () {
        _chart.resetSvg();

        _g = _chart.svg()
            .append('g')
            .attr('transform', 'translate(' + _chart.cx() + ',' + _chart.cy() + ')');

        drawChart();

        return _chart;
    };

    function drawChart () {
        // set radius on basis of chart dimension if missing
        _radius = _givenRadius ? _givenRadius : d3.min([_chart.width(), _chart.height()]) / 2;

        var arc = buildArcs();

        var pie = pieLayout();
        var pieData;
        // if we have data...
        if (d3.sum(_chart.data(), _chart.valueAccessor())) {
            pieData = pie(_chart.data());
            _g.classed(_emptyCssClass, false);
        } else {
            // otherwise we'd be getting NaNs, so override
            // note: abuse others for its ignoring the value accessor
            pieData = pie([{key: _emptyTitle, value: 1, others: [_emptyTitle]}]);
            _g.classed(_emptyCssClass, true);
        }

        if (_g) {
            var slices = _g.selectAll('g.' + _sliceCssClass)
                .data(pieData);

            createElements(slices, arc, pieData);

            updateElements(pieData, arc);

            removeElements(slices);

            highlightFilter();

            dc.transition(_g, _chart.transitionDuration())
                .attr('transform', 'translate(' + _chart.cx() + ',' + _chart.cy() + ')');
        }
    }

    function createElements (slices, arc, pieData) {
        var slicesEnter = createSliceNodes(slices);

        createSlicePath(slicesEnter, arc);

        createTitles(slicesEnter);

        createLabels(pieData, arc);
    }

    function createSliceNodes (slices) {
        var slicesEnter = slices
            .enter()
            .append('g')
            .attr('class', function (d, i) {
                return _sliceCssClass + ' _' + i;
            });
        return slicesEnter;
    }

    function createSlicePath (slicesEnter, arc) {
        var slicePath = slicesEnter.append('path')
            .attr('fill', fill)
            .on('click', onClick)
            .attr('d', function (d, i) {
                return safeArc(d, i, arc);
            });

        dc.transition(slicePath, _chart.transitionDuration(), function (s) {
            s.attrTween('d', tweenPie);
        });
    }

    function createTitles (slicesEnter) {
        if (_chart.renderTitle()) {
            slicesEnter.append('title').text(function (d) {
                return _chart.title()(d.data);
            });
        }
    }

    function positionLabels (labelsEnter, arc) {
        dc.transition(labelsEnter, _chart.transitionDuration())
            .attr('transform', function (d) {
                return labelPosition(d, arc);
            })
            .attr('text-anchor', 'middle')
            .text(function (d) {
                var data = d.data;
                if ((sliceHasNoData(data) || sliceTooSmall(d)) && !isSelectedSlice(d)) {
                    return '';
                }
                return _chart.label()(d.data);
            });
    }

    function createLabels (pieData, arc) {
        if (_chart.renderLabel()) {
            var labels = _g.selectAll('text.' + _sliceCssClass)
                .data(pieData);

            labels.exit().remove();

            var labelsEnter = labels
                .enter()
                .append('text')
                .attr('class', function (d, i) {
                    var classes = _sliceCssClass + ' _' + i;
                    if (_externalLabelRadius) {
                        classes += ' external';
                    }
                    return classes;
                })
                .on('click', onClick);
            positionLabels(labelsEnter, arc);
        }
    }

    function updateElements (pieData, arc) {
        updateSlicePaths(pieData, arc);
        updateLabels(pieData, arc);
        updateTitles(pieData);
    }

    function updateSlicePaths (pieData, arc) {
        var slicePaths = _g.selectAll('g.' + _sliceCssClass)
            .data(pieData)
            .select('path')
            .attr('d', function (d, i) {
                return safeArc(d, i, arc);
            });
        dc.transition(slicePaths, _chart.transitionDuration(),
            function (s) {
                s.attrTween('d', tweenPie);
            }).attr('fill', fill);
    }

    function updateLabels (pieData, arc) {
        if (_chart.renderLabel()) {
            var labels = _g.selectAll('text.' + _sliceCssClass)
                .data(pieData);
            positionLabels(labels, arc);
        }
    }

    function updateTitles (pieData) {
        if (_chart.renderTitle()) {
            _g.selectAll('g.' + _sliceCssClass)
                .data(pieData)
                .select('title')
                .text(function (d) {
                    return _chart.title()(d.data);
                });
        }
    }

    function removeElements (slices) {
        slices.exit().remove();
    }

    function highlightFilter () {
        if (_chart.hasFilter()) {
            _chart.selectAll('g.' + _sliceCssClass).each(function (d) {
                if (isSelectedSlice(d)) {
                    _chart.highlightSelected(this);
                } else {
                    _chart.fadeDeselected(this);
                }
            });
        } else {
            _chart.selectAll('g.' + _sliceCssClass).each(function () {
                _chart.resetHighlight(this);
            });
        }
    }

    /**
     * Get or set the external radius padding of the pie chart. This will force the radius of the
     * pie chart to become smaller or larger depending on the value.
     * @name externalRadiusPadding
     * @memberof dc.pieChart
     * @instance
     * @param {Number} [externalRadiusPadding=0]
     * @returns {Chart}
     */
    _chart.externalRadiusPadding = function (externalRadiusPadding) {
        if (!arguments.length) {
            return _externalRadiusPadding;
        }
        _externalRadiusPadding = externalRadiusPadding;
        return _chart;
    };

    /**
     * Get or set the inner radius of the pie chart. If the inner radius is greater than 0px then the
     * pie chart will be rendered as a doughnut chart.
     * @name innerRadius
     * @memberof dc.pieChart
     * @instance
     * @param {Number} [innerRadius=0]
     * @returns {Chart}
     */
    _chart.innerRadius = function (innerRadius) {
        if (!arguments.length) {
            return _innerRadius;
        }
        _innerRadius = innerRadius;
        return _chart;
    };

    /**
     * Get or set the outer radius. If the radius is not set, it will be half of the minimum of the
     * chart width and height.
     * @name radius
     * @memberof dc.pieChart
     * @instance
     * @param {Number} [radius]
     * @returns {Chart}
     */
    _chart.radius = function (radius) {
        if (!arguments.length) {
            return _givenRadius;
        }
        _givenRadius = radius;
        return _chart;
    };

    /**
     * Get or set center x coordinate position. Default is center of svg.
     * @name cx
     * @memberof dc.pieChart
     * @instance
     * @param {Number} [cx]
     * @returns {Chart}
     */
    _chart.cx = function (cx) {
        if (!arguments.length) {
            return (_cx ||  _chart.width() / 2);
        }
        _cx = cx;
        return _chart;
    };

    /**
     * Get or set center y coordinate position. Default is center of svg.
     * @name cy
     * @memberof dc.pieChart
     * @instance
     * @param {Number} [cy]
     * @returns {Chart}
     */
    _chart.cy = function (cy) {
        if (!arguments.length) {
            return (_cy ||  _chart.height() / 2);
        }
        _cy = cy;
        return _chart;
    };

    function buildArcs () {
        return d3.svg.arc().outerRadius(_radius - _externalRadiusPadding).innerRadius(_innerRadius);
    }

    function isSelectedSlice (d) {
        return _chart.hasFilter(_chart.cappedKeyAccessor(d.data));
    }

    _chart._doRedraw = function () {
        drawChart();
        return _chart;
    };

    /**
     * Get or set the minimal slice angle for label rendering. Any slice with a smaller angle will not
     * display a slice label.
     * @name minAngleForLabel
     * @memberof dc.pieChart
     * @instance
     * @param {Number} [minAngleForLabel=0.5]
     * @returns {Chart}
     */
    _chart.minAngleForLabel = function (minAngleForLabel) {
        if (!arguments.length) {
            return _minAngleForLabel;
        }
        _minAngleForLabel = minAngleForLabel;
        return _chart;
    };

    function pieLayout () {
        return d3.layout.pie().sort(null).value(_chart.cappedValueAccessor);
    }

    function sliceTooSmall (d) {
        var angle = (d.endAngle - d.startAngle);
        return isNaN(angle) || angle < _minAngleForLabel;
    }

    function sliceHasNoData (d) {
        return _chart.cappedValueAccessor(d) === 0;
    }

    function tweenPie (b) {
        b.innerRadius = _innerRadius;
        var current = this._current;
        if (isOffCanvas(current)) {
            current = {startAngle: 0, endAngle: 0};
        }
        var i = d3.interpolate(current, b);
        this._current = i(0);
        return function (t) {
            return safeArc(i(t), 0, buildArcs());
        };
    }

    function isOffCanvas (current) {
        return !current || isNaN(current.startAngle) || isNaN(current.endAngle);
    }

    function fill (d, i) {
        return _chart.getColor(d.data, i);
    }

    function onClick (d, i) {
        if (_g.attr('class') !== _emptyCssClass) {
            _chart.onClick(d.data, i);
        }
    }

    function safeArc (d, i, arc) {
        var path = arc(d, i);
        if (path.indexOf('NaN') >= 0) {
            path = 'M0,0';
        }
        return path;
    }

    /**
     * Title to use for the only slice when there is no data.
     * @name emptyTitle
     * @memberof dc.pieChart
     * @instance
     * @param {String} [title]
     * @returns {Chart}
     */
    _chart.emptyTitle = function (title) {
        if (arguments.length === 0) {
            return _emptyTitle;
        }
        _emptyTitle = title;
        return _chart;
    };

    /**
     * Position slice labels offset from the outer edge of the chart
     *
     * The given argument sets the radial offset.
     * @name externalLabels
     * @memberof dc.pieChart
     * @instance
     * @param {Number} [radius]
     * @returns {Chart}
     */
    _chart.externalLabels = function (radius) {
        if (arguments.length === 0) {
            return _externalLabelRadius;
        } else if (radius) {
            _externalLabelRadius = radius;
        } else {
            _externalLabelRadius = undefined;
        }

        return _chart;
    };

    function labelPosition (d, arc) {
        var centroid;
        if (_externalLabelRadius) {
            centroid = d3.svg.arc()
                .outerRadius(_radius - _externalRadiusPadding + _externalLabelRadius)
                .innerRadius(_radius - _externalRadiusPadding + _externalLabelRadius)
                .centroid(d);
        } else {
            centroid = arc.centroid(d);
        }
        if (isNaN(centroid[0]) || isNaN(centroid[1])) {
            return 'translate(0,0)';
        } else {
            return 'translate(' + centroid + ')';
        }
    }

    _chart.legendables = function () {
        return _chart.data().map(function (d, i) {
            var legendable = {name: d.key, data: d.value, others: d.others, chart: _chart};
            legendable.color = _chart.getColor(d, i);
            return legendable;
        });
    };

    _chart.legendHighlight = function (d) {
        highlightSliceFromLegendable(d, true);
    };

    _chart.legendReset = function (d) {
        highlightSliceFromLegendable(d, false);
    };

    _chart.legendToggle = function (d) {
        _chart.onClick({key: d.name, others: d.others});
    };

    function highlightSliceFromLegendable (legendable, highlighted) {
        _chart.selectAll('g.pie-slice').each(function (d) {
            if (legendable.name === d.data.key) {
                d3.select(this).classed('highlight', highlighted);
            }
        });
    }

    return _chart.anchor(parent, chartGroup);
};

/**
 * Concrete bar chart/histogram implementation.
 * Examples:
 * - [Nasdaq 100 Index](http://dc-js.github.com/dc.js/)
 * - [Canadian City Crime Stats](http://dc-js.github.com/dc.js/crime/index.html)
 * @name barChart
 * @memberof dc
 * @mixes dc.stackMixin
 * @mixes dc.coordinateGridMixin
 * @example
 * // create a bar chart under #chart-container1 element using the default global chart group
 * var chart1 = dc.barChart('#chart-container1');
 * // create a bar chart under #chart-container2 element using chart group A
 * var chart2 = dc.barChart('#chart-container2', 'chartGroupA');
 * // create a sub-chart under a composite parent chart
 * var chart3 = dc.barChart(compositeChart);
 * @param {String|node|d3.selection|dc.compositeChart} parent - Any valid
 * [d3 single selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying
 * a dom block element such as a div; or a dom element or d3 selection.  If the bar chart is a sub-chart
 * in a [Composite Chart](#composite-chart) then pass in the parent composite chart instance.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @returns {BarChart}
 */
dc.barChart = function (parent, chartGroup) {
    var MIN_BAR_WIDTH = 1;
    var DEFAULT_GAP_BETWEEN_BARS = 2;

    var _chart = dc.stackMixin(dc.coordinateGridMixin({}));

    var _gap = DEFAULT_GAP_BETWEEN_BARS;
    var _centerBar = false;
    var _alwaysUseRounding = false;

    var _barWidth;

    dc.override(_chart, 'rescale', function () {
        _chart._rescale();
        _barWidth = undefined;
        return _chart;
    });

    dc.override(_chart, 'render', function () {
        if (_chart.round() && _centerBar && !_alwaysUseRounding) {
            dc.logger.warn('By default, brush rounding is disabled if bars are centered. ' +
                         'See dc.js bar chart API documentation for details.');
        }

        return _chart._render();
    });

    _chart.plotData = function () {
        var layers = _chart.chartBodyG().selectAll('g.stack')
            .data(_chart.data());

        calculateBarWidth();

        layers
            .enter()
            .append('g')
            .attr('class', function (d, i) {
                return 'stack ' + '_' + i;
            });

        layers.each(function (d, i) {
            var layer = d3.select(this);

            renderBars(layer, i, d);
        });
    };

    function barHeight (d) {
        return dc.utils.safeNumber(Math.abs(_chart.y()(d.y + d.y0) - _chart.y()(d.y0)));
    }

    function renderBars (layer, layerIndex, d) {
        var bars = layer.selectAll('rect.bar')
            .data(d.values, dc.pluck('x'));

        var enter = bars.enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('fill', dc.pluck('data', _chart.getColor))
            .attr('y', _chart.yAxisHeight())
            .attr('height', 0);

        if (_chart.renderTitle()) {
            enter.append('title').text(dc.pluck('data', _chart.title(d.name)));
        }

        if (_chart.isOrdinal()) {
            bars.on('click', _chart.onClick);
        }

        dc.transition(bars, _chart.transitionDuration())
            .attr('x', function (d) {
                var x = _chart.x()(d.x);
                if (_centerBar) {
                    x -= _barWidth / 2;
                }
                if (_chart.isOrdinal() && _gap !== undefined) {
                    x += _gap / 2;
                }
                return dc.utils.safeNumber(x);
            })
            .attr('y', function (d) {
                var y = _chart.y()(d.y + d.y0);

                if (d.y < 0) {
                    y -= barHeight(d);
                }

                return dc.utils.safeNumber(y);
            })
            .attr('width', _barWidth)
            .attr('height', function (d) {
                return barHeight(d);
            })
            .attr('fill', dc.pluck('data', _chart.getColor))
            .select('title').text(dc.pluck('data', _chart.title(d.name)));

        dc.transition(bars.exit(), _chart.transitionDuration())
            .attr('height', 0)
            .remove();
    }

    function calculateBarWidth () {
        if (_barWidth === undefined) {
            var numberOfBars = _chart.xUnitCount();

            // please can't we always use rangeBands for bar charts?
            if (_chart.isOrdinal() && _gap === undefined) {
                _barWidth = Math.floor(_chart.x().rangeBand());
            } else if (_gap) {
                _barWidth = Math.floor((_chart.xAxisLength() - (numberOfBars - 1) * _gap) / numberOfBars);
            } else {
                _barWidth = Math.floor(_chart.xAxisLength() / (1 + _chart.barPadding()) / numberOfBars);
            }

            if (_barWidth === Infinity || isNaN(_barWidth) || _barWidth < MIN_BAR_WIDTH) {
                _barWidth = MIN_BAR_WIDTH;
            }
        }
    }

    _chart.fadeDeselectedArea = function () {
        var bars = _chart.chartBodyG().selectAll('rect.bar');
        var extent = _chart.brush().extent();

        if (_chart.isOrdinal()) {
            if (_chart.hasFilter()) {
                bars.classed(dc.constants.SELECTED_CLASS, function (d) {
                    return _chart.hasFilter(d.x);
                });
                bars.classed(dc.constants.DESELECTED_CLASS, function (d) {
                    return !_chart.hasFilter(d.x);
                });
            } else {
                bars.classed(dc.constants.SELECTED_CLASS, false);
                bars.classed(dc.constants.DESELECTED_CLASS, false);
            }
        } else {
            if (!_chart.brushIsEmpty(extent)) {
                var start = extent[0];
                var end = extent[1];

                bars.classed(dc.constants.DESELECTED_CLASS, function (d) {
                    return d.x < start || d.x >= end;
                });
            } else {
                bars.classed(dc.constants.DESELECTED_CLASS, false);
            }
        }
    };

    /**
     * Whether the bar chart will render each bar centered around the data position on x axis
     * @name centerBar
     * @memberof dc.barChart
     * @instance
     * @param {Boolean} [centerBar=false]
     * @returns {Boolean}
     */
    _chart.centerBar = function (centerBar) {
        if (!arguments.length) {
            return _centerBar;
        }
        _centerBar = centerBar;
        return _chart;
    };

    dc.override(_chart, 'onClick', function (d) {
        _chart._onClick(d.data);
    });

    /**
     * Get or set the spacing between bars as a fraction of bar size. Valid values are between 0-1.
     * Setting this value will also remove any previously set `gap`. See the
     * [d3 docs](https://github.com/mbostock/d3/wiki/Ordinal-Scales#wiki-ordinal_rangeBands)
     * for a visual description of how the padding is applied.
     * @name barPadding
     * @memberof dc.barChart
     * @instance
     * @param {Number} [barPadding]
     * @returns {Number}
     */
    _chart.barPadding = function (barPadding) {
        if (!arguments.length) {
            return _chart._rangeBandPadding();
        }
        _chart._rangeBandPadding(barPadding);
        _gap = undefined;
        return _chart;
    };

    _chart._useOuterPadding = function () {
        return _gap === undefined;
    };

    /**
     * Get or set the outer padding on an ordinal bar chart. This setting has no effect on non-ordinal charts.
     * Will pad the width by `padding * barWidth` on each side of the chart.
     * @name outerPadding
     * @memberof dc.barChart
     * @instance
     * @param {Number} [padding=0.5]
     * @returns {Number}
     */
    _chart.outerPadding = _chart._outerRangeBandPadding;

    /**
     * Manually set fixed gap (in px) between bars instead of relying on the default auto-generated
     * gap.  By default the bar chart implementation will calculate and set the gap automatically
     * based on the number of data points and the length of the x axis.
     * @name gap
     * @memberof dc.barChart
     * @instance
     * @param {Number} [gap=2]
     * @returns {Number}
     */
    _chart.gap = function (gap) {
        if (!arguments.length) {
            return _gap;
        }
        _gap = gap;
        return _chart;
    };

    _chart.extendBrush = function () {
        var extent = _chart.brush().extent();
        if (_chart.round() && (!_centerBar || _alwaysUseRounding)) {
            extent[0] = extent.map(_chart.round())[0];
            extent[1] = extent.map(_chart.round())[1];

            _chart.chartBodyG().select('.brush')
                .call(_chart.brush().extent(extent));
        }

        return extent;
    };

    /**
     * Set or get whether rounding is enabled when bars are centered.  Default: false.  If false, using
     * rounding with centered bars will result in a warning and rounding will be ignored.  This flag
     * has no effect if bars are not centered.
     * When using standard d3.js rounding methods, the brush often doesn't align correctly with
     * centered bars since the bars are offset.  The rounding function must add an offset to
     * compensate, such as in the following example.
     * @name alwaysUseRounding
     * @memberof dc.barChart
     * @instance
     * @example
     * chart.round(function(n) {return Math.floor(n)+0.5});
     * @param {Boolean} [alwaysUseRounding=false]
     * @returns {Boolean}
     */
    _chart.alwaysUseRounding = function (alwaysUseRounding) {
        if (!arguments.length) {
            return _alwaysUseRounding;
        }
        _alwaysUseRounding = alwaysUseRounding;
        return _chart;
    };

    function colorFilter (color, inv) {
        return function () {
            var item = d3.select(this);
            var match = item.attr('fill') === color;
            return inv ? !match : match;
        };
    }

    _chart.legendHighlight = function (d) {
        if (!_chart.isLegendableHidden(d)) {
            _chart.g().selectAll('rect.bar')
                .classed('highlight', colorFilter(d.color))
                .classed('fadeout', colorFilter(d.color, true));
        }
    };

    _chart.legendReset = function () {
        _chart.g().selectAll('rect.bar')
            .classed('highlight', false)
            .classed('fadeout', false);
    };

    dc.override(_chart, 'xAxisMax', function () {
        var max = this._xAxisMax();
        if ('resolution' in _chart.xUnits()) {
            var res = _chart.xUnits().resolution;
            max += res;
        }
        return max;
    });

    return _chart.anchor(parent, chartGroup);
};

/**
 * Concrete line/area chart implementation.
 * Examples:
 * - [Nasdaq 100 Index](http://dc-js.github.com/dc.js/)
 * - [Canadian City Crime Stats](http://dc-js.github.com/dc.js/crime/index.html)
 * @name lineChart
 * @memberof dc
 * @mixes dc.stackMixin
 * @mixes dc.coordinateGridMixin
 * @example
 * // create a line chart under #chart-container1 element using the default global chart group
 * var chart1 = dc.lineChart('#chart-container1');
 * // create a line chart under #chart-container2 element using chart group A
 * var chart2 = dc.lineChart('#chart-container2', 'chartGroupA');
 * // create a sub-chart under a composite parent chart
 * var chart3 = dc.lineChart(compositeChart);
 * @param {String|node|d3.selection|dc.compositeChart} parent - Any valid
 * [d3 single selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying
 * a dom block element such as a div; or a dom element or d3 selection.  If the bar chart is a sub-chart
 * in a [Composite Chart](#composite-chart) then pass in the parent composite chart instance.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @returns {LineChart}
 */
dc.lineChart = function (parent, chartGroup) {
    var DEFAULT_DOT_RADIUS = 5;
    var TOOLTIP_G_CLASS = 'dc-tooltip';
    var DOT_CIRCLE_CLASS = 'dot';
    var Y_AXIS_REF_LINE_CLASS = 'yRef';
    var X_AXIS_REF_LINE_CLASS = 'xRef';
    var DEFAULT_DOT_OPACITY = 1e-6;

    var _chart = dc.stackMixin(dc.coordinateGridMixin({}));
    var _renderArea = false;
    var _dotRadius = DEFAULT_DOT_RADIUS;
    var _dataPointRadius = null;
    var _dataPointFillOpacity = DEFAULT_DOT_OPACITY;
    var _dataPointStrokeOpacity = DEFAULT_DOT_OPACITY;
    var _interpolate = 'linear';
    var _tension = 0.7;
    var _defined;
    var _dashStyle;
    var _xyTipsOn = true;

    _chart.transitionDuration(500);
    _chart._rangeBandPadding(1);

    _chart.plotData = function () {
        var chartBody = _chart.chartBodyG();
        var layersList = chartBody.selectAll('g.stack-list');

        if (layersList.empty()) {
            layersList = chartBody.append('g').attr('class', 'stack-list');
        }

        var layers = layersList.selectAll('g.stack').data(_chart.data());

        var layersEnter = layers
            .enter()
            .append('g')
            .attr('class', function (d, i) {
                return 'stack ' + '_' + i;
            });

        drawLine(layersEnter, layers);

        drawArea(layersEnter, layers);

        drawDots(chartBody, layers);
    };

    /**
     * Gets or sets the interpolator to use for lines drawn, by string name, allowing e.g. step
     * functions, splines, and cubic interpolation.  This is passed to
     * [d3.svg.line.interpolate](https://github.com/mbostock/d3/wiki/SVG-Shapes#line_interpolate) and
     * [d3.svg.area.interpolate](https://github.com/mbostock/d3/wiki/SVG-Shapes#area_interpolate),
     * where you can find a complete list of valid arguments
     * @name interpolate
     * @memberof dc.lineChart
     * @instance
     * @param  {String} [interpolate='linear']
     * @returns {Chart}
     */
    _chart.interpolate = function (interpolate) {
        if (!arguments.length) {
            return _interpolate;
        }
        _interpolate = interpolate;
        return _chart;
    };

    /**
     * Gets or sets the tension to use for lines drawn, in the range 0 to 1.
     * This parameter further customizes the interpolation behavior.  It is passed to
     * [d3.svg.line.tension](https://github.com/mbostock/d3/wiki/SVG-Shapes#line_tension) and
     * [d3.svg.area.tension](https://github.com/mbostock/d3/wiki/SVG-Shapes#area_tension).
     * @name tension
     * @memberof dc.lineChart
     * @instance
     * @param  {Number} [tension=0.7]
     * @returns {Chart}
     */
    _chart.tension = function (tension) {
        if (!arguments.length) {
            return _tension;
        }
        _tension = tension;
        return _chart;
    };

    /**
     * Gets or sets a function that will determine discontinuities in the line which should be
     * skipped: the path will be broken into separate subpaths if some points are undefined.
     * This function is passed to
     * [d3.svg.line.defined](https://github.com/mbostock/d3/wiki/SVG-Shapes#line_defined)
     *
     * Note: crossfilter will sometimes coerce nulls to 0, so you may need to carefully write
     * custom reduce functions to get this to work, depending on your data. See
     * https://github.com/dc-js/dc.js/issues/615#issuecomment-49089248
     * @name defined
     * @memberof dc.lineChart
     * @instance
     * @param  {Function} [defined]
     * @returns {Chart}
     */
    _chart.defined = function (defined) {
        if (!arguments.length) {
            return _defined;
        }
        _defined = defined;
        return _chart;
    };

    /**
     * Set the line's d3 dashstyle. This value becomes the 'stroke-dasharray' of line. Defaults to empty
     * array (solid line).
     * @name dashStyle
     * @memberof dc.lineChart
     * @instance
     * @example
     * // create a Dash Dot Dot Dot
     * chart.dashStyle([3,1,1,1]);
     * @param  {Array<Number>} [dashStyle=[]]
     * @returns {Chart}
     */
    _chart.dashStyle = function (dashStyle) {
        if (!arguments.length) {
            return _dashStyle;
        }
        _dashStyle = dashStyle;
        return _chart;
    };

    /**
     * Get or set render area flag. If the flag is set to true then the chart will render the area
     * beneath each line and the line chart effectively becomes an area chart.
     * @name renderArea
     * @memberof dc.lineChart
     * @instance
     * @param  {Boolean} [renderArea=false]
     * @returns {Chart}
     */
    _chart.renderArea = function (renderArea) {
        if (!arguments.length) {
            return _renderArea;
        }
        _renderArea = renderArea;
        return _chart;
    };

    function colors (d, i) {
        return _chart.getColor.call(d, d.values, i);
    }

    function drawLine (layersEnter, layers) {
        var line = d3.svg.line()
            .x(function (d) {
                return _chart.x()(d.x);
            })
            .y(function (d) {
                return _chart.y()(d.y + d.y0);
            })
            .interpolate(_interpolate)
            .tension(_tension);
        if (_defined) {
            line.defined(_defined);
        }

        var path = layersEnter.append('path')
            .attr('class', 'line')
            .attr('stroke', colors);
        if (_dashStyle) {
            path.attr('stroke-dasharray', _dashStyle);
        }

        dc.transition(layers.select('path.line'), _chart.transitionDuration())
            //.ease('linear')
            .attr('stroke', colors)
            .attr('d', function (d) {
                return safeD(line(d.values));
            });
    }

    function drawArea (layersEnter, layers) {
        if (_renderArea) {
            var area = d3.svg.area()
                .x(function (d) {
                    return _chart.x()(d.x);
                })
                .y(function (d) {
                    return _chart.y()(d.y + d.y0);
                })
                .y0(function (d) {
                    return _chart.y()(d.y0);
                })
                .interpolate(_interpolate)
                .tension(_tension);
            if (_defined) {
                area.defined(_defined);
            }

            layersEnter.append('path')
                .attr('class', 'area')
                .attr('fill', colors)
                .attr('d', function (d) {
                    return safeD(area(d.values));
                });

            dc.transition(layers.select('path.area'), _chart.transitionDuration())
                //.ease('linear')
                .attr('fill', colors)
                .attr('d', function (d) {
                    return safeD(area(d.values));
                });
        }
    }

    function safeD (d) {
        return (!d || d.indexOf('NaN') >= 0) ? 'M0,0' : d;
    }

    function drawDots (chartBody, layers) {
        if (!_chart.brushOn() && _chart.xyTipsOn()) {
            var tooltipListClass = TOOLTIP_G_CLASS + '-list';
            var tooltips = chartBody.select('g.' + tooltipListClass);

            if (tooltips.empty()) {
                tooltips = chartBody.append('g').attr('class', tooltipListClass);
            }

            layers.each(function (d, layerIndex) {
                var points = d.values;
                if (_defined) {
                    points = points.filter(_defined);
                }

                var g = tooltips.select('g.' + TOOLTIP_G_CLASS + '._' + layerIndex);
                if (g.empty()) {
                    g = tooltips.append('g').attr('class', TOOLTIP_G_CLASS + ' _' + layerIndex);
                }

                createRefLines(g);

                var dots = g.selectAll('circle.' + DOT_CIRCLE_CLASS)
                    .data(points, dc.pluck('x'));

                dots.enter()
                    .append('circle')
                    .attr('class', DOT_CIRCLE_CLASS)
                    .attr('r', getDotRadius())
                    .style('fill-opacity', _dataPointFillOpacity)
                    .style('stroke-opacity', _dataPointStrokeOpacity)
                    .on('mousemove', function () {
                        var dot = d3.select(this);
                        showDot(dot);
                        showRefLines(dot, g);
                    })
                    .on('mouseout', function () {
                        var dot = d3.select(this);
                        hideDot(dot);
                        hideRefLines(g);
                    });

                dots
                    .attr('cx', function (d) {
                        return dc.utils.safeNumber(_chart.x()(d.x));
                    })
                    .attr('cy', function (d) {
                        return dc.utils.safeNumber(_chart.y()(d.y + d.y0));
                    })
                    .attr('fill', _chart.getColor)
                    .call(renderTitle, d);

                dots.exit().remove();
            });
        }
    }

    function createRefLines (g) {
        var yRefLine = g.select('path.' + Y_AXIS_REF_LINE_CLASS).empty() ?
            g.append('path').attr('class', Y_AXIS_REF_LINE_CLASS) : g.select('path.' + Y_AXIS_REF_LINE_CLASS);
        yRefLine.style('display', 'none').attr('stroke-dasharray', '5,5');

        var xRefLine = g.select('path.' + X_AXIS_REF_LINE_CLASS).empty() ?
            g.append('path').attr('class', X_AXIS_REF_LINE_CLASS) : g.select('path.' + X_AXIS_REF_LINE_CLASS);
        xRefLine.style('display', 'none').attr('stroke-dasharray', '5,5');
    }

    function showDot (dot) {
        dot.style('fill-opacity', 0.8);
        dot.style('stroke-opacity', 0.8);
        dot.attr('r', _dotRadius);
        return dot;
    }

    function showRefLines (dot, g) {
        var x = dot.attr('cx');
        var y = dot.attr('cy');
        var yAxisX = (_chart._yAxisX() - _chart.margins().left);
        var yAxisRefPathD = 'M' + yAxisX + ' ' + y + 'L' + (x) + ' ' + (y);
        var xAxisRefPathD = 'M' + x + ' ' + _chart.yAxisHeight() + 'L' + x + ' ' + y;
        g.select('path.' + Y_AXIS_REF_LINE_CLASS).style('display', '').attr('d', yAxisRefPathD);
        g.select('path.' + X_AXIS_REF_LINE_CLASS).style('display', '').attr('d', xAxisRefPathD);
    }

    function getDotRadius () {
        return _dataPointRadius || _dotRadius;
    }

    function hideDot (dot) {
        dot.style('fill-opacity', _dataPointFillOpacity)
            .style('stroke-opacity', _dataPointStrokeOpacity)
            .attr('r', getDotRadius());
    }

    function hideRefLines (g) {
        g.select('path.' + Y_AXIS_REF_LINE_CLASS).style('display', 'none');
        g.select('path.' + X_AXIS_REF_LINE_CLASS).style('display', 'none');
    }

    function renderTitle (dot, d) {
        if (_chart.renderTitle()) {
            dot.selectAll('title').remove();
            dot.append('title').text(dc.pluck('data', _chart.title(d.name)));
        }
    }

    /**
     * Turn on/off the mouseover behavior of an individual data point which renders a circle and x/y axis
     * dashed lines back to each respective axis.  This is ignored if the chart brush is on (`brushOn`)
     * @name xyTipsOn
     * @memberof dc.lineChart
     * @instance
     * @param  {Boolean} [xyTipsOn=false]
     * @returns {Chart}
     */
    _chart.xyTipsOn = function (xyTipsOn) {
        if (!arguments.length) {
            return _xyTipsOn;
        }
        _xyTipsOn = xyTipsOn;
        return _chart;
    };

    /**
     * Get or set the radius (in px) for dots displayed on the data points.
     * @name dotRadius
     * @memberof dc.lineChart
     * @instance
     * @param  {Number} [dotRadius=5]
     * @returns {Chart}
     */
    _chart.dotRadius = function (dotRadius) {
        if (!arguments.length) {
            return _dotRadius;
        }
        _dotRadius = dotRadius;
        return _chart;
    };

    /**
     * Always show individual dots for each datapoint.
     * If `options` is falsy, it disables data point rendering.
     *
     * If no `options` are provided, the current `options` values are instead returned.
     * @name renderDataPoints
     * @memberof dc.lineChart
     * @instance
     * @example
     * chart.renderDataPoints({radius: 2, fillOpacity: 0.8, strokeOpacity: 0.8})
     * @param  {{fillOpacity: Number, strokeOpacity: Number, radius: Number}} [options={fillOpacity: 0.8, strokeOpacity: 0.8, radius: 2}]
     * @returns {Chart}
     */
    _chart.renderDataPoints = function (options) {
        if (!arguments.length) {
            return {
                fillOpacity: _dataPointFillOpacity,
                strokeOpacity: _dataPointStrokeOpacity,
                radius: _dataPointRadius
            };
        } else if (!options) {
            _dataPointFillOpacity = DEFAULT_DOT_OPACITY;
            _dataPointStrokeOpacity = DEFAULT_DOT_OPACITY;
            _dataPointRadius = null;
        } else {
            _dataPointFillOpacity = options.fillOpacity || 0.8;
            _dataPointStrokeOpacity = options.strokeOpacity || 0.8;
            _dataPointRadius = options.radius || 2;
        }
        return _chart;
    };

    function colorFilter (color, dashstyle, inv) {
        return function () {
            var item = d3.select(this);
            var match = (item.attr('stroke') === color &&
                item.attr('stroke-dasharray') === ((dashstyle instanceof Array) ?
                    dashstyle.join(',') : null)) || item.attr('fill') === color;
            return inv ? !match : match;
        };
    }

    _chart.legendHighlight = function (d) {
        if (!_chart.isLegendableHidden(d)) {
            _chart.g().selectAll('path.line, path.area')
                .classed('highlight', colorFilter(d.color, d.dashstyle))
                .classed('fadeout', colorFilter(d.color, d.dashstyle, true));
        }
    };

    _chart.legendReset = function () {
        _chart.g().selectAll('path.line, path.area')
            .classed('highlight', false)
            .classed('fadeout', false);
    };

    dc.override(_chart, 'legendables', function () {
        var legendables = _chart._legendables();
        if (!_dashStyle) {
            return legendables;
        }
        return legendables.map(function (l) {
            l.dashstyle = _dashStyle;
            return l;
        });
    });

    return _chart.anchor(parent, chartGroup);
};

/**
 * The data count widget is a simple widget designed to display the number of records selected by the
 * current filters out of the total number of records in the data set. Once created the data count widget
 * will automatically update the text content of the following elements under the parent element.
 *
 * '.total-count' - total number of records
 * '.filter-count' - number of records matched by the current filters
 *
 * Examples:
 * - [Nasdaq 100 Index](http://dc-js.github.com/dc.js/)
 * @name dataCount
 * @memberof dc
 * @mixes dc.baseMixin
 * @example
 * var ndx = crossfilter(data);
 * var all = ndx.groupAll();
 *
 * dc.dataCount('.dc-data-count')
 *     .dimension(ndx)
 *     .group(all);
 * @param {String|node|d3.selection|dc.compositeChart} parent - Any valid
 * [d3 single selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying
 * a dom block element such as a div; or a dom element or d3 selection.  If the bar chart is a sub-chart
 * in a [Composite Chart](#composite-chart) then pass in the parent composite chart instance.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @returns {DataCount}
 */
dc.dataCount = function (parent, chartGroup) {
    var _formatNumber = d3.format(',d');
    var _chart = dc.baseMixin({});
    var _html = {some: '', all: ''};

    /**
     * Gets or sets an optional object specifying HTML templates to use depending how many items are
     * selected. The text `%total-count` will replaced with the total number of records, and the text
     * `%filter-count` will be replaced with the number of selected records.
     * - all: HTML template to use if all items are selected
     * - some: HTML template to use if not all items are selected
     * @name html
     * @memberof dc.dataCount
     * @instance
     * @example
     * counter.html({
     *      some: '%filter-count out of %total-count records selected',
     *      all: 'All records selected. Click on charts to apply filters'
     * })
     * @param {{some:String, all: String}} [options]
     * @returns {Chart}
     */
    _chart.html = function (options) {
        if (!arguments.length) {
            return _html;
        }
        if (options.all) {
            _html.all = options.all;
        }
        if (options.some) {
            _html.some = options.some;
        }
        return _chart;
    };

    /**
     * Gets or sets an optional function to format the filter count and total count.
     * @name formatNumber
     * @memberof dc.dataCount
     * @instance
     * @example
     * counter.formatNumber(d3.format('.2g'))
     * @param {Function} [formatter=d3.format('.2g')]
     * @returns {Chart}
     */
    _chart.formatNumber = function (formatter) {
        if (!arguments.length) {
            return _formatNumber;
        }
        _formatNumber = formatter;
        return _chart;
    };

    _chart._doRender = function () {
        var tot = _chart.dimension().size(),
            val = _chart.group().value();
        var all = _formatNumber(tot);
        var selected = _formatNumber(val);

        if ((tot === val) && (_html.all !== '')) {
            _chart.root().html(_html.all.replace('%total-count', all).replace('%filter-count', selected));
        } else if (_html.some !== '') {
            _chart.root().html(_html.some.replace('%total-count', all).replace('%filter-count', selected));
        } else {
            _chart.selectAll('.total-count').text(all);
            _chart.selectAll('.filter-count').text(selected);
        }
        return _chart;
    };

    _chart._doRedraw = function () {
        return _chart._doRender();
    };

    return _chart.anchor(parent, chartGroup);
};

/**
 * The data table is a simple widget designed to list crossfilter focused data set (rows being
 * filtered) in a good old tabular fashion.
 *
 * Note: Unlike other charts, the data table (and data grid chart) use the group attribute as a keying function
 * for [nesting](https://github.com/mbostock/d3/wiki/Arrays#-nest) the data together in groups.
 * Do not pass in a crossfilter group as this will not work.
 *
 * Examples:
 * - [Nasdaq 100 Index](http://dc-js.github.com/dc.js/)
 * @name dataTable
 * @memberof dc
 * @mixes dc.baseMixin
 * @param {String|node|d3.selection|dc.compositeChart} parent - Any valid
 * [d3 single selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying
 * a dom block element such as a div; or a dom element or d3 selection.  If the bar chart is a sub-chart
 * in a [Composite Chart](#composite-chart) then pass in the parent composite chart instance.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @returns {DataTable}
 */
dc.dataTable = function (parent, chartGroup) {
    var LABEL_CSS_CLASS = 'dc-table-label';
    var ROW_CSS_CLASS = 'dc-table-row';
    var COLUMN_CSS_CLASS = 'dc-table-column';
    var GROUP_CSS_CLASS = 'dc-table-group';
    var HEAD_CSS_CLASS = 'dc-table-head';

    var _chart = dc.baseMixin({});

    var _size = 25;
    var _columns = [];
    var _sortBy = function (d) {
        return d;
    };
    var _order = d3.ascending;
    var _showGroups = true;

    _chart._doRender = function () {
        _chart.selectAll('tbody').remove();

        renderRows(renderGroups());

        return _chart;
    };

    _chart._doColumnValueFormat = function (v, d) {
        return ((typeof v === 'function') ?
                v(d) :                          // v as function
                ((typeof v === 'string') ?
                 d[v] :                         // v is field name string
                 v.format(d)                        // v is Object, use fn (element 2)
                )
               );
    };

    _chart._doColumnHeaderFormat = function (d) {
        // if 'function', convert to string representation
        // show a string capitalized
        // if an object then display it's label string as-is.
        return (typeof d === 'function') ?
                _chart._doColumnHeaderFnToString(d) :
                ((typeof d === 'string') ?
                 _chart._doColumnHeaderCapitalize(d) : String(d.label));
    };

    _chart._doColumnHeaderCapitalize = function (s) {
        // capitalize
        return s.charAt(0).toUpperCase() + s.slice(1);
    };

    _chart._doColumnHeaderFnToString = function (f) {
        // columnString(f) {
        var s = String(f);
        var i1 = s.indexOf('return ');
        if (i1 >= 0) {
            var i2 = s.lastIndexOf(';');
            if (i2 >= 0) {
                s = s.substring(i1 + 7, i2);
                var i3 = s.indexOf('numberFormat');
                if (i3 >= 0) {
                    s = s.replace('numberFormat', '');
                }
            }
        }
        return s;
    };

    function renderGroups () {
        // The 'original' example uses all 'functions'.
        // If all 'functions' are used, then don't remove/add a header, and leave
        // the html alone. This preserves the functionality of earlier releases.
        // A 2nd option is a string representing a field in the data.
        // A third option is to supply an Object such as an array of 'information', and
        // supply your own _doColumnHeaderFormat and _doColumnValueFormat functions to
        // create what you need.
        var bAllFunctions = true;
        _columns.forEach(function (f) {
            bAllFunctions = bAllFunctions & (typeof f === 'function');
        });

        if (!bAllFunctions) {
            _chart.selectAll('th').remove();
            var headcols = _chart.root().selectAll('th')
                .data(_columns);

            var headGroup = headcols
                .enter()
                .append('th');

            headGroup
                .attr('class', HEAD_CSS_CLASS)
                    .html(function (d) {
                        return (_chart._doColumnHeaderFormat(d));

                    });
        }

        var groups = _chart.root().selectAll('tbody')
            .data(nestEntries(), function (d) {
                return _chart.keyAccessor()(d);
            });

        var rowGroup = groups
            .enter()
            .append('tbody');

        if (_showGroups === true) {
            rowGroup
                .append('tr')
                .attr('class', GROUP_CSS_CLASS)
                    .append('td')
                    .attr('class', LABEL_CSS_CLASS)
                    .attr('colspan', _columns.length)
                    .html(function (d) {
                        return _chart.keyAccessor()(d);
                    });
        }

        groups.exit().remove();

        return rowGroup;
    }

    function nestEntries () {
        var entries;
        if (_order === d3.ascending) {
            entries = _chart.dimension().bottom(_size);
        } else {
            entries = _chart.dimension().top(_size);
        }

        return d3.nest()
            .key(_chart.group())
            .sortKeys(_order)
            .entries(entries.sort(function (a, b) {
                return _order(_sortBy(a), _sortBy(b));
            }));
    }

    function renderRows (groups) {
        var rows = groups.order()
            .selectAll('tr.' + ROW_CSS_CLASS)
            .data(function (d) {
                return d.values;
            });

        var rowEnter = rows.enter()
            .append('tr')
            .attr('class', ROW_CSS_CLASS);

        _columns.forEach(function (v, i) {
            rowEnter.append('td')
                .attr('class', COLUMN_CSS_CLASS + ' _' + i)
                .html(function (d) {
                    return _chart._doColumnValueFormat(v, d);
                });
        });

        rows.exit().remove();

        return rows;
    }

    _chart._doRedraw = function () {
        return _chart._doRender();
    };

    /**
     * Get or set the table size which determines the number of rows displayed by the widget.
     * @name size
     * @memberof dc.dataTable
     * @instance
     * @param {Number} [size=25]
     * @returns {Chart}
     */
    _chart.size = function (size) {
        if (!arguments.length) {
            return _size;
        }
        _size = size;
        return _chart;
    };

    /**
     * Get or set column functions. The data table widget now supports several methods of specifying
     * the columns to display.  The original method, first shown below, uses an array of functions to
     * generate dynamic columns. Column functions are simple javascript functions with only one input
     * argument `d` which represents a row in the data set. The return value of these functions will be
     * used directly to generate table content for each cell. However, this method requires the .html
     * table entry to have a fixed set of column headers.
     *
     * The second example shows you can simply list the data (d) content directly without
     * specifying it as a function, except where necessary (ie, computed columns).  Note
     * the data element accessor name is capitalized when displayed in the table. You can
     * also mix in functions as desired or necessary, but you must use the
     * Object = [Label, Fn] method as shown below.
     * You may wish to override the following two functions, which are internally used to
     * translate the column information or function into a displayed header. The first one
     * is used on the simple "string" column specifier, the second is used to transform the
     * String(fn) into something displayable. For the Stock example, the function for Change
     * becomes a header of 'd.close - d.open'.
     * _chart._doColumnHeaderCapitalize _chart._doColumnHeaderFnToString
     * You may use your own Object definition, however you must then override
     * _chart._doColumnHeaderFormat , _chart._doColumnValueFormat
     * Be aware that fields without numberFormat specification will be displayed just as
     * they are stored in the data, unformatted.
     *
     * The third example, where all fields are specified using the Object = [Label, Fn] method.
     * @name columns
     * @memberof dc.dataTable
     * @instance
     * @example
     * chart.columns([
     *     function(d) { return d.date; },
     *     function(d) { return d.open; },
     *     function(d) { return d.close; },
     *     function(d) { return numberFormat(d.close - d.open); },
     *     function(d) { return d.volume; }
     * ]);
     * @example
     * chart.columns([
     *     "date",    // d["date"], ie, a field accessor; capitalized automatically
     *     "open",    // ...
     *     "close",   // ...
     *     ["Change", // Specify an Object = [Label, Fn]
     *         function (d) { return numberFormat(d.close - d.open); }],
     *     "volume"   // d["volume"], ie, a field accessor; capitalized automatically
     * ]);
     * @example
     * chart.columns([
     *     ["Date",   // Specify an Object = [Label, Fn]
     *         function (d) { return d.date; }],
     *     ["Open",
     *         function (d) { return numberFormat(d.open); }],
     *     ["Close",
     *         function (d) { return numberFormat(d.close); }],
     *     ["Change",
     *         function (d) { return numberFormat(d.close - d.open); }],
     *     ["Volume",
     *         function (d) { return d.volume; }]
     * ]);
     * @param {Array<Function>} [columns=[]]
     * @returns {Chart}
     */
    _chart.columns = function (columns) {
        if (!arguments.length) {
            return _columns;
        }
        _columns = columns;
        return _chart;
    };

    /**
     * Get or set sort-by function. This function works as a value accessor at row level and returns a
     * particular field to be sorted by. Default value: identity function
     * @name sortBy
     * @memberof dc.dataTable
     * @instance
     * @example
     * chart.sortBy(function(d) {
     *     return d.date;
     * });
     * @param {Function} [sortBy]
     * @returns {Chart}
     */
    _chart.sortBy = function (sortBy) {
        if (!arguments.length) {
            return _sortBy;
        }
        _sortBy = sortBy;
        return _chart;
    };

    /**
     * Get or set sort order.
     * @name order
     * @memberof dc.dataTable
     * @instance
     * @example
     * chart.order(d3.descending);
     * @param {Function} [order=d3.ascending]
     * @returns {Chart}
     */
    _chart.order = function (order) {
        if (!arguments.length) {
            return _order;
        }
        _order = order;
        return _chart;
    };

    /**
     * Get or set if group rows will be shown.
     *
     * The .group() getter-setter must be provided in either case.
     * @name order
     * @memberof dc.dataTable
     * @instance
     * @example
     * chart
     *     .group([value], [name])
     *     .showGroups(true|false);
     * @param {Boolean} [showGroups=true]
     * @returns {Chart}
     */
    _chart.showGroups = function (showGroups) {
        if (!arguments.length) {
            return _showGroups;
        }
        _showGroups = showGroups;
        return _chart;
    };

    return _chart.anchor(parent, chartGroup);
};

/**
 * Data grid is a simple widget designed to list the filtered records, providing
 * a simple way to define how the items are displayed.
 *
 * Note: Unlike other charts, the data grid chart (and data table) use the group attribute as a keying function
 * for [nesting](https://github.com/mbostock/d3/wiki/Arrays#-nest) the data together in groups.
 * Do not pass in a crossfilter group as this will not work.
 *
 * Examples:
 * - [List of members of the european parliament](http://europarl.me/dc.js/web/ep/index.html)
 * @name dataGrid
 * @memberof dc
 * @mixes dc.baseMixin
 * @param {String|node|d3.selection|dc.compositeChart} parent - Any valid
 * [d3 single selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying
 * a dom block element such as a div; or a dom element or d3 selection.  If the bar chart is a sub-chart
 * in a [Composite Chart](#composite-chart) then pass in the parent composite chart instance.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @returns {DataGrid}
 */
dc.dataGrid = function (parent, chartGroup) {
    var LABEL_CSS_CLASS = 'dc-grid-label';
    var ITEM_CSS_CLASS = 'dc-grid-item';
    var GROUP_CSS_CLASS = 'dc-grid-group';
    var GRID_CSS_CLASS = 'dc-grid-top';

    var _chart = dc.baseMixin({});

    var _size = 999; // shouldn't be needed, but you might
    var _html = function (d) { return 'you need to provide an html() handling param:  ' + JSON.stringify(d); };
    var _sortBy = function (d) {
        return d;
    };
    var _order = d3.ascending;
    var _beginSlice = 0, _endSlice;

    var _htmlGroup = function (d) {
        return '<div class=\'' + GROUP_CSS_CLASS + '\'><h1 class=\'' + LABEL_CSS_CLASS + '\'>' +
            _chart.keyAccessor()(d) + '</h1></div>';
    };

    _chart._doRender = function () {
        _chart.selectAll('div.' + GRID_CSS_CLASS).remove();

        renderItems(renderGroups());

        return _chart;
    };

    function renderGroups () {
        var groups = _chart.root().selectAll('div.' + GRID_CSS_CLASS)
                .data(nestEntries(), function (d) {
                    return _chart.keyAccessor()(d);
                });

        var itemGroup = groups
                .enter()
                .append('div')
                .attr('class', GRID_CSS_CLASS);

        if (_htmlGroup) {
            itemGroup
                .html(function (d) {
                    return _htmlGroup(d);
                });
        }

        groups.exit().remove();
        return itemGroup;
    }

    function nestEntries () {
        var entries = _chart.dimension().top(_size);

        return d3.nest()
            .key(_chart.group())
            .sortKeys(_order)
            .entries(entries.sort(function (a, b) {
                return _order(_sortBy(a), _sortBy(b));
            }).slice(_beginSlice, _endSlice));
    }

    function renderItems (groups) {
        var items = groups.order()
                .selectAll('div.' + ITEM_CSS_CLASS)
                .data(function (d) {
                    return d.values;
                });

        items.enter()
            .append('div')
            .attr('class', ITEM_CSS_CLASS)
            .html(function (d) {
                return _html(d);
            });

        items.exit().remove();

        return items;
    }

    _chart._doRedraw = function () {
        return _chart._doRender();
    };

    /**
     * Get or set the index of the beginning slice which determines which entries get displayed by the widget
     * Useful when implementing pagination.
     * @name beginSlice
     * @memberof dc.dataGrid
     * @instance
     * @param {Number} [beginSlice=0]
     * @returns {Chart}
     */
    _chart.beginSlice = function (beginSlice) {
        if (!arguments.length) {
            return _beginSlice;
        }
        _beginSlice = beginSlice;
        return _chart;
    };

    /**
     * Get or set the index of the end slice which determines which entries get displayed by the widget
     * Useful when implementing pagination.
     * @name endSlice
     * @memberof dc.dataGrid
     * @instance
     * @param {Number} [endSlice]
     * @returns {Chart}
     */
    _chart.endSlice = function (endSlice) {
        if (!arguments.length) {
            return _endSlice;
        }
        _endSlice = endSlice;
        return _chart;
    };

    /**
     * Get or set the grid size which determines the number of items displayed by the widget.
     * @name size
     * @memberof dc.dataGrid
     * @instance
     * @param {Number} [size=999]
     * @returns {Chart}
     */
    _chart.size = function (size) {
        if (!arguments.length) {
            return _size;
        }
        _size = size;
        return _chart;
    };

    /**
     * Get or set the function that formats an item. The data grid widget uses a
     * function to generate dynamic html. Use your favourite templating engine or
     * generate the string directly.
     * @name html
     * @memberof dc.dataGrid
     * @instance
     * @example
     * chart.html(function (d) { return '<div class='item '+data.exampleCategory+''>'+data.exampleString+'</div>';});
     * @param {Function} [html]
     * @returns {Chart}
     */
    _chart.html = function (html) {
        if (!arguments.length) {
            return _html;
        }
        _html = html;
        return _chart;
    };

    /**
     * Get or set the function that formats a group label.
     * @name htmlGroup
     * @memberof dc.dataGrid
     * @instance
     * @example
     * chart.htmlGroup (function (d) { return '<h2>'.d.key . 'with ' . d.values.length .' items</h2>'});
     * @param {Function} [htmlGroup]
     * @returns {Chart}
     */
    _chart.htmlGroup = function (htmlGroup) {
        if (!arguments.length) {
            return _htmlGroup;
        }
        _htmlGroup = htmlGroup;
        return _chart;
    };

    /**
     * Get or set sort-by function. This function works as a value accessor at the item
     * level and returns a particular field to be sorted.
     * @name sortBy
     * @memberof dc.dataGrid
     * @instance
     * @example
     * chart.sortBy(function(d) {
     *     return d.date;
     * });
     * @param {Function} [sortByFunction]
     * @returns {Chart}
     */
    _chart.sortBy = function (sortByFunction) {
        if (!arguments.length) {
            return _sortBy;
        }
        _sortBy = sortByFunction;
        return _chart;
    };

    /**
     * Get or set sort order function.
     * @name order
     * @memberof dc.dataGrid
     * @instance
     * @example
     * chart.order(d3.descending);
     * @param {Function} [order=d3.ascending]
     * @returns {Chart}
     */
    _chart.order = function (order) {
        if (!arguments.length) {
            return _order;
        }
        _order = order;
        return _chart;
    };

    return _chart.anchor(parent, chartGroup);
};

/**
 * A concrete implementation of a general purpose bubble chart that allows data visualization using the
 * following dimensions:
 * - x axis position
 * - y axis position
 * - bubble radius
 * - color
 * Examples:
 * - [Nasdaq 100 Index](http://dc-js.github.com/dc.js/)
 * - [US Venture Capital Landscape 2011](http://dc-js.github.com/dc.js/vc/index.html)
 * @name bubbleChart
 * @memberof dc
 * @mixes dc.bubbleMixin
 * @mixes dc.coordinateGridMixin
 * @example
 * // create a bubble chart under #chart-container1 element using the default global chart group
 * var bubbleChart1 = dc.bubbleChart('#chart-container1');
 * // create a bubble chart under #chart-container2 element using chart group A
 * var bubbleChart2 = dc.bubbleChart('#chart-container2', 'chartGroupA');
 * @param {String|node|d3.selection|dc.compositeChart} parent - Any valid
 * [d3 single selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying
 * a dom block element such as a div; or a dom element or d3 selection.  If the bar chart is a sub-chart
 * in a [Composite Chart](#composite-chart) then pass in the parent composite chart instance.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @returns {BubbleChart}
 */
dc.bubbleChart = function (parent, chartGroup) {
    var _chart = dc.bubbleMixin(dc.coordinateGridMixin({}));

    var _elasticRadius = false;

    _chart.transitionDuration(750);

    var bubbleLocator = function (d) {
        return 'translate(' + (bubbleX(d)) + ',' + (bubbleY(d)) + ')';
    };

    /**
     * Turn on or off the elastic bubble radius feature, or return the value of the flag. If this
     * feature is turned on, then bubble radii will be automatically rescaled to fit the chart better.
     * @name elasticRadius
     * @memberof dc.bubbleChart
     * @instance
     * @param {Boolean} [elasticRadius=false]
     * @returns {Boolean}
     */
    _chart.elasticRadius = function (elasticRadius) {
        if (!arguments.length) {
            return _elasticRadius;
        }
        _elasticRadius = elasticRadius;
        return _chart;
    };

    _chart.plotData = function () {
        if (_elasticRadius) {
            _chart.r().domain([_chart.rMin(), _chart.rMax()]);
        }

        _chart.r().range([_chart.MIN_RADIUS, _chart.xAxisLength() * _chart.maxBubbleRelativeSize()]);

        var bubbleG = _chart.chartBodyG().selectAll('g.' + _chart.BUBBLE_NODE_CLASS)
            .data(_chart.data(), function (d) { return d.key; });

        renderNodes(bubbleG);

        updateNodes(bubbleG);

        removeNodes(bubbleG);

        _chart.fadeDeselectedArea();
    };

    function renderNodes (bubbleG) {
        var bubbleGEnter = bubbleG.enter().append('g');

        bubbleGEnter
            .attr('class', _chart.BUBBLE_NODE_CLASS)
            .attr('transform', bubbleLocator)
            .append('circle').attr('class', function (d, i) {
                return _chart.BUBBLE_CLASS + ' _' + i;
            })
            .on('click', _chart.onClick)
            .attr('fill', _chart.getColor)
            .attr('r', 0);
        dc.transition(bubbleG, _chart.transitionDuration())
            .selectAll('circle.' + _chart.BUBBLE_CLASS)
            .attr('r', function (d) {
                return _chart.bubbleR(d);
            })
            .attr('opacity', function (d) {
                return (_chart.bubbleR(d) > 0) ? 1 : 0;
            });

        _chart._doRenderLabel(bubbleGEnter);

        _chart._doRenderTitles(bubbleGEnter);
    }

    function updateNodes (bubbleG) {
        dc.transition(bubbleG, _chart.transitionDuration())
            .attr('transform', bubbleLocator)
            .selectAll('circle.' + _chart.BUBBLE_CLASS)
            .attr('fill', _chart.getColor)
            .attr('r', function (d) {
                return _chart.bubbleR(d);
            })
            .attr('opacity', function (d) {
                return (_chart.bubbleR(d) > 0) ? 1 : 0;
            });

        _chart.doUpdateLabels(bubbleG);
        _chart.doUpdateTitles(bubbleG);
    }

    function removeNodes (bubbleG) {
        bubbleG.exit().remove();
    }

    function bubbleX (d) {
        var x = _chart.x()(_chart.keyAccessor()(d));
        if (isNaN(x)) {
            x = 0;
        }
        return x;
    }

    function bubbleY (d) {
        var y = _chart.y()(_chart.valueAccessor()(d));
        if (isNaN(y)) {
            y = 0;
        }
        return y;
    }

    _chart.renderBrush = function () {
        // override default x axis brush from parent chart
    };

    _chart.redrawBrush = function () {
        // override default x axis brush from parent chart
        _chart.fadeDeselectedArea();
    };

    return _chart.anchor(parent, chartGroup);
};

/**
 * Composite charts are a special kind of chart that render multiple charts on the same Coordinate
 * Grid. You can overlay (compose) different bar/line/area charts in a single composite chart to
 * achieve some quite flexible charting effects.
 * @name compositeChart
 * @memberof dc
 * @mixes dc.coordinateGridMixin
 * @example
 * // create a composite chart under #chart-container1 element using the default global chart group
 * var compositeChart1 = dc.compositeChart('#chart-container1');
 * // create a composite chart under #chart-container2 element using chart group A
 * var compositeChart2 = dc.compositeChart('#chart-container2', 'chartGroupA');
 * @param {String|node|d3.selection|dc.compositeChart} parent - Any valid
 * [d3 single selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying
 * a dom block element such as a div; or a dom element or d3 selection.  If the bar chart is a sub-chart
 * in a [Composite Chart](#composite-chart) then pass in the parent composite chart instance.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @returns {CompositeChart}
 */
dc.compositeChart = function (parent, chartGroup) {

    var SUB_CHART_CLASS = 'sub';
    var DEFAULT_RIGHT_Y_AXIS_LABEL_PADDING = 12;

    var _chart = dc.coordinateGridMixin({});
    var _children = [];

    var _childOptions = {};

    var _shareColors = false,
        _shareTitle = true;

    var _rightYAxis = d3.svg.axis(),
        _rightYAxisLabel = 0,
        _rightYAxisLabelPadding = DEFAULT_RIGHT_Y_AXIS_LABEL_PADDING,
        _rightY,
        _rightAxisGridLines = false;

    _chart._mandatoryAttributes([]);
    _chart.transitionDuration(500);

    dc.override(_chart, '_generateG', function () {
        var g = this.__generateG();

        for (var i = 0; i < _children.length; ++i) {
            var child = _children[i];

            generateChildG(child, i);

            if (!child.dimension()) {
                child.dimension(_chart.dimension());
            }
            if (!child.group()) {
                child.group(_chart.group());
            }

            child.chartGroup(_chart.chartGroup());
            child.svg(_chart.svg());
            child.xUnits(_chart.xUnits());
            child.transitionDuration(_chart.transitionDuration());
            child.brushOn(_chart.brushOn());
            child.renderTitle(_chart.renderTitle());
            child.elasticX(_chart.elasticX());
        }

        return g;
    });

    _chart._brushing = function () {
        var extent = _chart.extendBrush();
        var brushIsEmpty = _chart.brushIsEmpty(extent);

        for (var i = 0; i < _children.length; ++i) {
            _children[i].filter(null);
            if (!brushIsEmpty) {
                _children[i].filter(extent);
            }
        }
    };

    _chart._prepareYAxis = function () {
        if (leftYAxisChildren().length !== 0) { prepareLeftYAxis(); }
        if (rightYAxisChildren().length !== 0) { prepareRightYAxis(); }

        if (leftYAxisChildren().length > 0 && !_rightAxisGridLines) {
            _chart._renderHorizontalGridLinesForAxis(_chart.g(), _chart.y(), _chart.yAxis());
        } else if (rightYAxisChildren().length > 0) {
            _chart._renderHorizontalGridLinesForAxis(_chart.g(), _rightY, _rightYAxis);
        }
    };

    _chart.renderYAxis = function () {
        if (leftYAxisChildren().length !== 0) {
            _chart.renderYAxisAt('y', _chart.yAxis(), _chart.margins().left);
            _chart.renderYAxisLabel('y', _chart.yAxisLabel(), -90);
        }

        if (rightYAxisChildren().length !== 0) {
            _chart.renderYAxisAt('yr', _chart.rightYAxis(), _chart.width() - _chart.margins().right);
            _chart.renderYAxisLabel('yr', _chart.rightYAxisLabel(), 90, _chart.width() - _rightYAxisLabelPadding);
        }
    };

    function prepareRightYAxis () {
        if (_chart.rightY() === undefined || _chart.elasticY()) {
            if (_chart.rightY() === undefined) {
                _chart.rightY(d3.scale.linear());
            }
            _chart.rightY().domain([rightYAxisMin(), rightYAxisMax()]).rangeRound([_chart.yAxisHeight(), 0]);
        }

        _chart.rightY().range([_chart.yAxisHeight(), 0]);
        _chart.rightYAxis(_chart.rightYAxis().scale(_chart.rightY()));

        _chart.rightYAxis().orient('right');
    }

    function prepareLeftYAxis () {
        if (_chart.y() === undefined || _chart.elasticY()) {
            if (_chart.y() === undefined) {
                _chart.y(d3.scale.linear());
            }
            _chart.y().domain([yAxisMin(), yAxisMax()]).rangeRound([_chart.yAxisHeight(), 0]);
        }

        _chart.y().range([_chart.yAxisHeight(), 0]);
        _chart.yAxis(_chart.yAxis().scale(_chart.y()));

        _chart.yAxis().orient('left');
    }

    function generateChildG (child, i) {
        child._generateG(_chart.g());
        child.g().attr('class', SUB_CHART_CLASS + ' _' + i);
    }

    _chart.plotData = function () {
        for (var i = 0; i < _children.length; ++i) {
            var child = _children[i];

            if (!child.g()) {
                generateChildG(child, i);
            }

            if (_shareColors) {
                child.colors(_chart.colors());
            }

            child.x(_chart.x());

            child.xAxis(_chart.xAxis());

            if (child.useRightYAxis()) {
                child.y(_chart.rightY());
                child.yAxis(_chart.rightYAxis());
            } else {
                child.y(_chart.y());
                child.yAxis(_chart.yAxis());
            }

            child.plotData();

            child._activateRenderlets();
        }
    };

    /**
     * Get or set whether to draw gridlines from the right y axis.  Drawing from the left y axis is the
     * default behavior. This option is only respected when subcharts with both left and right y-axes
     * are present.
     * @name useRightAxisGridLines
     * @memberof dc.compositeChart
     * @instance
     * @param {Boolean} [useRightAxisGridLines=false]
     * @return {Chart}
     */
    _chart.useRightAxisGridLines = function (useRightAxisGridLines) {
        if (!arguments) {
            return _rightAxisGridLines;
        }

        _rightAxisGridLines = useRightAxisGridLines;
        return _chart;
    };

    /**
     * Get or set chart-specific options for all child charts. This is equivalent to calling `.options`
     * on each child chart.
     * @name childOptions
     * @memberof dc.compositeChart
     * @instance
     * @param {Object} [childOptions]
     * @return {Chart}
     */
    _chart.childOptions = function (childOptions) {
        if (!arguments.length) {
            return _childOptions;
        }
        _childOptions = childOptions;
        _children.forEach(function (child) {
            child.options(_childOptions);
        });
        return _chart;
    };

    _chart.fadeDeselectedArea = function () {
        for (var i = 0; i < _children.length; ++i) {
            var child = _children[i];
            child.brush(_chart.brush());
            child.fadeDeselectedArea();
        }
    };

    /**
     * Set or get the right y axis label.
     * @name rightYAxisLabel
     * @memberof dc.compositeChart
     * @instance
     * @param {String} [rightYAxisLabel]
     * @param {Number} [padding]
     * @return {Chart}
     */
    _chart.rightYAxisLabel = function (rightYAxisLabel, padding) {
        if (!arguments.length) {
            return _rightYAxisLabel;
        }
        _rightYAxisLabel = rightYAxisLabel;
        _chart.margins().right -= _rightYAxisLabelPadding;
        _rightYAxisLabelPadding = (padding === undefined) ? DEFAULT_RIGHT_Y_AXIS_LABEL_PADDING : padding;
        _chart.margins().right += _rightYAxisLabelPadding;
        return _chart;
    };

    /**
     * Combine the given charts into one single composite coordinate grid chart.
     * @name compose
     * @memberof dc.compositeChart
     * @instance
     * @example
     * moveChart.compose([
     *     // when creating sub-chart you need to pass in the parent chart
     *     dc.lineChart(moveChart)
     *         .group(indexAvgByMonthGroup) // if group is missing then parent's group will be used
     *         .valueAccessor(function (d){return d.value.avg;})
     *         // most of the normal functions will continue to work in a composed chart
     *         .renderArea(true)
     *         .stack(monthlyMoveGroup, function (d){return d.value;})
     *         .title(function (d){
     *             var value = d.value.avg?d.value.avg:d.value;
     *             if(isNaN(value)) value = 0;
     *             return dateFormat(d.key) + '\n' + numberFormat(value);
     *         }),
     *     dc.barChart(moveChart)
     *         .group(volumeByMonthGroup)
     *         .centerBar(true)
     * ]);
     * @param {Array<Chart>} [subChartArray]
     * @return {Chart}
     */
    _chart.compose = function (subChartArray) {
        _children = subChartArray;
        _children.forEach(function (child) {
            child.height(_chart.height());
            child.width(_chart.width());
            child.margins(_chart.margins());

            if (_shareTitle) {
                child.title(_chart.title());
            }

            child.options(_childOptions);
        });
        return _chart;
    };

    /**
     * Returns the child charts which are composed into the composite chart.
     * @name children
     * @memberof dc.compositeChart
     * @instance
     * @return {Array<Chart>}
     */
    _chart.children = function () {
        return _children;
    };

    /**
     * Get or set color sharing for the chart. If set, the `.colors()` value from this chart
     * will be shared with composed children. Additionally if the child chart implements
     * Stackable and has not set a custom .colorAccessor, then it will generate a color
     * specific to its order in the composition.
     * @name shareColors
     * @memberof dc.compositeChart
     * @instance
     * @param {Boolean} [shareColors=false]
     * @return {Chart}
     */
    _chart.shareColors = function (shareColors) {
        if (!arguments.length) {
            return _shareColors;
        }
        _shareColors = shareColors;
        return _chart;
    };

    /**
     * Get or set title sharing for the chart. If set, the `.title()` value from this chart will be
     * shared with composed children.
     * @name shareTitle
     * @memberof dc.compositeChart
     * @instance
     * @param {Boolean} [shareTitle=true]
     * @return {Chart}
     */
    _chart.shareTitle = function (shareTitle) {
        if (!arguments.length) {
            return _shareTitle;
        }
        _shareTitle = shareTitle;
        return _chart;
    };

    /**
     * Get or set the y scale for the right axis. The right y scale is typically automatically
     * generated by the chart implementation.
     * @name rightY
     * @memberof dc.compositeChart
     * @instance
     * @param {d3.scale} [yScale]
     * @return {Chart}
     */
    _chart.rightY = function (yScale) {
        if (!arguments.length) {
            return _rightY;
        }
        _rightY = yScale;
        _chart.rescale();
        return _chart;
    };

    function leftYAxisChildren () {
        return _children.filter(function (child) {
            return !child.useRightYAxis();
        });
    }

    function rightYAxisChildren () {
        return _children.filter(function (child) {
            return child.useRightYAxis();
        });
    }

    function getYAxisMin (charts) {
        return charts.map(function (c) {
            return c.yAxisMin();
        });
    }

    delete _chart.yAxisMin;
    function yAxisMin () {
        return d3.min(getYAxisMin(leftYAxisChildren()));
    }

    function rightYAxisMin () {
        return d3.min(getYAxisMin(rightYAxisChildren()));
    }

    function getYAxisMax (charts) {
        return charts.map(function (c) {
            return c.yAxisMax();
        });
    }

    delete _chart.yAxisMax;
    function yAxisMax () {
        return dc.utils.add(d3.max(getYAxisMax(leftYAxisChildren())), _chart.yAxisPadding());
    }

    function rightYAxisMax () {
        return dc.utils.add(d3.max(getYAxisMax(rightYAxisChildren())), _chart.yAxisPadding());
    }

    function getAllXAxisMinFromChildCharts () {
        return _children.map(function (c) {
            return c.xAxisMin();
        });
    }

    dc.override(_chart, 'xAxisMin', function () {
        return dc.utils.subtract(d3.min(getAllXAxisMinFromChildCharts()), _chart.xAxisPadding());
    });

    function getAllXAxisMaxFromChildCharts () {
        return _children.map(function (c) {
            return c.xAxisMax();
        });
    }

    dc.override(_chart, 'xAxisMax', function () {
        return dc.utils.add(d3.max(getAllXAxisMaxFromChildCharts()), _chart.xAxisPadding());
    });

    _chart.legendables = function () {
        return _children.reduce(function (items, child) {
            if (_shareColors) {
                child.colors(_chart.colors());
            }
            items.push.apply(items, child.legendables());
            return items;
        }, []);
    };

    _chart.legendHighlight = function (d) {
        for (var j = 0; j < _children.length; ++j) {
            var child = _children[j];
            child.legendHighlight(d);
        }
    };

    _chart.legendReset = function (d) {
        for (var j = 0; j < _children.length; ++j) {
            var child = _children[j];
            child.legendReset(d);
        }
    };

    _chart.legendToggle = function () {
        console.log('composite should not be getting legendToggle itself');
    };

    /**
     * Set or get the right y axis used by the composite chart. This function is most useful when y
     * axis customization is required. The y axis in dc.js is an instance of a [d3 axis
     * object](https://github.com/mbostock/d3/wiki/SVG-Axes#wiki-_axis) therefore it supports any valid
     * d3 axis manipulation. **Caution**: The y axis is usually generated internally by dc;
     * resetting it may cause unexpected results.
     * @name rightYAxis
     * @memberof dc.compositeChart
     * @instance
     * @example
     * // customize y axis tick format
     * chart.rightYAxis().tickFormat(function (v) {return v + '%';});
     * // customize y axis tick values
     * chart.rightYAxis().tickValues([0, 100, 200, 300]);
     * @param {d3.svg.axis} [rightYAxis]
     * @return {Chart}
     */
    _chart.rightYAxis = function (rightYAxis) {
        if (!arguments.length) {
            return _rightYAxis;
        }
        _rightYAxis = rightYAxis;
        return _chart;
    };

    return _chart.anchor(parent, chartGroup);
};

/**
 * A series chart is a chart that shows multiple series of data overlaid on one chart, where the
 * series is specified in the data. It is a specialization of Composite Chart and inherits all
 * composite features other than recomposing the chart.
 * @name seriesChart
 * @memberof dc
 * @mixes dc.compositeChart
 * @example
 * // create a series chart under #chart-container1 element using the default global chart group
 * var seriesChart1 = dc.seriesChart("#chart-container1");
 * // create a series chart under #chart-container2 element using chart group A
 * var seriesChart2 = dc.seriesChart("#chart-container2", "chartGroupA");
 * @param {String|node|d3.selection|dc.compositeChart} parent - Any valid
 * [d3 single selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying
 * a dom block element such as a div; or a dom element or d3 selection.  If the bar chart is a sub-chart
 * in a [Composite Chart](#composite-chart) then pass in the parent composite chart instance.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @returns {SeriesChart}
 */
dc.seriesChart = function (parent, chartGroup) {
    var _chart = dc.compositeChart(parent, chartGroup);

    function keySort (a, b) {
        return d3.ascending(_chart.keyAccessor()(a), _chart.keyAccessor()(b));
    }

    var _charts = {};
    var _chartFunction = dc.lineChart;
    var _seriesAccessor;
    var _seriesSort = d3.ascending;
    var _valueSort = keySort;

    _chart._mandatoryAttributes().push('seriesAccessor', 'chart');
    _chart.shareColors(true);

    _chart._preprocessData = function () {
        var keep = [];
        var childrenChanged;
        var nester = d3.nest().key(_seriesAccessor);
        if (_seriesSort) {
            nester.sortKeys(_seriesSort);
        }
        if (_valueSort) {
            nester.sortValues(_valueSort);
        }
        var nesting = nester.entries(_chart.data());
        var children =
            nesting.map(function (sub, i) {
                var subChart = _charts[sub.key] || _chartFunction.call(_chart, _chart, chartGroup, sub.key, i);
                if (!_charts[sub.key]) {
                    childrenChanged = true;
                }
                _charts[sub.key] = subChart;
                keep.push(sub.key);
                return subChart
                    .dimension(_chart.dimension())
                    .group({all: d3.functor(sub.values)}, sub.key)
                    .keyAccessor(_chart.keyAccessor())
                    .valueAccessor(_chart.valueAccessor())
                    .brushOn(_chart.brushOn());
            });
        // this works around the fact compositeChart doesn't really
        // have a removal interface
        Object.keys(_charts)
            .filter(function (c) {return keep.indexOf(c) === -1;})
            .forEach(function (c) {
                clearChart(c);
                childrenChanged = true;
            });
        _chart._compose(children);
        if (childrenChanged && _chart.legend()) {
            _chart.legend().render();
        }
    };

    function clearChart (c) {
        if (_charts[c].g()) {
            _charts[c].g().remove();
        }
        delete _charts[c];
    }

    function resetChildren () {
        Object.keys(_charts).map(clearChart);
        _charts = {};
    }

    /**
     * Get or set the chart function, which generates the child charts.
     * @name chart
     * @memberof dc.seriesChart
     * @instance
     * @example
     * // put interpolation on the line charts used for the series
     * chart.chart(function(c) { return dc.lineChart(c).interpolate('basis'); })
     * // do a scatter series chart
     * chart.chart(dc.scatterPlot)
     * @param {Function} [chartFunction=dc.lineChart]
     * @returns {Chart}
     */
    _chart.chart = function (chartFunction) {
        if (!arguments.length) {
            return _chartFunction;
        }
        _chartFunction = chartFunction;
        resetChildren();
        return _chart;
    };

    /**
     * Get or set accessor function for the displayed series. Given a datum, this function
     * should return the series that datum belongs to.
     * @name seriesAccessor
     * @memberof dc.seriesChart
     * @instance
     * @param {Function} [accessor]
     * @returns {Chart}
     */
    _chart.seriesAccessor = function (accessor) {
        if (!arguments.length) {
            return _seriesAccessor;
        }
        _seriesAccessor = accessor;
        resetChildren();
        return _chart;
    };

    /**
     * Get or set a function to sort the list of series by, given series values.
     * @name seriesSort
     * @memberof dc.seriesChart
     * @instance
     * @example
     * chart.seriesSort(d3.descending);
     * @param {Function} [sortFunction=d3.ascending]
     * @returns {Chart}
     */
    _chart.seriesSort = function (sortFunction) {
        if (!arguments.length) {
            return _seriesSort;
        }
        _seriesSort = sortFunction;
        resetChildren();
        return _chart;
    };

    /**
     * Get or set a function to sort each series values by. By default this is the key accessor which,
     * for example, will ensure a lineChart series connects its points in increasing key/x order,
     * rather than haphazardly.
     * @name valueSort
     * @memberof dc.seriesChart
     * @instance
     * @param {Function} [sortFunction]
     * @returns {Chart}
     */
    _chart.valueSort = function (sortFunction) {
        if (!arguments.length) {
            return _valueSort;
        }
        _valueSort = sortFunction;
        resetChildren();
        return _chart;
    };

    // make compose private
    _chart._compose = _chart.compose;
    delete _chart.compose;

    return _chart;
};

/**
 * The geo choropleth chart is designed as an easy way to create a crossfilter driven choropleth map
 * from GeoJson data. This chart implementation was inspired by [the great d3 choropleth example](http://bl.ocks.org/4060606).
 * Examples:
 * - [US Venture Capital Landscape 2011](http://dc-js.github.com/dc.js/vc/index.html)
 * @name geoChoroplethChart
 * @memberof dc
 * @mixes dc.colorMixin
 * @mixes dc.baseMixin
 * @example
 * // create a choropleth chart under '#us-chart' element using the default global chart group
 * var chart1 = dc.geoChoroplethChart('#us-chart');
 * // create a choropleth chart under '#us-chart2' element using chart group A
 * var chart2 = dc.compositeChart('#us-chart2', 'chartGroupA');
 * @param {String|node|d3.selection|dc.compositeChart} parent - Any valid
 * [d3 single selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying
 * a dom block element such as a div; or a dom element or d3 selection.  If the bar chart is a sub-chart
 * in a [Composite Chart](#composite-chart) then pass in the parent composite chart instance.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @returns {GeoChoroplethChart}
 */
dc.geoChoroplethChart = function (parent, chartGroup) {
    var _chart = dc.colorMixin(dc.baseMixin({}));

    _chart.colorAccessor(function (d) {
        return d || 0;
    });

    var _geoPath = d3.geo.path();
    var _projectionFlag;

    var _geoJsons = [];

    _chart._doRender = function () {
        _chart.resetSvg();
        for (var layerIndex = 0; layerIndex < _geoJsons.length; ++layerIndex) {
            var states = _chart.svg().append('g')
                .attr('class', 'layer' + layerIndex);

            var regionG = states.selectAll('g.' + geoJson(layerIndex).name)
                .data(geoJson(layerIndex).data)
                .enter()
                .append('g')
                .attr('class', geoJson(layerIndex).name);

            regionG
                .append('path')
                .attr('fill', 'white')
                .attr('d', _geoPath);

            regionG.append('title');

            plotData(layerIndex);
        }
        _projectionFlag = false;
    };

    function plotData (layerIndex) {
        var data = generateLayeredData();

        if (isDataLayer(layerIndex)) {
            var regionG = renderRegionG(layerIndex);

            renderPaths(regionG, layerIndex, data);

            renderTitle(regionG, layerIndex, data);
        }
    }

    function generateLayeredData () {
        var data = {};
        var groupAll = _chart.data();
        for (var i = 0; i < groupAll.length; ++i) {
            data[_chart.keyAccessor()(groupAll[i])] = _chart.valueAccessor()(groupAll[i]);
        }
        return data;
    }

    function isDataLayer (layerIndex) {
        return geoJson(layerIndex).keyAccessor;
    }

    function renderRegionG (layerIndex) {
        var regionG = _chart.svg()
            .selectAll(layerSelector(layerIndex))
            .classed('selected', function (d) {
                return isSelected(layerIndex, d);
            })
            .classed('deselected', function (d) {
                return isDeselected(layerIndex, d);
            })
            .attr('class', function (d) {
                var layerNameClass = geoJson(layerIndex).name;
                var regionClass = dc.utils.nameToId(geoJson(layerIndex).keyAccessor(d));
                var baseClasses = layerNameClass + ' ' + regionClass;
                if (isSelected(layerIndex, d)) {
                    baseClasses += ' selected';
                }
                if (isDeselected(layerIndex, d)) {
                    baseClasses += ' deselected';
                }
                return baseClasses;
            });
        return regionG;
    }

    function layerSelector (layerIndex) {
        return 'g.layer' + layerIndex + ' g.' + geoJson(layerIndex).name;
    }

    function isSelected (layerIndex, d) {
        return _chart.hasFilter() && _chart.hasFilter(getKey(layerIndex, d));
    }

    function isDeselected (layerIndex, d) {
        return _chart.hasFilter() && !_chart.hasFilter(getKey(layerIndex, d));
    }

    function getKey (layerIndex, d) {
        return geoJson(layerIndex).keyAccessor(d);
    }

    function geoJson (index) {
        return _geoJsons[index];
    }

    function renderPaths (regionG, layerIndex, data) {
        var paths = regionG
            .select('path')
            .attr('fill', function () {
                var currentFill = d3.select(this).attr('fill');
                if (currentFill) {
                    return currentFill;
                }
                return 'none';
            })
            .on('click', function (d) {
                return _chart.onClick(d, layerIndex);
            });

        dc.transition(paths, _chart.transitionDuration()).attr('fill', function (d, i) {
            return _chart.getColor(data[geoJson(layerIndex).keyAccessor(d)], i);
        });
    }

    _chart.onClick = function (d, layerIndex) {
        var selectedRegion = geoJson(layerIndex).keyAccessor(d);
        dc.events.trigger(function () {
            _chart.filter(selectedRegion);
            _chart.redrawGroup();
        });
    };

    function renderTitle (regionG, layerIndex, data) {
        if (_chart.renderTitle()) {
            regionG.selectAll('title').text(function (d) {
                var key = getKey(layerIndex, d);
                var value = data[key];
                return _chart.title()({key: key, value: value});
            });
        }
    }

    _chart._doRedraw = function () {
        for (var layerIndex = 0; layerIndex < _geoJsons.length; ++layerIndex) {
            plotData(layerIndex);
            if (_projectionFlag) {
                _chart.svg().selectAll('g.' + geoJson(layerIndex).name + ' path').attr('d', _geoPath);
            }
        }
        _projectionFlag = false;
    };

    /**
     * **mandatory**
     *
     * Use this function to insert a new GeoJson map layer. This function can be invoked multiple times
     * if you have multiple GeoJson data layers to render on top of each other. If you overlay multiple
     * layers with the same name the new overlay will override the existing one.
     * @name overlayGeoJson
     * @memberof dc.geoChoroplethChart
     * @instance
     * @example
     * // insert a layer for rendering US states
     * chart.overlayGeoJson(statesJson.features, 'state', function(d) {
     *      return d.properties.name;
     * });
     * @param {Object} json - a geojson feed
     * @param {String} name - name of the layer
     * @param {Function} keyAccessor - accessor function used to extract 'key' from the GeoJson data. The key extracted by
     * this function should match the keys returned by the crossfilter groups.
     * @returns {Chart}
     */
    _chart.overlayGeoJson = function (json, name, keyAccessor) {
        for (var i = 0; i < _geoJsons.length; ++i) {
            if (_geoJsons[i].name === name) {
                _geoJsons[i].data = json;
                _geoJsons[i].keyAccessor = keyAccessor;
                return _chart;
            }
        }
        _geoJsons.push({name: name, data: json, keyAccessor: keyAccessor});
        return _chart;
    };

    /**
     * Set custom geo projection function. See the available [d3 geo projection
     * functions](https://github.com/mbostock/d3/wiki/Geo-Projections).
     * @name projection
     * @memberof dc.geoChoroplethChart
     * @instance
     * @param {d3.projection} [projection=d3.projection.albersUsa()]
     * @returns {Chart}
     */
    _chart.projection = function (projection) {
        _geoPath.projection(projection);
        _projectionFlag = true;
        return _chart;
    };

    /**
     * Returns all GeoJson layers currently registered with this chart. The returned array is a
     * reference to this chart's internal data structure, so any modification to this array will also
     * modify this chart's internal registration.
     * @name geoJsons
     * @memberof dc.geoChoroplethChart
     * @instance
     * @returns {Array<{name:String, data: Object, accessor: Function}>}
     */
    _chart.geoJsons = function () {
        return _geoJsons;
    };

    /**
     * Returns the [d3.geo.path](https://github.com/mbostock/d3/wiki/Geo-Paths#path) object used to
     * render the projection and features.  Can be useful for figuring out the bounding box of the
     * feature set and thus a way to calculate scale and translation for the projection.
     * @name geoPath
     * @memberof dc.geoChoroplethChart
     * @instance
     * @returns {d3.geo.path}
     */
    _chart.geoPath = function () {
        return _geoPath;
    };

    /**
     * Remove a GeoJson layer from this chart by name
     * @name removeGeoJson
     * @memberof dc.geoChoroplethChart
     * @instance
     * @param {String} name
     * @returns {Chart}
     */
    _chart.removeGeoJson = function (name) {
        var geoJsons = [];

        for (var i = 0; i < _geoJsons.length; ++i) {
            var layer = _geoJsons[i];
            if (layer.name !== name) {
                geoJsons.push(layer);
            }
        }

        _geoJsons = geoJsons;

        return _chart;
    };

    return _chart.anchor(parent, chartGroup);
};

/**
 * The bubble overlay chart is quite different from the typical bubble chart. With the bubble overlay
 * chart you can arbitrarily place bubbles on an existing svg or bitmap image, thus changing the
 * typical x and y positioning while retaining the capability to visualize data using bubble radius
 * and coloring.
 * Examples:
 * - [Canadian City Crime Stats](http://dc-js.github.com/dc.js/crime/index.html)
 * @name bubbleOverlay
 * @memberof dc
 * @mixes dc.bubbleMixin
 * @mixes dc.baseMixin
 * @example
 * // create a bubble overlay chart on top of the '#chart-container1 svg' element using the default global chart group
 * var bubbleChart1 = dc.bubbleOverlayChart('#chart-container1').svg(d3.select('#chart-container1 svg'));
 * // create a bubble overlay chart on top of the '#chart-container2 svg' element using chart group A
 * var bubbleChart2 = dc.compositeChart('#chart-container2', 'chartGroupA').svg(d3.select('#chart-container2 svg'));
 * @param {String|node|d3.selection|dc.compositeChart} parent - Any valid
 * [d3 single selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying
 * a dom block element such as a div; or a dom element or d3 selection.  If the bar chart is a sub-chart
 * in a [Composite Chart](#composite-chart) then pass in the parent composite chart instance.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @returns {BubbleOverlay}
 */
dc.bubbleOverlay = function (parent, chartGroup) {
    var BUBBLE_OVERLAY_CLASS = 'bubble-overlay';
    var BUBBLE_NODE_CLASS = 'node';
    var BUBBLE_CLASS = 'bubble';

    /**
     * **mandatory**
     *
     * Set the underlying svg image element. Unlike other dc charts this chart will not generate a svg
     * element; therefore the bubble overlay chart will not work if this function is not invoked. If the
     * underlying image is a bitmap, then an empty svg will need to be created on top of the image.
     * @name svg
     * @memberof dc.bubbleOverlay
     * @instance
     * @example
     * // set up underlying svg element
     * chart.svg(d3.select('#chart svg'));
     * @param {Selection} [imageElement]
     * @returns {Chart}
     */
    var _chart = dc.bubbleMixin(dc.baseMixin({}));
    var _g;
    var _points = [];

    _chart.transitionDuration(750);

    _chart.radiusValueAccessor(function (d) {
        return d.value;
    });

    /**
     * **mandatory**
     *
     * Set up a data point on the overlay. The name of a data point should match a specific 'key' among
     * data groups generated using keyAccessor.  If a match is found (point name <-> data group key)
     * then a bubble will be generated at the position specified by the function. x and y
     * value specified here are relative to the underlying svg.
     * @name point
     * @memberof dc.bubbleOverlay
     * @instance
     * @param {String} name
     * @param {Number} x
     * @param {Number} y
     * @returns {Chart}
     */
    _chart.point = function (name, x, y) {
        _points.push({name: name, x: x, y: y});
        return _chart;
    };

    _chart._doRender = function () {
        _g = initOverlayG();

        _chart.r().range([_chart.MIN_RADIUS, _chart.width() * _chart.maxBubbleRelativeSize()]);

        initializeBubbles();

        _chart.fadeDeselectedArea();

        return _chart;
    };

    function initOverlayG () {
        _g = _chart.select('g.' + BUBBLE_OVERLAY_CLASS);
        if (_g.empty()) {
            _g = _chart.svg().append('g').attr('class', BUBBLE_OVERLAY_CLASS);
        }
        return _g;
    }

    function initializeBubbles () {
        var data = mapData();

        _points.forEach(function (point) {
            var nodeG = getNodeG(point, data);

            var circle = nodeG.select('circle.' + BUBBLE_CLASS);

            if (circle.empty()) {
                circle = nodeG.append('circle')
                    .attr('class', BUBBLE_CLASS)
                    .attr('r', 0)
                    .attr('fill', _chart.getColor)
                    .on('click', _chart.onClick);
            }

            dc.transition(circle, _chart.transitionDuration())
                .attr('r', function (d) {
                    return _chart.bubbleR(d);
                });

            _chart._doRenderLabel(nodeG);

            _chart._doRenderTitles(nodeG);
        });
    }

    function mapData () {
        var data = {};
        _chart.data().forEach(function (datum) {
            data[_chart.keyAccessor()(datum)] = datum;
        });
        return data;
    }

    function getNodeG (point, data) {
        var bubbleNodeClass = BUBBLE_NODE_CLASS + ' ' + dc.utils.nameToId(point.name);

        var nodeG = _g.select('g.' + dc.utils.nameToId(point.name));

        if (nodeG.empty()) {
            nodeG = _g.append('g')
                .attr('class', bubbleNodeClass)
                .attr('transform', 'translate(' + point.x + ',' + point.y + ')');
        }

        nodeG.datum(data[point.name]);

        return nodeG;
    }

    _chart._doRedraw = function () {
        updateBubbles();

        _chart.fadeDeselectedArea();

        return _chart;
    };

    function updateBubbles () {
        var data = mapData();

        _points.forEach(function (point) {
            var nodeG = getNodeG(point, data);

            var circle = nodeG.select('circle.' + BUBBLE_CLASS);

            dc.transition(circle, _chart.transitionDuration())
                .attr('r', function (d) {
                    return _chart.bubbleR(d);
                })
                .attr('fill', _chart.getColor);

            _chart.doUpdateLabels(nodeG);

            _chart.doUpdateTitles(nodeG);
        });
    }

    _chart.debug = function (flag) {
        if (flag) {
            var debugG = _chart.select('g.' + dc.constants.DEBUG_GROUP_CLASS);

            if (debugG.empty()) {
                debugG = _chart.svg()
                    .append('g')
                    .attr('class', dc.constants.DEBUG_GROUP_CLASS);
            }

            var debugText = debugG.append('text')
                .attr('x', 10)
                .attr('y', 20);

            debugG
                .append('rect')
                .attr('width', _chart.width())
                .attr('height', _chart.height())
                .on('mousemove', function () {
                    var position = d3.mouse(debugG.node());
                    var msg = position[0] + ', ' + position[1];
                    debugText.text(msg);
                });
        } else {
            _chart.selectAll('.debug').remove();
        }

        return _chart;
    };

    _chart.anchor(parent, chartGroup);

    return _chart;
};

/**
 * Concrete row chart implementation.
 * @name rowChart
 * @memberof dc
 * @mixes dc.capMixin
 * @mixes dc.marginMixin
 * @mixes dc.colorMixin
 * @mixes dc.baseMixin
 * @example
 * // create a row chart under #chart-container1 element using the default global chart group
 * var chart1 = dc.rowChart('#chart-container1');
 * // create a row chart under #chart-container2 element using chart group A
 * var chart2 = dc.rowChart('#chart-container2', 'chartGroupA');
 * @param {String|node|d3.selection|dc.compositeChart} parent - Any valid
 * [d3 single selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying
 * a dom block element such as a div; or a dom element or d3 selection.  If the bar chart is a sub-chart
 * in a [Composite Chart](#composite-chart) then pass in the parent composite chart instance.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @returns {RowChart}
 */
dc.rowChart = function (parent, chartGroup) {

    var _g;

    var _labelOffsetX = 10;
    var _labelOffsetY = 15;
    var _hasLabelOffsetY = false;
    var _dyOffset = '0.35em';  // this helps center labels https://github.com/mbostock/d3/wiki/SVG-Shapes#svg_text
    var _titleLabelOffsetX = 2;

    var _gap = 5;

    var _fixedBarHeight = false;
    var _rowCssClass = 'row';
    var _titleRowCssClass = 'titlerow';
    var _renderTitleLabel = false;

    var _chart = dc.capMixin(dc.marginMixin(dc.colorMixin(dc.baseMixin({}))));

    var _x;

    var _elasticX;

    var _xAxis = d3.svg.axis().orient('bottom');

    var _rowData;

    _chart.rowsCap = _chart.cap;

    function calculateAxisScale () {
        if (!_x || _elasticX) {
            var extent = d3.extent(_rowData, _chart.cappedValueAccessor);
            if (extent[0] > 0) {
                extent[0] = 0;
            }
            _x = d3.scale.linear().domain(extent)
                .range([0, _chart.effectiveWidth()]);
        }
        _xAxis.scale(_x);
    }

    function drawAxis () {
        var axisG = _g.select('g.axis');

        calculateAxisScale();

        if (axisG.empty()) {
            axisG = _g.append('g').attr('class', 'axis')
                .attr('transform', 'translate(0, ' + _chart.effectiveHeight() + ')');
        }

        dc.transition(axisG, _chart.transitionDuration())
            .call(_xAxis);
    }

    _chart._doRender = function () {
        _chart.resetSvg();

        _g = _chart.svg()
            .append('g')
            .attr('transform', 'translate(' + _chart.margins().left + ',' + _chart.margins().top + ')');

        drawChart();

        return _chart;
    };

    _chart.title(function (d) {
        return _chart.cappedKeyAccessor(d) + ': ' + _chart.cappedValueAccessor(d);
    });

    _chart.label(_chart.cappedKeyAccessor);

    /**
     * Gets or sets the x scale. The x scale can be any d3
     * [quantitive scale](https://github.com/mbostock/d3/wiki/Quantitative-Scales)
     * @name x
     * @memberof dc.rowChart
     * @instance
     * @param {d3.scale} [scale]
     * @returns {Chart}
     */
    _chart.x = function (scale) {
        if (!arguments.length) {
            return _x;
        }
        _x = scale;
        return _chart;
    };

    function drawGridLines () {
        _g.selectAll('g.tick')
            .select('line.grid-line')
            .remove();

        _g.selectAll('g.tick')
            .append('line')
            .attr('class', 'grid-line')
            .attr('x1', 0)
            .attr('y1', 0)
            .attr('x2', 0)
            .attr('y2', function () {
                return -_chart.effectiveHeight();
            });
    }

    function drawChart () {
        _rowData = _chart.data();

        drawAxis();
        drawGridLines();

        var rows = _g.selectAll('g.' + _rowCssClass)
            .data(_rowData);

        createElements(rows);
        removeElements(rows);
        updateElements(rows);
    }

    function createElements (rows) {
        var rowEnter = rows.enter()
            .append('g')
            .attr('class', function (d, i) {
                return _rowCssClass + ' _' + i;
            });

        rowEnter.append('rect').attr('width', 0);

        createLabels(rowEnter);
        updateLabels(rows);
    }

    function removeElements (rows) {
        rows.exit().remove();
    }

    function rootValue () {
        var root = _x(0);
        return (root === -Infinity || root !== root) ? _x(1) : root;
    }

    function updateElements (rows) {
        var n = _rowData.length;

        var height;
        if (!_fixedBarHeight) {
            height = (_chart.effectiveHeight() - (n + 1) * _gap) / n;
        } else {
            height = _fixedBarHeight;
        }

        // vertically align label in center unless they override the value via property setter
        if (!_hasLabelOffsetY) {
            _labelOffsetY = height / 2;
        }

        var rect = rows.attr('transform', function (d, i) {
                return 'translate(0,' + ((i + 1) * _gap + i * height) + ')';
            }).select('rect')
            .attr('height', height)
            .attr('fill', _chart.getColor)
            .on('click', onClick)
            .classed('deselected', function (d) {
                return (_chart.hasFilter()) ? !isSelectedRow(d) : false;
            })
            .classed('selected', function (d) {
                return (_chart.hasFilter()) ? isSelectedRow(d) : false;
            });

        dc.transition(rect, _chart.transitionDuration())
            .attr('width', function (d) {
                return Math.abs(rootValue() - _x(_chart.valueAccessor()(d)));
            })
            .attr('transform', translateX);

        createTitles(rows);
        updateLabels(rows);
    }

    function createTitles (rows) {
        if (_chart.renderTitle()) {
            rows.selectAll('title').remove();
            rows.append('title').text(_chart.title());
        }
    }

    function createLabels (rowEnter) {
        if (_chart.renderLabel()) {
            rowEnter.append('text')
                .on('click', onClick);
        }
        if (_chart.renderTitleLabel()) {
            rowEnter.append('text')
                .attr('class', _titleRowCssClass)
                .on('click', onClick);
        }
    }

    function updateLabels (rows) {
        if (_chart.renderLabel()) {
            var lab = rows.select('text')
                .attr('x', _labelOffsetX)
                .attr('y', _labelOffsetY)
                .attr('dy', _dyOffset)
                .on('click', onClick)
                .attr('class', function (d, i) {
                    return _rowCssClass + ' _' + i;
                })
                .text(function (d) {
                    return _chart.label()(d);
                });
            dc.transition(lab, _chart.transitionDuration())
                .attr('transform', translateX);
        }
        if (_chart.renderTitleLabel()) {
            var titlelab = rows.select('.' + _titleRowCssClass)
                    .attr('x', _chart.effectiveWidth() - _titleLabelOffsetX)
                    .attr('y', _labelOffsetY)
                    .attr('text-anchor', 'end')
                    .on('click', onClick)
                    .attr('class', function (d, i) {
                        return _titleRowCssClass + ' _' + i ;
                    })
                    .text(function (d) {
                        return _chart.title()(d);
                    });
            dc.transition(titlelab, _chart.transitionDuration())
                .attr('transform', translateX);
        }
    }

    /**
     * Turn on/off Title label rendering (values) using SVG style of text-anchor 'end'
     * @name renderTitleLabel
     * @memberof dc.rowChart
     * @instance
     * @param {Boolean} [renderTitleLabel=false]
     * @returns {Chart}
     */
    _chart.renderTitleLabel = function (renderTitleLabel) {
        if (!arguments.length) {
            return _renderTitleLabel;
        }
        _renderTitleLabel = renderTitleLabel;
        return _chart;
    };

    function onClick (d) {
        _chart.onClick(d);
    }

    function translateX (d) {
        var x = _x(_chart.cappedValueAccessor(d)),
            x0 = rootValue(),
            s = x > x0 ? x0 : x;
        return 'translate(' + s + ',0)';
    }

    _chart._doRedraw = function () {
        drawChart();
        return _chart;
    };

    /**
     * Get the x axis for the row chart instance.  Note: not settable for row charts.
     * See the [d3 axis object](https://github.com/mbostock/d3/wiki/SVG-Axes#wiki-axis) documention for more information.
     * @name xAxis
     * @memberof dc.rowChart
     * @instance
     * @example
     * // customize x axis tick format
     * chart.xAxis().tickFormat(function (v) {return v + '%';});
     * // customize x axis tick values
     * chart.xAxis().tickValues([0, 100, 200, 300]);
     * @returns {d3.svg.Axis}
     */
    _chart.xAxis = function () {
        return _xAxis;
    };

    /**
     * Get or set the fixed bar height. Default is [false] which will auto-scale bars.
     * For example, if you want to fix the height for a specific number of bars (useful in TopN charts)
     * you could fix height as follows (where count = total number of bars in your TopN and gap is
     * your vertical gap space).
     * @name fixedBarHeight
     * @memberof dc.rowChart
     * @instance
     * @example
     * chart.fixedBarHeight( chartheight - (count + 1) * gap / count);
     * @param {Boolean|Number} [fixedBarHeight=false]
     * @returns {Chart}
     */
    _chart.fixedBarHeight = function (fixedBarHeight) {
        if (!arguments.length) {
            return _fixedBarHeight;
        }
        _fixedBarHeight = fixedBarHeight;
        return _chart;
    };

    /**
     * Get or set the vertical gap space between rows on a particular row chart instance
     * @name gap
     * @memberof dc.rowChart
     * @instance
     * @param {Number} [gap=5]
     * @returns {Chart}
     */
    _chart.gap = function (gap) {
        if (!arguments.length) {
            return _gap;
        }
        _gap = gap;
        return _chart;
    };

    /**
     * Get or set the elasticity on x axis. If this attribute is set to true, then the x axis will rescle to auto-fit the
     * data range when filtered.
     * @name elasticX
     * @memberof dc.rowChart
     * @instance
     * @param {Boolean} [elasticX]
     * @returns {Chart}
     */
    _chart.elasticX = function (elasticX) {
        if (!arguments.length) {
            return _elasticX;
        }
        _elasticX = elasticX;
        return _chart;
    };

    /**
     * Get or set the x offset (horizontal space to the top left corner of a row) for labels on a particular row chart.
     * @name labelOffsetX
     * @memberof dc.rowChart
     * @instance
     * @param {Number} [labelOffsetX=10]
     * @returns {Chart}
     */
    _chart.labelOffsetX = function (labelOffsetX) {
        if (!arguments.length) {
            return _labelOffsetX;
        }
        _labelOffsetX = labelOffsetX;
        return _chart;
    };

    /**
     * Get or set the y offset (vertical space to the top left corner of a row) for labels on a particular row chart.
     * @name labelOffsetY
     * @memberof dc.rowChart
     * @instance
     * @param {Number} [labelOffsety=15]
     * @returns {Chart}
     */
    _chart.labelOffsetY = function (labelOffsety) {
        if (!arguments.length) {
            return _labelOffsetY;
        }
        _labelOffsetY = labelOffsety;
        _hasLabelOffsetY = true;
        return _chart;
    };

    /**
     * Get of set the x offset (horizontal space between right edge of row and right edge or text.
     * @name titleLabelOffsetX
     * @memberof dc.rowChart
     * @instance
     * @param {Number} [titleLabelOffsetX=2]
     * @returns {Chart}
     */
    _chart.titleLabelOffsetX = function (titleLabelOffsetX) {
        if (!arguments.length) {
            return _titleLabelOffsetX;
        }
        _titleLabelOffsetX = titleLabelOffsetX;
        return _chart;
    };

    function isSelectedRow (d) {
        return _chart.hasFilter(_chart.cappedKeyAccessor(d));
    }

    return _chart.anchor(parent, chartGroup);
};

/**
 * Legend is a attachable widget that can be added to other dc charts to render horizontal legend
 * labels.
 * Examples:
 * - [Nasdaq 100 Index](http://dc-js.github.com/dc.js/)
 * - [Canadian City Crime Stats](http://dc-js.github.com/dc.js/crime/index.html)
 * @name legend
 * @memberof dc
 * @example
 * chart.legend(dc.legend().x(400).y(10).itemHeight(13).gap(5))
 * @returns {Legend}
 */
dc.legend = function () {
    var LABEL_GAP = 2;

    var _legend = {},
        _parent,
        _x = 0,
        _y = 0,
        _itemHeight = 12,
        _gap = 5,
        _horizontal = false,
        _legendWidth = 560,
        _itemWidth = 70,
        _autoItemWidth = false;

    var _g;

    _legend.parent = function (p) {
        if (!arguments.length) {
            return _parent;
        }
        _parent = p;
        return _legend;
    };

    _legend.render = function () {
        _parent.svg().select('g.dc-legend').remove();
        _g = _parent.svg().append('g')
            .attr('class', 'dc-legend')
            .attr('transform', 'translate(' + _x + ',' + _y + ')');
        var legendables = _parent.legendables();

        var itemEnter = _g.selectAll('g.dc-legend-item')
            .data(legendables)
            .enter()
            .append('g')
            .attr('class', 'dc-legend-item')
            .on('mouseover', function (d) {
                _parent.legendHighlight(d);
            })
            .on('mouseout', function (d) {
                _parent.legendReset(d);
            })
            .on('click', function (d) {
                d.chart.legendToggle(d);
            });

        _g.selectAll('g.dc-legend-item')
            .classed('fadeout', function (d) {
                return d.chart.isLegendableHidden(d);
            });

        if (legendables.some(dc.pluck('dashstyle'))) {
            itemEnter
                .append('line')
                .attr('x1', 0)
                .attr('y1', _itemHeight / 2)
                .attr('x2', _itemHeight)
                .attr('y2', _itemHeight / 2)
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', dc.pluck('dashstyle'))
                .attr('stroke', dc.pluck('color'));
        } else {
            itemEnter
                .append('rect')
                .attr('width', _itemHeight)
                .attr('height', _itemHeight)
                .attr('fill', function (d) {return d ? d.color : 'blue';});
        }

        itemEnter.append('text')
                .text(dc.pluck('name'))
                .attr('x', _itemHeight + LABEL_GAP)
                .attr('y', function () {
                    return _itemHeight / 2 + (this.clientHeight ? this.clientHeight : 13) / 2 - 2;
                });

        var _cumulativeLegendTextWidth = 0;
        var row = 0;
        itemEnter.attr('transform', function (d, i) {
            if (_horizontal) {
                var translateBy = 'translate(' + _cumulativeLegendTextWidth + ',' + row * legendItemHeight() + ')';
                var itemWidth   = _autoItemWidth === true ? this.getBBox().width + _gap : _itemWidth;

                if ((_cumulativeLegendTextWidth + itemWidth) >= _legendWidth) {
                    ++row ;
                    _cumulativeLegendTextWidth = 0 ;
                } else {
                    _cumulativeLegendTextWidth += itemWidth;
                }
                return translateBy;
            } else {
                return 'translate(0,' + i * legendItemHeight() + ')';
            }
        });
    };

    function legendItemHeight () {
        return _gap + _itemHeight;
    }

    /**
     * Set or get x coordinate for legend widget.
     * @name x
     * @memberof dc.legend
     * @instance
     * @param  {Number} [x=0]
     * @returns {Legend}
     */
    _legend.x = function (x) {
        if (!arguments.length) {
            return _x;
        }
        _x = x;
        return _legend;
    };

    /**
     * Set or get y coordinate for legend widget.
     * @name y
     * @memberof dc.legend
     * @instance
     * @param  {Number} [y=0]
     * @returns {Legend}
     */
    _legend.y = function (y) {
        if (!arguments.length) {
            return _y;
        }
        _y = y;
        return _legend;
    };

    /**
     * Set or get gap between legend items.
     * @name gap
     * @memberof dc.legend
     * @instance
     * @param  {Number} [gap=5]
     * @returns {Legend}
     */
    _legend.gap = function (gap) {
        if (!arguments.length) {
            return _gap;
        }
        _gap = gap;
        return _legend;
    };

    /**
     * Set or get legend item height.
     * @name itemHeight
     * @memberof dc.legend
     * @instance
     * @param  {Number} [itemHeight=12]
     * @returns {Legend}
     */
    _legend.itemHeight = function (itemHeight) {
        if (!arguments.length) {
            return _itemHeight;
        }
        _itemHeight = itemHeight;
        return _legend;
    };

    /**
     * Position legend horizontally instead of vertically.
     * @name horizontal
     * @memberof dc.legend
     * @instance
     * @param  {Boolean} [horizontal=false]
     * @returns {Legend}
     */
    _legend.horizontal = function (horizontal) {
        if (!arguments.length) {
            return _horizontal;
        }
        _horizontal = horizontal;
        return _legend;
    };

    /**
     * Maximum width for horizontal legend.
     * @name legendWidth
     * @memberof dc.legend
     * @instance
     * @param  {Number} [legendWidth=500]
     * @returns {Legend}
     */
    _legend.legendWidth = function (legendWidth) {
        if (!arguments.length) {
            return _legendWidth;
        }
        _legendWidth = legendWidth;
        return _legend;
    };

    /**
     * legendItem width for horizontal legend.
     * @name itemWidth
     * @memberof dc.legend
     * @instance
     * @param  {Number} [itemWidth=70]
     * @returns {Legend}
     */
    _legend.itemWidth = function (itemWidth) {
        if (!arguments.length) {
            return _itemWidth;
        }
        _itemWidth = itemWidth;
        return _legend;
    };

    /**
     * Turn automatic width for legend items on or off. If true, itemWidth() is ignored.
     * This setting takes into account gap().
     * @name autoItemWidth
     * @memberof dc.legend
     * @instance
     * @param  {Boolean} [autoItemWidth=false]
     * @returns {Legend}
     */
    _legend.autoItemWidth = function (autoItemWidth) {
        if (!arguments.length) {
            return _autoItemWidth;
        }
        _autoItemWidth = autoItemWidth;
        return _legend;
    };

    return _legend;
};

/**
 * A scatter plot chart
 * @name scatterPlot
 * @memberof dc
 * @mixes dc.coordinateGridMixin
 * @example
 * // create a scatter plot under #chart-container1 element using the default global chart group
 * var chart1 = dc.scatterPlot('#chart-container1');
 * // create a scatter plot under #chart-container2 element using chart group A
 * var chart2 = dc.scatterPlot('#chart-container2', 'chartGroupA');
 * // create a sub-chart under a composite parent chart
 * var chart3 = dc.scatterPlot(compositeChart);
 * @param {String|node|d3.selection|dc.compositeChart} parent - Any valid
 * [d3 single selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying
 * a dom block element such as a div; or a dom element or d3 selection.  If the bar chart is a sub-chart
 * in a [Composite Chart](#composite-chart) then pass in the parent composite chart instance.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @returns {SeriesChart}
 */
dc.scatterPlot = function (parent, chartGroup) {
    var _chart = dc.coordinateGridMixin({});
    var _symbol = d3.svg.symbol();

    var _existenceAccessor = function (d) { return d.value; };

    var originalKeyAccessor = _chart.keyAccessor();
    _chart.keyAccessor(function (d) { return originalKeyAccessor(d)[0]; });
    _chart.valueAccessor(function (d) { return originalKeyAccessor(d)[1]; });
    _chart.colorAccessor(function () { return _chart._groupName; });

    var _locator = function (d) {
        return 'translate(' + _chart.x()(_chart.keyAccessor()(d)) + ',' +
                              _chart.y()(_chart.valueAccessor()(d)) + ')';
    };

    var _symbolSize = 3;
    var _highlightedSize = 5;
    var _hiddenSize = 0;

    _symbol.size(function (d) {
        if (!_existenceAccessor(d)) {
            return _hiddenSize;
        } else if (this.filtered) {
            return Math.pow(_highlightedSize, 2);
        } else {
            return Math.pow(_symbolSize, 2);
        }
    });

    dc.override(_chart, '_filter', function (filter) {
        if (!arguments.length) {
            return _chart.__filter();
        }

        return _chart.__filter(dc.filters.RangedTwoDimensionalFilter(filter));
    });

    _chart.plotData = function () {
        var symbols = _chart.chartBodyG().selectAll('path.symbol')
            .data(_chart.data());

        symbols
            .enter()
        .append('path')
            .attr('class', 'symbol')
            .attr('opacity', 0)
            .attr('fill', _chart.getColor)
            .attr('transform', _locator);

        dc.transition(symbols, _chart.transitionDuration())
            .attr('opacity', function (d) { return _existenceAccessor(d) ? 1 : 0; })
            .attr('fill', _chart.getColor)
            .attr('transform', _locator)
            .attr('d', _symbol);

        dc.transition(symbols.exit(), _chart.transitionDuration())
            .attr('opacity', 0).remove();
    };

    /**
     * Get or set the existence accessor.  If a point exists, it is drawn with symbolSize radius and
     * opacity 1; if it does not exist, it is drawn with hiddenSize radius and opacity 0. By default,
     * the existence accessor checks if the reduced value is truthy.
     * @name existenceAccessor
     * @memberof dc.scatterPlot
     * @instance
     * @param {Function} [accessor]
     * @returns {Chart}
     */
    _chart.existenceAccessor = function (accessor) {
        if (!arguments.length) {
            return _existenceAccessor;
        }
        _existenceAccessor = accessor;
        return this;
    };

    /**
     * Get or set the symbol type used for each point. By default the symbol is a circle. See the D3
     * [docs](https://github.com/mbostock/d3/wiki/SVG-Shapes#wiki-symbol_type) for acceptable types.
     * Type can be a constant or an accessor.
     * @name symbol
     * @memberof dc.scatterPlot
     * @instance
     * @param {Function} [type]
     * @returns {Chart}
     */
    _chart.symbol = function (type) {
        if (!arguments.length) {
            return _symbol.type();
        }
        _symbol.type(type);
        return _chart;
    };

    /**
     * Set or get radius for symbols.
     * @name symbolSize
     * @memberof dc.scatterPlot
     * @instance
     * @param {Number} [symbolSize=3]
     * @returns {Chart}
     */
    _chart.symbolSize = function (symbolSize) {
        if (!arguments.length) {
            return _symbolSize;
        }
        _symbolSize = symbolSize;
        return _chart;
    };

    /**
     * Set or get radius for highlighted symbols.
     * @name highlightedSize
     * @memberof dc.scatterPlot
     * @instance
     * @param {Number} [highlightedSize=5]
     * @returns {Chart}
     */
    _chart.highlightedSize = function (highlightedSize) {
        if (!arguments.length) {
            return _highlightedSize;
        }
        _highlightedSize = highlightedSize;
        return _chart;
    };

    /**
     * Set or get radius for symbols when the group is empty.
     * @name hiddenSize
     * @memberof dc.scatterPlot
     * @instance
     * @param {Number} [hiddenSize=0]
     * @returns {Chart}
     */
    _chart.hiddenSize = function (hiddenSize) {
        if (!arguments.length) {
            return _hiddenSize;
        }
        _hiddenSize = hiddenSize;
        return _chart;
    };

    _chart.legendables = function () {
        return [{chart: _chart, name: _chart._groupName, color: _chart.getColor()}];
    };

    _chart.legendHighlight = function (d) {
        resizeSymbolsWhere(function (symbol) {
            return symbol.attr('fill') === d.color;
        }, _highlightedSize);
        _chart.selectAll('.chart-body path.symbol').filter(function () {
            return d3.select(this).attr('fill') !== d.color;
        }).classed('fadeout', true);
    };

    _chart.legendReset = function (d) {
        resizeSymbolsWhere(function (symbol) {
            return symbol.attr('fill') === d.color;
        }, _symbolSize);
        _chart.selectAll('.chart-body path.symbol').filter(function () {
            return d3.select(this).attr('fill') !== d.color;
        }).classed('fadeout', false);
    };

    function resizeSymbolsWhere (condition, size) {
        var symbols = _chart.selectAll('.chart-body path.symbol').filter(function () {
            return condition(d3.select(this));
        });
        var oldSize = _symbol.size();
        _symbol.size(Math.pow(size, 2));
        dc.transition(symbols, _chart.transitionDuration()).attr('d', _symbol);
        _symbol.size(oldSize);
    }

    _chart.setHandlePaths = function () {
        // no handle paths for poly-brushes
    };

    _chart.extendBrush = function () {
        var extent = _chart.brush().extent();
        if (_chart.round()) {
            extent[0] = extent[0].map(_chart.round());
            extent[1] = extent[1].map(_chart.round());

            _chart.g().select('.brush')
                .call(_chart.brush().extent(extent));
        }
        return extent;
    };

    _chart.brushIsEmpty = function (extent) {
        return _chart.brush().empty() || !extent || extent[0][0] >= extent[1][0] || extent[0][1] >= extent[1][1];
    };

    function resizeFiltered (filter) {
        var symbols = _chart.selectAll('.chart-body path.symbol').each(function (d) {
            this.filtered = filter && filter.isFiltered(d.key);
        });

        dc.transition(symbols, _chart.transitionDuration()).attr('d', _symbol);
    }

    _chart._brushing = function () {
        var extent = _chart.extendBrush();

        _chart.redrawBrush(_chart.g());

        if (_chart.brushIsEmpty(extent)) {
            dc.events.trigger(function () {
                _chart.filter(null);
                _chart.redrawGroup();
            });

            resizeFiltered(false);

        } else {
            var ranged2DFilter = dc.filters.RangedTwoDimensionalFilter(extent);
            dc.events.trigger(function () {
                _chart.filter(null);
                _chart.filter(ranged2DFilter);
                _chart.redrawGroup();
            }, dc.constants.EVENT_DELAY);

            resizeFiltered(ranged2DFilter);
        }
    };

    _chart.setBrushY = function (gBrush) {
        gBrush.call(_chart.brush().y(_chart.y()));
    };

    return _chart.anchor(parent, chartGroup);
};

/**
 * A display of a single numeric value.
 * Unlike other charts, you do not need to set a dimension. Instead a group object must be provided and
 * a valueAccessor that returns a single value.
 * @name numberDisplay
 * @memberof dc
 * @mixes dc.baseMixin
 * @example
 * // create a number display under #chart-container1 element using the default global chart group
 * var display1 = dc.numberDisplay('#chart-container1');
 * @param {String|node|d3.selection|dc.compositeChart} parent - Any valid
 * [d3 single selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying
 * a dom block element such as a div; or a dom element or d3 selection.  If the bar chart is a sub-chart
 * in a [Composite Chart](#composite-chart) then pass in the parent composite chart instance.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @returns {NumberDisplay}
 */
dc.numberDisplay = function (parent, chartGroup) {
    var SPAN_CLASS = 'number-display';
    var _formatNumber = d3.format('.2s');
    var _chart = dc.baseMixin({});
    var _html = {one: '', some: '', none: ''};

    // dimension not required
    _chart._mandatoryAttributes(['group']);

    /**
     * Gets or sets an optional object specifying HTML templates to use depending on the number
     * displayed.  The text `%number` will be replaced with the current value.
     * - one: HTML template to use if the number is 1
     * - zero: HTML template to use if the number is 0
     * - some: HTML template to use otherwise
     * @name html
     * @memberof dc.numberDisplay
     * @instance
     * @example
     * numberWidget.html({
     *      one:'%number record',
     *      some:'%number records',
     *      none:'no records'})
     * @param {{one:String, some:String, none:String}} [html={one: '', some: '', none: ''}]
     * @returns {Chart}
     */
    _chart.html = function (html) {
        if (!arguments.length) {
            return _html;
        }
        if (html.none) {
            _html.none = html.none;//if none available
        } else if (html.one) {
            _html.none = html.one;//if none not available use one
        } else if (html.some) {
            _html.none = html.some;//if none and one not available use some
        }
        if (html.one) {
            _html.one = html.one;//if one available
        } else if (html.some) {
            _html.one = html.some;//if one not available use some
        }
        if (html.some) {
            _html.some = html.some;//if some available
        } else if (html.one) {
            _html.some = html.one;//if some not available use one
        }
        return _chart;
    };

    /**
     * Calculate and return the underlying value of the display
     * @name value
     * @memberof dc.numberDisplay
     * @instance
     * @returns {Number}
     */
    _chart.value = function () {
        return _chart.data();
    };

    _chart.data(function (group) {
        var valObj = group.value ? group.value() : group.top(1)[0];
        return _chart.valueAccessor()(valObj);
    });

    _chart.transitionDuration(250); // good default

    _chart._doRender = function () {
        var newValue = _chart.value(),
            span = _chart.selectAll('.' + SPAN_CLASS);

        if (span.empty()) {
            span = span.data([0])
                .enter()
                .append('span')
                .attr('class', SPAN_CLASS);
        }

        span.transition()
            .duration(_chart.transitionDuration())
            .ease('quad-out-in')
            .tween('text', function () {
                var interp = d3.interpolateNumber(this.lastValue || 0, newValue);
                this.lastValue = newValue;
                return function (t) {
                    var html = null, num = _chart.formatNumber()(interp(t));
                    if (newValue === 0 && (_html.none !== '')) {
                        html = _html.none;
                    } else if (newValue === 1 && (_html.one !== '')) {
                        html = _html.one;
                    } else if (_html.some !== '') {
                        html = _html.some;
                    }
                    this.innerHTML = html ? html.replace('%number', num) : num;
                };
            });
    };

    _chart._doRedraw = function () {
        return _chart._doRender();
    };

    /**
     * Get or set a function to format the value for the display.
     * @name formatNumber
     * @memberof dc.numberDisplay
     * @instance
     * @param {Function} [formatter=d3.format('.2s')]
     * @returns {Chart}
     */
    _chart.formatNumber = function (formatter) {
        if (!arguments.length) {
            return _formatNumber;
        }
        _formatNumber = formatter;
        return _chart;
    };

    return _chart.anchor(parent, chartGroup);
};

/**
 * A heat map is matrix that represents the values of two dimensions of data using colors.
 * @name heatMap
 * @memberof dc
 * @mixes dc.colorMixin
 * @mixes dc.marginMixin
 * @mixes dc.baseMixin
 * @example
 * // create a heat map under #chart-container1 element using the default global chart group
 * var heatMap1 = dc.heatMap('#chart-container1');
 * // create a heat map under #chart-container2 element using chart group A
 * var heatMap2 = dc.heatMap('#chart-container2', 'chartGroupA');
 * @param {String|node|d3.selection|dc.compositeChart} parent - Any valid
 * [d3 single selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying
 * a dom block element such as a div; or a dom element or d3 selection.  If the bar chart is a sub-chart
 * in a [Composite Chart](#composite-chart) then pass in the parent composite chart instance.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @returns {HeatMap}
 */
dc.heatMap = function (parent, chartGroup) {

    var DEFAULT_BORDER_RADIUS = 6.75;

    var _chartBody;

    var _cols;
    var _rows;
    var _colOrdering = d3.ascending;
    var _rowOrdering = d3.ascending;
    var _colScale = d3.scale.ordinal();
    var _rowScale = d3.scale.ordinal();

    var _xBorderRadius = DEFAULT_BORDER_RADIUS;
    var _yBorderRadius = DEFAULT_BORDER_RADIUS;

    var _chart = dc.colorMixin(dc.marginMixin(dc.baseMixin({})));
    _chart._mandatoryAttributes(['group']);
    _chart.title(_chart.colorAccessor());

    var _colsLabel = function (d) {
        return d;
    };
    var _rowsLabel = function (d) {
        return d;
    };

    /**
     * Set or get the column label function. The chart class uses this function to render
     * column labels on the X axis. It is passed the column name.
     * @name colsLabel
     * @memberof dc.heatMap
     * @instance
     * @example
     * // the default label function just returns the name
     * chart.colsLabel(function(d) { return d; });
     * @param  {Function} [labelFunction=function(d) { return d; }]
     * @returns {Chart}
     */
    _chart.colsLabel = function (labelFunction) {
        if (!arguments.length) {
            return _colsLabel;
        }
        _colsLabel = labelFunction;
        return _chart;
    };

    /**
     * Set or get the row label function. The chart class uses this function to render
     * row labels on the Y axis. It is passed the row name.
     * @name rowsLabel
     * @memberof dc.heatMap
     * @instance
     * @example
     * // the default label function just returns the name
     * chart.rowsLabel(function(d) { return d; });
     * @param  {Function} [labelFunction=function(d) { return d; }]
     * @returns {Chart}
     */
    _chart.rowsLabel = function (labelFunction) {
        if (!arguments.length) {
            return _rowsLabel;
        }
        _rowsLabel = labelFunction;
        return _chart;
    };

    var _xAxisOnClick = function (d) { filterAxis(0, d); };
    var _yAxisOnClick = function (d) { filterAxis(1, d); };
    var _boxOnClick = function (d) {
        var filter = d.key;
        dc.events.trigger(function () {
            _chart.filter(filter);
            _chart.redrawGroup();
        });
    };

    function filterAxis (axis, value) {
        var cellsOnAxis = _chart.selectAll('.box-group').filter(function (d) {
            return d.key[axis] === value;
        });
        var unfilteredCellsOnAxis = cellsOnAxis.filter(function (d) {
            return !_chart.hasFilter(d.key);
        });
        dc.events.trigger(function () {
            if (unfilteredCellsOnAxis.empty()) {
                cellsOnAxis.each(function (d) {
                    _chart.filter(d.key);
                });
            } else {
                unfilteredCellsOnAxis.each(function (d) {
                    _chart.filter(d.key);
                });
            }
            _chart.redrawGroup();
        });
    }

    dc.override(_chart, 'filter', function (filter) {
        if (!arguments.length) {
            return _chart._filter();
        }

        return _chart._filter(dc.filters.TwoDimensionalFilter(filter));
    });

    /**
     * Gets or sets the values used to create the rows of the heatmap, as an array. By default, all
     * the values will be fetched from the data using the value accessor.
     * @name rows
     * @memberof dc.heatMap
     * @instance
     * @param  {Array<String|Number>} [rows]
     * @returns {Chart}
     */

    _chart.rows = function (rows) {
        if (!arguments.length) {
            return _rows;
        }
        _rows = rows;
        return _chart;
    };

    /**
     #### .rowOrdering([orderFunction])
     Get or set an accessor to order the rows.  Default is d3.ascending.
     */
    _chart.rowOrdering = function (_) {
        if (!arguments.length) {
            return _rowOrdering;
        }
        _rowOrdering = _;
        return _chart;
    };

    /**
     * Gets or sets the keys used to create the columns of the heatmap, as an array. By default, all
     * the values will be fetched from the data using the key accessor.
     * @name cols
     * @memberof dc.heatMap
     * @instance
     * @param  {Array<String|Number>} [cols]
     * @returns {Chart}
     */
    _chart.cols = function (cols) {
        if (!arguments.length) {
            return _cols;
        }
        _cols = cols;
        return _chart;
    };

    /**
     #### .colOrdering([orderFunction])
     Get or set an accessor to order the cols.  Default is ascending.
     */
    _chart.colOrdering = function (_) {
        if (!arguments.length) {
            return _colOrdering;
        }
        _colOrdering = _;
        return _chart;
    };

    _chart._doRender = function () {
        _chart.resetSvg();

        _chartBody = _chart.svg()
            .append('g')
            .attr('class', 'heatmap')
            .attr('transform', 'translate(' + _chart.margins().left + ',' + _chart.margins().top + ')');

        return _chart._doRedraw();
    };

    _chart._doRedraw = function () {
        var data = _chart.data(),
            rows = _chart.rows() || data.map(_chart.valueAccessor()),
            cols = _chart.cols() || data.map(_chart.keyAccessor());
        if (_rowOrdering) {
            rows = rows.sort(_rowOrdering);
        }
        if (_colOrdering) {
            cols = cols.sort(_colOrdering);
        }
        rows = _rowScale.domain(rows);
        cols = _colScale.domain(cols);

        var rowCount = rows.domain().length,
            colCount = cols.domain().length,
            boxWidth = Math.floor(_chart.effectiveWidth() / colCount),
            boxHeight = Math.floor(_chart.effectiveHeight() / rowCount);

        cols.rangeRoundBands([0, _chart.effectiveWidth()]);
        rows.rangeRoundBands([_chart.effectiveHeight(), 0]);

        var boxes = _chartBody.selectAll('g.box-group').data(_chart.data(), function (d, i) {
            return _chart.keyAccessor()(d, i) + '\0' + _chart.valueAccessor()(d, i);
        });
        var gEnter = boxes.enter().append('g')
            .attr('class', 'box-group');

        gEnter.append('rect')
            .attr('class', 'heat-box')
            .attr('fill', 'white')
            .on('click', _chart.boxOnClick());

        if (_chart.renderTitle()) {
            gEnter.append('title');
            boxes.selectAll('title').text(_chart.title());
        }

        dc.transition(boxes.selectAll('rect'), _chart.transitionDuration())
            .attr('x', function (d, i) { return cols(_chart.keyAccessor()(d, i)); })
            .attr('y', function (d, i) { return rows(_chart.valueAccessor()(d, i)); })
            .attr('rx', _xBorderRadius)
            .attr('ry', _yBorderRadius)
            .attr('fill', _chart.getColor)
            .attr('width', boxWidth)
            .attr('height', boxHeight);

        boxes.exit().remove();

        var gCols = _chartBody.selectAll('g.cols');
        if (gCols.empty()) {
            gCols = _chartBody.append('g').attr('class', 'cols axis');
        }
        var gColsText = gCols.selectAll('text').data(cols.domain());
        gColsText.enter().append('text')
              .attr('x', function (d) { return cols(d) + boxWidth / 2; })
              .style('text-anchor', 'middle')
              .attr('y', _chart.effectiveHeight())
              .attr('dy', 12)
              .on('click', _chart.xAxisOnClick())
              .text(_chart.colsLabel());
        dc.transition(gColsText, _chart.transitionDuration())
               .text(_chart.colsLabel())
               .attr('x', function (d) { return cols(d) + boxWidth / 2; })
               .attr('y', _chart.effectiveHeight());
        gColsText.exit().remove();
        var gRows = _chartBody.selectAll('g.rows');
        if (gRows.empty()) {
            gRows = _chartBody.append('g').attr('class', 'rows axis');
        }
        var gRowsText = gRows.selectAll('text').data(rows.domain());
        gRowsText.enter().append('text')
              .attr('dy', 6)
              .style('text-anchor', 'end')
              .attr('x', 0)
              .attr('dx', -2)
              .on('click', _chart.yAxisOnClick())
              .text(_chart.rowsLabel());
        dc.transition(gRowsText, _chart.transitionDuration())
              .text(_chart.rowsLabel())
              .attr('y', function (d) { return rows(d) + boxHeight / 2; });
        gRowsText.exit().remove();

        if (_chart.hasFilter()) {
            _chart.selectAll('g.box-group').each(function (d) {
                if (_chart.isSelectedNode(d)) {
                    _chart.highlightSelected(this);
                } else {
                    _chart.fadeDeselected(this);
                }
            });
        } else {
            _chart.selectAll('g.box-group').each(function () {
                _chart.resetHighlight(this);
            });
        }
        return _chart;
    };

    /**
     * Gets or sets the handler that fires when an individual cell is clicked in the heatmap.
     * By default, filtering of the cell will be toggled.
     * @name boxOnClick
     * @memberof dc.heatMap
     * @instance
     * @param  {Function} [handler]
     * @returns {Chart}
     */
    _chart.boxOnClick = function (handler) {
        if (!arguments.length) {
            return _boxOnClick;
        }
        _boxOnClick = handler;
        return _chart;
    };

    /**
     * Gets or sets the handler that fires when a column tick is clicked in the x axis.
     * By default, if any cells in the column are unselected, the whole column will be selected,
     * otherwise the whole column will be unselected.
     * @name xAxisOnClick
     * @memberof dc.heatMap
     * @instance
     * @param  {Function} [handler]
     * @returns {Chart}
     */
    _chart.xAxisOnClick = function (handler) {
        if (!arguments.length) {
            return _xAxisOnClick;
        }
        _xAxisOnClick = handler;
        return _chart;
    };

    /**
     * Gets or sets the handler that fires when a row tick is clicked in the y axis.
     * By default, if any cells in the row are unselected, the whole row will be selected,
     * otherwise the whole row will be unselected.
     * @name yAxisOnClick
     * @memberof dc.heatMap
     * @instance
     * @param  {Function} [handler]
     * @returns {Chart}
     */
    _chart.yAxisOnClick = function (handler) {
        if (!arguments.length) {
            return _yAxisOnClick;
        }
        _yAxisOnClick = handler;
        return _chart;
    };

    /**
     * Gets or sets the X border radius.  Set to 0 to get full rectangles.
     * @name xBorderRadius
     * @memberof dc.heatMap
     * @instance
     * @param  {Number} [xBorderRadius=6.75]
     * @returns {Chart}
     */
    _chart.xBorderRadius = function (xBorderRadius) {
        if (!arguments.length) {
            return _xBorderRadius;
        }
        _xBorderRadius = xBorderRadius;
        return _chart;
    };

    /**
     * Gets or sets the Y border radius.  Set to 0 to get full rectangles.
     * @name yBorderRadius
     * @memberof dc.heatMap
     * @instance
     * @param  {Number} [yBorderRadius=6.75]
     * @returns {Chart}
     */
    _chart.yBorderRadius = function (yBorderRadius) {
        if (!arguments.length) {
            return _yBorderRadius;
        }
        _yBorderRadius = yBorderRadius;
        return _chart;
    };

    _chart.isSelectedNode = function (d) {
        return _chart.hasFilter(d.key);
    };

    return _chart.anchor(parent, chartGroup);
};

// https://github.com/d3/d3-plugins/blob/master/box/box.js
(function () {

    // Inspired by http://informationandvisualization.de/blog/box-plot
    d3.box = function () {
        var width = 1,
            height = 1,
            duration = 0,
            domain = null,
            value = Number,
            whiskers = boxWhiskers,
            quartiles = boxQuartiles,
            tickFormat = null;

        // For each small multiple…
        function box (g) {
            g.each(function (d, i) {
                d = d.map(value).sort(d3.ascending);
                var g = d3.select(this),
                    n = d.length,
                    min = d[0],
                    max = d[n - 1];

                // Compute quartiles. Must return exactly 3 elements.
                var quartileData = d.quartiles = quartiles(d);

                // Compute whiskers. Must return exactly 2 elements, or null.
                var whiskerIndices = whiskers && whiskers.call(this, d, i),
                    whiskerData = whiskerIndices && whiskerIndices.map(function (i) { return d[i]; });

                // Compute outliers. If no whiskers are specified, all data are 'outliers'.
                // We compute the outliers as indices, so that we can join across transitions!
                var outlierIndices = whiskerIndices ?
                    d3.range(0, whiskerIndices[0]).concat(d3.range(whiskerIndices[1] + 1, n)) : d3.range(n);

                // Compute the new x-scale.
                var x1 = d3.scale.linear()
                    .domain(domain && domain.call(this, d, i) || [min, max])
                    .range([height, 0]);

                // Retrieve the old x-scale, if this is an update.
                var x0 = this.__chart__ || d3.scale.linear()
                    .domain([0, Infinity])
                    .range(x1.range());

                // Stash the new scale.
                this.__chart__ = x1;

                // Note: the box, median, and box tick elements are fixed in number,
                // so we only have to handle enter and update. In contrast, the outliers
                // and other elements are variable, so we need to exit them! Variable
                // elements also fade in and out.

                // Update center line: the vertical line spanning the whiskers.
                var center = g.selectAll('line.center')
                    .data(whiskerData ? [whiskerData] : []);

                center.enter().insert('line', 'rect')
                    .attr('class', 'center')
                    .attr('x1', width / 2)
                    .attr('y1', function (d) { return x0(d[0]); })
                    .attr('x2', width / 2)
                    .attr('y2', function (d) { return x0(d[1]); })
                    .style('opacity', 1e-6)
                  .transition()
                    .duration(duration)
                    .style('opacity', 1)
                    .attr('y1', function (d) { return x1(d[0]); })
                    .attr('y2', function (d) { return x1(d[1]); });

                center.transition()
                    .duration(duration)
                    .style('opacity', 1)
                    .attr('y1', function (d) { return x1(d[0]); })
                    .attr('y2', function (d) { return x1(d[1]); });

                center.exit().transition()
                    .duration(duration)
                    .style('opacity', 1e-6)
                    .attr('y1', function (d) { return x1(d[0]); })
                    .attr('y2', function (d) { return x1(d[1]); })
                    .remove();

                // Update innerquartile box.
                var box = g.selectAll('rect.box')
                    .data([quartileData]);

                box.enter().append('rect')
                    .attr('class', 'box')
                    .attr('x', 0)
                    .attr('y', function (d) { return x0(d[2]); })
                    .attr('width', width)
                    .attr('height', function (d) { return x0(d[0]) - x0(d[2]); })
                  .transition()
                    .duration(duration)
                    .attr('y', function (d) { return x1(d[2]); })
                    .attr('height', function (d) { return x1(d[0]) - x1(d[2]); });

                box.transition()
                    .duration(duration)
                    .attr('y', function (d) { return x1(d[2]); })
                    .attr('height', function (d) { return x1(d[0]) - x1(d[2]); });

                // Update median line.
                var medianLine = g.selectAll('line.median')
                    .data([quartileData[1]]);

                medianLine.enter().append('line')
                    .attr('class', 'median')
                    .attr('x1', 0)
                    .attr('y1', x0)
                    .attr('x2', width)
                    .attr('y2', x0)
                    .transition()
                    .duration(duration)
                    .attr('y1', x1)
                    .attr('y2', x1);

                medianLine.transition()
                    .duration(duration)
                    .attr('y1', x1)
                    .attr('y2', x1);

                // Update whiskers.
                var whisker = g.selectAll('line.whisker')
                    .data(whiskerData || []);

                whisker.enter().insert('line', 'circle, text')
                    .attr('class', 'whisker')
                    .attr('x1', 0)
                    .attr('y1', x0)
                    .attr('x2', width)
                    .attr('y2', x0)
                    .style('opacity', 1e-6)
                  .transition()
                    .duration(duration)
                    .attr('y1', x1)
                    .attr('y2', x1)
                    .style('opacity', 1);

                whisker.transition()
                    .duration(duration)
                    .attr('y1', x1)
                    .attr('y2', x1)
                    .style('opacity', 1);

                whisker.exit().transition()
                    .duration(duration)
                    .attr('y1', x1)
                    .attr('y2', x1)
                    .style('opacity', 1e-6)
                    .remove();

                // Update outliers.
                var outlier = g.selectAll('circle.outlier')
                    .data(outlierIndices, Number);

                outlier.enter().insert('circle', 'text')
                    .attr('class', 'outlier')
                    .attr('r', 5)
                    .attr('cx', width / 2)
                    .attr('cy', function (i) { return x0(d[i]); })
                    .style('opacity', 1e-6)
                    .transition()
                    .duration(duration)
                    .attr('cy', function (i) { return x1(d[i]); })
                    .style('opacity', 1);

                outlier.transition()
                    .duration(duration)
                    .attr('cy', function (i) { return x1(d[i]); })
                    .style('opacity', 1);

                outlier.exit().transition()
                    .duration(duration)
                    .attr('cy', function (i) { return x1(d[i]); })
                    .style('opacity', 1e-6)
                    .remove();

                // Compute the tick format.
                var format = tickFormat || x1.tickFormat(8);

                // Update box ticks.
                var boxTick = g.selectAll('text.box')
                    .data(quartileData);

                boxTick.enter().append('text')
                    .attr('class', 'box')
                    .attr('dy', '.3em')
                    .attr('dx', function (d, i) { return i & 1 ? 6 : -6; })
                    .attr('x', function (d, i) { return i & 1 ? width : 0; })
                    .attr('y', x0)
                    .attr('text-anchor', function (d, i) { return i & 1 ? 'start' : 'end'; })
                    .text(format)
                    .transition()
                    .duration(duration)
                    .attr('y', x1);

                boxTick.transition()
                    .duration(duration)
                    .text(format)
                    .attr('y', x1);

                // Update whisker ticks. These are handled separately from the box
                // ticks because they may or may not exist, and we want don't want
                // to join box ticks pre-transition with whisker ticks post-.
                var whiskerTick = g.selectAll('text.whisker')
                    .data(whiskerData || []);

                whiskerTick.enter().append('text')
                    .attr('class', 'whisker')
                    .attr('dy', '.3em')
                    .attr('dx', 6)
                    .attr('x', width)
                    .attr('y', x0)
                    .text(format)
                    .style('opacity', 1e-6)
                    .transition()
                    .duration(duration)
                    .attr('y', x1)
                    .style('opacity', 1);

                whiskerTick.transition()
                    .duration(duration)
                    .text(format)
                    .attr('y', x1)
                    .style('opacity', 1);

                whiskerTick.exit().transition()
                    .duration(duration)
                    .attr('y', x1)
                    .style('opacity', 1e-6)
                    .remove();
            });
            d3.timer.flush();
        }

        box.width = function (x) {
            if (!arguments.length) {
                return width;
            }
            width = x;
            return box;
        };

        box.height = function (x) {
            if (!arguments.length) {
                return height;
            }
            height = x;
            return box;
        };

        box.tickFormat = function (x) {
            if (!arguments.length) {
                return tickFormat;
            }
            tickFormat = x;
            return box;
        };

        box.duration = function (x) {
            if (!arguments.length) {
                return duration;
            }
            duration = x;
            return box;
        };

        box.domain = function (x) {
            if (!arguments.length) {
                return domain;
            }
            domain = x === null ? x : d3.functor(x);
            return box;
        };

        box.value = function (x) {
            if (!arguments.length) {
                return value;
            }
            value = x;
            return box;
        };

        box.whiskers = function (x) {
            if (!arguments.length) {
                return whiskers;
            }
            whiskers = x;
            return box;
        };

        box.quartiles = function (x) {
            if (!arguments.length) {
                return quartiles;
            }
            quartiles = x;
            return box;
        };

        return box;
    };

    function boxWhiskers (d) {
        return [0, d.length - 1];
    }

    function boxQuartiles (d) {
        return [
            d3.quantile(d, 0.25),
            d3.quantile(d, 0.5),
            d3.quantile(d, 0.75)
        ];
    }

})();

/**
 * A box plot is a chart that depicts numerical data via their quartile ranges.
 * Examples:
 * - [Nasdaq 100 Index](http://dc-js.github.com/dc.js/)
 * - [Canadian City Crime Stats](http://dc-js.github.com/dc.js/crime/index.html)
 * @name boxPlot
 * @memberof dc
 * @mixes dc.coordinateGridMixin
 * @example
 * // create a box plot under #chart-container1 element using the default global chart group
 * var boxPlot1 = dc.boxPlot('#chart-container1');
 * // create a box plot under #chart-container2 element using chart group A
 * var boxPlot2 = dc.boxPlot('#chart-container2', 'chartGroupA');
 * @param {String|node|d3.selection|dc.compositeChart} parent - Any valid
 * [d3 single selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying
 * a dom block element such as a div; or a dom element or d3 selection.  If the bar chart is a sub-chart
 * in a [Composite Chart](#composite-chart) then pass in the parent composite chart instance.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @returns {BoxPlot}
 */
dc.boxPlot = function (parent, chartGroup) {
    var _chart = dc.coordinateGridMixin({});

    // Returns a function to compute the interquartile range.
    function DEFAULT_WHISKERS_IQR (k) {
        return function (d) {
            var q1 = d.quartiles[0],
                q3 = d.quartiles[2],
                iqr = (q3 - q1) * k,
                i = -1,
                j = d.length;
            /*jshint -W116*/
            /*jshint -W035*/
            while (d[++i] < q1 - iqr) {}
            while (d[--j] > q3 + iqr) {}
            /*jshint +W116*/
            return [i, j];
            /*jshint +W035*/
        };
    }

    var _whiskerIqrFactor = 1.5;
    var _whiskersIqr = DEFAULT_WHISKERS_IQR;
    var _whiskers = _whiskersIqr(_whiskerIqrFactor);

    var _box = d3.box();
    var _tickFormat = null;

    var _boxWidth = function (innerChartWidth, xUnits) {
        if (_chart.isOrdinal()) {
            return _chart.x().rangeBand();
        } else {
            return innerChartWidth / (1 + _chart.boxPadding()) / xUnits;
        }
    };

    // default padding to handle min/max whisker text
    _chart.yAxisPadding(12);

    // default to ordinal
    _chart.x(d3.scale.ordinal());
    _chart.xUnits(dc.units.ordinal);

    // valueAccessor should return an array of values that can be coerced into numbers
    // or if data is overloaded for a static array of arrays, it should be `Number`.
    // Empty arrays are not included.
    _chart.data(function (group) {
        return group.all().map(function (d) {
            d.map = function (accessor) { return accessor.call(d, d); };
            return d;
        }).filter(function (d) {
            var values = _chart.valueAccessor()(d);
            return values.length !== 0;
        });
    });

    /**
     * Get or set the spacing between boxes as a fraction of box size. Valid values are within 0-1.
     * See the [d3 docs](https://github.com/mbostock/d3/wiki/Ordinal-Scales#wiki-ordinal_rangeBands)
     * for a visual description of how the padding is applied.
     * @name boxPadding
     * @memberof dc.boxPlot
     * @instance
     * @param {Number} [padding=0.8]
     * @returns {Number}
     */
    _chart.boxPadding = _chart._rangeBandPadding;
    _chart.boxPadding(0.8);

    /**
     * Get or set the outer padding on an ordinal box chart. This setting has no effect on non-ordinal charts
     * or on charts with a custom `.boxWidth`. Will pad the width by `padding * barWidth` on each side of the chart.
     * @name outerPadding
     * @memberof dc.boxPlot
     * @instance
     * @param {Number} [padding=0.5]
     * @returns {Number}
     */
    _chart.outerPadding = _chart._outerRangeBandPadding;
    _chart.outerPadding(0.5);

    /**
     * Get or set the numerical width of the boxplot box. The width may also be a function taking as
     * parameters the chart width excluding the right and left margins, as well as the number of x
     * units.
     * @example
     * // Using numerical parameter
     * chart.boxWidth(10);
     * // Using function
     * chart.boxWidth((innerChartWidth, xUnits) { ... });
     * @name boxWidth
     * @memberof dc.boxPlot
     * @instance
     * @param {Number|Function} [boxWidth=0.5]
     * @returns {Number|Function}
     */
    _chart.boxWidth = function (boxWidth) {
        if (!arguments.length) {
            return _boxWidth;
        }
        _boxWidth = d3.functor(boxWidth);
        return _chart;
    };

    var boxTransform = function (d, i) {
        var xOffset = _chart.x()(_chart.keyAccessor()(d, i));
        return 'translate(' + xOffset + ', 0)';
    };

    _chart._preprocessData = function () {
        if (_chart.elasticX()) {
            _chart.x().domain([]);
        }
    };

    _chart.plotData = function () {
        var _calculatedBoxWidth = _boxWidth(_chart.effectiveWidth(), _chart.xUnitCount());

        _box.whiskers(_whiskers)
            .width(_calculatedBoxWidth)
            .height(_chart.effectiveHeight())
            .value(_chart.valueAccessor())
            .domain(_chart.y().domain())
            .duration(_chart.transitionDuration())
            .tickFormat(_tickFormat);

        var boxesG = _chart.chartBodyG().selectAll('g.box').data(_chart.data(), function (d) { return d.key; });

        renderBoxes(boxesG);
        updateBoxes(boxesG);
        removeBoxes(boxesG);

        _chart.fadeDeselectedArea();
    };

    function renderBoxes (boxesG) {
        var boxesGEnter = boxesG.enter().append('g');

        boxesGEnter
            .attr('class', 'box')
            .attr('transform', boxTransform)
            .call(_box)
            .on('click', function (d) {
                _chart.filter(d.key);
                _chart.redrawGroup();
            });
    }

    function updateBoxes (boxesG) {
        dc.transition(boxesG, _chart.transitionDuration())
            .attr('transform', boxTransform)
            .call(_box)
            .each(function () {
                d3.select(this).select('rect.box').attr('fill', _chart.getColor);
            });
    }

    function removeBoxes (boxesG) {
        boxesG.exit().remove().call(_box);
    }

    _chart.fadeDeselectedArea = function () {
        if (_chart.hasFilter()) {
            _chart.g().selectAll('g.box').each(function (d) {
                if (_chart.isSelectedNode(d)) {
                    _chart.highlightSelected(this);
                } else {
                    _chart.fadeDeselected(this);
                }
            });
        } else {
            _chart.g().selectAll('g.box').each(function () {
                _chart.resetHighlight(this);
            });
        }
    };

    _chart.isSelectedNode = function (d) {
        return _chart.hasFilter(d.key);
    };

    _chart.yAxisMin = function () {
        var min = d3.min(_chart.data(), function (e) {
            return d3.min(_chart.valueAccessor()(e));
        });
        return dc.utils.subtract(min, _chart.yAxisPadding());
    };

    _chart.yAxisMax = function () {
        var max = d3.max(_chart.data(), function (e) {
            return d3.max(_chart.valueAccessor()(e));
        });
        return dc.utils.add(max, _chart.yAxisPadding());
    };

    /**
     * Set the numerical format of the boxplot median, whiskers and quartile labels. Defaults to
     * integer formatting.
     * @example
     * // format ticks to 2 decimal places
     * chart.tickFormat(d3.format('.2f'));
     * @name tickFormat
     * @memberof dc.boxPlot
     * @instance
     * @param {Function} [tickFormat]
     * @returns {Number|Function}
     */
    _chart.tickFormat = function (tickFormat) {
        if (!arguments.length) {
            return _tickFormat;
        }
        _tickFormat = tickFormat;
        return _chart;
    };

    return _chart.anchor(parent, chartGroup);
};

/**
 * The select menu is a simple widget designed to filter a dimension by selecting an option from
 * an HTML `<select/>` menu. The menu can be optionally turned into a multiselect.
 * @name selectMenu
 * @memberof dc
 * @mixes dc.baseMixin
 * @example
 * // create a select menu under #select-container using the default global chart group
 * var select = dc.selectMenu('#select-container')
 *                .dimension(states)
 *                .group(stateGroup);
 * // the option text can be set via the title() function
 * // by default the option text is '`key`: `value`'
 * select.title(function (d){
 *     return 'STATE: ' + d.key;
 * })
 * @param {String|node|d3.selection|dc.compositeChart} parent - Any valid
 * [d3 single selector](https://github.com/mbostock/d3/wiki/Selections#selecting-elements) specifying
 * a dom block element such as a div; or a dom element or d3 selection.
 * @param {String} [chartGroup] - The name of the chart group this widget should be placed in.
 * Interaction with the widget will only trigger events and redraws within its group.
 * @returns {selectMenu}
 **/
dc.selectMenu = function (parent, chartGroup) {
    var SELECT_CSS_CLASS = 'dc-select-menu';
    var OPTION_CSS_CLASS = 'dc-select-option';

    var _chart = dc.baseMixin({});

    var _select;
    var _promptText = 'Select all';
    var _multiple = false;
    var _size = null;
    var _order = function (a, b) {
        return _chart.keyAccessor()(a) > _chart.keyAccessor()(b) ?
             1 : _chart.keyAccessor()(b) > _chart.keyAccessor()(a) ?
            -1 : 0;
    };

    var _filterDisplayed = function (d) {
        return _chart.valueAccessor()(d) > 0;
    };

    _chart.data(function (group) {
        return group.all().filter(_filterDisplayed);
    });

    _chart._doRender = function () {
        _chart.select('select').remove();
        _select = _chart.root().append('select')
                        .classed(SELECT_CSS_CLASS, true);

        setAttributes();

        _select.append('option').text(_promptText).attr('value', '');
        renderOptions();
        return _chart;
    };

    _chart._doRedraw = function () {
        setAttributes();
        renderOptions();
        // select the option(s) corresponding to current filter(s)
        if (_chart.hasFilter() && _multiple) {
            _select.selectAll('option')
                .filter(function (d) {
                    return d && _chart.filters().indexOf(String(_chart.keyAccessor()(d))) >= 0;
                })
                .property('selected', true);
        } else if (_chart.hasFilter()) {
            _select.property('value', _chart.filter());
        } else {
            _select.property('value', '');
        }
        return _chart;
    };

    function renderOptions () {
        var options = _select.selectAll('option.' + OPTION_CSS_CLASS)
          .data(_chart.data(), function (d) { return _chart.keyAccessor()(d); });

        options.enter()
              .append('option')
              .classed(OPTION_CSS_CLASS, true)
              .attr('value', function (d) { return _chart.keyAccessor()(d); });

        options.text(_chart.title());
        options.exit().remove();
        _select.selectAll('option.' + OPTION_CSS_CLASS).sort(_order);

        _select.on('change', onChange);
        return options;
    }

    function onChange (d, i) {
        var values;
        var target = d3.event.target;
        if (target.selectedOptions) {
            var selectedOptions = Array.prototype.slice.call(target.selectedOptions);
            values = selectedOptions.map(function (d) {
                return d.value;
            });
        } else { // IE and other browsers do not support selectedOptions
            // adapted from this polyfill: https://gist.github.com/brettz9/4212217
            var options = [].slice.call(d3.event.target.options);
            values = options.filter(function (option) {
                return option.selected;
            }).map(function (option) {
                return option.value;
            });
        }
        // console.log(values);
        // check if only prompt option is selected
        if (values.length === 1 && values[0] === '') {
            values = null;
        } else if (values.length === 1) {
            values = values[0];
        }
        _chart.onChange(values);
    }

    _chart.onChange = function (val) {
        if (val && _multiple) {
            _chart.replaceFilter([val]);
        } else if (val) {
            _chart.replaceFilter(val);
        } else {
            _chart.filterAll();
        }
        dc.events.trigger(function () {
            _chart.redrawGroup();
        });
    };

    function setAttributes () {
        if (_multiple) {
            _select.attr('multiple', true);
        } else {
            _select.attr('multiple', null);
        }
        if (_size !== null) {
            _select.attr('size', _size);
        } else {
            _select.attr('size', null);
        }
    }

    /**
     * Get or set the function that controls the ordering of option tags in the
     * select menu. By default options are ordered by the group key in ascending
     * order.
     * @name order
     * @memberof dc.selectMenu
     * @instance
     * @param {Function} [order]
     * @example
     * // order by the group's value
     * chart.order(function (a,b) {
     *     return a.value > b.value ? 1 : b.value > a.value ? -1 : 0;
     * });
     **/
    _chart.order = function (order) {
        if (!arguments.length) {
            return _order;
        }
        _order = order;
        return _chart;
    };

    /**
     * Get or set the text displayed in the options used to prompt selection.
     * @name promptText
     * @memberof dc.selectMenu
     * @instance
     * @param {String} [promptText='Select all']
     * @example
     * chart.promptText('All states');
     **/
    _chart.promptText = function (_) {
        if (!arguments.length) {
            return _promptText;
        }
        _promptText = _;
        return _chart;
    };

    /**
     * Get or set the function that filters option tags prior to display. By default options
     * with a value of < 1 are not displayed.
     * @name filterDisplayed
     * @memberof dc.selectMenu
     * @instance
     * @param {function} [filterDisplayed]
     * @example
     * // display all options override the `filterDisplayed` function:
     * chart.filterDisplayed(function () {
     *     return true;
     * });
     **/
    _chart.filterDisplayed = function (filterDisplayed) {
        if (!arguments.length) {
            return _filterDisplayed;
        }
        _filterDisplayed = filterDisplayed;
        return _chart;
    };

    /**
     * Controls the type of select menu. Setting it to true converts the underlying
     * HTML tag into a multiple select.
     * @name multiple
     * @memberof dc.selectMenu
     * @instance
     * @param {boolean} [multiple=false]
     * @example
     * chart.multiple(true);
     **/
    _chart.multiple = function (multiple) {
        if (!arguments.length) {
            return _multiple;
        }
        _multiple = multiple;

        return _chart;
    };

    /**
     * Controls the height, in lines, of the select menu, when `.multiple()` is true. If `null` (the default),
     * uses the browser's default height.
     * @name size
     * @memberof dc.selectMenu
     * @instance
     * @param {?number} [size
     * @example
     * chart.size(10);
     **/
    _chart.size = function (size) {
        if (!arguments.length) {
            return _size;
        }
        _size = size;

        return _chart;
    };

    return _chart.anchor(parent, chartGroup);
};

// Renamed functions

dc.abstractBubbleChart = dc.bubbleMixin;
dc.baseChart = dc.baseMixin;
dc.capped = dc.capMixin;
dc.colorChart = dc.colorMixin;
dc.coordinateGridChart = dc.coordinateGridMixin;
dc.marginable = dc.marginMixin;
dc.stackableChart = dc.stackMixin;

// Expose d3 and crossfilter, so that clients in browserify
// case can obtain them if they need them.
dc.d3 = d3;
dc.crossfilter = crossfilter;

return dc;}
    if(typeof define === "function" && define.amd) {
        define(["d3", "crossfilter"], _dc);
    } else if(typeof module === "object" && module.exports) {
        var _d3 = require('d3');
        var _crossfilter = require('crossfilter');
        // When using npm + browserify, 'crossfilter' is a function,
        // since package.json specifies index.js as main function, and it
        // does special handling. When using bower + browserify,
        // there's no main in bower.json (in fact, there's no bower.json),
        // so we need to fix it.
        if (typeof _crossfilter !== "function") {
            _crossfilter = _crossfilter.crossfilter;
        }
        module.exports = _dc(_d3, _crossfilter);
    } else {
        this.dc = _dc(d3, crossfilter);
    }
}
)();

//# sourceMappingURL=dc.js.map