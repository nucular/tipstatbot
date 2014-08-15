// From http://strongloop.com/strongblog/practical-examples-of-the-new-node-js-streams-api
var stream = require('stream')

function liner() {
    var l = new stream.Transform( { objectMode: true } )

    l._transform = function (chunk, encoding, done) {
         var data = chunk.toString()
         if (this._lastLineData) data = this._lastLineData + data
     
         var lines = data.split('\n')
         this._lastLineData = lines.splice(lines.length-1,1)[0]
     
         lines.forEach(this.push.bind(this))
         done()
    }
     
    l._flush = function (done) {
         if (this._lastLineData) this.push(this._lastLineData)
         this._lastLineData = null
         done()
    }
    return l;
}
 
module.exports = liner
