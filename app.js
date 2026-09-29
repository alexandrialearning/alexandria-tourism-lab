const firebaseConfig = {
  apiKey: "AIzaSyAyhBWleVkUBM8C4LkMAmqt1e1glUEkfMc",
  authDomain: "anahuac-tourism.firebaseapp.com",
  projectId: "anahuac-tourism",
  storageBucket: "anahuac-tourism.firebasestorage.app",
  messagingSenderId: "675954232934",
  appId: "1:675954232934:web:3c5269b303cacf720267a7",
  measurementId: "G-QMWWW53JJQ"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.functions();

const state = {
  currentScenario: 'mentor',
  currentAudio: null,
  isSpeaking: false,
  isRecording: false,
  sidebarOpen: true,
  callDurationSeconds: 0,
  timerInterval: null,
  currentProject: null,
  customVoiceId: 'sDh3eviBhiuHKi0MjTNq',
  ttsApiKey: 'sk_4197546279e7106e0b4d72bfa7f870dd1316bd4e71fbd682',
  conversationHistory: [],
  sessionId: null,
  userMessageCount: 0
};

let recognition = null;

const elements = {
  videoBg: document.getElementById('videoBg'),
  callTimer: document.getElementById('callTimer'),
  pillLabel: document.getElementById('pillLabel'),
  participantName: document.getElementById('participantName'),
  roleLabel: document.getElementById('roleLabel'),
  videoStage: document.getElementById('videoStage'),
  captionSpeaker: document.getElementById('captionSpeaker'),
  captionText: document.getElementById('captionText'),
  callSidebar: document.getElementById('callSidebar'),
  transcriptTimeline: document.getElementById('transcriptTimeline'),
  userInput: document.getElementById('userInput'),
  btnMic: document.getElementById('btnMic'),
  micIcon: document.getElementById('micIcon'),
  micLabel: document.getElementById('micLabel'),
  pipMicStatus: document.getElementById('pipMicStatus')
};

let pendingOrbState = null;
function updateOrb(state) {
  if (window.setOrbState) {
    window.setOrbState(state);
  } else {
    pendingOrbState = state; // Guardar si el módulo aún no carga
  }
}

// Escuchar cuando el módulo termine de cargar para aplicar el estado pendiente
window.addEventListener('orbReady', () => {
  if (pendingOrbState) updateOrb(pendingOrbState);
});

document.addEventListener('DOMContentLoaded', () => {
  initSpeechRecognition();
  updateOrb('breathing');

  // Revisar si ya aceptó aviso de privacidad previamente
  if (localStorage.getItem('privacyAccepted') === 'true') {
    const privacyContainer = document.getElementById('privacyContainer');
    const privacyCheckbox = document.getElementById('privacyCheckbox');
    if (privacyContainer && privacyCheckbox) {
      privacyContainer.style.display = 'none';
      privacyCheckbox.checked = true;
    }
  }

  // Mantener sesión activa al recargar
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      state.userName = user.displayName || user.email.split('@')[0];
      document.getElementById('userProfileTag').innerText = `👤 ${state.userName}`;
      document.getElementById('startOverlay').style.display = 'none';
      document.getElementById('btnLogout').style.display = 'inline-block';
      startCallTimer();
      elements.participantName.innerText = "Copiloto Anáhuac";
      elements.roleLabel.innerText = "Facultad de Turismo y Gastronomía";
      
      try {
        const pastSessions = await db.collection("user_sessions")
          .where("userId", "==", user.uid)
          .orderBy('updatedAt', 'desc')
          .limit(2)
          .get();
        if (!pastSessions.empty) {
          state.userMemory = "HISTORIAL RECIENTE DEL ALUMNO (Conócelo y personaliza el nivel):\n";
          pastSessions.forEach(doc => {
            const data = doc.data();
            if (data.evaluation) {
              state.userMemory += `- Caso: ${data.scenario}. Feedback previo: ${data.evaluation.substring(0, 100)}...\n`;
            }
          });
        }
      } catch(e) {
        console.error("Memoria de usuario no disponible", e);
      }
    }
  });
});

