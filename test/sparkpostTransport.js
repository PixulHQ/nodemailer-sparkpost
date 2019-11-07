'use strict';

const Code               = require('@hapi/code');
const Lab                = require('@hapi/lab');
const Sinon              = require('sinon');
const Nodemailer         = require('nodemailer');
const SparkPostTransport = require('../lib');
const Pkg                = require('../package.json');

const { expect }                   = Code;
const { describe, it, beforeEach } = exports.lab = Lab.script();

describe('SparkPost Transport', () => {

    const transport = SparkPostTransport({ sparkPostApiKey : '12345678901234567890' });

    it('should have a name and version property', () => {

        expect(transport.name).to.equal('SparkPost');
        expect(transport.version).to.equal(Pkg.version);
    });

    it('should expose a send method', () => {

        expect(transport.send).to.exist();
        expect(transport.send).to.be.a.function();
    });

    it('sparkpost api key options should override env', () => {

        process.env.SPARKPOST_API_KEY = '2345';

        const transportWithOverride = SparkPostTransport({
            sparkPostApiKey : '12345678901234567890'
        });

        expect(transportWithOverride.sparkPostApiKey).to.equal('12345678901234567890');
    });

    it('sparkpost api key should be got from env if not in options', () => {

        process.env.SPARKPOST_API_KEY = '12345678901234567890';

        const transportWithOverride = SparkPostTransport({});

        expect(transportWithOverride.sparkPostApiKey).to.equal('12345678901234567890');
    });

    it('should be able to set options', () => {

        const transportWithOptions = SparkPostTransport({
            sparkPostApiKey   : '12345678901234567890',
            endpoint          : 'https://api.eu.sparkpost.com',
            campaign_id       : 'sample_campaign',
            tags              : ['new-account-notification'],
            metadata          : { 'source' : 'event' },
            substitution_data : { 'salutatory' : 'Welcome to SparkPost!' },
            options           : { 'click_tracking' : true, 'open_tracking' : true },
            content           : { 'template_id' : 'newAccountNotification' },
            recipients        : [{ 'email' : 'john.doe@example.com', 'name' : 'John Doe' }]
        });

        expect(transportWithOptions.endpoint).to.equal('https://api.eu.sparkpost.com');
        expect(transportWithOptions.campaign_id).to.equal('sample_campaign');
        expect(transportWithOptions.tags).to.equal(['new-account-notification']);
        expect(transportWithOptions.metadata).to.equal({ 'source' : 'event' });
        expect(transportWithOptions.substitution_data).to.equal({ 'salutatory' : 'Welcome to SparkPost!' });
        expect(transportWithOptions.options).to.equal({ 'click_tracking' : true, 'open_tracking' : true });
        expect(transportWithOptions.content).to.equal({ 'template_id' : 'newAccountNotification' });
        expect(transportWithOptions.recipients).to.equal([{ 'email' : 'john.doe@example.com', 'name' : 'John Doe' }]);
    });

});

