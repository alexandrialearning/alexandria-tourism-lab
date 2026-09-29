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
  //
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
      
      elements.captionSpeaker.innerText = "Sistema";
      elements.captionText.innerHTML = renderMarkdown(`Bienvenido de vuelta, **${state.userName}**. Selecciona **Generar caso aleatorio** o **Subir PDF** para comenzar.`);
      
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

function loginAsGuest() {
  state.userName = "Invitado";
  const userTag = document.getElementById('userProfileTag');
  if (userTag) userTag.innerText = `👤 Invitado`;
  startSimulation();
}

async function startSimulation() {
  document.getElementById('startOverlay').style.display = 'none';
  document.getElementById('btnLogout').style.display = 'inline-block';
  startCallTimer();
  
  elements.participantName.innerText = "Copiloto Anáhuac";
  elements.roleLabel.innerText = "Facultad de Turismo y Gastronomía";
  
  const intro = `¡Hola ${state.userName}! Soy tu tutor de la Facultad de Turismo y Gastronomía de la Universidad Anáhuac. Por favor, selecciona **Generar caso aleatorio** o **Subir PDF** para iniciar tu evaluación.`;
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
// Markdown Rendering Utility
// -----------------------------------------------------------------
function renderMarkdown(text) {
  if (!text) return '';
  if (window.marked && typeof window.marked.parse === 'function') {
    try {
      return window.marked.parse(text);
    } catch (e) {
      console.warn("marked.parse error, using fallback", e);
    }
  }
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/\n\n/g, '<p></p>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

// -----------------------------------------------------------------
// Audio Synthesis (ElevenLabs ONLY)
// -----------------------------------------------------------------
async function speakCaption(speaker, text) {
  elements.captionSpeaker.innerText = speaker;
  elements.captionText.innerHTML = renderMarkdown(text);
  
  elements.videoStage.classList.add('speaking');
  document.body.classList.add('orb-speaking');
  state.isSpeaking = true;
  updateOrb('composing'); // Orb state for speaking

  // Limpiar sintaxis de markdown para que el sintetizador de voz no hable asteriscos o signos
  const cleanTTS = text
    .replace(/[*#_`~>[\]]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();

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
          text: cleanTTS,
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
    document.body.classList.remove('orb-speaking');
    state.isSpeaking = false;
    
    // Terminar caso después de 3 preguntas
    if (state.currentScenario === 'agentic' && state.userMessageCount >= 3) {
      finishCall(true);
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
    const utterance = new SpeechSynthesisUtterance(cleanTTS);
    utterance.lang = 'es-MX';
    utterance.rate = 1.0;
    
    utterance.onend = onAudioEnd;
    utterance.onerror = onAudioEnd;
    
    window.speechSynthesis.speak(utterance);
  } else {
    setTimeout(onAudioEnd, Math.min(cleanTTS.length * 50, 4000));
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
  recognition.interimResults = true;
  recognition.continuous = true;

  recognition.onstart = () => {
    state.isRecording = true;
    updateOrb('listening');
    
    elements.btnMic.classList.add('active-mic');
    elements.micIcon.innerText = '📤';
    elements.micLabel.innerText = 'Enviar Respuesta';
  };

  recognition.onresult = (event) => {
    let interim_transcript = '';
    let final_transcript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final_transcript += event.results[i][0].transcript + ' ';
      } else {
        interim_transcript += event.results[i][0].transcript;
      }
    }

    if (final_transcript) {
      elements.userInput.value += final_transcript;
    }
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
    //
    //
    
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
  if (state.isRecording) {
    stopMic();
    if (elements.userInput.value.trim() !== '') {
      handleUserSubmit(new Event('submit'));
    }
  } else {
    elements.userInput.value = '';
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
  if (state.sessionId && db) {
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
  textDiv.innerHTML = renderMarkdown(text);
  
  msgDiv.appendChild(headerDiv);
  msgDiv.appendChild(textDiv);
  elements.transcriptTimeline.appendChild(msgDiv);
  elements.transcriptTimeline.scrollTop = elements.transcriptTimeline.scrollHeight;
}

async function generateResponse(userText) {
  if (state.currentScenario !== 'agentic') {
    speakCaption('Sistema', 'Por favor, selecciona **Generar caso aleatorio** o **Subir PDF** para comenzar.');
    return;
  }

  // Flujo Agéntico Inteligente Universal (Gemini para TODO)
  
  let roleContext = "Eres un evaluador estricto. Sigue tu rol asignado previamente, NUNCA rompas el personaje. Responde de forma estructurada con Markdown.";
  
  if (state.currentScenario === 'mentor') {
    roleContext = "Eres un Copiloto, un Mentor Socrático experto en turismo. Nunca das la respuesta directa, siempre respondes con preguntas profundas que hagan pensar al estudiante sobre sostenibilidad y rentabilidad.";
  } else if (state.currentScenario === 'overbooking') {
    roleContext = "Eres un huésped en el lobby del hotel. Hiciste tu reserva hace 3 meses y acaba de ocurrir un overbooking. Exiges soluciones inmediatas y amenazas con Profeco.";
  } else if (state.currentScenario === 'community') {
    roleContext = "Eres el líder de una asamblea ejidal indígena. Un empresario quiere construir un proyecto en tu tierra. Eres desconfiado, defiendes la naturaleza y quieres garantías por escrito. Hablas con firmeza.";
  } else if (state.currentScenario === 'investor') {
    roleContext = "Eres un inversionista de Wall Street analítico. Evalúas un pitch turístico. Cuestionas el ROI, la TIR y las proyecciones de ventas.";
  } else {
    // Escenario agéntico generado por PDF o Aleatorio
    roleContext = "Eres el personaje de la simulación. MANTÉN SIEMPRE UN TONO DE RESPETO ABSOLUTO, formal y corporativo (trata al usuario de Usted). Plantea tus dudas o problemas de manera profesional, sin exigir cosas de forma maleducada. JAMÁS uses groserías ni expresiones informales o agresivas (ej. no digas 'qué demonios'). Responde de forma natural, clara y argumentada. Puedes usar formato Markdown (como **negritas** para enfatizar conceptos clave o viñetas cortas si listas puntos) para que la respuesta esté visualmente estructurada.";
  }

  let pacingInstruction = "";
  if (state.userMessageCount === 2) {
    pacingInstruction = "\\n\\n[INSTRUCCIÓN DEL SISTEMA]: Esta es tu penúltima intervención. Empieza a acercar el caso hacia una conclusión o acuerdo basándote en la respuesta del alumno.";
  } else if (state.userMessageCount >= 3) {
    pacingInstruction = "\\n\\n[INSTRUCCIÓN DEL SISTEMA]: Esta es tu ÚLTIMA intervención. El tiempo de la reunión se acabó. Llega a una conclusión final definitiva sobre el caso y despídete en tu personaje.";
  }

  const systemInstruction = {
    parts: [{ text: roleContext + "\\n\\n" + (state.userMemory || "") + pacingInstruction }]
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

// Case Generator Modal Control
function openCaseModal() {
  const modal = document.getElementById('caseModal');
  if (modal) modal.style.display = 'flex';
}

function closeCaseModal() {
  const modal = document.getElementById('caseModal');
  if (modal) modal.style.display = 'none';
}

function triggerCaseOption(type) {
  closeCaseModal();
  if (type === 'random') {
    triggerAgenticGenerator(false);
  }
}

// Mobile Bottom Sheet More Options Menu
function toggleMoreMenu() {
  const sheet = document.getElementById('moreOptionsSheet');
  if (!sheet) return;
  if (sheet.style.display === 'none' || sheet.style.display === '') {
    sheet.style.display = 'flex';
    setTimeout(() => sheet.classList.add('active'), 10);
  } else {
    sheet.classList.remove('active');
    setTimeout(() => { sheet.style.display = 'none'; }, 260);
  }
}

function closeMoreMenuOnBackdrop(event) {
  if (event.target.id === 'moreOptionsSheet') {
    toggleMoreMenu();
  }
}

// Transcript Modal Control
function openTranscriptModal() {
  const modal = document.getElementById('transcriptModal');
  if (modal) modal.style.display = 'flex';
  const timeline = document.getElementById('transcriptTimeline');
  if (timeline) timeline.scrollTop = timeline.scrollHeight;
}

function closeTranscriptModal() {
  const modal = document.getElementById('transcriptModal');
  if (modal) modal.style.display = 'none';
}

function toggleSidebar() {
  state.sidebarOpen = true;
}

function switchSidebarTab(tabName) {
  const tabTranscript = document.getElementById('tabTranscript');
  const tabRag = document.getElementById('tabRag');
  const viewTranscript = document.getElementById('viewTranscript');
  const viewRag = document.getElementById('viewRag');

  if (tabTranscript && tabRag && viewTranscript && viewRag) {
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
}

function triggerFileUpload() { document.getElementById('fileInput').click(); }

async function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    state.currentProject = file.name;
    document.getElementById('projectName').innerText = `📄 ${file.name} (Cargando archivo...)`;
    document.getElementById('projectInfo').style.display = 'block';
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        document.getElementById('projectName').innerText = `📄 ${file.name} (Procesando texto rápido...)`;
        
        const typedarray = new Uint8Array(event.target.result);
        const loadingTask = pdfjsLib.getDocument(typedarray);
        const pdf = await loadingTask.promise;
        
        let fullText = "";
        // Leer páginas aleatorias para no exceder límites de memoria ni de red
        const numPagesToRead = Math.min(pdf.numPages, 10);
        const step = Math.max(1, Math.floor(pdf.numPages / numPagesToRead));
        
        for (let i = 1; i <= pdf.numPages; i += step) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map(item => item.str).join(' ') + " \n";
          if (fullText.length > 30000) break; 
        }
        
        state.extractedPdfText = fullText;
        state.currentFileBase64 = null; // No mandaremos Base64 masivo para evitar Error 413 Payload Too Large
        
        const pName = document.getElementById('projectName');
        if (pName) pName.innerText = `📄 ${file.name} (Cargado exitosamente)`;
        const pInfo = document.getElementById('projectInfo');
        if (pInfo) pInfo.style.display = 'block';
        
        closeCaseModal();
        triggerAgenticGenerator(true);
      } catch (err) {
        console.error("Error procesando PDF localmente:", err);
        const pName = document.getElementById('projectName');
        if (pName) pName.innerText = `📄 ${file.name} (Error procesando)`;
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

function askLaw(lawTitle) {
  switchSidebarTab('transcript');
  sendPrompt(`¿Qué establece la regulación sobre "${lawTitle}" para proyectos turísticos?`);
}

async function finishCall(auto = false) {
  if (!auto && !confirm('¿Deseas finalizar la simulación y recibir tu evaluación?')) return;
  state.currentScenario = 'evaluating';
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  if (state.currentAudio) {
    state.currentAudio.pause();
    state.currentAudio.currentTime = 0;
  }
  updateOrb('working');

  document.getElementById('feedbackModal').style.display = 'flex';
  document.getElementById('feedbackContent').innerHTML = '<div style="text-align: center; padding: 2rem 0;"><div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⏳ Analizando simulación...</div><p style="color: #94A3B8; font-size: 0.9rem;">Por favor espera, la IA está evaluando tu liderazgo y toma de decisiones.</p></div>';

  const systemInstruction = {
    parts: [{ 
      text: `Eres un estricto profesor universitario evaluando el desempeño de un alumno directivo en una simulación de toma de decisiones.
Analiza la siguiente transcripción y genera un reporte oficial de evaluación para el alumno "${state.userName}".

REGLAS ESTRICTAS:
1. El reporte debe estar escrito 100% en ESPAÑOL, sin importar el contenido del caso.
2. Usa un tono académico, profesional y constructivo.
3. El formato debe ser estrictamente en Markdown usando encabezados y listas.

ESTRUCTURA OBLIGATORIA DEL REPORTE:
# 📊 Reporte de Evaluación

**Alumno:** ${state.userName}  
**Calificación Final:** [0 a 100]/100

### 🎯 Resumen de Desempeño
[Un párrafo de 3 a 4 líneas resumiendo cómo manejó la situación, su nivel de liderazgo y su toma de decisiones]

### ✅ Puntos Fuertes
* [Punto 1]
* [Punto 2]

### ⚠️ Áreas de Mejora
* [Punto 1]
* [Punto 2]

### 💡 Comentario Final del Evaluador
[Feedback directo y profesional para el alumno sobre cómo mejorar en su rol directivo]`
    }]
  };

  const payloadText = JSON.stringify(state.conversationHistory, null, 2);

  try {
    const callGeminiAPI = firebase.functions().httpsCallable('callGeminiAPIV1');
    const result = await callGeminiAPI({
      systemInstruction: systemInstruction,
      contents: [{ role: "user", parts: [{ text: "Aquí tienes la transcripción completa de la simulación. Evalúame siguiendo estrictamente tus instrucciones del sistema:\n\n" + payloadText }] }]
    });

    const rawFeedback = result.data.text;
    const formattedHtml = renderMarkdown(rawFeedback);

    document.getElementById('feedbackContent').innerHTML = formattedHtml;
    updateOrb('neutral');
    speakCaption('Sistema', 'Evaluación completada. Revisa en pantalla tu reporte de desempeño.');

    // Guardar evaluación en Firestore en la sesión
    if (state.sessionId && db) {
      db.collection("user_sessions").doc(state.sessionId).update({
        evaluation: rawFeedback
      }).catch(err => console.error("Error guardando rúbrica:", err));
    }
  } catch (error) {
    console.error(error);
    document.getElementById('feedbackContent').innerHTML = '<div style="color: #EF4444;">Error al generar la evaluación: ' + error.message + '</div>';
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
    const intro = `¡Hola ${state.userName}! Soy tu tutor de la Facultad de Turismo y Gastronomía de la Universidad Anáhuac. Por favor, selecciona **Generar caso aleatorio** o **Subir PDF** para iniciar tu evaluación.`;
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

Temas de evaluación de la Facultad (elige SOLO UNO AL AZAR para este caso):

1. MERCADOTECNIA TURÍSTICA AVANZADA: Modelos híbridos Offline/Online, distribución y omnicanalidad, branding, economía digital, customer journey.
2. ESTADÍSTICA PARA LA DIRECCIÓN: Distribución normal, series de tiempo, regresión lineal múltiple.
3. SOSTENIBILIDAD Y TURISMO AVANZADO: Dimensión económica, ambiental, equidad, inclusión, crisis climática, ODS, certificaciones GSTC.
4. TURISMO SOSTENIBLE (PRÁCTICO): Análisis de sustentabilidad de Pueblos Mágicos, investigación y consultoría.
5. GESTIÓN DE DESTINOS TURÍSTICOS: Perspectiva gubernamental, creación de planes turísticos y branding de región.
6. DIRECCIÓN DE EVENTOS: Logística, presupuestos y ejecución de eventos a gran escala.
7. TRANSPORTACIÓN TURÍSTICA: Logística, alianzas con aerolíneas y optimización de rutas.
8. DESARROLLO DE PRODUCTOS Y EXPERIENCIAS TURÍSTICAS: Creación de valor, diseño de tours o atractivos.
9. GESTIÓN DE EXPERIENCIAS DE HOSPITABILIDAD: Operación hotelera, estándares de calidad y resolución de crisis en tiempo real.
10. ECONOMÍA TURÍSTICA: Macroeconomía, presupuestos directivos y rentabilidad de proyectos.
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
6. IMPORTANTE: Como el alumno es el Director, asume que tú (la IA) NO entiendes a fondo los términos muy técnicos (Ej. Yield Management, Macrosegmentación). Exígele al alumno (el Director) que te los explique con palabras sencillas para que tu departamento pueda ejecutar la estrategia. NUNCA rompas el personaje.
7. REGLA DE ORO: El usuario SIEMPRE es la autoridad. Mantén un tono de respeto profesional absoluto y muestra empatía. Sin embargo, no te dejes engañar: cuestiona firmemente las respuestas malas, evasivas o incorrectas. Por el contrario, cuando el alumno te dé una buena respuesta bien fundamentada, mejora tu trato, actitud y docilidad hacia él. NUNCA debes ser grosero o faltar al respeto.`;

async function triggerAgenticGenerator(usePdf = false) {
  closeCaseModal();
  state.sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
  state.conversationHistory = [];
  state.callDurationSeconds = 0;
  state.userMessageCount = 0;
  
  if (usePdf) {
    if (!state.currentProject || !state.currentProject.toLowerCase().includes('.pdf')) {
      alert('Primero debes arrastrar un Syllabus (PDF) en el área designada.');
      return;
    }
    if (!state.extractedPdfText && !state.currentFileBase64) {
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
    5. IMPORTANTE: Como el alumno es el Director, asume que tú (la IA) eres un mando medio o tercero que NO entiende a fondo los términos muy técnicos. Exígele al alumno que te los explique con palabras sencillas para poder ejecutar sus órdenes. NUNCA rompas el personaje.
    6. REGLA DE ORO: El usuario SIEMPRE es la autoridad. Mantén un tono de respeto profesional absoluto y muestra empatía. Sin embargo, no te dejes engañar: cuestiona firmemente las respuestas malas, evasivas o incorrectas. Por el contrario, cuando el alumno te dé una buena respuesta bien fundamentada, mejora tu trato, actitud y docilidad hacia él. NUNCA debes ser grosero o faltar al respeto.`;
  }
  
  const promptText = dynamicPrompt + `\n\nIMPORTANTE: El nombre del alumno es "${state.userName}". Debes dirigirte a él o mencionarlo por su nombre en tu 'first_message' dependiendo del rol que le asignaste (Ej. "Director ${state.userName}", "Licenciado ${state.userName}", "Jefe ${state.userName}", etc.).\n\nResponde ÚNICAMENTE con un JSON válido con la siguiente estructura exacta:\n{\n  "title": "Ej. 🌿 Auditoría GSTC",\n  "ai_name": "Ej. Auditora Internacional",\n  "ai_role": "Ej. Evaluando Economía Circular",\n  "scenario_context": "Breve descripción de 2 líneas explicando el conflicto del escenario que le aparecerá al alumno para que entienda su rol antes de hablar.",\n  "first_message": "Ej. Director ${state.userName}, he revisado sus indicadores..."\n}`;
  
  const btnGen = document.getElementById('btnGenerateScenario');
  if (btnGen) {
    btnGen.innerText = "⏳ Generando...";
    btnGen.disabled = true;
  }
  
  try {
    const parts = [];
    let finalPrompt = promptText;
    if (usePdf && state.extractedPdfText) {
      finalPrompt = `CONTENIDO DEL LIBRO/DOCUMENTO A EVALUAR:\n---\n${state.extractedPdfText}\n---\n\n${promptText}`;
    }
    parts.push({ text: finalPrompt });

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
  if (!db || !user) {
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
        // Extraer la calificación final usando regex
        let calificacion = "N/A";
        const scoreMatch = data.evaluation.match(/\*\*Calificaci&oacute;n Final:\*\*\s*(\d+\/100)/i) || data.evaluation.match(/Calificaci[oó]n Final:.*?(\d+\/100)/i) || data.evaluation.match(/(\d+\/100)/);
        if (scoreMatch && scoreMatch[1]) {
          calificacion = scoreMatch[1];
        }

        html += `<div style="background: rgba(255,102,0,0.1); border-left: 4px solid var(--primary-orange); padding: 1rem; border-radius: 4px; margin-bottom: 1rem; color: white;">
                   <details style="cursor: pointer;">
                     <summary style="font-weight: bold; color: var(--primary-orange); display: flex; align-items: center; justify-content: space-between; font-size: 1.1rem; list-style: none;">
                       <span>🎯 Calificación: <span style="color: white; background: var(--primary-orange); padding: 2px 8px; border-radius: 12px; margin-left: 5px;">${calificacion}</span></span>
                       <span style="font-size: 0.9rem; text-decoration: underline;">Ver reporte completo ▼</span>
                     </summary>
                     <div style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
                       ${renderMarkdown(data.evaluation)}
                     </div>
                   </details>
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
      
      <ul style="margin-top: 1rem; margin-bottom: 1rem;">
        <li><strong>Mercadotecnia Turística Avanzada:</strong> Omnicanalidad, Inbound marketing, Macrosegmentación, Branding.</li>
        <li><strong>Sostenibilidad y Turismo:</strong> Desarrollo regenerativo, Criterios GSTC, Indicadores de impacto.</li>
        <li><strong>Estadística para la Dirección:</strong> Distribución normal, series de tiempo, regresión.</li>
        <li>Gestión de Destinos y Pueblos Mágicos</li>
        <li>Dirección de Eventos y Transportación</li>
        <li>Gestión de Hospitabilidad y Atención al Consumidor</li>
        <li>Economía Turística</li>
      </ul>

      <p style="margin-top: 1.5rem; font-size: 0.9em; color: #64748B;"><em>¿Quieres un caso sobre un tema específico?</em> Arrastra tu documento PDF en la pestaña "RAG" del panel izquierdo y la IA extraerá el temario automáticamente.</p>
    `;
  }
}
