var irc = require("irc");
var bot = require("bot");

function cfgBoolean(str) {
    if (str)
        str = str.toLowerCase();
        return str == "true" || str == "yes" || str == "1";
    else
        return false;
}

global.client = new irc.Client(
    process.env.IRC_SERVER || "irc.freenode.net",
    process.env.IRC_NICK || "tipstatbot",
    {
        userName: process.env.IRC_USERNAME || "tipstatbot",
        realName: process.env.IRC_REALNAME || "Node.js rocks!",
        port: Number(process.env.IRC_PORT) || 6667,
        debug: cfgBoolean(process.env.IRC_DEBUG) || false,
        showErrors: cfgBoolean(process.env.IRC_SHOWERRORS) || true,
        autoRejoin: cfgBoolean(process.env.IRC_AUTOREJOIN) || true,
        autoConnect: false,
        channels: (process.env.IRC_CHANNELS || "").split(","),
        floodProtection: true,
        floodProtectionDelay: 300,
        stripColors: false
    }
);

global.client.addListener("registered", function(message) {
    var u = process.env.IRC_NSNICK || process.env.IRC_NICK;
    var p = process.env.IRC_NSPASS;
    if (u && p)
        client.say("NickServ", "IDENTIFY " + u + " " + p);
});

client.connect(process.env.IRC_RETRYCOUNT || 5);
bot.start();
