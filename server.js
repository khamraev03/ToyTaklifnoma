require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

app.use(express.json());

// HTML va images papkasini ochish
app.use(express.static(__dirname));

app.get("/api/messages", (req, res) => {
    try {
        const messagesFile = path.join(__dirname, "messages.json");

        if (!fs.existsSync(messagesFile)) {
            return res.json([]);
        }

        const fileData = fs.readFileSync(messagesFile, "utf8");
        const messages = JSON.parse(fileData);

        res.json(messages);
    } catch (error) {
        console.error("Messages xatosi:", error);

        res.status(500).json({
            message: "Xabarlarni olishda xatolik."
        });
    }
});
// RSVP qabul qilish

app.post("/api/rsvp", async (req, res) => {
    console.log("🔥 RSVP KELDI");
    console.log("RSVP request keldi:", req.body);

    try {
        const { guestName, attendance, guestMessage } = req.body;

        if (!guestName || !attendance) {
            return res.status(400).json({
                message: "Ism va qatnashish holati majburiy."
            });
        }

        const attendanceText = {
            alone: "Ha, albatta boraman!",
            with_guest: "Ha, mehmon bilan boraman",
            no: "Afsus, kela olmayman",
            maybe: "Hali aniq emas"
        };

const messageId = "TEST-ID-" + Date.now().toString();

console.log("1. MESSAGE ID YARATILDI:", messageId);
        //const messageId = Date.now().toString();

const newMessage = {
    id: messageId,
    name: guestName,
    message: guestMessage || "",
    date: new Date().toISOString()
};

const messagesFile = path.join(__dirname, "messages.json");

let messages = [];

if (fs.existsSync(messagesFile)) {
    const fileData = fs.readFileSync(messagesFile, "utf8");
    messages = JSON.parse(fileData);
}

messages.push(newMessage);

fs.writeFileSync(
    messagesFile,
    JSON.stringify(messages, null, 2),
    "utf8"
);
console.log("Yangi message ID:", messageId);
        const text = `
💍 HUSNIDDIN & MUSHARRAF
Yangi RSVP javobi

👤 Mehmon:
${guestName}

💌 Qatnashish:
${attendanceText[attendance] || attendance}

📝 Xabar:
${guestMessage || "Xabar yozilmagan"}
🆔 ID:
${messageId}
        `.trim();

        const telegramResponse = await fetch(
            `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    chat_id: process.env.CHAT_ID,
                    text: text
                })
            }
        );

        const telegramData = await telegramResponse.json();

        if (!telegramResponse.ok || !telegramData.ok) {
            console.error("Telegram xatosi:", telegramData);

            return res.status(500).json({
                message: "Telegramga yuborishda xatolik."
            });
        }

        res.json({
            success: true,
            message: "Javob yuborildi."
        });

    } catch (error) {
        console.error("Server xatosi:", error);

        res.status(500).json({
            message: "Serverda xatolik yuz berdi."
        });
    }
});
// Telegramdan /delete komandani qabul qilish
let telegramOffset = 0;

async function pollTelegram() {
    try {
        const response = await fetch(
            `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getUpdates?offset=${telegramOffset + 1}&timeout=25`
        );

        const data = await response.json();

        if (!data.ok) {
            console.error("Telegram polling xatosi:", data);
            return;
        }

        for (const update of data.result) {
            telegramOffset = update.update_id;

            const message = update.message;

            if (!message || !message.text) {
                continue;
            }

           if (message.text.trim() !== "/delete") {
    continue;
}

if (String(message.chat.id) !== String(process.env.CHAT_ID)) {
    continue;
}

const repliedMessage = message.reply_to_message;

if (!repliedMessage) {
    console.log("/delete uchun Telegram xabariga Reply qilish kerak.");
    continue;
}

const repliedText = repliedMessage.text || "";

const idMatch = repliedText.match(/🆔 ID:\s*(\S+)/);

if (!idMatch) {
    console.log("Bu Telegram xabarida ID topilmadi.");
    continue;
}

const messageId = idMatch[1];

console.log("O‘chiriladigan message ID:", messageId);
        }

    } catch (error) {
        console.error("Telegram polling xatosi:", error);
    }

    setTimeout(pollTelegram, 1000);
}

pollTelegram();
// Serverni ishga tushirish
app.listen(PORT, () => {
    console.log(`Wedding invitation server: http://localhost:${PORT}`);
});
