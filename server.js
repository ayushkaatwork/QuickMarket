console.log("Starting QuickMarket server...");
console.log("Loading environment variables...");
const dotenvResult = require("dotenv").config();
if (dotenvResult.error) {
    console.error("Error loading .env file:", dotenvResult.error);
} else {
    console.log(".env file loaded successfully.");
}

console.log("Checking WhatsApp configuration...");
if (process.env.WHATSAPP_ACCESS_TOKEN) {
    console.log(`- WHATSAPP_ACCESS_TOKEN is configured (length: ${process.env.WHATSAPP_ACCESS_TOKEN.length})`);
} else {
    console.warn("- WHATSAPP_ACCESS_TOKEN is NOT configured!");
}
if (process.env.WHATSAPP_PHONE_NUMBER_ID) {
    console.log(`- WHATSAPP_PHONE_NUMBER_ID is configured: ${process.env.WHATSAPP_PHONE_NUMBER_ID}`);
} else {
    console.warn("- WHATSAPP_PHONE_NUMBER_ID is NOT configured!");
}

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Temporary OTP storage
const otpStore = {};

// SEND OTP
app.post("/send-otp", async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                error: "Phone number required",
            });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        // Save OTP temporarily (5 mins)
        otpStore[phone] = {
            otp,
            expires: Date.now() + 5 * 60 * 1000,
        };

        console.log(`[OTP Generated] For ${phone}: ${otp}`);

        let isFallback = false;
        let apiError = null;

        // Check if WhatsApp credentials are configured
        if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
            const warning = "WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not configured in .env.";
            console.warn(warning);
            console.warn(`[DEV FALLBACK] OTP for ${phone}: ${otp}`);
            isFallback = true;
            apiError = { message: warning };
        } else {
            const currentDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
            const url = `https://graph.facebook.com/v25.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
            const payload = {
                messaging_product: "whatsapp",
                to: phone,
                type: "template",
                template: {
                    name: "jaspers_market_order_confirmation_v1",
                    language: {
                        code: "en_US"
                    },
                    components: [
                        {
                            type: "body",
                            parameters: [
                                {
                                    type: "text",
                                    text: "QuickMarket User"
                                },
                                {
                                    type: "text",
                                    text: otp
                                },
                                {
                                    type: "text",
                                    text: currentDate
                                }
                            ]
                        }
                    ]
                }
            };
            const headers = {
                Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            };

            console.log("\n--- Outgoing WhatsApp Request ---");
            console.log(`URL: ${url}`);
            console.log("Headers: { Authorization: 'Bearer [REDACTED]' }");
            console.log("Payload:", JSON.stringify(payload, null, 2));
            console.log("---------------------------------\n");

            // Send WhatsApp message
            try {
                const waResponse = await axios.post(url, payload, { headers });
                console.log("\n--- Meta API Success Response ---");
                console.log(JSON.stringify(waResponse.data, null, 2));
                console.log("---------------------------------\n");
            } catch (waError) {
                isFallback = true;
                console.error("\n--- Meta API Error Response ---");
                if (waError.response && waError.response.data) {
                    apiError = waError.response.data;
                    console.error(JSON.stringify(waError.response.data, null, 2));
                } else {
                    apiError = { message: waError.message };
                    console.error(waError.message);
                }
                console.error("---------------------------------\n");
                console.warn(`[DEV FALLBACK] OTP for ${phone}: ${otp}`);
            }
        }

        if (isFallback) {
            console.error(`WhatsApp delivery failed for ${phone}. dev fallback active.`);
            return res.status(500).json({
                success: false,
                error: "WhatsApp delivery failed.",
                metaError: apiError,
                isFallback: true
            });
        }

        res.json({
            success: true,
            message: "OTP sent successfully via WhatsApp"
        });
    } catch (error) {
        console.error("Failed to generate OTP:", error.message);
        res.status(500).json({
            success: false,
            error: "Failed to generate OTP",
        });
    }
});

// VERIFY OTP
app.post("/verify-otp", async (req, res) => {
    const { phone, otp, redirectTo } = req.body;

    const savedOtp = otpStore[phone];

    if (!savedOtp) {
        return res.json({
            success: false,
            message: "No OTP found",
        });
    }

    if (Date.now() > savedOtp.expires) {
        return res.json({
            success: false,
            message: "OTP expired",
        });
    }

    if (savedOtp.otp !== otp) {
        return res.json({
            success: false,
            message: "Wrong OTP",
        });
    }

    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        // Clean phone number and prefix with '+' for the database lookup
        const cleanPhone = phone.replace(/^\+/, '');
        const dbPhone = `+${cleanPhone}`;

        // Query customer details by mobile number
        const customerRes = await axios.get(
            `${supabaseUrl}/rest/v1/customers`,
            {
                params: {
                    mobile_number: `eq.${dbPhone}`,
                },
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
                },
            }
        );

        if (!customerRes.data || customerRes.data.length === 0) {
            return res.json({
                success: false,
                message: "Mobile number not registered. Please sign up first.",
            });
        }

        const email = customerRes.data[0].email;

        // Generate magic link session using Supabase admin API
        const linkRes = await axios.post(
            `${supabaseUrl}/auth/v1/admin/generate_link`,
            {
                type: "magiclink",
                email: email,
                options: {
                    redirectTo: redirectTo || `${supabaseUrl}/dashboard.html`,
                },
            },
            {
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
                    "Content-Type": "application/json",
                },
            }
        );

        delete otpStore[phone];

        res.json({
            success: true,
            message: "Login successful",
            action_link: linkRes.data.action_link || linkRes.data.properties?.action_link,
            hashed_token: linkRes.data.hashed_token || linkRes.data.properties?.hashed_token,
        });
    } catch (error) {
        console.error("Supabase magic link generation error:", error.response?.data || error.message);
        res.json({
            success: false,
            message: "Failed to generate login session",
        });
    }
});

// Start server
console.log("Attempting to start server on port 5000...");
const PORT = 5000;
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:5000`);
}).on("error", (err) => {
    console.error(`Failed to start server on port ${PORT}:`, err.message);
    if (err.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use by another process.`);
    }
    process.exit(1);
});