async function handleLogin() {
  const name = document.getElementById('loginName').value.trim();
  const email = document.getElementById('loginUsername').value;
  const pass = document.getElementById('loginPassword').value;
  const privacyChecked = document.getElementById('privacyCheckbox').checked;
  
  if (!email || !pass) {
    alert("Por favor, ingresa tu correo y contraseña.");
    return;
  }
  
  try {
    const btn = document.getElementById('btnStartSimulation');
    btn.innerText = "Autenticando...";
    btn.disabled = true;

    let userCredential;
    try {
      // 1. Intentar iniciar sesión primero (Usuario recurrente)
      userCredential = await auth.signInWithEmailAndPassword(email, pass);
    } catch (err) {
      // 2. Si el usuario no existe o se equivocó de contraseña
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        // Validar requisitos de registro
        if (!name || !privacyChecked) {
          alert("Credenciales incorrectas o usuario no encontrado. Si eres nuevo, ingresa tu Nombre de Pila y acepta el Aviso de Privacidad para registrarte.");
          btn.innerText = "Iniciar Sesión";
          btn.disabled = false;
          return;
        }
        
        try {
          userCredential = await auth.createUserWithEmailAndPassword(email, pass);
        } catch (createErr) {
          if (createErr.code === 'auth/email-already-in-use') {
            alert("Error: Esta cuenta ya existe. La contraseña es incorrecta.");
            btn.innerText = "Iniciar Sesión";
            btn.disabled = false;
            return;
          } else {
            throw createErr;
          }
        }
      } else {
        throw err;
      }
    }
    
    // Si escribió un nombre y acabamos de crear la cuenta o quiere actualizarlo
    if (userCredential.user && name) {
      await userCredential.user.updateProfile({ displayName: name });
      state.userName = name;
    } else {
      state.userName = userCredential.user.displayName || email.split('@')[0];
    }
    
    document.getElementById('userProfileTag').innerText = `👤 ${state.userName}`;
    localStorage.setItem('privacyAccepted', 'true');
    startSimulation();
    
  } catch (error) {
    alert("Error de autenticación: " + error.message);
    const btn = document.getElementById('btnStartSimulation');
    btn.innerText = "Iniciar Sesión";
    btn.disabled = false;
  }
}

async function startSimulation() {
  document.getElementById('startOverlay').style.display = 'none';
  document.getElementById('btnLogout').style.display = 'inline-block';
  startCallTimer();
  
  elements.participantName.innerText = "Copiloto Anáhuac";
  elements.roleLabel.innerText = "Facultad de Turismo y Gastronomía";
  
  const intro = `¡Hola ${state.userName}! Soy tu tutor de la Facultad de Turismo y Gastronomía de la Universidad Anáhuac. Por favor, selecciona un Generador de Casos en el panel lateral para iniciar tu evaluación.`;
  await speakCaption('Copiloto Anáhuac', intro);
}

function startCallTimer() {
  state.timerInterval = setInterval(() => {
    state.callDurationSeconds++;
    const mins = String(Math.floor(state.callDurationSeconds / 60)).padStart(2, '0');
    const secs = String(state.callDurationSeconds % 60).padStart(2, '0');
    elements.callTimer.innerText = `${mins}:${secs}`;
    
    // Temporizador sin límite de tiempo para que termine por número de preguntas
  }, 1000);
}

// -----------------------------------------------------------------
// Audio Synthesis (ElevenLabs ONLY)
// -----------------------------------------------------------------
async function speakCaption(speaker, text) {
  elements.captionSpeaker.innerText = speaker;
  elements.captionText.innerText = `"${text}"`;
  
  elements.videoStage.classList.add('speaking');
  state.isSpeaking = true;
  updateOrb('composing'); // Orb state for speaking

  let audioBlob = null;
  if (state.ttsApiKey && state.ttsApiKey.trim() !== '') {
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${state.customVoiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': state.ttsApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      });

      if (response.ok) {
        audioBlob = await response.blob();
      } else {
        console.warn('ElevenLabs API error: ' + response.statusText);
      }
    } catch (error) {
      console.warn("ElevenLabs TTS fetch failed", error);
    }
  }

  function onAudioEnd() {
    elements.videoStage.classList.remove('speaking');
    state.isSpeaking = false;
    
    // Terminar caso después de 3 preguntas
    if (state.currentScenario === 'agentic' && state.userMessageCount >= 3) {
      speakCaption('Sistema', 'Se han completado las 3 preguntas de esta evaluación. Generando retroalimentación...');
      setTimeout(() => finishCall(true), 3500);
    } else {
      startListening();
    }
  }

  if (audioBlob) {
    if (state.currentAudio) {
      state.currentAudio.pause();
      state.currentAudio.currentTime = 0;
    }
    
    const audioUrl = URL.createObjectURL(audioBlob);
    state.currentAudio = new Audio(audioUrl);
    
    state.currentAudio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      onAudioEnd();
    };
    
    await state.currentAudio.play();
    return;
  }

  // Fallback nativo
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-MX';
    utterance.rate = 1.0;
    
    utterance.onend = onAudioEnd;
    utterance.onerror = onAudioEnd;
    
    window.speechSynthesis.speak(utterance);
  } else {
    setTimeout(onAudioEnd, Math.min(text.length * 50, 4000));
  }
}

// -----------------------------------------------------------------
// UI Interactions & Logic
// -----------------------------------------------------------------

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  recognition = new SpeechRecognition();
  recognition.lang = 'es-MX';
  recognition.interimResults = false;

  recognition.onstart = () => {
    state.isRecording = true;
    updateOrb('listening'); // Orb state for listening
    
    elements.btnMic.classList.add('active-mic');
    elements.micIcon.innerText = '🎙️';
    elements.micLabel.innerText = 'Escuchando...';
    elements.pipMicStatus.innerText = '🔴 Transmitiendo';
    elements.pipMicStatus.style.color = '#F43F5E';
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    elements.userInput.value = transcript;
    stopMic(); 
    handleUserSubmit(new Event('submit'));
  };

  recognition.onerror = (e) => {
    // Silencio o no-speech: no hacer nada
  };

  recognition.onend = () => {
    state.isRecording = false;
    elements.btnMic.classList.remove('active-mic');
    elements.btnMic.style.background = "var(--bg-card)";
    elements.micIcon.innerText = '🎙️';
    elements.micLabel.innerText = 'Toca para Hablar';
    elements.pipMicStatus.innerText = '🎙️ En espera';
    elements.pipMicStatus.style.color = '#34D399';
    
    if (!state.isSpeaking && window.setOrbState) {
      window.setOrbState('breathing');
    }
  };
}

