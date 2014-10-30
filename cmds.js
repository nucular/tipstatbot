var http = require("http");
var querystring = require("querystring");
var url = require("url");
var buffer = Buffer || require('buffer')

var dateformat = require("dateformat");
var EasyTable = require("easy-table");

var util = require("./util");
var Tipstat = require("./tipstat");


var Arg = function(name, type, optional) {
    this.name = name;
    this.type = type;
    this.optional = optional;
}

var Command = function(func, args, help, costblock, restricted) {
    this.func = func || function() {};
    this.args = args || [];
    this.help = help || "";
    this.costblock = costblock || false;
    this.restricted = restricted || false;
}


var cmds = {};


cmds.help = new Command();
cmds.help.args = [new Arg("name", "string", true)];
cmds.help.help = "Hopefully helpful.";
cmds.help.costsblock = false;

cmds.help.func = function(from, to, args) {
    if (args.name) {
        if (cmds.hasOwnProperty(args.name)) {
            var cmd = cmds[args.name];

            arghelp = "";
            for (var i = 0; i < cmd.args.length; i++) {
                arghelp += (cmd.args[i].optional ? "[" : "{{bold}}")
                    + cmd.args[i].name.toUpperCase()
                    + "({{italic}}" + cmd.args[i].type + "{{italic}})"
                    + (cmd.args[i].optional ? "] " : "{{bold}} ");
            }

            client.say(to, util.colorfy(from + ":{{clear}} "
                + BOT_PREFIX + args.name + " "
                + arghelp + " (" + cmd.help + ")"));
        } else {
            //client.say(to, from + ": I don't know that command, sorry!");
        }
    } else {
        client.say(to, from + ": My commands are " + util.getProps(cmds).join(", "));
    }
}


cmds.about = new Command();
cmds.about.help = "Shows some infos about me.";

cmds.about.func = function(from, to, args) {
    client.say(to, util.colorfy(from + ":{{clear}} I'm a bot written by {{blue}}nucular{{clear}} in Node.js. "
        + "I can provide interesting tip statistics, powered by {{blue}}mniip{{clear}}'s log server. "
        + "My source can be found at {{bold}}https://github.com/nucular/tipstatbot{{bold}}."));
}


cmds.tsbeval = new Command();
cmds.tsbeval.args = [new Arg("js", "string", false)];
cmds.tsbeval.help = "Evaluate some unrestricted JavaScript code.";
cmds.tsbeval.restricted = true;

cmds.tsbeval.func = function(from, to, args) {
    try {
        var ret = eval(args.js);
        ret = ret ? ret.toString() : String(ret);
        ret = ret.replace(/(\r\n|\r|\n)([\s\t]*)/gm," ");
        if (ret.length > 200)
            ret = ret.substring(0, 200) + "...";

        client.say(to, from + ": " + ret);
    }
    catch (e) {
        client.say(to, from + ": " + e.toString());
    }
}


cmds.tipsum = new Command();
cmds.tipsum.args = [new Arg("nick", "string", false), new Arg("head", "date", true), new Arg("tail", "date", true)];
cmds.tipsum.help = "Sums up public tips from/to a nick/wildcard between two UTC dates with 14 days maximum difference. "
    + "Head defaults to 00:00 and tail to now.";
cmds.tipsum.costblock = true;

cmds.tipsum.func = function(from, to, args) {
    if (!args.head) {
        args.head = util.dateToUTC(new Date());
        args.head.setHours(0, 0, 0, 0);
    }
    if (!args.tail) {
        args.tail = util.dateToUTC(new Date());
    }

    t = new Tipstat("#dogecoin", args.nick, args.head, args.tail);
    t.on("end", function(incoming, outgoing, tippers, tippees, matches) {
        var toptippers = ["","",""];
        var toptippees = ["","",""];

        for (var k in tippers) {
            if (tippers.hasOwnProperty(k)) {
                toptippers.every(function(v, i) {
                    if (v == "" || tippers[v].sum < tippers[k].sum) {
                        toptippers[i] = k;
                        return false;
                    } else {
                        return true;
                    }
                });
            }
        }

        for (var k in tippees) {
            if (tippees.hasOwnProperty(k)) {
                toptippees.every(function(v, i) {
                    if (v == "" || tippees[v].sum < tippees[k].sum) {
                        toptippees[i] = k;
                        return false;
                    } else {
                        return true;
                    }
                });
            }
        }

        var toptipperstr = "";
        toptippers.forEach(function(v, i) {
            if (v != "") {
                toptipperstr += "{{bold}}{{green}}" + v + "{{clear}}"
                    + " {{red}}Ɖ" + util.thd(tippers[v].sum) + "{{clear}}"
                    + ", {{blue}}" + util.thd(tippers[v].tips) + "{{clear}} tips | ";
            }
        });
        toptipperstr = toptipperstr.substring(0, toptipperstr.length - 3);

        var toptippeestr = "";
        toptippees.forEach(function(v, i) {
            if (v != "") {
                toptippeestr += "{{bold}}{{green}}" + v + "{{clear}}"
                    + " {{red}}Ɖ" + util.thd(tippees[v].sum) + "{{clear}}"
                    + ", {{blue}}" + util.thd(tippees[v].tips) + "{{clear}} tips | ";
            }
        });
        toptippeestr = toptippeestr.substring(0, toptippeestr.length - 3);

        client.say(to, util.colorfy(from
            + ":{{clear}} Incoming ({{blue}}" + util.thd(incoming.tips) + "{{clear}}): {{red}}Ɖ" + util.thd(incoming.sum)
            + "{{clear}}, outgoing ({{blue}}" + util.thd(outgoing.tips) + "{{clear}}): {{red}}Ɖ" + util.thd(outgoing.sum)
            + "{{clear}}, net: {{red}}Ɖ" + util.thd(incoming.sum - outgoing.sum) + "{{clear}} | "
            + " ({{italic}}Most Tipping{{italic}}: " + toptipperstr + ")"
            + " ({{italic}}Most Tipped{{italic}}: " + toptippeestr + ")"));
        costs += Math.ceil((1 + util.dateDiff(args.tail, args.head)) * 7);
    });

    t.on("error", function(err) {
        client.say(to, from + ": " + err);
    });

    t.start();
}


