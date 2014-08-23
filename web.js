var http = require("http");
var fs = require("fs");

function onrequest(req, res) {
    var pathname = url.parse(request.url).pathname;

    fs.readFile("public/tipstat.txt", function(err, data) {
        if (err) {
            res.writeHead(400, {"Content-Type": "text/plain"});
            res.write(String(err), "utf-8");
            res.end();
        } else {
            res.writeHead(200, {"Content-Type": "text/plain"});
            res.write(data, "utf-8");
            res.end();
        }
    });
}

http.createServer(onrequest).listen(80);
