# SparkPost transport for Nodemailer

This is a fork of [nodemailer-sparkpost-transport](https://github.com/SparkPost/nodemailer-sparkpost-transport).

[![Travis CI](https://travis-ci.org/PixulHQ/nodemailer-sparkpost.svg?branch=master)](https://travis-ci.org/PixulHQ/nodemailer-sparkpost) [![Coverage Status](https://coveralls.io/repos/github/PixulHQ/c/badge.svg?branch=master)](https://coveralls.io/github/PixulHQ/nodemailer-sparkpost?branch=master) [![npm version](https://badge.fury.io/js/%40pixul%2Fsparkpost.svg)](https://badge.fury.io/js/%40pixul%2Fsparkpost) [![npm version](https://badge.fury.io/js/%40pixul%2Fnodemailer-sparkpost.svg)](https://badge.fury.io/js/%40pixul%2Fnodemailer-sparkpost)

Lead Maintainer: [Daniel Cole](https://github.com/optii)

## Usage

### Install

```
npm install @pixul/nodemailer-sparkpost
```

### Create a Nodemailer transport object

```javascript
const Nodemailer = require('nodemailer');
const SparkPostTransport = require('@pixul/nodemailer-sparkpos');
const Transporter = Nodemailer.createTransport(SparkPostTransport(options));
```

where:

  - **options** defines connection _default_ transmission properties
    - `sparkPostApiKey` - SparkPost [API Key](https://app.sparkpost.com/account/api-keys). If not provided, it will use the `SPARKPOST_API_KEY` env var.
    - `endpoint` - The endpoint to use for the SparkPost API requests. If you have a SparkPost EU account, set this to `https://api.eu.sparkpost.com` (optional)
    - `campaign_id` - Name of the campaign (optional)
    - `metadata` - Transmission level metadata containing key/value pairs (optional)
    - `options` - JSON object in which transmission options are defined (optional)
    - `substitution_data` - Key/value pairs that are provided to the substitution engine (optional)

  For more information, see the [SparkPost API Documentation for Transmissions](https://developers.sparkpost.com/api/transmissions)

## Send a message

```javascript
transport.sendMail({
  from: 'me@here.com',
  to: 'you@there.com',
  subject: 'Very important stuff',
  text: 'Plain text',
  html: 'Rich taggery'
}, function(err, info) {

  if (err) {
    console.log('Error: ' + err);
  } else {
    console.log('Success: ' + info);
  }
});
```

[Read more about Nodemailer's `sendMail()` method here](https://github.com/nodemailer/nodemailer#sending-mail).

### Additional Options

The SparkPost Nodemailer transport also supports a few SparkPost-specific `sendMail()` options in both the transport constructor and the 'sendMail()` method.

Note: `sendMail()` options override their constructor counterparts:

  - **options**
    - `campaign_id` - Overrides for constructor option
    - `metadata` - Override for constructor option
    - `options` - Override for constructor option
    - `substitution_data` - Override for constructor option
