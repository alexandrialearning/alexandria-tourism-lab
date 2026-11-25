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

  const candidateModels = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3-flash-preview', 'gemini-flash-latest'];
  let lastError = null;

  const payload = {
    contents,
    generationConfig: generationConfig || { temperature: 0.8, maxOutputTokens: 3000 }
  };
  if (systemInstruction) {
    payload.system_instruction = systemInstruction;
  }

  for (const model of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    try {
      logger.info(`Calling Gemini model: ${model}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const respData = await response.json();

      if (!response.ok) {
        logger.warn(`Gemini model ${model} error (${response.status}):`, respData);
        lastError = respData.error?.message || `HTTP ${response.status}`;
        continue; // Try next fallback model
      }

      if (respData.candidates && respData.candidates[0]?.content?.parts?.[0]?.text) {
        const aiText = respData.candidates[0].content.parts[0].text;
        logger.info(`Successfully generated content using model: ${model}`);
        return { text: aiText };
      } else {
        logger.warn(`Gemini model ${model} returned unexpected structure:`, respData);
        lastError = 'Unexpected response structure from Gemini';
      }
    } catch (err) {
      logger.warn(`Exception calling Gemini model ${model}:`, err.message);
      lastError = err.message;
    }
  }

  logger.error("All Gemini candidate models failed. Last error:", lastError);
  throw new functions.https.HttpsError('internal', `Unable to generate response from AI: ${lastError}`);
});