function startListening() {
  if (state.currentScenario !== 'agentic') return;
  if (recognition && !state.isRecording && !state.isSpeaking) {
    try { 
      recognition.start();
      elements.btnMic.style.background = "var(--primary-orange)";
      elements.micLabel.innerText = "Toca para Enviar";
    } catch(e){}
  }
}

function stopMic() {
  if (recognition && state.isRecording) {
    recognition.stop();
  }
}

function toggleMic() {
  if (state.currentScenario !== 'agentic') {
    alert("Genera un escenario primero antes de hablar.");
    return;
  }
  if (state.currentRecording || state.isRecording) {
    stopMic();
  } else {
    startListening();
  }
}


function handleUserSubmit(e) {
  e.preventDefault();
  const text = elements.userInput.value.trim();
  if (!text) return;

  addTranscriptMsg('Tú', text);
  state.userMessageCount++;
  elements.userInput.value = '';
  
  updateOrb('working'); // Orb state for thinking

  setTimeout(() => {
    generateResponse(text);
  }, 50);
}

function sendPrompt(promptText) {
  if (!state.sidebarOpen) toggleSidebar();
  elements.userInput.value = promptText;
  handleUserSubmit(new Event('submit'));
}

function addTranscriptMsg(sender, text) {
  state.conversationHistory.push({
    role: sender === 'Tú' ? 'user' : 'model',
    parts: [{ text: text }]
  });

  // Guardado permanente de la sesión vinculado al usuario
  if (state.sessionId && window.db) {
    const user = firebase.auth().currentUser;
    if (user) {
      db.collection("user_sessions").doc(state.sessionId).set({
        userId: user.uid,
        scenario: elements.pillLabel ? elements.pillLabel.innerText : 'Desconocido',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        history: state.conversationHistory
      }, { merge: true }).catch(err => console.error("Error guardando sesión:", err));
    }
  }

  const msgDiv = document.createElement('div');
  msgDiv.className = `transcript-msg ${sender === 'Tú' ? 'user' : 'alex'}`;
  
  const headerDiv = document.createElement('div');
  headerDiv.className = 'msg-header';
  const senderSpan = document.createElement('span');
  senderSpan.className = 'msg-sender';
  senderSpan.innerText = sender;
  const timeSpan = document.createElement('span');
  timeSpan.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  headerDiv.appendChild(senderSpan);
  headerDiv.appendChild(timeSpan);
  
  const textDiv = document.createElement('div');
  textDiv.className = 'msg-text';
  textDiv.innerText = text;
  
  msgDiv.appendChild(headerDiv);
  msgDiv.appendChild(textDiv);
  elements.transcriptTimeline.appendChild(msgDiv);
  elements.transcriptTimeline.scrollTop = elements.transcriptTimeline.scrollHeight;
}

async function generateResponse(userText) {
  if (state.currentScenario !== 'agentic') {
    // Si el usuario presiona el micrófono antes de generar escenario, le recordamos
    speakCaption('Sistema', 'Por favor, selecciona un generador de escenarios en el panel lateral primero.');
    return;
  }

  // Flujo Agéntico Inteligente Universal (Gemini para TODO)
  
  let roleContext = "Eres un evaluador estricto. Sigue tu rol asignado previamente, NUNCA rompas el personaje. Responde de forma breve, concisa y oral (máximo 2 párrafos).";
  
  if (state.currentScenario === 'mentor') {
    roleContext = "Eres un Copiloto, un Mentor Socrático experto en turismo. Nunca das la respuesta directa, siempre respondes con preguntas profundas que hagan pensar al estudiante sobre sostenibilidad y rentabilidad.";
  } else if (state.currentScenario === 'overbooking') {
    roleContext = "Eres un huésped furioso en el lobby del hotel. Hiciste tu reserva hace 3 meses y acaba de ocurrir un overbooking. Estás muy enojado, exiges soluciones inmediatas y amenazas con Profeco. Responde breve y cortante.";
  } else if (state.currentScenario === 'community') {
    roleContext = "Eres el líder de una asamblea ejidal indígena. Un empresario quiere construir un proyecto en tu tierra. Eres desconfiado, defiendes la naturaleza y quieres garantías por escrito. Hablas con firmeza.";
  } else if (state.currentScenario === 'investor') {
    roleContext = "Eres un inversionista de Wall Street rudo y analítico. Evalúas un pitch turístico. Cuestionas agresivamente el ROI, la TIR y las proyecciones de ventas. No tienes tiempo que perder.";
  } else {
    // Escenario agéntico generado por PDF o Aleatorio
    roleContext = "Eres la Persona Antagónica asignada en este escenario de evaluación turística. NUNCA rompas tu personaje. Desafía agresivamente los argumentos del estudiante. Responde de forma breve y conversacional (máximo 2 párrafos).";
  }

  const systemInstruction = {
    parts: [{ text: roleContext + "\n\n" + (state.userMemory || "") }]
  };

  try {
    const callGeminiAPI = firebase.functions().httpsCallable('callGeminiAPIV1');
    const result = await callGeminiAPI({
      systemInstruction: systemInstruction,
      contents: state.conversationHistory
    });

    const replyText = result.data.text;
    
    const aiName = elements.participantName.innerText;
    addTranscriptMsg(aiName, replyText);
    speakCaption(aiName, replyText);

  } catch (error) {
    console.error(error);
    addTranscriptMsg('Sistema', 'Error de conexión con la IA. ' + error.message);
    updateOrb('breathing');
  }
}

