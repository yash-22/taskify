const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const request = require('request');
'use strict';

// Imports dependencies and set up http server
const
  express = require('express'),
  bodyParser = require('body-parser'),
  app = express().use(bodyParser.json()); // creates express http server

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

// Creates the endpoint for our webhook 
app.post('/webhook', (req, res) => {

    let body = req.body;

    // Checks this is an event from a page subscription
    if (body.object === 'page') {

        // Iterates over each entry - there may be multiple if batched
        body.entry.forEach(function (entry) {
            // Gets the body of the webhook event
            let webhook_event = entry.messaging[0];
            console.log(webhook_event);

            // Get the sender PSID
            let sender_psid = webhook_event.sender.id;
            console.log('Sender PSID: ' + sender_psid);

            // Check if the event is a message or postback and
            // pass the event to the appropriate handler function
            if (webhook_event.message) {
                handleMessage(sender_psid, webhook_event.message);
            } else if (webhook_event.postback) {
                handlePostback(sender_psid, webhook_event.postback);
            }
        });

        // Returns a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // Returns a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }

});

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {

    // Your verify token. Should be a random string.
    let VERIFY_TOKEN = "yash-taskify"

    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    // Checks if a token and mode is in the query string of the request
    if (mode && token) {

        // Checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {

            // Responds with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);

        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
});

// Handles messages events
function handleMessage(sender_psid, received_message) {
    let response;

    // Check if the message contains text
    const isGreeting = getEntity(received_message.nlp, 'greetings');
    const time = getTimeLoc(recieved_message.nlp, 'datetime');
    const location = getTimeLoc(recieved_message.nlp, 'location');
    if (isGreeting && isGreeting.confidence > 0.5) {
        response = {
            "text": 'Welcome to taskify. The Scheduling Bot. Now set remainders over messenger interactively.'
        }
        callSendAPI(sender_psid, response);
        response = {
            "text": 'What do you want to do today or this week?'
        }
    } else if (time && time.confidence > 0.7 && location && location.confidence > 0.7) {
        response = {
            "text": 'Task set at : "${time}" and "${location}"'
        }
    } else if (time && time.confidence > 0.7 ) {
        response = {
            "text": 'Task set at : "${time}".'
        }
            callSendAPI(sender_psid, response);
        response = {
            "text": 'What is the location for this task?'
        }
    } else if (location && location.confidence > 0.7) {
        response = {
            "text": 'Task set at : "${location}".'
        }
        callSendAPI(sender_psid, response);
        response = {
            "text": 'What time for this task?'
        }
    } else if (received_message.text) {

        // Create the payload for a basic text message
        response = {
            "text": `You sent the message: "${received_message.text}".`
        }
    } else if (received_message.attachments) {

        // Gets the URL of the message attachment
        let attachment_url = received_message.attachments[0].payload.url;
        response = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [{
                        "title": "Is this the right picture?",
                        "subtitle": "Tap a button to answer.",
                        "image_url": attachment_url,
                        "buttons": [
                          {
                              "type": "postback",
                              "title": "Yes!",
                              "payload": "yes",
                          },
                          {
                              "type": "postback",
                              "title": "No!",
                              "payload": "no",
                          }
                        ],
                    }]
                }
            }
        }

    }

    // Sends the response message
    callSendAPI(sender_psid, response);
}

function handlePostback(sender_psid, received_postback) {
    let response;

    // Get the payload for the postback
    let payload = received_postback.payload;

    // Set the response based on the postback payload
    if (payload === 'yes') {
        response = { "text": "Thanks!" }
    } else if (payload === 'no') {
        response = { "text": "Oops, try sending another image." }
    }
    // Send the message to acknowledge the postback
    callSendAPI(sender_psid, response);
}


function callSendAPI(sender_psid, response) {
    // Construct the message body
    let request_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": response
    }

    // Send the HTTP request to the Messenger Platform
    request({
        "uri": "https://graph.facebook.com/v2.6/me/messages",
        "qs": {
            "access_token": "EAABzOQcGgWoBAD2XGw8ISUAqOhHAEEYs78kJLpFZAiYFNELdF2XwlD7HvJaZAUQ61CS4qRJUwOmbmUdwZAjmNRPzJCBC9kQOEsRtkvg7i4nLZBzqeHZCMxsWHZCIWqcq3d3tWvRSfRkkomaZAeIoOZApiuElZBbXgnSQx2ROODZACx8DtoJyRmi7h2"
        },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if (!err) {
            console.log('message sent!')
        } else {
            console.error("Unable to send message:" + err);
        }
    });
}

function getEntity(nlp, name) {
    return nlp && nlp.entities && nlp.entities[name] && nlp.entities[name][0];
}

function getTimeLoc(nlp, name) {
    if (nlp && nlp.entities && nlp.entities[name] && nlp.entities[name][0]) {
        return nlp.entities[name][0];
    }
}