cmds.tipstat = new Command();
cmds.tipstat.args = [new Arg("nick", "string", false), new Arg("head", "date", true), new Arg("tail", "date", true)];
cmds.tipstat.help = "Provides more detailed statistics than tipsum, as a link.";
cmds.tipstat.costblock = true;

cmds.tipstat.func = function(from, to, args) {
    if (!args.head) {
        args.head = util.dateToUTC(new Date());
        args.head.setHours(0, 0, 0, 0);
    }
    if (!args.tail) {
        args.tail = util.dateToUTC(new Date());
    }

    client.say(to, from + ": Generating tip statistics, this may take a while...");


    t = new Tipstat("#dogecoin", args.nick, args.head, args.tail);

    t.on("end", function(incoming, outgoing, tippers, tippees, matches) {
        var output = "Tips to and from: " + args.nick;
        output += "\n" + util.repeatString("=", output.length);

        output += "\nStart (UTC): " + dateformat(args.head, "yyyy.mm.dd HH:MM:ss");
        output += "\nEnd (UTC): " + dateformat(args.tail, "yyyy.mm.dd HH:MM:ss");

        output += "\n\n\nSummary\n-------"
        output += "\nIncoming: Ɖ" + util.thd(incoming.sum) + " (" + util.thd(incoming.tips) + " tips)";
        output += "\nOutgoing: Ɖ" + util.thd(outgoing.sum) + " (" + util.thd(outgoing.tips) + " tips)";
        output += "\nNet: Ɖ" + util.thd(incoming.sum - outgoing.sum);

        output += "\n\nTip average, incoming: Ɖ" + util.thd(incoming.avg);
        output += "\nTip average, outgoing: Ɖ" + util.thd(outgoing.avg);

        var n = function (digits) {
            return function (val, width) {
                if (val === undefined) return ''
                if (typeof val != 'number')
                    throw new Error(String(val) + ' is not a number')
                var s = digits == null ? String(val) : (+val).toFixed(digits).toString()
                return EasyTable.padLeft(util.thd(s), width)
            }
        }

        var t = new EasyTable();
        var tkeys = Object.keys(tippers);
        tkeys.forEach(function(k) {
            var v = tippers[k];
            t.cell("Nick", k);
            t.cell("Sum, Ɖ", v.sum, n(0));
            t.cell("Tips", v.tips, n(0));
            t.cell("Avg, Ɖ", v.avg, n(2));
            t.cell("%", (v.sum / incoming.sum) * 100, n(2));
            t.newRow();
        });
        t.sort(["Sum, Ɖ|des"]);

        var avgsum = 0, avgtips = 0;
        Object.keys(tippers).forEach(function(k) {
            avgsum = (avgsum + tippers[k].sum) / 2;
            avgtips = (avgtips + tippers[k].tips) / 2;
        });

        t.newRow();
        t.cell("Nick", "AVG");
        t.cell("Sum, Ɖ", avgsum, n(3));
        t.cell("Tips", avgtips, n(3));
        t.newRow();
        t.cell("Nick", "SUM");
        t.cell("Sum, Ɖ", incoming.sum, n(0));
        t.cell("Tips", incoming.tips, n(0));
        t.newRow();

        var s = "\nTippers (incoming): " + util.thd(tkeys.length);
        output += "\n\n" + s + "\n" + util.repeatString("-", s.length - 1)
            + "\n" + t.toString();


        var t = new EasyTable();
        var tkeys = Object.keys(tippees);
        tkeys.forEach(function(k) {
            var v = tippees[k];
            t.cell("Nick", k);
            t.cell("Sum, Ɖ", v.sum, n(0));
            t.cell("Tips", v.tips, n(0));
            t.cell("Avg, Ɖ", v.avg, n(2));
            t.cell("%", (v.sum / outgoing.sum) * 100, n(2));
            t.newRow();
        });
        t.sort(["Sum, Ɖ|des"]);

        var avgsum = 0, avgtips = 0;
        Object.keys(tippees).forEach(function(k) {
            avgsum = (avgsum + tippees[k].sum) / 2;
            avgtips = (avgtips + tippees[k].tips) / 2;
        });

        t.newRow();
        t.cell("Nick", "AVG");
        t.cell("Sum, Ɖ", avgsum, n(3));
        t.cell("Tips", avgtips, n(3));
        t.newRow();
        t.cell("Nick", "SUM");
        t.cell("Sum, Ɖ", outgoing.sum, n(0));
        t.cell("Tips", outgoing.tips, n(0));
        t.newRow();

        var s = "Tippees (outgoing): " + util.thd(tkeys.length);
        output += "\n\n" + s + "\n" + util.repeatString("-", s.length)
            + "\n" + t.toString();


        output += "\n\n" + util.wrapLines("Nicks matching " + args.nick + ": "
            + matches.join(", "), 90);

        output += "\n\n[tipstatbot by nucular, "
            + dateformat(undefined, "yyyy.mm.dd HH:MM:ss") + "]\n";


        costs += Math.ceil((2 + util.dateDiff(args.tail, args.head)) * 10);

        // Post to hastebin
        var req = http.request({
            host: "www.hastebin.com",
            port: "80",
            path: "/documents",
            method: "POST",
            headers: {
                "Content-Type": "text/plain",
                "Content-Length": Buffer.byteLength(output, 'utf8')
            }
        }, function(res) {
            debug("Got response");

            res.setEncoding("utf8");

            var str = "";
            res.on("data", function(chunk) {
                str += chunk;
            });
            res.on("end", function() {
                var id = str.match(/{"key":"(\w+)"}/);
                if (!id) {
                    debug("Unexpected response", str);
                    client.say(to, from + ": Unexpected response from hastebin!");
                } else {
                    var url = "http://hastebin.com/" + id[1] + ".txt";
                    client.say(to, util.colorfy(from + ": Tip statistics uploaded, see {{bold}}" + url + "{{bold}}"));
                }
            });
        });

        req.on("error", function(err) {
            debug("Hastebin error", err.toString());
            client.say(to, from + ": " + err);
        });

        debug("Posting to hastebin");
        req.write(output, "utf8");
        req.end();

    });

    t.on("error", function(err) {
        client.say(to, from + ": " + err);
    });

    t.start();
}