function toggleSidebar() {
  // Función desactivada: El sidebar ya no se puede ocultar
  state.sidebarOpen = true;
}

function switchSidebarTab(tabName) {
  const tabTranscript = document.getElementById('tabTranscript');
  const tabRag = document.getElementById('tabRag');
  const viewTranscript = document.getElementById('viewTranscript');
  const viewRag = document.getElementById('viewRag');

  if (tabName === 'transcript') {
    tabTranscript.classList.add('active');
    tabRag.classList.remove('active');
    viewTranscript.classList.add('active');
    viewRag.classList.remove('active');
  } else {
    tabRag.classList.add('active');
    tabTranscript.classList.remove('active');
    viewRag.classList.add('active');
    viewTranscript.classList.remove('active');
  }
}

function triggerFileUpload() { document.getElementById('fileInput').click(); }

async function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    state.currentProject = file.name;
    document.getElementById('projectName').innerText = `📄 ${file.name} (Procesando vectores...)`;
    document.getElementById('projectInfo').style.display = 'block';
    
    // Read file as Base64 for fallback
    const reader = new FileReader();
    reader.onload = async (event) => {
      state.currentFileBase64 = event.target.result.split(',')[1];
      
      try {
        // Extraer texto usando pdf.js
        const pdfData = atob(state.currentFileBase64);
        const uint8Array = new Uint8Array(pdfData.length);
        for (let i = 0; i < pdfData.length; i++) {
          uint8Array[i] = pdfData.charCodeAt(i);
        }
        
        const loadingTask = pdfjsLib.getDocument({data: uint8Array});
        const pdf = await loadingTask.promise;
        let fullText = "";
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + " ";
        }
        
        state.extractedPdfText = fullText;
        
        // Guardar documento crudo en Firestore (Simulando la base vectorial para el prototipo)
        await db.collection("documents").add({
          fileName: file.name,
          content: fullText.substring(0, 5000), // Guardamos una muestra para no exceder límites
          uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
          uploadedBy: state.userName || 'unknown'
        });
        
        document.getElementById('projectName').innerText = `📄 ${file.name} (Indexado en Firestore)`;
        // Iniciar el escenario automáticamente
        triggerAgenticGenerator(true);
      } catch (err) {
        console.error("Error procesando PDF o subiendo a Firestore:", err);
        document.getElementById('projectName').innerText = `📄 ${file.name} (Error procesando)`;
      }
    };
    reader.readAsDataURL(file);
  }
}

function askLaw(lawTitle) {
  switchSidebarTab('transcript');
  sendPrompt(`¿Qué establece la regulación sobre "${lawTitle}" para proyectos turísticos?`);
}

