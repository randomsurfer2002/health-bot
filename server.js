const express = require('express');
const twilio = require('twilio');
const app = express();

// Twilio sends data as URL-encoded form data
app.use(express.urlencoded({ extended: false }));

// Fully authenticated Twilio Credentials
const accountSid = 'ACdafddd714cbe27cbbdf75887ef0432ca';
const authToken = '739925363453cb8d979beaf5c33c8e7b';
const client = twilio(accountSid, authToken);

const userSessions = {};

// Main Webhook for Twilio Traffic
app.post('/webhook', async (req, res) => {
    try {
        const fromNumber = req.body.From; // Unique WhatsApp string like "whatsapp:+91XXXXX"
        const userMessage = req.body.Body ? req.body.Body.trim() : "";
        
        let replyMessage = "";

        // --- STATE MACHINE ROUTER LOGIC ---
        if (!userSessions[fromNumber]) {
            userSessions[fromNumber] = { step: 'ASK_NAME' };
            replyMessage = "Namaste! Welcome to your Free Digital Health Assessment. 📋\n\nLet's calculate your full profile. What is your full name?";
        } 
        else if (userSessions[fromNumber].step === 'ASK_NAME') {
            userSessions[fromNumber].name = userMessage;
            userSessions[fromNumber].step = 'ASK_GENDER';
            replyMessage = `Great to meet you, ${userMessage}! Please specify your gender (Reply with *Male* or *Female*):`;
        } 
        else if (userSessions[fromNumber].step === 'ASK_GENDER') {
            userSessions[fromNumber].gender = userMessage;
            userSessions[fromNumber].step = 'ASK_AGE';
            replyMessage = "How old are you? (Enter age in numbers)";
        } 
        else if (userSessions[fromNumber].step === 'ASK_AGE') {
            userSessions[fromNumber].age = parseInt(userMessage) || 25;
            userSessions[fromNumber].step = 'ASK_HEIGHT';
            replyMessage = "What is your current height in centimeters? (e.g., 175)";
        } 
        else if (userSessions[fromNumber].step === 'ASK_HEIGHT') {
            userSessions[fromNumber].height = parseFloat(userMessage) || 170;
            userSessions[fromNumber].step = 'ASK_WEIGHT';
            replyMessage = "What is your current weight in kilograms? (e.g., 70)";
        } 
        else if (userSessions[fromNumber].step === 'ASK_WEIGHT') {
            const weight = parseFloat(userMessage) || 70;
            const height = userSessions[fromNumber].height;
            const age = userSessions[fromNumber].age;
            const isMale = userSessions[fromNumber].gender.toLowerCase() === 'male';

            // Advanced Calculations
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

            replyMessage = `📊 *YOUR HEALTH MATRIX PROFILE* 📊\n\n` +
                           `• *BMI:* ${bmi}\n` +
                           `• *Ideal Body Weight:* ${idealWeight} kg\n` +
                           `• *Estimated BMR:* ${bmr} kcal/day\n` +
                           `• *Visceral Fat Rating:* ${visceralFat} (Normal: 1-9)\n` +
                           `• *Total Body Water:* ${userSessions[fromNumber].waterPercentage}%\n\n` +
                           `To know more about your health indicators and systematically fix imbalances, please secure an online expert appointment.\n\n` +
                           `👇 *Type your preferred date to book appointment (e.g., Today, Tomorrow, Monday):*`;
        } 
        else if (userSessions[fromNumber].step === 'PICK_DATE') {
            userSessions[fromNumber].selectedDate = userMessage;
            userSessions[fromNumber].step = 'PICK_TIME';
            replyMessage = "Great! Now type your preferred time slot window (e.g., 11:00 AM, Morning, Evening):";
        } 
       else if (userSessions[fromNumber].step === 'PICK_TIME') {
            const finalTime = userMessage;
            const data = userSessions[fromNumber];

            replyMessage = `✅ *Appointment Form Confirmed!*\n\n` +
                           `Your virtual consultation slot is locked for *${data.selectedDate}* during the *${finalTime}*.\n\n` +
                           `Our team has processed your structural enquiry. Keep your phone near you; an expert will link with you shortly!`;

            // 📱 ALERT YOU IMMEDIATELY VIA WHATSAPP
            try {
                await client.messages.create({
                    from: 'whatsapp:+14155238886', // Your Twilio number
                    to: 'whatsapp:+919368891933',   // 👈 REPLACE THIS WITH YOUR REAL PERSONAL WHATSAPP NUMBER
                    body: `🚨 *NEW APPOINTMENT BOOKED!*\n\n` +
                          `• *Name:* ${data.name}\n` +
                          `• *Phone:* ${fromNumber.replace('whatsapp:', '')}\n` +
                          `• *Age/Gender:* ${data.age} / ${data.gender}\n` +
                          `• *BMI/BMR:* ${data.bmi} / ${data.bmr} kcal\n` +
                          `• *Scheduled for:* ${data.selectedDate} @ ${finalTime}`
                });
                console.log("Success: Admin notification text forwarded.");
            } catch (smsErr) {
                console.error("Admin notification failure:", smsErr.message);
            }

            // Terminal Data Readout
            console.log("\n==================================================");
            console.log("📥 NEW HEALTH ENQUIRY RECEIVED SUCCESSFULLY:");
            console.log(`• Name: ${data.name}\n• Phone: ${fromNumber}\n• Gender: ${data.gender}\n• Age: ${data.age}`);
            console.log(`• BMI: ${data.bmi}\n• Ideal Weight: ${data.idealWeight} kg\n• BMR: ${data.bmr} kcal\n• Visceral Fat: ${data.visceralFat}\n• Water: ${data.waterPercentage}%`);
            console.log(`• APPOINTMENT TIME: ${data.selectedDate} (${finalTime})`);
            console.log("==================================================\n");

            delete userSessions[fromNumber];
        }
