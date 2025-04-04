require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors({
    origin: ['http://localhost:8000', 'http://127.0.0.1:8000'],
    credentials: true
}));
app.use(express.json());

app.post('/api/process-image', upload.single('image'), async (req, res) => {
    let tempFilePath = null;

    try {
        // Added model field with fallback default value
        const {
            prompt,
            temperature = 0.1,
            model = "google/gemini-2.0-flash-lite-001",
            max_tokens = 2048,
            top_p = 0.95
        } = req.body;

        if (!req.file) throw new Error('No image file provided');

        tempFilePath = req.file.path;
        const imageBuffer = fs.readFileSync(tempFilePath);
        const imageBase64 = imageBuffer.toString('base64');

        const temperatureValue = Math.min(Math.max(parseFloat(temperature) || 0.1, 0), 1);
        const top_pValue = Math.min(Math.max(parseFloat(top_p) || 0.95, 0), 1);

        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model,  // Use the dynamic model field
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${req.file.mimetype};base64,${imageBase64}` // Or a URL if API expects it
                                }
                            }
                        ]
                    }
                ],
                temperature: temperatureValue,
                max_tokens: parseInt(max_tokens) || 2048,
                top_p: top_pValue
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:8000',
                    'X-Title': 'Bulk Image Processor'
                }
            }
        );

        // console.log('Full AI Response:', response.data); // Log entire response for debugging

        const rawContent = response.data.choices[0]?.message?.content || '{}';
        // console.log('Raw AI Response:', rawContent); // Log raw response for debugging

        const sanitizedContent = rawContent.replace(/```(?:\w+)?\n([\s\S]*?)```/g, '$1').trim();

        let parsedContent;

        try {
            parsedContent = JSON.parse(sanitizedContent);
        } catch (e) {
            console.error('Could not parse JSON from AI. Sending sanitized content instead.');
            parsedContent = { error: 'Invalid JSON format', rawContent: sanitizedContent };
        }

        res.json({
            success: true,
            result: parsedContent
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: error.response?.data?.error?.message || error.message
        });
    } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath); // Clean up temporary file
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
