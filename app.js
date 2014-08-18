var irc = require("irc");
var http = require("http");
var fs = require("fs");

var dateformat = require("dateformat");
var minimatch = require("minimatch");

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

function separateThousands(n) {
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
                                for (var i = 0; i < m.length; i++) {
                                    var s = m[i].split(" ");
                                    linecb(from, s[0], s[1]);
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

function tipsum(channel, target, head, tail, cb, errcb) {
    incoming_num = 0;
    incoming = 0;
    outgoing_num = 0;
    outgoing = 0;
    target = target.toLowerCase()
    var mm = minimatch.Minimatch(target, {
        noglobstar: true, nocomment: true
    });
    loglines(channel, "Doger", head, tail, function(from, to, amount) {
        to = to.toLowerCase();
        from = from.toLowerCase();
        amount = Number(amount);
        if (mm.match(to) && target != from) {
            incoming_num++;
            incoming += amount;
        } else if (mm.match(from) && target != to) {
            outgoing_num++;
            outgoing += amount;
        }
    }, function() {
        cb(incoming, incoming_num, outgoing, outgoing_num, incoming - outgoing);
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
    } else {
        client.say(to, from + ": Nah, it's !tipsum NICK HEAD [TAIL]");
        return;
    }
    if (isNaN(head) || isNaN(tail)) {
        client.say(to, from + ": Something's weird with your date formats.");
        return;
    }
    if (tail < head) {
        client.say(to, from + ": The tail date must be later than the head.");
        return;
    }

    var diff = dateDiff(tail, head);
    if (diff > 14) {
        client.say(to, from + ": The log server only allows 14 days difference maximum.");
        return;
    }
    cost += Math.ceil(diff * 7);

    tipsum("#dogecoin", nick, head, tail, function(incoming, incoming_num, outgoing, outgoing_num, net) {
        client.say(to, from
            + ": Incoming (" + separateThousands(incoming_num) + "): Ɖ" + separateThousands(incoming)
            + ", outgoing (" + separateThousands(outgoing_num) + "): Ɖ" + separateThousands(outgoing)
            + ", net: Ɖ" + separateThousands(net));
    }, function(err) {
        client.say(to, from + ": " + err);
    });
}

function cmd_tipstat(from, to, m) {
    client.say(to, from + ": That's not implemented yet :(");
}

var commands = {
    tsbhelp: [cmd_help, false, "[CMD] (May be helpful.)"],
    tipsum: [cmd_tipsum, true, "NICK HEAD [TAIL] "
    + "(Head, tail are dates with 14 days maximum difference "
    + "and tail is right now if not given. Nick may contain wildcards.)"],
    tipstat: [cmd_tipstat, true, "(not implemented yet)"]
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
