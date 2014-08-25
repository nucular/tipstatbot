var events = require("events");
var http = require("http");

var dateformat = require("dateformat");
var minimatch = require("minimatch");

var util = require("./util");
var liner = require("./liner.js");


var tipparser = /Such ([\w\<\-\[\]\\\^\{\}]+) tipped much Ɖ(\d+) to (\w+)\! \(to claim \/msg Doger help\) \[\w+\]/

var mtipcheck = /([\w\<\-\[\]\\\^\{\}]+): Tipped:/
var mtipparser = /([\w\<\-\[\]\\\^\{\}]+) (\d+)/g


function tipstream(channel, nick, head, tail) {
    var emitter = new events.EventEmitter();

    var url = "http://mniip.com/irc/log/?"
        + "channel=" + encodeURIComponent(channel)
        + "&head=" + encodeURIComponent(dateformat(head, "yyyy.mm.dd-HH:MM:ss"))
        + "&tail=" + encodeURIComponent(dateformat(tail, "yyyy.mm.dd-HH:MM:ss"))
        + "&grep=" + encodeURIComponent(nick)
        + "&raw";
    debug("Fetching logs from", url);

    var request = http.get(url, function(response) {
            debug("Got response");
            emitter.emit("response");

            response.on("error", function(err) {emitter.emit("error", err);});
            response.on("end", function(err) {emitter.emit("end");});

            var l = liner();
            response.pipe(l);

            // iterate the response line-by-line
            l.on("readable", function() {
                var line;
                while (line = l.read()) {
                    if (line == "Channel  is not publicly logged") {
                        emitter.emit("error", "Server error");
                    } else if (line == "Channel " + channel + " is not publicly logged") {
                        emitter.emit("error", "Channel is not publicly logged"); // well
                    } else {
                        var m = line.match(tipparser);
                        if (m) {
                            emitter.emit("tip", m[1], m[3], Number(m[2]));
                        }
                        else {
                            var m = line.match(mtipcheck);
                            if (m) {
                                var from = m[1];
                                var m = line.match(mtipparser);
                                if (m) {
                                    var args = ["mtip", from];

                                    for (var i = 0; i < m.length; i++) {
                                        var s = m[i].split(" ");
                                        emitter.emit("tip", from, s[0], Number(s[1]));
                                        args.push([s[0], Number(s[1])]);
                                    }

                                    emitter.emit.apply(this, args);
                                }
                            }
                        }
                    }
                }
            });
            l.on("error", function(err) {emitter.emit("error", err);});
        }
    );
    request.on("error", function(err) {emitter.emit("error", err);});

    return emitter;
}

function tipstat(channel, target, head, tail) {
    var emitter = new events.EventEmitter();

    if (isNaN(head) || isNaN(tail)) {
        emitter.emit("error", "Date formats invalid");
        return;
    } else if (tail < head) {
        emitter.emit("error", "Tail date must be later than head date");
        return;
    } else if (util.dateDiff(tail, head) > 14) {
        emitter.emit("error", "Log server allows 14 days difference maximum");
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

    target = target.toLowerCase();

    log = tipstream(channel, "Doger", head, tail);

    log.on("error", function(err) {
        debug(err.toString());
        emitter.emit("error", err);
    });

    log.on("tip", function(from, to, amount) {
        to = to.toLowerCase();
        from = from.toLowerCase();

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
    });

    log.on("end", function() {
        debug("Done");
        emitter.emit("end", incoming, outgoing, tippers, tippees, matches);
    });

    return emitter;
}

module.exports = tipstat;
