'use strict';

// Dependencies
const Pkg       = require('../package');
const Utils     = require('./utils');
const SparkPost = require('@pixul/sparkpost');

class SparkPostTransport {

    constructor(options = {}) {

        // Set the SparkPost API Key (must have appropriate Transmission resource permissions)
        this.sparkPostApiKey      = options.sparkPostApiKey || process.env.SPARKPOST_API_KEY;
        this.sparkPostEmailClient = new SparkPost(this.sparkPostApiKey, {
            stackIdentity : `nodemailer-sparkpost-transport/${ this.version }`,
            origin        : options.origin
        });

        // Set any options which are valid
        for (const opt in options) {

            this[opt] = options[opt];
        }
    }

    async send(message, callback) {

        const data    = message.data;
        const request = {
            content : {}
        };

        const resolveme = {};

        // Conventional nodemailer fields override SparkPost-specific ones and defaults
        Utils.populateCustomFields(message, this, request);
        Utils.populateRecipients(request, data);

        if (data.raw) {

            resolveme.raw = 'email_rfc822';
        }
        else {

            Utils.populateInlineStdFields(message, resolveme, request);
        }

        const res = await this.resolveAndSend(message, resolveme, request);

        callback(null, res); //This is ugly, but nodemailer doesn't support promise for .send method
    }

    async resolveAndSend(mail, toResolve, request) {

        for (const key of Object.keys(toResolve)) {

            request.content[toResolve[key]] = await this.loadContent(mail, key);
        }

        return this.sendWithSparkPost(request);
    }

    async sendWithSparkPost(message) {

        const res = await this.sparkPostEmailClient.transmissions.send(message);

        return {
            messageId : res.results.id,
            accepted  : res.results.total_accepted_recipients,
            rejected  : res.results.total_rejected_recipients
        };
    }

    async loadContent(mail, key) {

        const content = mail.data[key];

        if (typeof content === 'string') {

            return content;
        }

        const res = await mail.resolveContent(mail.data, key);

        return res.toString();
    }

    get name() {

        return 'SparkPost';
    }

    get version() {

        return Pkg.version;
    }
}

module.exports = function (options) {

    return new SparkPostTransport(options);
};