cmds.tipsper = new Command();
cmds.tipsper.args = [new Arg("unit", "string", false), new Arg("range", "number", true)];
cmds.tipsper.help = "Shows you the current tip amount and speed. "
    + " Unit can be second/minute/hour/day and range is the measure range, default 1.";
cmds.tipsper.costblock = true;

cmds.tipsper.func = function(from, to, args) {
    var units = {
        "day": 1000 * 60 * 60 * 24,
        "hour": 1000 * 60 * 60,
        "minute": 1000 * 60,
        "second": 1000
    }

    if (!args.range) {
        args.range = 1;
    }
    if (!units.hasOwnProperty(args.unit)) {
        client.say(to, from + ": I don't even know that unit.");
        return;
    }
    if (args.range <= 0) {
        client.say(to, from + ": I can't measure in that range...");
        return;
    }
    args.range = +(args.range).toFixed(4);

    var tail = util.dateToUTC(new Date());
    var head = new Date();
    head.setTime(tail.getTime()-(args.range*units[args.unit]));

    if (isNaN(head) || isNaN(tail)) {
        client.say(to, from + ": I really can't measure in that range...");
        return;
    }

    var t = new Tipstat("#dogecoin", "*", head, tail);
    t.on("end", function(incoming, outgoing, tippers, tippees, matches) {
        client.say(to, util.colorfy(from
            + ":{{clear}} tp" + args.unit.substring(0,1)
            + ": {{red}}" + util.thd(+(incoming.tips / args.range).toFixed(4))
            + "{{clear}}, Ɖp" + args.unit.substring(0,1)
            + ": {{red}}" + util.thd(+(incoming.sum / args.range).toFixed(4))
            + "{{clear}} (measured in the last " + util.thd(args.range) + " " + args.unit
            + "s)"));
        costs += Math.ceil((1 + util.dateDiff(tail, head)) * 7);
    });

    t.on("error", function(err) {
        client.say(to, from + ": " + err);
    });

    t.start();
}

module.exports = cmds;
