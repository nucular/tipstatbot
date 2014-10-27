var events = require("events");
var http = require("http");

var dateformat = require("dateformat");
var minimatch = require("minimatch");

var util = require("./util");
var liner = require("./liner.js");


var tipparser = /Such ([\w\<\-\[\]\\\^\{\}]+) tipped much Ɖ(\d+) to (\w+)\! \(to claim \/msg Doger help\) \[\w+\]/

var mtipcheck = /([\w\<\-\[\]\\\^\{\}]+): Tipped:/
var mtipparser = /([\w\<\-\[\]\\\^\{\}]+) (\d+)/g


function Tipstream(channel, nick, head, tail) {
    this.channel = channel;
    this.nick = nick;
    this.head = head;
    this.tail = tail;

    var inst = this;

    this.start = function() {
        var url = "http://mniip.com/irc/log/?"
            + "channel=" + encodeURIComponent(this.channel)
            + "&head=" + encodeURIComponent(dateformat(this.head, "yyyy.mm.dd-HH:MM:ss"))
            + "&tail=" + encodeURIComponent(dateformat(this.tail, "yyyy.mm.dd-HH:MM:ss"))
            + "&grep=" + encodeURIComponent(this.nick)
            + "&raw";
        debug("Fetching logs from", url);

        var request = http.get(url, function(response) {
                debug("Got response");
                inst.emit("response");

                response.on("error", function(err) {inst.emit("error", err);});
                response.on("end", function(err) {inst.emit("end");});

                var l = liner();
                response.pipe(l);

                // iterate the response line-by-line
                l.on("readable", function() {
                    var line;
                    while (line = l.read()) {
                        if (line == "Channel  is not publicly logged") {
                            inst.emit("error", "Server error");
                        } else if (line == "Channel " + this.channel + " is not publicly logged") {
                            inst.emit("error", "Channel is not publicly logged"); // well
                        } else {
                            var m = line.match(tipparser);
                            if (m) {
                                inst.emit("tip", m[1], m[3], Number(m[2]));
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
                                            inst.emit("tip", from, s[0], Number(s[1]));
                                            args.push([s[0], Number(s[1])]);
                                        }

                                        inst.emit.apply(this, args);
                                    }
                                }
                            }
                        }
                    }
                });
                l.on("error", function(err) {inst.emit("error", err);});
            }
        );
        request.on("error", function(err) {inst.emit("error", err);});
    }
}
Tipstream.prototype.__proto__ = events.EventEmitter.prototype;


function Tipstat(channel, target, head, tail) {
    this.channel = channel;
    this.target = target;
    this.head = head;
    this.tail = tail;

    var inst = this;

    this.start = function() {
        if (isNaN(this.head) || isNaN(this.tail)) {
            inst.emit("error", "Date formats invalid");
            return this;
        } else if (this.tail < this.head) {
            inst.emit("error", "Tail date must be later than head date");
            return this;
        } else if (util.dateDiff(this.tail, this.head) > 14) {
            inst.emit("error", "Log server allows 14 days difference maximum");
            return this;
        }

        matches = [];
        incoming = {sum: 0, tips: 0, avg: 0};
        outgoing = {sum: 0, tips: 0, avg: 0};

        tippers = {};
        tippees = {};

        var mm = minimatch.Minimatch(this.target, {
            noglobstar: true, nocomment: true, nocase: true
        });
        mm.makeRe();

        target = this.target.toLowerCase();

        log = new Tipstream(this.channel, "Doger", this.head, this.tail);

        log.on("error", function(err) {
            debug(err.toString());
            inst.emit("error", err);
        });

        log.on("tip", function(from, to, amount) {
            to = to.toLowerCase();
            from = from.toLowerCase();

            if (mm.match(to)) {
                if (matches.indexOf(to) == -1)
                    matches.push(to)

                incoming.tips++;
                incoming.sum += amount;
                incoming.avg = (incoming.avg + amount) / 2;

                if (tippers.hasOwnProperty(from)) {
                    tippers[from].tips++;
                    tippers[from].sum += amount;
                    tippers[from].avg = (tippers[from].avg + amount) / 2;
                } else {
                    tippers[from] = {tips: 1, sum: amount, avg: 0};
                }
            }
            if (mm.match(from)) {
                if (matches.indexOf(from) == -1)
                    matches.push(from)

                outgoing.tips++;
                outgoing.sum += amount;
                outgoing.avg = (outgoing.avg + amount) / 2;

                if (tippees.hasOwnProperty(to)) {
                    tippees[to].tips++;
                    tippees[to].sum += amount;
                    tippees[to].avg = (tippees[to].avg + amount) / 2;
                } else {
                    tippees[to] = {tips: 1, sum: amount, avg: 0};
                }
            }
        });

        log.on("end", function() {
            debug("Done");
            inst.emit("end", incoming, outgoing, tippers, tippees, matches);
        });

        log.start();
    }
}
Tipstat.prototype.__proto__ = events.EventEmitter.prototype;


module.exports = Tipstat;
