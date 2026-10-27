
const jsObfuscator = require('javascript-obfuscator');

class Obfuscator {
    constructor() {

    }

    async obfuscate(script) {
        try {
            var res = jsObfuscator.obfuscate(script,
                {
                    stringArrayEncoding: ['rc4'],
                }
            );
            return res.getObfuscatedCode();
        } catch(error) {
            console.error("obfuscator: " + error);
            return script
        }
    }
}

module.exports = Obfuscator;