async function finishCall(auto = false) {
  if (!auto && !confirm('¿Deseas finalizar la simulación y recibir tu evaluación?')) return;
  
  // Detener la simulación INMEDIATAMENTE para evitar más grabaciones
  
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  if (state.currentAudio) {
    state.currentAudio.pause();
    state.currentAudio.currentTime = 0;
  }
  
  updateOrb('working');

  document.getElementById('feedbackModal').style.display = 'flex';
  document.getElementById('feedbackContent').innerHTML = 'Generando rúbrica de evaluación...<br><br><small>Por favor espera, la IA está analizando la conversación completa.</small>';

  const systemInstruction = {
    parts: [{ 
      text: `Eres un profesor experto en turismo evaluando una simulación.
Lee la transcripción de la conversación.
Genera un reporte final para el alumno "${state.userName}" en formato Markdown con esta estructura exacta:
**Resolución de conflicto:** [Calificación de 1 a 10]/10
**Uso de lenguaje técnico:** [Calificación de 1 a 10]/10
**Comentario del mentor:** "[Un párrafo de feedback constructivo de 2-3 líneas dirigiéndote a ${state.userName} por su nombre]".`
    }]
  };

  try {
    const callGeminiAPI = firebase.functions().httpsCallable('callGeminiAPIV1');
    const result = await callGeminiAPI({
      systemInstruction: systemInstruction,
      contents: state.conversationHistory
    });

    // Convirtiendo markdown simple a HTML
    let feedbackText = result.data.text;
    feedbackText = feedbackText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    feedbackText = feedbackText.replace(/\n/g, '<br>');

    // Detener la simulación para evitar que el micrófono se abra
    
    // Parsear texto para generar mensaje de voz resumido
    let resScore = "10";
    let lenScore = "10";
    let comment = "Gran trabajo en la sesión de hoy.";
    
    try {
      const resMatch = feedbackText.match(/Resolución de conflicto:\s*(?:<[^>]+>)*\**(\d+)/i);
      if (resMatch) resScore = resMatch[1];
      
      const lenMatch = feedbackText.match(/Uso de lenguaje técnico:\s*(?:<[^>]+>)*\**(\d+)/i);
      if (lenMatch) lenScore = lenMatch[1];
      
      const commentMatch = feedbackText.match(/Comentario del mentor:\s*(?:<[^>]+>)*\**"?([^"]+)"?/i) || feedbackText.match(/Comentario del mentor:\s*(?:<[^>]+>)*\**(.*)/i);
      if (commentMatch) comment = commentMatch[1].replace(/<[^>]+>/g, '').trim();
    } catch(e) { console.warn("Parsing feedback failed:", e); }
    
    // Hablar el resultado (pero ocultar las captions visualmente atrás del modal está bien)
    speakCaption('Profesor Anáhuac', `Se acabó el tiempo. Revisé tu desempeño y lograste un ${resScore} de 10 en resolución y ${lenScore} en lenguaje. ${comment}`);
    
    document.getElementById('feedbackContent').innerHTML = feedbackText;
    updateOrb('neutral');
    
    // Guardar evaluación en Firestore
    if (state.sessionId && window.db) {
      db.collection("user_sessions").doc(state.sessionId).update({
        evaluation: feedbackText
      }).catch(err => console.error("Error guardando rúbrica:", err));
    }
  } catch (error) {
    console.error(error);
    document.getElementById('feedbackContent').innerHTML = 'Error al generar la evaluación: ' + error.message;
    updateOrb('breathing');
  }
}

function closeFeedbackModal() {
  document.getElementById('feedbackModal').style.display = 'none';
  // Llama a la confirmación de reinicio automáticamente, pero bypass el confirm extra
  forceResetCall();
}

function forceResetCall() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  state.callDurationSeconds = 0;
  state.userMessageCount = 0;
  state.currentScenario = 'none';
  elements.transcriptTimeline.innerHTML = '';
  const tabTranscriptBtn = document.getElementById('tabTranscript');
  if (tabTranscriptBtn) tabTranscriptBtn.style.display = 'none';
  switchSidebarTab('ai');
  updateOrb('breathing');
  elements.pillLabel.innerText = 'Selecciona un escenario';
  elements.participantName.innerText = 'Esperando escenario...';
  elements.roleLabel.innerText = 'AI Roleplay';
  state.conversationHistory = [];
  const contextBox = document.getElementById('scenarioContextBox');
  if (contextBox) {
    contextBox.innerHTML = '';
    contextBox.style.border = 'none';
  }
  elements.videoBg.className = 'video-bg theme-default';
}

function resetCall() {
  if (confirm('¿Deseas reiniciar la sesión sin guardar?')) {
    forceResetCall();
    
    // Reproducir mensaje de bienvenida nuevamente
    const intro = `¡Hola ${state.userName}! Soy tu tutor de la Facultad de Turismo y Gastronomía de la Universidad Anáhuac. Por favor, selecciona un Generador de Casos en el panel lateral para iniciar tu evaluación.`;
    speakCaption('Copiloto Anáhuac', intro);
  }
}

