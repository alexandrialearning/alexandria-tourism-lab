const functions = require('firebase-functions/v1');
const logger = require('firebase-functions/logger');

exports.callGeminiAPIV1 = functions.runWith({ secrets: ["GEMINI_API_KEY"] }).https.onCall(async (data, context) => {
  const { systemInstruction, contents, generationConfig } = data;
  
  if (!contents || !Array.isArray(contents)) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a valid "contents" array.');
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new functions.https.HttpsError('failed-precondition', 'The GEMINI_API_KEY environment variable is missing.');
  }
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  
  try {
    const payload = {
      contents,
      generationConfig: generationConfig || { temperature: 0.8, maxOutputTokens: 3000 }
    };
    if (systemInstruction) {
      payload.system_instruction = systemInstruction;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const respData = await response.json();

    if (!response.ok) {
      logger.error("Gemini API Error:", respData);
      throw new functions.https.HttpsError('internal', respData.error?.message || 'Error from Gemini API');
    }

    const aiText = respData.candidates[0].content.parts[0].text;
    return { text: aiText };

  } catch (error) {
    logger.error("Error calling Gemini API", error);
    throw new functions.https.HttpsError('internal', 'Unable to generate response from AI.');
  }
});
