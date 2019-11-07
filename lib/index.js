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
            endpoint      : options.endpoint
        });

        // Set any options which are valid
        for (const opt in options) {

            this[opt] = options[opt];
        }
    }

    send(message, callback) {

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

        this.resolveAndSend(message, resolveme, request, callback);
    }

    resolveAndSend(mail, toResolve, request, callback) {

        const keys = Object.keys(toResolve);

        if (keys.length === 0) {

            return this.sendWithSparkPost(request, callback);
        }

        // eslint-disable-next-line one-var
        const srcKey = keys[0];
        const dstKey = toResolve[keys[0]];

        delete toResolve[srcKey];

        this.loadContent(mail, srcKey, (err, content) => {

            if (err) {

                return callback(null, err);
            }

            request.content[dstKey] = content;
            this.resolveAndSend(mail, toResolve, request, callback);
        });
    }

    sendWithSparkPost(transBody, callback) {

        this.sparkPostEmailClient.transmissions.send(transBody, (err, res) => {

            if (err) {

                return callback(err);
            }

            // Example successful Sparkpost transmission response:
            // { "results": { "total_rejected_recipients": 0, "total_accepted_recipients": 1, "id": "66123596945797072" } }
            return callback(null, {
                messageId : res.results.id,
                accepted  : res.results.total_accepted_recipients,
                rejected  : res.results.total_rejected_recipients
            });
        });
    }

    loadContent(mail, key, callback) {

        const content = mail.data[key];

        if (typeof content === 'string') {

            return process.nextTick(() => {

                callback(null, content);
            });
        }

        mail.resolveContent(mail.data, key, (err, res) => {

            if (err) {

                return callback(err);
            }

            callback(null, res.toString());
        });
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