// -----------------------------------------------------------------
// Agentic Scenario Generator (Syllabus based)
// -----------------------------------------------------------------
const agenticSystemPrompt = `
Eres el motor de simulación directiva de la Facultad de Turismo y Gastronomía de la Universidad Anáhuac. 

Tu objetivo es poner a prueba el pensamiento crítico, la toma de decisiones, y las habilidades gerenciales de los futuros líderes del sector (Directores de Hoteles, Chefs Ejecutivos, Funcionarios de Turismo, etc.).
{MEMORY_PLACEHOLDER}

Temas de evaluación de la Facultad (elige UNO al azar o combínalos estratégicamente):

[TEMARIO CENTRAL - BLOQUE A]
1. MERCADOTECNIA TURÍSTICA AVANZADA:
- Comunicando valor: Transición a modelos híbridos Offline/Online y las 5 etapas del marketing.
- Distribución y Omnicanalidad: Sinergia de canales, economía digital, Big Data y mapeo del Customer Journey.
- Promoción: Gestión de contenidos por segmento y métricas de efectividad.
- Ventas y Competitividad: Macrosegmentación, microsegmentación y optimización del portafolio de marcas.
- Macroeconomía Turística: Aeropuertos, HUB economy, optimización de slots, alianzas y "destinos blindados".
- Branding: Valor integral, mapas mentales del consumidor y pirámide de marca.
- Marketing Digital: Hiperconveniencia, Customer centricity, APPs y las 5 etapas del Inbound marketing.
- Integración Omnicanal 360°: Reach en medios fusionados, Content Experience y minimización de volatilidad.
- Storytelling y Visual Telling: Campañas seriadas y adopción de tecnología 4G/5G en la experiencia del viajero.

2. ESTADÍSTICA PARA LA DIRECCIÓN: Distribución normal, series de tiempo, regresión lineal múltiple.

3. SOSTENIBILIDAD Y TURISMO AVANZADO:
- Evolución multidisciplinaria: Dimensión económica, ambiental, sistemas de bienestar social (salud, educación, vivienda), equidad, inclusión y el balance político.
- Retos contemporáneos: Brechas económicas, protección del patrimonio cultural, crisis climática, pérdida de biodiversidad.
- Arreglos institucionales: ONU (PNUD, PNUMA, OMT), Objetivos de Desarrollo Sostenible (ODS).
- Indicadores de sostenibilidad: Métricas cuantitativas/cualitativas de agua, emisiones, biodiversidad.
- Certificación internacional: Criterios GSTC, sellos internacionales, auditorías.

[TEMARIO TRANSVERSAL - BLOQUE B (Facultad)]
4. Turismo Sostenible (Práctico): Análisis de sustentabilidad de Pueblos Mágicos, investigación y consultoría.
5. Gestión de Destinos Turísticos: Perspectiva gubernamental, creación de planes turísticos y branding de región.
6. Dirección de Eventos: Logística, presupuestos y ejecución de eventos a gran escala.
7. Transportación Turística: Logística, alianzas con aerolíneas y optimización de rutas.
8. Desarrollo de Productos y Experiencias Turísticas: Creación de valor, diseño de tours o atractivos.
9. Gestión de Experiencias de Hospitabilidad: Operación hotelera, estándares de calidad y resolución de crisis en tiempo real.
10. Economía Turística: Macroeconomía, presupuestos directivos y rentabilidad de proyectos.
11. Estrategias de Atención al Consumidor: Fidelización, manejo de quejas y "Customer Centricity".
12. Introducción a la Hospitabilidad y Gastronomía: Conceptos core compartidos entre Turismo, Dirección Internacional de Hoteles y Gastronomía.

INSTRUCCIONES CLAVE (SITUACIONES COTIDIANAS DIRECTIVAS):
1. Elige aleatoriamente UN subtema específico de la lista anterior.
2. ADOPTA UNA PERSONALIDAD COTIDIANA PERO QUE REQUIERA LIDERAZGO DIRECTIVO. Eres alguien con quien un Director o Gerente General lidiaría en un día normal. Ejemplos: 
   - Un Gerente de Área (Mando medio) que está confundido con la nueva estrategia de la empresa y cuestiona las decisiones.
   - Un Huésped VIP cuya queja fue escalada hasta la Dirección porque nadie más pudo resolverla.
   - Un Proveedor Estratégico o Socio Comercial que quiere cambiar las reglas del juego.
   - Un Supervisor de Operaciones que trae un reporte semanal con malos resultados y excusas.
3. Asigna un Rol DIRECTIVO al alumno (Ej. Gerente General, Director de Marketing, Director de Sostenibilidad, CEO).
4. Plantea una situación común y del día a día (rutinaria pero que requiere toma de decisiones y liderazgo) donde el alumno deba aplicar y explicar los conceptos del temario.
5. Emite la primera frase del diálogo de forma directa.
6. IMPORTANTE: Como el alumno es el Director, asume que tú (la IA) NO entiendes a fondo los términos muy técnicos (Ej. Yield Management, Macrosegmentación). Exígele al alumno (el Director) que te los explique con palabras sencillas para que tu departamento pueda ejecutar la estrategia. NUNCA rompas el personaje.`;

