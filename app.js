var irc = require("irc");
var util = require("./util");
var cmds = require("./cmds");

var cmdparser = /([^"' ]+)|["']([^"']*)["']/g;


global.BOT_PREFIX = process.env.BOT_PREFIX || "!";
global.BOT_DEBUG = util.parseBool(process.env.BOT_DEBUG, false);
global.BOT_OWNER = process.env.BOT_OWNER || "";

global.IRC_NICK = process.env.IRC_NICK || "tipstatbot";
global.IRC_SERVER = process.env.IRC_SERVER || "irc.freenode.net";
global.IRC_CHANNELS = (process.env.IRC_CHANNELS || "").split(",");

global.costs = 0;

global.debug = function() {
    if (BOT_DEBUG)
        console.log.apply(this, arguments);
}

global.client = new irc.Client(
    IRC_SERVER,
    IRC_NICK,
    {
        userName: process.env.IRC_USERNAME || "tipstatbot",
        realName: process.env.IRC_REALNAME || "Node.js rocks!",
        port: Number(process.env.IRC_PORT) || 6667,
        debug: BOT_DEBUG,
        showErrors: true,
        autoRejoin: util.parseBool(process.env.IRC_AUTOREJOIN, true),
        autoConnect: false,
        channels: IRC_CHANNELS,
        floodProtection: true,
        floodProtectionDelay: 300,
        stripColors: false
    }
);


client.on("registered", function(message) {
    var u = process.env.IRC_NSNICK || IRC_NICK;
    var p = process.env.IRC_NSPASS;
    if (u && p)
        client.say("NickServ", "IDENTIFY " + u + " " + p);
});

client.on("message#", function(from, to, text, message) {
    var m = text.match(cmdparser);

    if (m[0].substring(0, 1) != BOT_PREFIX) {
        return;
    }

    var name = m[0].substring(1);
    debug("Name", name);

    if (m && m.length > 0 && cmds.hasOwnProperty(name)) {
        var cmd = cmds[name];
        var rargs = m.slice(1);

        // command is cost-blocked
        if (cmd.costblock && costs > 0) {
            client.say(to, from + ": Please wait " + String(costs) + " seconds.");
            return;
        }

        // check arguments
        var args = [];
        for (var i = 0; i < cmd.args.length; i++) {
            if (i >= rargs.length) {
                if (cmd.args[i].optional) {
                    break;
                } else {
                    client.say(to, from + ": " + "Not enough arguments! Try "
                        + BOT_PREFIX + "help " + name);
                    return;
                }
            }

            var arg = rargs[i];
            if (cmd.args[i].type == "number") {
                arg = Number(arg);
                if (isNaN(arg)) {
                    client.say(to, from + ": " + cmd.args[i].name.toUpperCase() + " has to be a number! Try "
                        + BOT_PREFIX + "help " + name);
                    return;
                }
            } else if (cmd.args[i].type == "date") {
                arg = new Date(arg);
                if (isNaN(arg)) {
                    client.say(to, from + ": " + cmd.args[i].name.toUpperCase() + " has to be a valid date! Try "
                        + BOT_PREFIX + "help " + name);
                    return;
                }
            } else {
                arg = arg.replace(/^["']+|["']+$/gm, "");
            }
            args[cmd.args[i].name] = arg;
        }

        debug("Parsed", m);

        if (cmd.restricted) {
            // restricted command
            if (from != BOT_OWNER) {
                debug("Restricted command denied");
                client.say(to, from + ": Sorry, that command is reserved for " + BOT_OWNER + ".");
            } else {
                var cb = function(nnick, nto, ntext, nmessage) {
                    if (nnick == "NickServ") {
                        client.removeListener("notice", cb);
                        if (ntext == BOT_OWNER + " ACC 3") {
                            debug("Restricted command allowed");
                            cmd.func(from, to, args);
                        } else {
                            debug("Impersonation!");
                            client.say(to, from + ": Stop impersonating my owner!");
                        }
                    }
                }
                client.on("notice", cb);
                client.say("NickServ", "ACC " + process.env.OWNER);
            }
        } else {
            // unrestricted command
            cmd.func(from, to, args);
        }
    }
})

client.connect(process.env.IRC_RETRYCOUNT || 5);

// reduce cost every second
setInterval(function() {
    if (costs > 0) {
        costs--;
    }
}, 1000);
