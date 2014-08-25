var irc = require("irc");
var http = require("http");
var querystring = require("querystring");
var url = require("url");
var fs = require("fs");

var dateformat = require("dateformat");
var minimatch = require("minimatch");
var EasyTable = require("easy-table");

var liner = require("./liner.js");

var tipparser = /Such ([\w\<\-\[\]\\\^\{\}]+) tipped much Ɖ(\d+) to (\w+)\! \(to claim \/msg Doger help\) \[\w+\]/

var mtipcheck = /([\w\<\-\[\]\\\^\{\}]+): Tipped:/
var mtipparser = /([\w\<\-\[\]\\\^\{\}]+) (\d+)/g

var cmdparser = /([^"' ]+)|["']([^"']*)["']/g

var cost = true;


function getProps(obj) {
    var keys = [];
    for(var k in obj)
        if (obj.hasOwnProperty(k))
            keys.push(k);
    return keys;
}

function dateToUTC(d) {
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

function dateDiff(a, b) {
    var timeDiff = Math.abs(b.getTime() - a.getTime());
    return timeDiff / (1000 * 3600 * 24);
}

function thd(n) {
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

function repeatString(pattern, count) {
    if (count < 1) return '';
    var result = '';
    while (count > 1) {
        if (count & 1) result += pattern;
        count >>= 1, pattern += pattern;
    }
    return result + pattern;
}


function loglines(channel, nick, head, tail, linecb, endcb, errcb) {
    var url = "http://mniip.com/irc/log/?"
        + "channel=" + encodeURIComponent(channel)
        + "&head=" + encodeURIComponent(dateformat(head, "yyyy.mm.dd-HH:MM:ss"))
        + "&tail=" + encodeURIComponent(dateformat(tail, "yyyy.mm.dd-HH:MM:ss"))
        + "&grep=" + encodeURIComponent(nick)
        + "&raw";
    console.log("URL: " + url);

    var request = http.get(url, function(response) {
            console.log("Got response!");

            response.on("error", errcb);
            response.on("end", endcb);

            var l = liner();
            response.pipe(l);
            // iterate the response line-by-line
            l.on("readable", function() {
                var line;
                while (line = l.read()) {
                    if (line == "Channel  is not publicly logged") {
                        errcb("Server error");
                    } else if (line == "Channel " + channel + " is not publicly logged") {
                        errcb("Channel is not publicly logged"); // lel
                    } else {
                        var m = line.match(tipparser);
                        if (m) {
                            linecb(m[1], m[3], m[2]);
                        }
                        else {
                            var m = line.match(mtipcheck);
                            if (m) {
                                var from = m[1];
                                var m = line.match(mtipparser);
                                if (m) {
                                    for (var i = 0; i < m.length; i++) {
                                        var s = m[i].split(" ");
                                        linecb(from, s[0], s[1]);
                                    }
                                }
                            }
                        }
                    }
                }
            });
            l.on("error", errcb);
        }
    ).on("error", errcb);
}

function tipstat(channel, target, head, tail, cb, errcb) {
    if (isNaN(head) || isNaN(tail)) {
        errcb("Somethings wrong with your date formats!");
        return;
    } else if (tail < head) {
        errcb("The tail date must be later than the head date.");
        return;
    } else if (dateDiff(tail, head) > 14) {
        errcb("The log server only allows 14 days difference.");
        return;
    }

    matches = [];
    incoming = {amount: 0, tips: 0, avgamount: 0, avgtips: 0};
    outgoing = {amount: 0, tips: 0, avgamount: 0, avgtips: 0};

    tippers = {};
    tippees = {};

    var mm = minimatch.Minimatch(target, {
        noglobstar: true, nocomment: true, nocase: true
    });
    mm.makeRe();
    console.log("Regex: " + mm.regexp.toString());

    target = target.toLowerCase();

    loglines(channel, "Doger", head, tail, function(from, to, amount) {
        to = to.toLowerCase();
        from = from.toLowerCase();

        amount = Number(amount);

        if (mm.match(to)) {
            if (matches.indexOf(to) == -1)
                matches.push(to)

            incoming.tips++;
            incoming.avgtips = (incoming.avgtips + 1) / 2;
            incoming.amount += amount;
            incoming.avgamount = (incoming.avgamount + amount) / 2;

            if (tippers.hasOwnProperty(from)) {
                tippers[from].tips++;
                tippers[from].amount += amount;
            } else {
                tippers[from] = {tips: 1, amount: amount};
            }
        }
        if (mm.match(from)) {
            if (matches.indexOf(from) == -1)
                matches.push(from)

            outgoing.tips++;
            outgoing.avgtips = (outgoing.avgtips + 1) / 2;
            outgoing.amount += amount;
            outgoing.avgamount = (outgoing.avgamount + amount) / 2;

            if (tippees.hasOwnProperty(to)) {
                tippees[to].tips++;
                tippees[to].amount += amount;
            } else {
                tippees[to] = {tips: 1, amount: amount};
            }
        }
    }, function() {
        cb(incoming, outgoing, tippers, tippees, matches);
    }, errcb);
}


function cmd_help(from, to, m) {
    var cmd;
    if (m.length == 2) {
        cmd = m[1];
        if (commands.hasOwnProperty(cmd))
            client.say(to, from + ": !" + cmd + " " + commands[cmd][2]);
        else
            client.say(to, from + ": I don't know that command, sorry!");
    } else {
        client.say(to, from + ": My commands are " + getProps(commands).join(", "));
    }
}

function cmd_tipsum(from, to, m) {
    var nick, head, tail;
    if (m.length == 4) {
        nick = m[1];
        head = new Date(m[2]);
        tail = new Date(m[3]);
    } else if (m.length == 3) {
        nick = m[1];
        head = new Date(m[2]);
        tail = dateToUTC(new Date());
    } else if (m.length == 2) {
        nick = m[1];
        head = dateToUTC(new Date());
        head.setHours(0, 0, 0, 0);
        tail = dateToUTC(new Date());
    } else {
        client.say(to, from + ": Nah, it's !tipsum NICK [HEAD] [TAIL]");
        return;
    }

    tipstat("#dogecoin", nick, head, tail, function(incoming, outgoing, tippers, tippees, matches) {
        client.say(to, from
            + ": Incoming (" + thd(incoming.tips) + "): Ɖ" + thd(incoming.amount)
            + ", outgoing (" + thd(outgoing.tips) + "): Ɖ" + thd(outgoing.amount)
            + ", net: Ɖ" + thd(incoming.amount - outgoing.amount));
        cost += Math.ceil((1 + dateDiff(tail, head)) * 7);
    }, function(err) {
        client.say(to, from + ": " + err);
    });
}

function cmd_tipstat(from, to, m) {
    var nick, head, tail;
    if (m.length == 4) {
        nick = m[1];
        head = new Date(m[2]);
        tail = new Date(m[3]);
    } else if (m.length == 3) {
        nick = m[1];
        head = new Date(m[2]);
        tail = dateToUTC(new Date());
    } else if (m.length == 2) {
        nick = m[1];
        head = dateToUTC(new Date());
        head.setHours(0, 0, 0, 0);
        tail = dateToUTC(new Date());
    } else {
        client.say(to, from + ": Nah, it's !tipstat NICK [HEAD] [TAIL]");
        return;
    }

    tipstat("#dogecoin", nick, head, tail, function(incoming, outgoing, tippers, tippees, matches) {
        var output = "Tips to and from: " + nick;
        output += "\n" + repeatString("=", output.length);

        output += "\nStart (UTC): " + dateformat(head, "yyyy.mm.dd HH:MM:ss");
        output += "\nEnd (UTC): " + dateformat(tail, "yyyy.mm.dd HH:MM:ss");

        output += "\n\nSummary\n-------"
        output += "\nIncoming: Ɖ" + thd(incoming.amount) + " (" + thd(incoming.tips) + " tips)";
        output += "\nOutgoing: Ɖ" + thd(outgoing.amount) + " (" + thd(outgoing.tips) + " tips)";
        output += "\nNet: Ɖ" + thd(incoming.amount - outgoing.amount);

        var n = function (digits) {
            return function (val, width) {
                if (val === undefined) return ''
                if (typeof val != 'number')
                    throw new Error(String(val) + ' is not a number')
                var s = digits == null ? String(val) : val.toFixed(digits).toString()
                return EasyTable.padLeft(thd(s), width)
            }
        }

        var t = new EasyTable();
        var tkeys = Object.keys(tippers);
        tkeys.forEach(function(k) {
            var v = tippers[k];
            t.cell("Nick", k);
            t.cell("Amount, Ɖ", v.amount, n(0));
            t.cell("Tips", v.tips, n(0));
            t.cell("%", (v.amount / incoming.amount) * 100, n(2));
            t.newRow();
        });
        t.sort(["Amount, Ɖ|des"]);

        t.newRow();
        t.cell("Nick", "AVG");
        t.cell("Amount, Ɖ", incoming.avgamount, n(3));
        t.cell("Tips", incoming.avgtips, n(3));
        t.cell("%", 50, n(2));
        t.newRow();
        t.cell("Nick", "SUM");
        t.cell("Amount, Ɖ", incoming.amount, n(0));
        t.cell("Tips", incoming.tips, n(0));
        t.cell("%", 100, n(2));
        t.newRow();

        var s = "\nTippers (incoming): " + thd(tkeys.length);
        output += "\n\n" + s + "\n" + repeatString("-", s.length)
            + "\n" + t.toString();


        var t = new EasyTable();
        var tkeys = Object.keys(tippees);
        tkeys.forEach(function(k) {
            var v = tippees[k];
            t.cell("Nick", k);
            t.cell("Amount, Ɖ", v.amount, n(0));
            t.cell("Tips", v.tips, n(0));
            t.cell("%", (v.amount / outgoing.amount) * 100, n(2));
            t.newRow();
        });
        t.sort(["Amount, Ɖ|des"]);

        t.newRow();
        t.cell("Nick", "AVG");
        t.cell("Amount, Ɖ", outgoing.avgamount, n(3));
        t.cell("Tips", outgoing.avgtips, n(3));
        t.cell("%", 50, n(2));
        t.newRow();
        t.cell("Nick", "SUM");
        t.cell("Amount, Ɖ", outgoing.amount, n(0));
        t.cell("Tips", outgoing.tips, n(0));
        t.cell("%", 100, n(2));
        t.newRow();

        var s = "Tippees (outgoing): " + thd(tkeys.length);
        output += "\n\n" + s + "\n" + repeatString("-", s.length)
            + "\n" + t.toString();


        output += "\n\nNicks matching " + nick + ": " + matches.join(", ");

        output += "\n\n[tipstatbot by nucular, "
            + dateformat(undefined, "yyyy.mm.dd HH:MM:ss") + "]\n";

        var pdata = querystring.stringify({
            "data": output
        });
        var req = http.request({
            host: "qp.mniip.com",
            port: "80",
            path: "/",
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": pdata.length
            }
        }, function(res) {
            var loc = res.headers.location;

            if (!url.parse(loc).hostname) {
                loc = "http://qp.mniip.com" + "/" + loc;
            }

            client.say(to, from + ": Tip statistics created, see " + loc);
            cost += Math.ceil((2 + dateDiff(tail, head)) * 10);
        });
        req.on("error", function(err) {
            client.say(to, from + ": " + err);
        });

        req.write(pdata);
        req.end();

    }, function(err) {
        client.say(to, from + ": " + err);
    });
}


var commands = {
    tsbhelp: [cmd_help, false, "[CMD] (May be helpful.)"],
    tipsum: [cmd_tipsum, true, "NICK [HEAD] [TAIL] "
    + "(Head, tail are dates with 14 days maximum difference, "
    + "tail defaults to now and head to the start of the day. "
    + "Nick may contain wildcards.)"],
    tipstat: [cmd_tipstat, true, "NICK [HEAD] [TAIL] (see !tipsum, but this provides "
    + "a link to detailed tip statistics.)"]
}


function cfgbool(str, def) {
    if (str) {
        str = str.toLowerCase();
        return str == "true" || str == "yes" || str == "1" || str == "y";
    } else {
        return def;
    }
}

global.client = new irc.Client(
    process.env.IRC_SERVER || "irc.freenode.net",
    process.env.IRC_NICK || "tipstatbot",
    {
        userName: process.env.IRC_USERNAME || "tipstatbot",
        realName: process.env.IRC_REALNAME || "Node.js rocks!",
        port: Number(process.env.IRC_PORT) || 6667,
        debug: cfgbool(process.env.IRC_DEBUG, false),
        showErrors: cfgbool(process.env.IRC_SHOWERRORS, true),
        autoRejoin: cfgbool(process.env.IRC_AUTOREJOIN, true),
        autoConnect: false,
        channels: (process.env.IRC_CHANNELS || "").split(","),
        floodProtection: true,
        floodProtectionDelay: 300,
        stripColors: false
    }
);

client.on("registered", function(message) {
    var u = process.env.IRC_NSNICK || process.env.IRC_NICK;
    var p = process.env.IRC_NSPASS;
    if (u && p)
        client.say("NickServ", "IDENTIFY " + u + " " + p);
});

client.on("message#", function(nick, to, text, message) {
    var m = text.match(cmdparser);
    var cmd = m[0].substring(1);
    if (m && m.length > 0 && commands.hasOwnProperty(cmd)) {
        if (commands[cmd][1] && cost > 0) {
            client.say(to, nick + ": Please wait " + String(cost) + " seconds.");
            return;
        }

        // trim parentheses
        for (var i = 1; i < m.length; i++) {
            m[i] = m[i].replace(/^["']+|["']+$/gm, "");
        }
        console.log("Command: " + m.join(","));
        commands[cmd][0](nick, to, m);
    }
})

client.connect(process.env.IRC_RETRYCOUNT || 5);
setInterval(function() {
    if (cost > 0) {
        cost = cost - 1;
    }
}, 1000);
