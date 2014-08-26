var http = require("http");
var querystring = require("querystring");
var url = require("url");
var buffer = Buffer || require('buffer')

var dateformat = require("dateformat");
var EasyTable = require("easy-table");

var util = require("./util");
var tipstat = require("./tipstat");


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
                arghelp += (cmd.args[i].optional ? "[" : "")
                    + cmd.args[i].name.toUpperCase()
                    + "(" + cmd.args[i].type + ")"
                    + (cmd.args[i].optional ? "] " : " ");
            }

            client.say(to, from + ": "
                + BOT_PREFIX + args.name + " "
                + arghelp + " (" + cmd.help + ")");
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
    client.say(to, from + ": I'm a bot written by nucular in Node.js. "
        + "I can provide interesting tip statistics, powered by mniip's log server. "
        + "My source can be found at https://github.com/nucular/tipstatbot.");
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

    t = tipstat("#dogecoin", args.nick, args.head, args.tail)
    t.on("end", function(incoming, outgoing, tippers, tippees, matches) {
        client.say(to, from
            + ": Incoming (" + util.thd(incoming.tips) + "): Ɖ" + util.thd(incoming.amount)
            + ", outgoing (" + util.thd(outgoing.tips) + "): Ɖ" + util.thd(outgoing.amount)
            + ", net: Ɖ" + util.thd(incoming.amount - outgoing.amount));
        costs += Math.ceil((1 + util.dateDiff(args.tail, args.head)) * 7);
    });

    t.on("error", function(err) {
        client.say(to, from + ": " + err);
    });
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


    t = tipstat("#dogecoin", args.nick, args.head, args.tail);

    t.on("end", function(incoming, outgoing, tippers, tippees, matches) {
        var output = "Tips to and from: " + args.nick;
        output += "\n" + util.repeatString("=", output.length);

        output += "\nStart (UTC): " + dateformat(args.head, "yyyy.mm.dd HH:MM:ss");
        output += "\nEnd (UTC): " + dateformat(args.tail, "yyyy.mm.dd HH:MM:ss");

        output += "\n\nSummary\n-------"
        output += "\nIncoming: Ɖ" + util.thd(incoming.amount) + " (" + util.thd(incoming.tips) + " tips)";
        output += "\nOutgoing: Ɖ" + util.thd(outgoing.amount) + " (" + util.thd(outgoing.tips) + " tips)";
        output += "\nNet: Ɖ" + util.thd(incoming.amount - outgoing.amount);

        var n = function (digits) {
            return function (val, width) {
                if (val === undefined) return ''
                if (typeof val != 'number')
                    throw new Error(String(val) + ' is not a number')
                var s = digits == null ? String(val) : val.toFixed(digits).toString()
                return EasyTable.padLeft(util.thd(s), width)
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

        var s = "\nTippers (incoming): " + util.thd(tkeys.length);
        output += "\n\n" + s + "\n" + util.repeatString("-", s.length)
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
                    client.say(to, from + ": Tip statistics uploaded, see " + url);
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
}


module.exports = cmds;
