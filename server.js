const express = require('express');
const axios = require('axios');
const app = express();

// Meta Cloud API sends payloads as JSON data
app.use(express.json());

// Meta Credentials (Replace these with your dashboard values)
const ACCESS_TOKEN = 'YOUR_META_PERMANENT_ACCESS_TOKEN';
const PHONE_NUMBER_ID = 'YOUR_META_PHONE_NUMBER_ID';
const ADMIN_NUMBER = '91XXXXXXXXXX'; // 👈 Your personal WhatsApp number to get alerts (Include country code, no +)

const userSessions = {};

// Helper function to send messages via Meta Cloud API
async function sendWhatsAppMessage(to, textBody) {
    try {
        await axios.post(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: to,
            type: "text",
            text: { preview_url: false, body: textBody }
        }, {
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' }
        });
    } catch (err) {
        console.error("Error sending message via Meta:", err.response ? err.response.data : err.message);
    }
}

// Main Webhook for Incoming Meta Traffic
app.post('/webhook', async (req, res) => {
    // 1. Handle Meta Webhook Verification (Run once when linking your webhook)
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === 'my_secret_token_123') {
        return res.status(200).send(req.query['hub.challenge']);
    }

    try {
        // 2. Parse incoming user message from Meta JSON payload
        const entry = req.body.entry?.[0];
        const changes = entry?.changes?.[0];
        const messageData = changes?.value?.messages?.[0];

        if (!messageData) {
            return res.sendStatus(200); // Not an incoming text event
        }

        const fromNumber = messageData.from; // User's phone number string
        const userMessage = messageData.text?.body ? messageData.text.body.trim() : "";
        let replyMessage = "";

        // --- STATE MACHINE ROUTER ---
        if (!userSessions[fromNumber]) {
            userSessions[fromNumber] = { step: 'ASK_NAME' };
            replyMessage = "Namaste! Welcome to your Free Digital Health Assessment. 📋\n\nLet's calculate your full profile. What is your full name?";
            await sendWhatsAppMessage(fromNumber, replyMessage);
        } 
        else if (userSessions[fromNumber].step === 'ASK_NAME') {
            userSessions[fromNumber].name = userMessage;
            userSessions[fromNumber].step = 'ASK_GENDER';
            replyMessage = `Great to meet you, ${userMessage}! Please specify your gender (Reply with Male or Female):`;
            await sendWhatsAppMessage(fromNumber, replyMessage);
        } 
        else if (userSessions[fromNumber].step === 'ASK_GENDER') {
            userSessions[fromNumber].gender = userMessage;
            userSessions[fromNumber].step = 'ASK_AGE';
            replyMessage = "How old are you? (Enter age in numbers)";
            await sendWhatsAppMessage(fromNumber, replyMessage);
        } 
        else if (userSessions[fromNumber].step === 'ASK_AGE') {
            userSessions[fromNumber].age = parseInt(userMessage) || 25;
            userSessions[fromNumber].step = 'ASK_HEIGHT';
            replyMessage = "What is your current height in centimeters? (e.g., 175)";
            await sendWhatsAppMessage(fromNumber, replyMessage);
        } 
        else if (userSessions[fromNumber].step === 'ASK_HEIGHT') {
            userSessions[fromNumber].height = parseFloat(userMessage) || 170;
            userSessions[fromNumber].step = 'ASK_WEIGHT';
            replyMessage = "What is your current weight in kilograms? (e.g., 70)";
            await sendWhatsAppMessage(fromNumber, replyMessage);
        } 
        else if (userSessions[fromNumber].step === 'ASK_WEIGHT') {
            const weight = parseFloat(userMessage) || 70;
            const height = userSessions[fromNumber].height;
            const age = userSessions[fromNumber].age;
            const isMale = userSessions[fromNumber].gender.toLowerCase() === 'male';

            // Calculations
            const heightInMeters = height / 100;
            const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(1);
            const heightInInches = height / 2.54;
            const idealWeight = isMale ? (50 + 2.3 * (heightInInches - 60)).toFixed(1) : (45.5 + 2.3 * (heightInInches - 60)).toFixed(1);
            const bmr = isMale ? Math.round(10 * weight + 6.25 * height - 5 * age + 5) : Math.round(10 * weight + 6.25 * height - 5 * age - 161);
            const visceralFat = Math.round((bmi * 0.4) + (age * 0.1) - (isMale ? 2 : 4));
            const waterPercentage = isMale ? (2.447 - (0.09156 * age) + (0.1074 * height) + (0.3362 * weight)) / weight * 100 : (2.097 + (0.1069 * height) + (0.2466 * weight)) / weight * 100;

            userSessions[fromNumber].weight = weight;
            userSessions[fromNumber].bmi = bmi;
            userSessions[fromNumber].idealWeight = idealWeight;
            userSessions[fromNumber].bmr = bmr;
            userSessions[fromNumber].visceralFat = visceralFat;
            userSessions[fromNumber].waterPercentage = waterPercentage.toFixed(1);
            userSessions[fromNumber].step = 'PICK_DATE';

            replyMessage = `📊 *YOUR HEALTH MATRIX PROFILE* 📊\n\n` +
                           `• *BMI:* ${bmi}\n` +
                           `• *Ideal Body Weight:* ${idealWeight} kg\n` +
                           `• *Estimated BMR:* ${bmr} kcal/day\n` +
                           `• *Visceral Fat:* ${visceralFat}\n` +
                           `• *Total Body Water:* ${userSessions[fromNumber].waterPercentage}%\n\n` +
                           `👇 *Type your preferred date to book appointment (e.g., Today, Tomorrow):*`;
            await sendWhatsAppMessage(fromNumber, replyMessage);
        } 
        else if (userSessions[fromNumber].step === 'PICK_DATE') {
            userSessions[fromNumber].selectedDate = userMessage;
            userSessions[fromNumber].step = 'PICK_TIME';
            replyMessage = "Great! Now type your preferred time slot window (e.g., 11:00 AM, Evening):";
            await sendWhatsAppMessage(fromNumber, replyMessage);
        } 
        else if (userSessions[fromNumber].step === 'PICK_TIME') {
            const finalTime = userMessage;
            const data = userSessions[fromNumber];

            replyMessage = `✅ *Appointment Form Confirmed!*\n\n` +
                           `Your virtual consultation slot is locked for *${data.selectedDate}* during the *${finalTime}*.\n\n` +
                           `Our team has processed your structural enquiry. Keep your phone near you; an expert will link with you shortly!`;
            await sendWhatsAppMessage(fromNumber, replyMessage);

            // 📱 ALERT ADMIN PHONE IMMEDIATELY
            const adminAlert = `🚨 *NEW APPOINTMENT BOOKED!*\n\n` +
                               `• *Name:* ${data.name}\n` +
                               `• *Phone:* ${fromNumber}\n` +
                               `• *Age/Gender:* ${data.age} / ${data.gender}\n` +
                               `• *BMI/BMR:* ${data.bmi} / ${data.bmr} kcal\n` +
                               `• *Scheduled for:* ${data.selectedDate} @ ${finalTime}`;
            await sendWhatsAppMessage(ADMIN_NUMBER, adminAlert);

            delete userSessions[fromNumber];
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("Webhook processing failure:", err.message);
        res.sendStatus(500);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Meta-powered Webhook Engine active on port ${PORT}`));
