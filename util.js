var util = {};

util.parseBool = function(str, def) {
    if (str) {
        str = str.toLowerCase();
        return str == "true" || str == "yes" || str == "1" || str == "y";
    } else {
        return def;
    }
}

util.getProps = function(obj) {
    var keys = [];
    for(var k in obj)
        if (obj.hasOwnProperty(k))
            keys.push(k);
    return keys;
}

util.dateToUTC = function(d) {
    // eww
    return new Date(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        d.getUTCHours(),
        d.getUTCMinutes(),
        d.getUTCSeconds()
    );
}

util.dateDiff = function(a, b) {
    var timeDiff = Math.abs(b.getTime() - a.getTime());
    return timeDiff / (1000 * 3600 * 24);
}

util.thd = function(n) {
    var nStr = String(n);
    nStr += '';
    x = nStr.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
            x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
}

util.repeatString = function(pattern, count) {
    if (count < 1) return '';
    var result = '';
    while (count > 1) {
        if (count & 1) result += pattern;
        count >>= 1, pattern += pattern;
    }
    return result + pattern;
}

module.exports = util;
