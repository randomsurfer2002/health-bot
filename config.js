// ==========================================================
// EDIT EVERYTHING IN THIS FILE TO CUSTOMIZE YOUR BOT
// ==========================================================

module.exports = {
  // Must match your WhatsApp group's name EXACTLY (case-sensitive)
  groupName: "Family Health Group",

  // ---------------- MEAL REMINDERS ----------------
  // Cron format: "minute hour * * *"  (24-hour clock)
  meals: {
    breakfast: {
      cron: "0 8 * * *", // 8:00 AM every day
      message: "🍳 Good morning! Time for *breakfast*. Eat a healthy meal to start your day right! 🌞",
      image: "./images/breakfast.jpg"
    },
    lunch: {
      cron: "0 13 * * *", // 1:00 PM every day
      message: "🍛 It's *lunch time*! Don't skip your meal, fuel up for the rest of the day. 💪",
      image: "./images/lunch.jpg"
    },
    dinner: {
      cron: "0 20 * * *", // 8:00 PM every day
      message: "🍽️ *Dinner time*! Enjoy a light, healthy dinner and wind down for the day. 🌙",
      image: "./images/dinner.jpg"
    }
  },

  // ---------------- HOURLY WATER / SHAKE REMINDERS ----------------
  hourly: {
    cron: "0 * * * *",     // runs every hour, on the hour
    activeStartHour: 7,    // don't send before 7 AM
    activeEndHour: 22,     // don't send after 10 PM
    // The bot alternates through this list each hour so it doesn't
    // repeat the exact same message every single time.
    messages: [
      "💧 *Water Reminder*: Drink a glass of water now! Stay hydrated. 🚰",
      "🥤 *Shake Reminder*: Time for your Afresh / Herbalife shake! 🌿",
      "💧 *Water Reminder*: Another glass of water — keep sipping through the day! 🚰",
      "🥤 *Shake Reminder*: Don't forget your Herbalife / Afresh shake! 🌿"
    ]
  }
};