async function triggerAgenticGenerator(usePdf = false) {
  state.sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
  state.conversationHistory = [];
  state.callDurationSeconds = 0;
  state.userMessageCount = 0;
  
  if (usePdf) {
    if (!state.currentProject || !state.currentProject.toLowerCase().includes('.pdf')) {
      alert('Primero debes arrastrar un Syllabus (PDF) en el área designada.');
      return;
    }
    if (!state.currentFileBase64) {
      alert('Esperando a que el archivo termine de procesarse... inténtalo en unos segundos.');
      return;
    }
  }

  state.currentScenario = 'agentic';
  elements.videoBg.className = 'video-bg theme-investor'; // Tema dinámico oscuro
  
  elements.pillLabel.innerText = usePdf ? 'Analizando PDF...' : 'Generando escenario aleatorio...';
  elements.participantName.innerText = usePdf ? 'Gemini Extrayendo Datos...' : 'Gemini Inventando Rol...';
  elements.roleLabel.innerText = usePdf ? 'Leyendo documento adjunto' : 'Consultando Temarios';
  
  updateOrb('working');
  
  let dynamicPrompt = agenticSystemPrompt.replace("{MEMORY_PLACEHOLDER}", state.userMemory || "");
  if (usePdf) {
    dynamicPrompt = `Eres un Generador de Escenarios Agénticos. Ignora los temas precargados. Lee el documento PDF adjunto.
    Extrae las competencias más importantes de este documento específico y genera un escenario de Roleplay inmersivo y de alta presión para evaluar al alumno sobre el contenido de este PDF.
    
    INSTRUCCIONES CLAVE (SITUACIONES COTIDIANAS DIRECTIVAS):
    1. ADOPTA UNA PERSONALIDAD COTIDIANA PERO QUE REQUIERA LIDERAZGO DIRECTIVO relevante al contenido del PDF (Ej. Un gerente de área confundido con la estrategia, un socio comercial, un supervisor con dudas).
    2. Asigna un Rol DIRECTIVO al alumno (Ej. Gerente General, Director de Área, CEO).
    3. Plantea una situación común y del día a día (rutinaria pero de nivel directivo) donde el alumno deba liderar y aplicar la teoría del documento.
    4. Emite la primera frase del diálogo.
    5. IMPORTANTE: Como el alumno es el Director, asume que tú (la IA) eres un mando medio o tercero que NO entiende a fondo los términos muy técnicos. Exígele al alumno que te los explique con palabras sencillas para poder ejecutar sus órdenes. NUNCA rompas el personaje.`;
  }
  
  const promptText = dynamicPrompt + `\n\nIMPORTANTE: El nombre del alumno es "${state.userName}". Debes dirigirte a él o mencionarlo por su nombre en tu 'first_message' dependiendo del rol que le asignaste (Ej. "Director ${state.userName}", "Licenciado ${state.userName}", "Jefe ${state.userName}", etc.).\n\nResponde ÚNICAMENTE con un JSON válido con la siguiente estructura exacta:\n{\n  "title": "Ej. 🌿 Auditoría GSTC",\n  "ai_name": "Ej. Auditora Internacional",\n  "ai_role": "Ej. Evaluando Economía Circular",\n  "scenario_context": "Breve descripción de 2 líneas explicando el conflicto del escenario que le aparecerá al alumno para que entienda su rol antes de hablar.",\n  "first_message": "Ej. Director ${state.userName}, he revisado sus indicadores..."\n}`;
  
  const btnGen = document.getElementById('btnGenerateScenario');
  if (btnGen) {
    btnGen.innerText = "⏳ Generando...";
    btnGen.disabled = true;
  }
  
  try {
    const parts = [];
    if (usePdf && state.currentFileBase64) {
      parts.push({
        inlineData: {
          mimeType: "application/pdf",
          data: state.currentFileBase64
        }
      });
    }
    parts.push({ text: promptText });

    const callGeminiAPI = firebase.functions().httpsCallable('callGeminiAPIV1');
    const response = await callGeminiAPI({
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    });
    
    // Clean up potential markdown formatting from Gemini
    let resultTextString = response.data.text;
    
    // Extract JSON only (from first { to last })
    const startIndex = resultTextString.indexOf('{');
    const endIndex = resultTextString.lastIndexOf('}');
    
    if (startIndex !== -1 && endIndex !== -1) {
      resultTextString = resultTextString.substring(startIndex, endIndex + 1);
    }
    
    const scenario = JSON.parse(resultTextString);
    
    if (btnGen) {
      btnGen.innerText = "🎲 Generar Escenario Aleatorio";
      btnGen.disabled = false;
    }
    
    elements.pillLabel.innerText = scenario.title;
    elements.participantName.innerText = scenario.ai_name;
    elements.roleLabel.innerText = scenario.ai_role;
    
    const contextBox = document.getElementById('scenarioContextBox');
    if (contextBox) {
      contextBox.innerHTML = `<strong>Tú eres:</strong> ${scenario.title.split(' ').slice(1).join(' ')}<br><br><strong>Situación:</strong> ${scenario.scenario_context}`;
      contextBox.style.border = "1px solid var(--primary-orange)";
    }

    // Desbloquear historial del caso y cambiar a esa vista
    const tabTranscriptBtn = document.getElementById('tabTranscript');
    if (tabTranscriptBtn) {
      tabTranscriptBtn.style.display = 'block';
    }
    switchSidebarTab('transcript');
    if (!state.sidebarOpen) toggleSidebar();
    
    addTranscriptMsg(scenario.ai_name, scenario.first_message);
    speakCaption(scenario.ai_name, scenario.first_message);
    
  } catch (error) {
    console.error("Generator Error:", error);
    elements.pillLabel.innerText = "Error: " + error.message;
    elements.participantName.innerText = "Error";
    elements.roleLabel.innerText = "Revisa la consola para más detalles";
    updateOrb('breathing');
    
    if (btnGen) {
      btnGen.innerText = "🎲 Reintentar Escenario";
      btnGen.disabled = false;
    }
  }
}

