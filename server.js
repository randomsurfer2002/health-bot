const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Meta Credentials - Replace these with your actual IDs from the Meta Developer Console
const ACCESS_TOKEN = 'YOUR_META_ACCESS_TOKEN';
const PHONE_NUMBER_ID = 'YOUR_PHONE_NUMBER_ID';
const VERIFY_TOKEN = 'your_secure_verify_token_here';

// In-Memory Session Storage
const userSessions = {};

// 1. Webhook Verification (GET)
app.get('/webhook', (req, res) => {
    if (req.query['hub.mode'] && req.query['hub.verify_token'] === VERIFY_TOKEN) {
        return res.status(200).send(req.query['hub.challenge']);
    }
    res.sendStatus(403);
});

// 2. Traffic Hook (POST)
app.post('/webhook', async (req, res) => {
    try {
        const entry = req.body.entry?.[0];
        const changes = entry?.changes?.[0];
        const messageObject = changes?.value?.messages?.[0];

        if (!messageObject) return res.sendStatus(200);

        const fromNumber = messageObject.from;
        let userMessage = "";

        if (messageObject.type === 'text') {
            userMessage = messageObject.text.body.trim();
        } else if (messageObject.type === 'interactive') {
            const reply = messageObject.interactive;
            userMessage = reply.button_reply?.title || reply.list_reply?.title || reply.list_reply?.id;
        }

        if (!userSessions[fromNumber]) {
            userSessions[fromNumber] = { step: 'ASK_NAME' };
            await sendTextMessage(fromNumber, "Namaste! Welcome to your Free Digital Health Assessment. 📋\n\nLet's calculate your full profile. What is your full name?");
        } 
        else if (userSessions[fromNumber].step === 'ASK_NAME') {
            userSessions[fromNumber].name = userMessage;
            userSessions[fromNumber].step = 'ASK_GENDER';
            await sendButtonMessage(fromNumber, `Great to meet you, ${userMessage}! Please specify your gender for accurate parameter processing:`, ['Male', 'Female']);
        } 
        else if (userSessions[fromNumber].step === 'ASK_GENDER') {
            userSessions[fromNumber].gender = userMessage;
            userSessions[fromNumber].step = 'ASK_AGE';
            await sendTextMessage(fromNumber, "How old are you? (Enter age in numbers)");
        } 
        else if (userSessions[fromNumber].step === 'ASK_AGE') {
            userSessions[fromNumber].age = parseInt(userMessage) || 25;
            userSessions[fromNumber].step = 'ASK_HEIGHT';
            await sendTextMessage(fromNumber, "What is your current height in centimeters? (e.g., 175)");
        } 
        else if (userSessions[fromNumber].step === 'ASK_HEIGHT') {
            userSessions[fromNumber].height = parseFloat(userMessage) || 170;
            userSessions[fromNumber].step = 'ASK_WEIGHT';
            await sendTextMessage(fromNumber, "What is your current weight in kilograms? (e.g., 70)");
        } 
        else if (userSessions[fromNumber].step === 'ASK_WEIGHT') {
            const weight = parseFloat(userMessage) || 70;
            const height = userSessions[fromNumber].height;
            const age = userSessions[fromNumber].age;
            const isMale = userSessions[fromNumber].gender.toLowerCase() === 'male';

            const heightInMeters = height / 100;
            const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(1);
            
            const heightInInches = height / 2.54;
            const idealWeight = isMale 
                ? (50 + 2.3 * (heightInInches - 60)).toFixed(1)
                : (45.5 + 2.3 * (heightInInches - 60)).toFixed(1);

            const bmr = isMale
                ? Math.round(10 * weight + 6.25 * height - 5 * age + 5)
                : Math.round(10 * weight + 6.25 * height - 5 * age - 161);

            const visceralFat = Math.round((bmi * 0.4) + (age * 0.1) - (isMale ? 2 : 4));
            const waterPercentage = isMale 
                ? (2.447 - (0.09156 * age) + (0.1074 * height) + (0.3362 * weight)) / weight * 100
                : (2.097 + (0.1069 * height) + (0.2466 * weight)) / weight * 100;

            userSessions[fromNumber].weight = weight;
            userSessions[fromNumber].bmi = bmi;
            userSessions[fromNumber].idealWeight = idealWeight;
            userSessions[fromNumber].bmr = bmr;
            userSessions[fromNumber].visceralFat = visceralFat;
            userSessions[fromNumber].waterPercentage = waterPercentage.toFixed(1);
            userSessions[fromNumber].step = 'PICK_DATE';

            const reportText = `📊 *YOUR HEALTH MATRIX PROFILE* 📊\n\n` +
                               `• *BMI:* ${bmi}\n` +
                               `• *Ideal Body Weight:* ${idealWeight} kg\n` +
                               `• *Estimated BMR:* ${bmr} kcal/day\n` +
                               `• *Visceral Fat Rating:* ${visceralFat} (Normal: 1-9)\n` +
                               `• *Total Body Water:* ${userSessions[fromNumber].waterPercentage}%\n\n` +
                               `To know more about your health indicators and systematically fix imbalances, please secure an online expert appointment.\n\n` +
                               `👇 *Choose your preferred date below:*`;

            await sendListMessage(fromNumber, reportText, "Select Date Slot", [
                { id: "date_today", title: "Today", description: "Book for today" },
                { id: "date_tomorrow", title: "Tomorrow", description: "Book for tomorrow" },
                { id: "date_dayafter", title: "Day After Tomorrow", description: "Book for day after tomorrow" }
            ]);
        } 
        else if (userSessions[fromNumber].step === 'PICK_DATE') {
            userSessions[fromNumber].selectedDate = userMessage;
            userSessions[fromNumber].step = 'PICK_TIME';

            await sendListMessage(fromNumber, "Great! Now choose a preferred time slot window:", "Select Time Slot", [
                { id: "time_morning", title: "Morning Window", description: "10:00 AM - 1:00 PM" },
                { id: "time_afternoon", title: "Afternoon Window", description: "1:00 PM - 4:00 PM" },
                { id: "time_evening", title: "Evening Window", description: "4:00 PM - 7:00 PM" }
            ]);
        } 
        else if (userSessions[fromNumber].step === 'PICK_TIME') {
            const finalTime = userMessage;
            const data = userSessions[fromNumber];

            const successText = `✅ *Appointment Form Confirmed!*\n\n` +
                                `Your virtual consultation slot is locked for *${data.selectedDate}* during the *${finalTime}*.\n\n` +
                                `Our team has processed your structural enquiry. Keep your phone near you; an expert will link with you shortly!`;

            await sendTextMessage(fromNumber, successText);

            console.log("\n==================================================");
            console.log("📥 NEW HEALTH ENQUIRY RECEIVED SUCCESSFULLY:");
            console.log(`• Name: ${data.name}\n• Phone: +${fromNumber}\n• Gender: ${data.gender}\n• Age: ${data.age}`);
            console.log(`• BMI: ${data.bmi}\n• Ideal Weight: ${data.idealWeight} kg\n• BMR: ${data.bmr} kcal\n• Visceral Fat: ${data.visceralFat}\n• Water: ${data.waterPercentage}%`);
            console.log(`• APPOINTMENT TIME: ${data.selectedDate} (${finalTime})`);
            console.log("==================================================\n");

            delete userSessions[fromNumber];
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("Webhook processing failure:", err.response?.data || err.message);
        res.sendStatus(500);
    }
});

async function sendTextMessage(to, text) {
    await axios.post(`https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`, {
        messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body: text }
    }, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
}

async function sendButtonMessage(to, text, buttonsArray) {
    const buttons = buttonsArray.map((b, i) => ({ type: "reply", reply: { id: `b_${i}`, title: b } }));
    await axios.post(`https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`, {
        messaging_product: "whatsapp", recipient_type: "individual", to, type: "interactive",
        interactive: { type: "button", body: { text }, action: { buttons } }
    }, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
}

async function sendListMessage(to, bodyText, buttonText, items) {
    const rows = items.map(item => ({ id: item.id, title: item.title, description: item.description }));
    await axios.post(`https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`, {
        messaging_product: "whatsapp", recipient_type: "individual", to, type: "interactive",
        interactive: {
            type: "list", body: { text: bodyText },
            action: { button: buttonText, sections: [{ rows }] }
        }
    }, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Pure Code Interactive Bot online on port ${PORT}`));
