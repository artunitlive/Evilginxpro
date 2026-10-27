const sleep = ms => new Promise(res => setTimeout(res, ms));

class BrowserPage {
    constructor(browser, id, timeout_ms) {
        this.browser = browser;
        this.id = id;
        this.page = null;
        this.timeout_ms = timeout_ms;
        this.url = "about:blank";
        this.intercepts = new Map();
        this.interceptors = [];
    }

    async OpenUrl(url) {
        console.log("page::OpenUrl('" + url + "')");
        try {
            this.url = url;
            await this.page.goto(url)
        } catch(err) {
            console.log('page: failed to open url: ' + err)
            return [err, false];
        }
        return ["", true];
    }

    async DoAction(action) {
        //console.log(action);
        try {
            if (action.action == "open_url") {
                return this.OpenUrl(action.value);
            }
    
            switch (action.action) {
            case "type":
            {
                if (await this.page.waitForSelector(action.selector, {timeout: action.timeout}) == null) {
                    throw new Error("item not found: " + action.selector);
                }
                const item = await this.page.$(action.selector);
                if (action.value != "") {
                    await item.type(action.value, {delay: 0});
                    if (action.wait_after < 500) {
                        action.wait_after = 500;
                    }
                }
            }
            case "wait_for":
            {
                if (await this.page.waitForSelector(action.selector, {timeout: action.timeout}) == null) {
                    throw new Error("item not found: " + action.selector);
                }
            }
            case "click":
            {
                await this.page.waitForSelector(action.selector, {timeout: action.timeout});
                if (await this.page.waitForSelector(action.selector, {timeout: action.timeout}) == null) {
                    throw new Error("item not found: " + action.selector);
                }
                await this.page.click(action.selector);
            }
            case "press_enter":
            {
                await this.page.waitForSelector(action.selector, {timeout: action.timeout});
                if (await this.page.waitForSelector(action.selector, {timeout: action.timeout}) == null) {
                    throw new Error("item not found: " + action.selector);
                }
                const item = await this.page.$(action.selector);
                await item.enter;
            }
            }

            if (action.wait_after < 100) {
                action.wait_after = 100;
            }
            if (action.wait_after > 0) {
                await sleep(action.wait_after);
            }

            /*
            const item = await this.page.$(action.selector);
            if (action.value != "") {
                await item.type(action.value, {delay: 0});
                if (action.post_wait < 500) {
                    action.post_wait = 500;
                }
            }
            if (action.enter) {
                await item.enter;
            }
            if (action.click) {
                await this.page.click(action.selector)
            }
            if (action.post_wait < 100) {
                action.post_wait = 100;
            }
            if (action.wait_selector != "") {
                await this.page.waitForSelector(action.wait_selector, {timeout: action.wait});
            } else if (action.post_wait > 0) {
                await this.page.waitForTimeout(action.post_wait);
            }*/
        } catch(err) {
            console.log('page: action failed: ' + err);
            return [err, false];
        }
        return ["", true];
    }

    GetTokens(names) {
        //console.log("page::GetTokens('" + names + "')");
        var tokens = {};
        for (var name of names) {
            var token = this.intercepts.get(name);
            if (token == undefined) {
                return null;
            }
            tokens[name] = token;
        }

        for (var name of names) {
            this.intercepts.delete(name);
        }
        return tokens;
    }

    async create() {
        console.log("page::create() == " + this.page);
        if (this.page != null) {
            return true;
        }

        try {
            const ctx = await this.browser.createBrowserContext();
            //const ctx = await this.browser.defaultBrowserContext();
            const page = await ctx.newPage();
            await page.setRequestInterception(true);
            await page.setDefaultTimeout(this.timeout_ms);
            this.page = page;

            this.page.on('request', request => {
                const url = new URL(request.url());
                //console.log("request: " + url.href);

                var handled = false;
                
                //console.log(this.interceptors);
                for (var o of this.interceptors) {
                    var domains = o.domains
                    var search_re = new RegExp(o.search);

                    var domain_ok = false;
                    //console.log(o.domains);
                    for (var domain of o.domains) {
                        if (url.hostname == domain) {
                            console.log("interceptor: matched domain: " + domain);
                            domain_ok = true;
                            break;
                        }
                    }

                    if (domain_ok) {
                        var path_ok = false
                        //console.log(o.paths);
                        for (var path of o.paths) {
                            var pathRe = new RegExp(path);
                            if (url.pathname.match(pathRe)) {
                                console.log("interceptor: matched path: " + path);
                                path_ok = true;
                                break;
                            }
                        }
                        if (path_ok) {
                            var query_ok = true;
                            //console.log(o.query);
                            for (const qk in o.query) {
                                const qv = o.query[qk]
                                var qvRe = new RegExp(qv);
                                //console.log(qv);
                                var v = url.searchParams.get(qk);
                                if (v != null) {
                                    //console.log("interceptor: query not found: " + qk);
                                    if (!v.match(qvRe)) {
                                        query_ok = false;
                                        break;
                                    } else {
                                        //console.log("interceptor: query found: " + qk + " = " + qv);
                                    }
                                } else {
                                    //console.log("interceptor: query not found: " + qk);
                                    query_ok = false;
                                    break;
                                }
                            }

                            if (query_ok) {
                                // 
                                console.log("matched url: " + url.href);

                                var keyRe = new RegExp(o.key);
                                var searchRe = new RegExp(o.search);

                                if (o.body_type == "urlencoded") {
                                    const params = new URLSearchParams(request.postData());
                                    for (var [pkey, pval] of params) {
                                        if (pkey.match(keyRe)) {
                                            var vals = searchRe.exec(pval);
                                            if (vals != null && vals.length >= 2) {
                                                var extractedValue = o.value;
                                                for (var i=1; i<vals.length; ++i) {
                                                    extractedValue = extractedValue.replaceAll("{"+i+"}", vals[i]);
                                                    this.intercepts.set(o.name, extractedValue);
                                                }
                                            }
                                        }
                                    }
                                } else { // TODO: add support for json and headers
                                    console.log("body_type not supported: " + o.body_type);
                                }

                                if (o.abort) {
                                    handled = true;
                                    if (!request.isInterceptResolutionHandled()) {
                                        request.abort();
                                    }
                                    //setTimeout(() => { console.log("page.reload()"); this.page.goto(this.url.href) }, 1000);
                                    break;
                                }
                            }
                        }
                    }
                }

                if (!handled) {
                    if (!request.isInterceptResolutionHandled()) {
                        request.continue();
                    }
                }

            });
            return true;
        } catch(error) {
            console.log("page: error: " + error);
        }
        return false;
    }

    async setup(interceptors) {
        //console.log(interceptors);
        this.interceptors = interceptors;
    }

    async close() {
        try {
            await this.page.close();
        } catch(error) {
            console.log("page: already closed: " + error);
        }
    }

    async screenshot(path) {
        await this.page.screenshot({ path: path, fullPage: true })
    }
}

module.exports = BrowserPage;