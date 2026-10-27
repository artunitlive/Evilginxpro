const BrowserPage = require('./page');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { executablePath } = require('puppeteer');
//puppeteer.use(StealthPlugin());

class Browser {
    constructor(isHeadless) {
        this.browser = null;
        this.isHeadless = isHeadless;
        this.pages = new Map();
        this.pageTimeouts = new Map();

        setInterval(this.#cleanup.bind(this), 5000);
    }

    async createPage(id, interceptors) {
        await this.#createBrowser();
        var page = this.getPage(id)
        //console.log("browser::createPage('" + id + "') == " + page);
        if (page == undefined) {
            page = new BrowserPage(this.browser, id, 15 * 1000);
            var ok = await page.create();
            if (ok == false) {
                return null;
            }
            this.pages.set(page.id, page);
            this.pageTimeouts.set(page.id, Date.now());
        }
        await page.setup(interceptors);
        return page;
    }

    getPage(id) {
        var page = this.pages.get(id);
        if (page != undefined) {
            this.pageTimeouts.set(page.id, Date.now());
        }
        return page;
    }

    async closePage(id) {
        //console.log("browser::closePage('" + id + "')");
        const page = this.getPage(id)
        if (page != undefined) {
            await page.close();
            this.pages.delete(id);
        }
        this.pageTimeouts.delete(id);
    }

    async close() {
        console.log("browser::close()");
        if (this.browser != null) {
            await this.browser.close();
        }
        this.browser = null;
    }

    async #createBrowser() {
        //console.log("browser::createBrowser()");
        if (this.browser == null) {
            //this.browser = await puppeteer.launch({ headless: this.isHeadless, executablePath: executablePath() })
            //this.browser = await puppeteer.launch({ headless: this.isHeadless, executablePath: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", userDataDir: "C:\\temp\\puppeteer\\"})
            try {
                this.browser = await puppeteer.connect({browserURL: "http://127.0.0.1:58000"});
                console.log("creating browser: " + this.browser);
            } catch(error) {
                console.log("browser: cannot connect: " + error);
            }

        }
    }

    #cleanup() {
        const t = Date.now();
        this.pageTimeouts.forEach((lastActive, id, map) => {
            console.log("now:" + t + " lastActive:" + lastActive + " id:" + id);
            if (t - lastActive >= 10 * 60 * 1000) {
                console.log(`page '${id}' inactive for extended period of time - closing`);
                this.closePage(id);
            }
        });
    }
}

module.exports = Browser;