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

util.wrapLines = function(text, len) {
    var lines = [];
    var line = "";
    for (var i = 0; i < text.length; i++) {
        var c = text[i];
        if (c != " ") {
            line += c;
        } else if (line.length >= len) {
            lines.push(line);
            line = "";
        } else {
            line += " ";
        }
    }
    lines.push(line);
    return lines.join("\n");
}


util.isValidDate = function(d) {
    return d.toDateString().toLowerCase().lastIndexOf("invalid") == -1;
}

var COLORTABLE = {
    "white": "00",
    "black": "01",
    "blue": "02",
    "navy": "02",
    "green": "03",
    "red": "04",
    "brown": "05",
    "maroon": "05",
    "purple": "06",
    "orange": "07",
    "yellow": "08",
    "lgreen": "09",
    "lime": "09",
    "teal": "10",
    "cyan": "10",
    "lcyan": "11",
    "aqua": "11",
    "lblue": "12",
    "royal": "12",
    "pink": "13",
    "lpurple": "13",
    "fuchsia": "13",
    "grey": "14",
    "lgrey": "15",
    "silver": "15"
}
var COLORCTRL = String.fromCharCode(0x03);
var BOLDCTRL = String.fromCharCode(0x02);
var ITALICCTRL = String.fromCharCode(0x1D);
var UNDERLINECTRL = String.fromCharCode(0x1F);
var CLEARCTRL = String.fromCharCode(0x0F);

util.colorfy = function(str) {
    return str.replace(/\{\{(\/?[\w,]+)\}\}/g, function(a, b) {
        var ret = "";

        if (BOT_COLORS) {
            var s = b.split(",");
            if (s.length == 2) {
                ret = COLORCTRL;
                if (COLORTABLE.hasOwnProperty(s[0]))
                    ret += COLORTABLE[s[0]];
                if (COLORTABLE.hasOwnProperty(s[1]))
                    ret += "," + COLORTABLE[s[1]];
            } else if (COLORTABLE.hasOwnProperty(b)) {
                ret = COLORCTRL + COLORTABLE[b];
            } else if (b == "bold") {
                ret = BOLDCTRL;
            } else if (b == "italic") {
                ret = ITALICCTRL;
            } else if (b == "underline") {
                ret = UNDERLINECTRL;
            } else if (b == "clear" || b == "reset") {
                ret = CLEARCTRL;
            }
        }

        return ret;
    });
}

module.exports = util;