async function openHistoryModal() {
  document.getElementById('historyModal').style.display = 'flex';
  const content = document.getElementById('historyModalContent');
  content.innerHTML = 'Cargando tu historial...';
  
  const user = firebase.auth().currentUser;
  if (!window.db || !user) {
    content.innerHTML = 'Error: Base de datos no conectada o usuario no autenticado.';
    return;
  }
  
  try {
    const snapshot = await db.collection("user_sessions")
      .where("userId", "==", user.uid)
      .orderBy('updatedAt', 'desc')
      .limit(20)
      .get();
      
    if (snapshot.empty) {
      content.innerHTML = 'No tienes simulaciones evaluadas todavía.';
      return;
    }
    
    let html = '';
    snapshot.forEach(doc => {
      const data = doc.data();
      const date = data.updatedAt ? data.updatedAt.toDate().toLocaleString('es-MX') : 'Fecha desconocida';
      html += `<div style="background: rgba(255,255,255,0.05); margin-bottom: 1rem; padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">`;
      html += `<div style="color: var(--primary-orange); font-weight: bold; margin-bottom: 0.5rem; font-size: 1.2rem;">${data.scenario}</div>`;
      html += `<div style="font-size: 0.8rem; color: #94A3B8; margin-bottom: 1rem;">ID: ${doc.id} | ${date}</div>`;
      
      if (data.evaluation) {
        html += `<div style="background: rgba(255,102,0,0.1); border-left: 4px solid var(--primary-orange); padding: 1rem; border-radius: 4px; margin-bottom: 1rem; color: white;">
                   <h4 style="margin-top:0; margin-bottom:0.5rem; color: var(--primary-orange);">Evaluación Automática</h4>
                   ${data.evaluation}
                 </div>`;
      }
      
      const history = data.history || [];
      if (history.length > 0) {
        html += `<details style="cursor: pointer;">
                   <summary style="color: #94A3B8; margin-bottom: 0.5rem;">Ver transcripción de la llamada</summary>
                   <div style="max-height: 200px; overflow-y: auto; background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 4px; cursor: text;">`;
        history.forEach(msg => {
          const isUser = msg.role === 'user';
          const text = msg.parts[0].text;
          const color = isUser ? '#60A5FA' : '#FFF';
          const sender = isUser ? 'Tú' : 'Copiloto';
          html += `<div style="margin-bottom: 0.5rem;"><strong style="color: ${color};">${sender}:</strong> ${text}</div>`;
        });
        html += `  </div>
                 </details>`;
      } else {
        html += `<div style="color: #94A3B8; font-style: italic;">Sin transcripción.</div>`;
      }
      html += `</div>`;
    });
    
    content.innerHTML = html;
  } catch (err) {
    console.error(err);
    content.innerHTML = 'Error al cargar el historial.';
  }
}

function closeHistoryModal() {
  document.getElementById('historyModal').style.display = 'none';
}

async function handleLogout() {
  if (confirm("¿Estás seguro que deseas cerrar sesión?")) {
    try {
      await auth.signOut();
      window.location.reload();
    } catch (error) {
      console.error("Error al cerrar sesión", error);
    }
  }
}

async function openSyllabusModal() {
  document.getElementById('syllabusModal').style.display = 'flex';
  const content = document.getElementById('syllabusContent');
  
  if (state.currentFileBase64) {
    if (state.extractedTopics) {
      content.innerHTML = state.extractedTopics;
      return;
    }
    
    content.innerHTML = '<div style="text-align: center;">Analizando documento para extraer el temario... ⏳</div>';
    
    try {
      const callGeminiAPI = firebase.functions().httpsCallable('callGeminiAPIV1');
      const response = await callGeminiAPI({
        contents: [{
          parts: [
            { inlineData: { mimeType: "application/pdf", data: state.currentFileBase64 } },
            { text: "Extrae un temario en formato HTML (usa <ul> y <li>, sin markdown). Extrae los 5 temas o competencias principales de este documento que un alumno debería dominar." }
          ]
        }]
      });
      
      let html = response.data.text;
      // Limpiar markdown si gemini lo devuelve por error
      html = html.replace(/```html/g, '').replace(/```/g, '');
      
      state.extractedTopics = `<h3>Temario de: ${state.currentProject}</h3>` + html;
      content.innerHTML = state.extractedTopics;
    } catch (e) {
      console.error(e);
      content.innerHTML = 'Error extrayendo temas del PDF.';
    }
  } else {
    content.innerHTML = `
      <h3>Temario Base de la Facultad</h3>
      <p>Al no haber subido un PDF, la IA elegirá dinámicamente evaluarte sobre los siguientes bloques de conocimiento:</p>
      
      <h4 style="margin-top: 1rem; margin-bottom: 0.5rem; color: #E2E8F0;">Bloque A: Materias Centrales</h4>
      <ul style="margin-bottom: 1rem;">
        <li><strong>Mercadotecnia Turística Avanzada:</strong> Omnicanalidad, Inbound marketing, Macrosegmentación, Branding.</li>
        <li><strong>Sostenibilidad y Turismo:</strong> Desarrollo regenerativo, Criterios GSTC, Indicadores de impacto.</li>
        <li><strong>Estadística para la Dirección:</strong> Distribución normal, series de tiempo, regresión.</li>
      </ul>

      <h4 style="margin-bottom: 0.5rem; color: #E2E8F0;">Bloque B: Conocimientos Transversales</h4>
      <ul>
        <li>Gestión de Destinos y Pueblos Mágicos</li>
        <li>Dirección de Eventos y Transportación</li>
        <li>Gestión de Hospitabilidad y Atención al Consumidor</li>
        <li>Economía Turística</li>
      </ul>

      <p style="margin-top: 1.5rem; font-size: 0.9em; color: #64748B;"><em>¿Quieres un caso sobre un tema específico?</em> Arrastra tu documento PDF en la pestaña "RAG" del panel izquierdo y la IA extraerá el temario automáticamente.</p>
    `;
  }
}
