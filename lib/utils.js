'use strict';

const internals = {};

module.exports.populateCustomFields = (message, defaults, request) => {

    const data         = message.data;
    const customFields = ['campaign_id', 'metadata', 'substitution_data', 'options', 'content', 'recipients'];

    // Apply default SP-centric options and override if provided in mail object
    customFields.forEach((fld) => {

        if (data.hasOwnProperty(fld)) {
            request[fld] = data[fld];
        }
        else if (defaults.hasOwnProperty(fld)) {

            request[fld] = defaults[fld];
        }
    });
};

module.exports.populateInlineStdFields = (message, resolveme, request) => {

    const data        = message.data;
    const resolveKeys = ['html', 'text'];
    const contentFlds = {
        'subject' : 'subject',
        'headers' : 'headers',
        'replyTo' : 'reply_to'
    };

    internals.populateFrom(data, request);

    // content fields that get transferred to request
    Object.keys(contentFlds).map((key) => {

        if (data.hasOwnProperty(key)) {

            request.content[contentFlds[key]] = data[key];
        }
    });

    for (const key of resolveKeys) {

        if (data.hasOwnProperty(key)) {

            resolveme[key] = key;
        }
    }

    // format attachments
    if (data.attachments) {

        const spAttachments = [];

        for (const att of data.attachments) {

            spAttachments.push({
                name : att.filename,
                type : att.contentType,
                data : att.content
            });
        }

        request.content.attachments = spAttachments;
    }
};

module.exports.populateRecipients = (request, msgData) => {

    if (msgData.to) {
        request.recipients = internals.emailList(msgData.to) || [];
    }

    if (msgData.cc) {
        request.cc = internals.emailList(msgData.cc);
    }

    if (msgData.bcc) {
        request.bcc = internals.emailList(msgData.bcc);
    }
};

internals.emailList = (strOrLst) => {

    let lst = strOrLst;

    if (typeof strOrLst === 'string') {

        lst = strOrLst.split(',');
    }

    return lst.map((addr) => {

        if (typeof addr === 'string') {

            return { address : addr };
        }

        return {
            address : {
                name  : addr.name,
                email : addr.address
            }
        };
    });
};

internals.populateFrom = (inreq, outreq) => {

    if (inreq.from) {

        outreq.content.from = inreq.from;

        if (typeof (inreq.from) === 'object') {

            outreq.content.from = {
                name  : inreq.from.name || null,
                email : inreq.from.address
            };
        }
    }
};
