const net = require('net');
const pjson = require('./package.json');

class Server {
    constructor(addr, port, jsonHandler) {
        this.addr = addr;
        this.port = port;
        this.server = net.createServer((s) => {
            var buffer = "";
            console.log(`server: connection from ${s.remoteAddress}`);
            // send version packet on connection
            this.send(s, {
                "command" : "version",
                "contents" : pjson.version
            });

            s.on('data', (data) => {
                try {
                    while (data.length > 0) {
                        var sepi = this.indexEOL(data);
                        if (sepi >= 0) {
                            const message = buffer + String(data).substring(0, sepi);
                            jsonHandler(s, JSON.parse(message));
                            buffer = "";
                            data = String(data).substring(sepi+2);
                        } else {
                            buffer += data;
                            data = "";
                        }
                    }
                } catch(err) {
                    console.error("server: " + err);
                    s.end();
                }
            });
            s.on('close', () => {
                console.log(`server: ${s.remoteAddress} disconnected`);
            });
            s.on('error', (error) => {
                console.error(`server: ${s.remoteAddress} error: ${error}`);
            });
        });
    }

    listen() {
        this.server.listen(this.port, this.addr);
    }

    send(s, data) {
        s.write(JSON.stringify(data)+"\n\n");
    }

    indexEOL(s) {
        var ss = String(s);
        for (var i=0; i<s.length-1; ++i) {
            if (ss.charCodeAt(i) == 10 && ss.charCodeAt(i+1) == 10) {
                return i;
            }
        }
        return -1;
    }
}

module.exports = Server;