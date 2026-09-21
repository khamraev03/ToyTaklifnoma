require("dotenv").config();

const express = require("express");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// POSTGRESQL
// =========================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// =========================
// DATABASE INIT
// =========================

async function initDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                message TEXT,
                date TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        console.log("✅ PostgreSQL: messages jadvali tayyor");

    } catch (error) {
        console.error("❌ PostgreSQL ulanish xatosi:", error);
        throw error;
    }
}

// =========================
// EXPRESS
// =========================

app.use(express.json());

// HTML, CSS, JS, images
app.use(express.static(__dirname));

// =========================
// GET MESSAGES
// =========================

app.get("/api/messages", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, message, date
            FROM messages
            ORDER BY date ASC
        `);

        res.json(result.rows);

    } catch (error) {
        console.error("❌ Messages xatosi:", error);

        res.status(500).json({
            message: "Xabarlarni olishda xatolik."
        });
    }
});

// =========================
// RSVP
// =========================

app.post("/api/rsvp", async (req, res) => {

    console.log("🔥 RSVP KELDI");
    console.log("RSVP request:", req.body);

    try {

        const {
            guestName,
            attendance,
            guestMessage
        } = req.body;

        // Majburiy maydonlar
        if (!guestName || !attendance) {
            return res.status(400).json({
                message: "Ism va qatnashish holati majburiy."
            });
        }

        // Qatnashish variantlari
        const attendanceText = {
            alone: "Ha, albatta boraman!",
            with_guest: "Ha, mehmon bilan boraman",
            no: "Afsus, kela olmayman",
            maybe: "Hali aniq emas"
        };

        // Message ID
        const messageId = "TEST-ID-" + Date.now().toString();

        console.log(
            "🆔 MESSAGE ID:",
            messageId
        );

        // =========================
        // POSTGRESQLGA SAQLASH
        // =========================

        await pool.query(
            `
            INSERT INTO messages (
                id,
                name,
                message,
                date
            )
            VALUES ($1, $2, $3, $4)
            `,
            [
                messageId,
                guestName,
                guestMessage || "",
                new Date()
            ]
        );

        console.log(
            "✅ PostgreSQL'ga saqlandi:",
            messageId
        );

        // =========================
        // TELEGRAM MESSAGE
        // =========================

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

        const telegramData =
            await telegramResponse.json();

        // Telegram xatosi
        if (
            !telegramResponse.ok ||
            !telegramData.ok
        ) {

            console.error(
                "❌ Telegram xatosi:",
                telegramData
            );

            return res.status(500).json({
                message:
                    "Telegramga yuborishda xatolik."
            });
        }

        console.log(
            "✅ Telegramga yuborildi:",
            messageId
        );

        // =========================
        // SUCCESS
        // =========================

        res.json({
            success: true,
            message: "Javob yuborildi.",
            id: messageId
        });

    } catch (error) {

        console.error(
            "❌ Serverda xatolik:",
            error
        );

        res.status(500).json({
            message:
                "Serverda xatolik yuz berdi."
        });
    }
});

// =========================
// TELEGRAM WEBHOOK DELETE
// =========================

app.post("/telegram/webhook", async (req, res) => {

    try {

        const update = req.body;

        console.log(
            "📩 Telegram webhook update keldi"
        );

        const message = update.message;

        // Message yoki text bo'lmasa
        if (
            !message ||
            !message.text
        ) {
            return res.sendStatus(200);
        }

        // Faqat /delete
        if (
            message.text.trim() !== "/delete"
        ) {
            return res.sendStatus(200);
        }

        // Faqat bizning CHAT_ID
        if (
            String(message.chat.id) !==
            String(process.env.CHAT_ID)
        ) {
            console.log(
                "⚠️ Noto'g'ri Telegram CHAT_ID"
            );

            return res.sendStatus(200);
        }

        // /delete reply bo'lishi kerak
        const repliedMessage =
            message.reply_to_message;

        if (!repliedMessage) {

            console.log(
                "⚠️ /delete uchun Telegram xabariga Reply qilish kerak."
            );

            return res.sendStatus(200);
        }

        // Reply qilingan Telegram xabari
        const repliedText =
            repliedMessage.text || "";

        // ID ni topish
        const idMatch =
            repliedText.match(
                /🆔 ID:\s*(\S+)/
            );

        if (!idMatch) {

            console.log(
                "⚠️ Bu Telegram xabarida ID topilmadi."
            );

            return res.sendStatus(200);
        }

        const messageId =
            idMatch[1];

        console.log(
            "🗑️ O‘chiriladigan message ID:",
            messageId
        );

        // =========================
        // DATABASE TEKSHIRISH
        // =========================

        const checkResult =
            await pool.query(
                `
                SELECT id, name, message
                FROM messages
                WHERE id = $1
                `,
                [messageId]
            );

        console.log(
            "🔎 DATABASE'DAN TOPILDI:",
            checkResult.rows
        );

        // =========================
        // DELETE
        // =========================

        const deleteResult =
            await pool.query(
                `
                DELETE FROM messages
                WHERE id = $1
                RETURNING id
                `,
                [messageId]
            );

        // =========================
        // RESULT
        // =========================

        if (
            deleteResult.rowCount > 0
        ) {

            console.log(
                "✅ Message PostgreSQL'dan o‘chirildi:",
                messageId
            );

        } else {

            console.log(
                "⚠️ Bunday message ID PostgreSQL'da topilmadi:",
                messageId
            );
        }

        return res.sendStatus(200);

    } catch (error) {

        console.error(
            "❌ Telegram webhook xatosi:",
            error
        );

        return res.sendStatus(500);
    }
});

// =========================
// START SERVER
// =========================

async function startServer() {

    try {

        // Avval DB
        await initDatabase();

        // =========================
        // WEB SERVER
        // =========================

        app.listen(
            PORT,
            async () => {

                console.log(
                    `Wedding invitation server: http://localhost:${PORT}`
                );

                // =========================
                // TELEGRAM WEBHOOK
                // =========================

                const webhookUrl =
                    "https://toytaklifnoma.onrender.com/telegram/webhook";

                try {

                    const response = await fetch(
                        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/setWebhook`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type": "application/json"
                            },

                            body: JSON.stringify({
                                url: webhookUrl,
                                drop_pending_updates: true
                            })
                        }
                    );

                    const data =
                        await response.json();

                    console.log(
                        "🤖 Telegram webhook:",
                        data
                    );

                } catch (error) {

                    console.error(
                        "❌ Telegram webhook sozlash xatosi:",
                        error
                    );
                }
            }
        );

    } catch (error) {

        console.error(
            "❌ Server ishga tushmadi:",
            error
        );

        process.exit(1);
    }
}

startServer();