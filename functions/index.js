const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

exports.callGeminiAPI = onCall({ cors: true, maxInstances: 10 }, async (request) => {
  const { systemInstruction, contents, generationConfig } = request.data;
  
  if (!contents || !Array.isArray(contents)) {
    throw new HttpsError('invalid-argument', 'The function must be called with a valid "contents" array.');
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new HttpsError('failed-precondition', 'The GEMINI_API_KEY environment variable is missing.');
  }
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  
  try {
    const payload = {
      contents,
      generationConfig: generationConfig || { temperature: 0.8, maxOutputTokens: 250 }
    };
    if (systemInstruction) {
      payload.system_instruction = systemInstruction;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error("Gemini API Error:", data);
      throw new HttpsError('internal', data.error?.message || 'Error from Gemini API');
    }

    const aiText = data.candidates[0].content.parts[0].text;
    return { text: aiText };

  } catch (error) {
    logger.error("Error calling Gemini API", error);
    throw new HttpsError('internal', 'Unable to generate response from AI.');
  }
});