describe('Send Method', () => {

    describe('SP-centric mail structure', () => {

        it('should be able to overload options at the transmission', () => {

            // Create the default transport
            const transport = SparkPostTransport({
                sparkPostApiKey   : '12345678901234567890',
                campaign_id       : 'sample_campaign',
                tags              : ['new-account-notification'],
                metadata          : { 'source' : 'event' },
                substitution_data : { 'salutatory' : 'Welcome to SparkPost!' },
                options           : { 'click_tracking' : true, 'open_tracking' : true },
                content           : { 'template_id' : 'newAccountNotification' },
                recipients        : [{ 'email' : 'john.doe@example.com', 'name' : 'John Doe' }]
            });

            // Create the modified options for use with the above stub test
            // eslint-disable-next-line one-var
            const overloadedTransmission = {
                campaign_id       : 'another_sample_campaign',
                tags              : ['alternative-tag'],
                metadata          : { 'changedKey' : 'value' },
                substitution_data : { 'salutatory' : 'And now...for something completely different' },
                options           : { 'click_tracking' : false, 'open_tracking' : false, 'transactional' : true },
                recipients        : [
                    {
                        list_id : 'myStoredRecipientTestList'
                    }
                ],
                content           : {
                    template_id : 'someOtherTemplate'
                }
            };

            // Stub the send method of the SDK out
            Sinon.stub(transport, 'send').callsFake((data, resolve) => {
                // Grab the transmission body from the send() payload for assertions
                expect(data.campaign_id).to.equal('another_sample_campaign');
                expect(data.tags).to.equal(['alternative-tag']);
                expect(data.metadata).to.equal({ 'changedKey' : 'value' });
                expect(data.substitution_data).to.equal({ 'salutatory' : 'And now...for something completely different' });
                expect(data.options).to.equal({ 'click_tracking' : false, 'open_tracking' : false, 'transactional' : true });
                expect(data.content).to.equal({ 'template_id' : 'someOtherTemplate' });
                expect(data.recipients).to.equal([{ 'list_id' : 'myStoredRecipientTestList' }]);

                // Resolve the stub's spy
                resolve({
                    results : {
                        total_rejected_recipients : 0,
                        total_accepted_recipients : 1,
                        id                        : '66123596945797072'
                    }
                });
            });

            // Call the stub from above
            return new Promise((resolve) => {

                transport.send(overloadedTransmission, (data) => {

                    expect(data.results.id).to.exist();
                    expect(data.results.total_rejected_recipients).to.exist();
                    expect(data.results.total_accepted_recipients).to.exist();
                    resolve();
                });
                // Return the original method to its proper state
                transport.send.restore();
            });
        });
    });

    describe('conventional nodemailer mail structure', () => {

        let sptrans;
        let transport;
        let mail;
        let rcp1;
        let rcp2;

        const checkRecipientsFromFld = (email, infld, val, outfld, resolve) => {

            email[infld] = val;
            transport.sendMail(email, () => {

                const transBody = sptrans.sparkPostEmailClient.transmissions.send.firstCall.args[0];

                expect(transBody).to.include(['recipients', 'content']);
                expect(transBody[outfld].length).to.equal(2);
                expect(transBody[outfld][0]).to.equal({ address : rcp1 });
                expect(transBody[outfld][1]).to.equal({ address : rcp2 });
                resolve();
            });
        };

        beforeEach(() => {

            sptrans = SparkPostTransport({
                sparkPostApiKey : '12345678901234567890'
            });

            transport = Nodemailer.createTransport(sptrans);

            rcp1 = 'Mrs. Asoni <a@a.com>';
            rcp2 = 'b@b.com';

            mail = {
                from    : 'roberto@from.example.com',
                to      : 'kingcnut@to.example.com',
                subject : 'Modern Kinging',
                text    : 'Edicts and surfeits...',
                html    : '<p>Edicts and surfeits...</p>',
                replyTo : 'other@to.example.com',
                headers : {
                    'X-MSYS-SUBACCOUNT' : 125
                }
            };

            sptrans.sparkPostEmailClient.transmissions.send = Sinon.stub().yields({
                results : {
                    total_rejected_recipients : 0,
                    total_accepted_recipients : 1,
                    id                        : '66123596945797072'
                }
            });
        });

        it('should accept nodemailer content fields', () => {

            return new Promise((resolve) => {

                transport.sendMail(mail, () => {

                    const transBody = sptrans.sparkPostEmailClient.transmissions.send.firstCall.args[0];

                    expect(transBody).to.include(['recipients', 'content']);
                    expect(transBody.content.html).to.equal(mail.html);
                    expect(transBody.content.text).to.equal(mail.text);
                    expect(transBody.content.subject).to.equal(mail.subject);
                    expect(transBody.content.from).to.equal(mail.from);
                    expect(transBody.content.reply_to).to.equal(mail.replyTo);
                    expect(transBody.content.headers).to.equal(mail.headers);
                    expect(transBody.recipients.length).to.equal(1);
                    expect(transBody.recipients[0]).to.include('address');
                    expect(transBody.recipients[0].address).to.be.a.string();
                    expect(transBody.recipients[0].address).to.equal(mail.to);
                    resolve();
                });
            });
        });

        it('should format attachments', () => {

            mail.attachments = [
                {
                    filename    : 'an_attachment',
                    content     : 'Q29uZ3JhdHVsYXRpb25zLCB5b3UgY2FuIGJhc2U2NCBkZWNvZGUh',
                    contentType : 'application/pdf'
                },
                {
                    filename    : 'another_attachment',
                    content     : 'Q30uZ3JhdHVsYXRpb25zLCB5b3UgY2FuIGJhc2U2NCBkZWNvZGUh',
                    contentType : 'application/pdf'
                }
            ];

            return new Promise((resolve) => {

                transport.sendMail(mail, () => {

                    const transBody = sptrans.sparkPostEmailClient.transmissions.send.firstCall.args[0];

                    expect(transBody.content.attachments.length).to.equal(2);
                    expect(transBody.content.attachments[0]).to.equal({
                        name : 'an_attachment',
                        type : 'application/pdf',
                        data : 'Q29uZ3JhdHVsYXRpb25zLCB5b3UgY2FuIGJhc2U2NCBkZWNvZGUh'
                    });
                    resolve();
                });
            });
        });

        it('should accept raw mail structure', () => {

            delete mail.subject;
            delete mail.text;
            delete mail.html;
            delete mail.from;
            mail.raw = 'rawmsg';
            return new Promise((resolve) => {

                transport.sendMail(mail, () => {

                    const transBody = sptrans.sparkPostEmailClient.transmissions.send.firstCall.args[0];

                    expect(transBody).to.include(['recipients', 'content']);
                    expect(transBody.content).to.include('email_rfc822');
                    expect(transBody.recipients.length).to.equal(1);
                    expect(transBody.recipients[0]).to.include('address');
                    expect(transBody.recipients[0].address).to.be.a.string();
                    expect(transBody.recipients[0].address).to.equal(mail.to);
                    resolve();
                });
            });
        });

        it('should accept from as a string', () => {

            mail.from = 'me@here.com';
            return new Promise((resolve) => {

                transport.sendMail(mail, () => {

                    const trans = sptrans.sparkPostEmailClient.transmissions.send.firstCall.args[0];
                    expect(trans.content.from).to.be.a.string();
                    resolve();
                });
            });
        });

        it('should accept from as an object', () => {

            mail.from = {
                name    : 'Me',
                address : 'me@here.com'
            };

            return new Promise((resolve) => {

                transport.sendMail(mail, () => {

                    const trans = sptrans.sparkPostEmailClient.transmissions.send.firstCall.args[0];
                    expect(trans.content.from).to.be.an.object();
                    expect(trans.content.from).to.include('name');
                    expect(trans.content.from.name).to.equal(mail.from.name);
                    expect(trans.content.from).to.include('email');
                    expect(trans.content.from.email).to.equal(mail.from.address);
                    resolve();
                });
            });
        });

        it('should accept to as an array', (done) => {

            return new Promise((resolve) => {

                checkRecipientsFromFld(mail, 'to', [rcp1, rcp2], 'recipients', resolve);
            });
        });

        it('should accept to as a string', (done) => {

            return new Promise((resolve) => {

                checkRecipientsFromFld(mail, 'to', [rcp1, rcp2].join(','), 'recipients', resolve);
            });
        });

        it('should accept cc as an array', () => {

            return new Promise((resolve) => {

                checkRecipientsFromFld(mail, 'cc', [rcp1, rcp2], 'cc', resolve);
            });
        });

        it('should accept cc as a string', () => {

            return new Promise((resolve) => {

                checkRecipientsFromFld(mail, 'cc', [rcp1, rcp2].join(','), 'cc', resolve);
            });
        });

        it('should accept bcc as an array', () => {

            return new Promise((resolve) => {

                checkRecipientsFromFld(mail, 'bcc', [rcp1, rcp2], 'bcc', resolve);
            });
        });

        it('should accept bcc as a string', () => {

            return new Promise((resolve) => {

                checkRecipientsFromFld(mail, 'bcc', [rcp1, rcp2].join(','), 'bcc', resolve);
            });
        });
    });
});
