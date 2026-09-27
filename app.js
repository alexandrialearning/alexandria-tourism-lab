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

const state = {
  currentScenario: 'mentor',
  isSpeaking: false,
  isRecording: false,
  sidebarOpen: true,
  callDurationSeconds: 0,
  timerInterval: null,
  currentProject: null,
  customVoiceId: 'sDh3eviBhiuHKi0MjTNq',
  ttsApiKey: 'sk_4197546279e7106e0b4d72bfa7f870dd1316bd4e71fbd682',
  conversationHistory: [],
  sessionId: null
};

let recognition = null;
let autoListen = true;

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
  scenarioDropdown: document.getElementById('scenarioDropdown'),
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
});

async function handleLogin() {
  const email = document.getElementById('loginUsername').value;
  const pass = document.getElementById('loginPassword').value;
  const privacyChecked = document.getElementById('privacyCheckbox').checked;
  
  if (!email || !pass) {
    alert("Por favor, ingresa tu correo y contraseña.");
    return;
  }

  if (!privacyChecked) {
    alert("Debes leer y aceptar el Aviso de Privacidad para continuar.");
    return;
  }
  
  try {
    const btn = document.getElementById('btnStartSimulation');
    const originalText = btn.innerText;
    btn.innerText = "Autenticando...";
    btn.disabled = true;

    try {
      // Intentar iniciar sesión
      await auth.signInWithEmailAndPassword(email, pass);
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        // Si no existe, lo creamos para el prototipo
        await auth.createUserWithEmailAndPassword(email, pass);
      } else {
        throw err;
      }
    }
    
    state.userName = email.split('@')[0];
    document.getElementById('userProfileTag').innerText = `👤 ${state.userName}`;
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

  if (audioBlob) {
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    audio.onended = () => {
      elements.videoStage.classList.remove('speaking');
      state.isSpeaking = false;
      URL.revokeObjectURL(audioUrl);
      startListening();
    };
    
    await audio.play();
    return;
  }

  // Fallback nativo
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-MX';
    utterance.rate = 1.0;
    
    utterance.onend = () => {
      elements.videoStage.classList.remove('speaking');
      state.isSpeaking = false;
      startListening();
    };
    utterance.onerror = () => {
      elements.videoStage.classList.remove('speaking');
      state.isSpeaking = false;
      startListening();
    };
    
    window.speechSynthesis.speak(utterance);
  } else {
    setTimeout(() => {
      elements.videoStage.classList.remove('speaking');
      state.isSpeaking = false;
      startListening();
    }, Math.min(text.length * 50, 4000));
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
    if (e.error === 'no-speech' && !state.isSpeaking && autoListen) {
      try { recognition.start(); } catch(err){}
    }
  };

  recognition.onend = () => {
    state.isRecording = false;
    elements.btnMic.classList.remove('active-mic');
    elements.micIcon.innerText = '🎙️';
    elements.micLabel.innerText = 'Micrófono (Auto)';
    elements.pipMicStatus.innerText = '🎙️ En espera';
    elements.pipMicStatus.style.color = '#34D399';
    
    if (!state.isSpeaking && window.setOrbState) {
      window.setOrbState('breathing');
    }

    if (autoListen && !state.isSpeaking) {
      try { recognition.start(); } catch(err){}
    }
  };
}

function startListening() {
  if (state.currentScenario !== 'agentic') return;
  autoListen = true;
  if (recognition && !state.isRecording && !state.isSpeaking) {
    try { recognition.start(); } catch(e){}
  }
}

function stopMic() {
  autoListen = false;
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

function toggleScenarioDropdown() {
  elements.scenarioDropdown.classList.toggle('show');
}

function selectScenario(scenarioKey) {
  state.currentScenario = scenarioKey;
  elements.scenarioDropdown.classList.remove('show');

  const items = elements.scenarioDropdown.querySelectorAll('.dropdown-item');
  items.forEach(item => item.classList.remove('active'));

  if (scenarioKey === 'mentor') {
    elements.videoBg.className = 'video-bg';
    elements.pillLabel.innerText = 'Modo: Mentor Socrático';
    elements.participantName.innerText = 'Copiloto Anáhuac';
    elements.roleLabel.innerText = 'Tutor Pedagógico';
    const msg = '¡De vuelta a nuestro espacio de tutoría socrática! ¿Revisamos tu borrador de proyecto o tienes alguna duda legal?';
    addTranscriptMsg('Copiloto Anáhuac', msg);
    speakCaption('Copiloto Anáhuac', msg);
  } else if (scenarioKey === 'overbooking') {
    elements.videoBg.className = 'video-bg theme-overbooking';
    elements.pillLabel.innerText = 'Crisis 🏨: Sobreventa en Hotel';
    elements.participantName.innerText = 'Sr. Martínez (Huésped)';
    elements.roleLabel.innerText = 'Rol: Cliente Exigente';
    const msg = `¡Esto es inaceptable! Vengo viajando horas y me dicen que no hay habitación disponible. ¡Exijo hablar con el gerente!`;
    addTranscriptMsg('Sr. Martínez', msg);
    speakCaption('Sr. Martínez', msg);
  } else if (scenarioKey === 'community') {
    elements.videoBg.className = 'video-bg theme-community';
    elements.pillLabel.innerText = 'Negociación 🌿: Comunidad Rural';
    elements.participantName.innerText = 'Doña Elena (Asamblea)';
    elements.roleLabel.innerText = 'Rol: Líder Ejidal';
    const msg = 'Buenas tardes. Nos preocupa que los grupos de turistas traigan basura. ¿Cómo se va a beneficiar nuestra gente?';
    addTranscriptMsg('Doña Elena', msg);
    speakCaption('Doña Elena', msg);
  } else if (scenarioKey === 'investor') {
    elements.videoBg.className = 'video-bg theme-investor';
    elements.pillLabel.innerText = 'Pitch 💼: Fondo de Inversión';
    elements.participantName.innerText = 'Lic. Valenzuela';
    elements.roleLabel.innerText = 'Rol: Inversionista';
    const msg = 'Tiene 2 minutos. Su propuesta de Yield Management me parece muy optimista. ¿Cómo justifica esas tarifas?';
    addTranscriptMsg('Lic. Valenzuela', msg);
    speakCaption('Lic. Valenzuela', msg);
  }
}

function handleUserSubmit(e) {
  e.preventDefault();
  const text = elements.userInput.value.trim();
  if (!text) return;

  addTranscriptMsg('Tú', text);
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

  // Guardado permanente y anónimo de la sesión
  if (state.sessionId && window.db) {
    db.collection("anonymous_sessions").doc(state.sessionId).set({
      scenario: elements.pillLabel ? elements.pillLabel.innerText : 'Desconocido',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      history: state.conversationHistory
    }, { merge: true }).catch(err => console.error("Error guardando sesión:", err));
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
  let GEMINI_API_KEY = atob("QVEuQWI4Uk42SnFqSXE3WEh6T3N6ZnJPYnU3VWpMSXo5WEYzSmswOFl4dDJBbXhZTkhYY1E=");
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  
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
    parts: [{ text: roleContext }]
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction,
        contents: state.conversationHistory
      })
    });

    if (!response.ok) throw new Error("API Error");

    const data = await response.json();
    const replyText = data.candidates[0].content.parts[0].text;
    
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
  elements.callSidebar.classList.toggle('hidden');
  state.sidebarOpen = !elements.callSidebar.classList.contains('hidden');
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

function resetCall() {
  if (confirm('¿Deseas reiniciar la sesión?')) {
    // 1. Cortar el audio actual
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    // 2. Reiniciar estados
    state.callDurationSeconds = 0;
    state.currentScenario = 'none';
    elements.transcriptTimeline.innerHTML = '';
    
    // 3. Ocultar historial del caso y mostrar generador
    const tabTranscriptBtn = document.getElementById('tabTranscript');
    if (tabTranscriptBtn) {
      tabTranscriptBtn.style.display = 'none';
    }
    switchSidebarTab('rag');
    if (!state.sidebarOpen) toggleSidebar();
    
    // 4. Limpiar caja de contexto
    const contextBox = document.getElementById('scenarioContextBox');
    if (contextBox) {
      contextBox.innerHTML = '';
      contextBox.style.border = "none";
    }

    // 5. Reproducir mensaje de bienvenida nuevamente
    const intro = `¡Hola ${state.userName}! Soy tu tutor de la Facultad de Turismo y Gastronomía de la Universidad Anáhuac. Por favor, selecciona un Generador de Casos en el panel lateral para iniciar tu evaluación.`;
    speakCaption('Copiloto Anáhuac', intro);
  }
}

// -----------------------------------------------------------------
// Agentic Scenario Generator (Syllabus based)
// -----------------------------------------------------------------
const agenticSystemPrompt = `
Eres un Generador de Escenarios Agénticos para 'Anáhuac Tourism Lab'.
Tu objetivo es crear un escenario de Roleplay inmersivo y de alta presión para evaluar oralmente a un estudiante de Administración Turística.

Temas de evaluación disponibles (elige UNO al azar o combínalos estratégicamente):

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
- Evolución multidisciplinaria: Dimensión económica, ambiental, sistemas de bienestar social (salud, educación, vivienda), equidad, inclusión y el balance político entre libre mercado, Estado y comunidades.
- Retos contemporáneos (México y el mundo): Brechas económicas, protección del patrimonio cultural, crisis climática, pérdida de biodiversidad, contaminación, gobernanza participativa y gestión de contingencias/desastres.
- Arreglos institucionales: Papel de la ONU (PNUD, PNUMA, OMT), Objetivos de Desarrollo Sostenible (ODS), atribuciones gubernamentales (federal, estatal, municipal), ONG's y filantropía.
- Indicadores de sostenibilidad: Métricas cuantitativas/cualitativas de agua, emisiones/aire, eficiencia energética, recursos costeros, biodiversidad, manejo de residuos y programas de reducción de la pobreza.
- Turismo como palanca de desarrollo: Desarrollo regenerativo y regional, economía circular, innovación tecnológica, emprendedurismo (PyMEs), y gestión en ciudades, zonas rurales y ANPs (Áreas Naturales Protegidas).
- Competitividad turística: Sostenibilidad como requisito indispensable de operación y ventaja competitiva diferenciadora.
- Certificación internacional: Criterios del Consejo Global de Turismo Sostenible (GSTC), sellos internacionales, auditorías, programas y distintivos nacionales oficiales.

INSTRUCCIONES CLAVE:
1. Elige aleatoriamente UN subtema específico de la lista anterior (ya sea de Marketing o de Sostenibilidad).
2. Asume una Persona Antagónica o Evaluadora (Ej. CEO estricto, Auditor del GSTC, Inversionista rudo, Activista ambiental, Periodista incisivo, Director de Aerolínea, Representante de la OMT o Líder Ejidal).
3. Asigna un Rol de Defensa al alumno (Ej. Estratega de Marca, Gerente de RSE, Director de Hotel, Funcionario de Turismo).
4. Plantea un conflicto crítico y muy específico que el alumno solo pueda resolver justificándose con la teoría del tema elegido (Ej. Defender el presupuesto de una campaña Inbound, justificar el balance político frente al mercado, o defender los indicadores métricos de agua frente a una auditoría).
5. Emite la primera frase del diálogo de forma retadora. NUNCA rompas el personaje.
`;

async function triggerAgenticGenerator(usePdf = false) {
  state.sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
  state.conversationHistory = [];
  
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

  elements.scenarioDropdown.classList.remove('show');
  state.currentScenario = 'agentic';
  elements.videoBg.className = 'video-bg theme-investor'; // Tema dinámico oscuro
  
  elements.pillLabel.innerText = usePdf ? 'Analizando PDF...' : 'Generando escenario aleatorio...';
  elements.participantName.innerText = usePdf ? 'Gemini Extrayendo Datos...' : 'Gemini Inventando Rol...';
  elements.roleLabel.innerText = usePdf ? 'Leyendo documento adjunto' : 'Consultando Temarios';
  
  updateOrb('working');
  
  let GEMINI_API_KEY = atob("QVEuQWI4Uk42SnFqSXE3WEh6T3N6ZnJPYnU3VWpMSXo5WEYzSmswOFl4dDJBbXhZTkhYY1E=");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  
  let dynamicPrompt = agenticSystemPrompt;
  if (usePdf) {
    dynamicPrompt = `Eres un Generador de Escenarios Agénticos. Ignora los temas precargados. Lee el documento PDF adjunto.
    Extrae las competencias más importantes de este documento específico y genera un escenario de Roleplay inmersivo y de alta presión para evaluar al alumno sobre el contenido de este PDF.
    
    INSTRUCCIONES CLAVE:
    1. Asume una Persona Antagónica o Evaluadora relevante al contenido del PDF.
    2. Asigna un Rol de Defensa al alumno coherente con el PDF.
    3. Plantea un conflicto crítico que el alumno solo pueda resolver justificándose con la teoría del documento.
    4. Emite la primera frase del diálogo de forma retadora. NUNCA rompas el personaje.`;
  }
  
  const promptText = dynamicPrompt + "\n\nResponde ÚNICAMENTE con un JSON válido con la siguiente estructura exacta:\n{\n  \"title\": \"Ej. 🌿 Auditoría GSTC\",\n  \"ai_name\": \"Ej. Auditora Internacional\",\n  \"ai_role\": \"Ej. Evaluando Economía Circular\",\n  \"scenario_context\": \"Breve descripción de 2 líneas explicando el conflicto del escenario que le aparecerá al alumno para que entienda su rol antes de hablar.\",\n  \"first_message\": \"Ej. Como auditora he revisado sus indicadores...\"\n}";
  
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

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });
    
    if (!response.ok) throw new Error("Error en la API de Gemini");
    
    const data = await response.json();
    const resultText = data.candidates[0].content.parts[0].text;
    const scenario = JSON.parse(resultText);
    
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
    console.error(error);
    elements.pillLabel.innerText = "Error generando escenario";
    elements.participantName.innerText = "Error";
    elements.roleLabel.innerText = "Revisa la API Key o el PDF";
    updateOrb('breathing');
  }
}

async function openHistoryModal() {
  document.getElementById('historyModal').style.display = 'flex';
  const content = document.getElementById('historyModalContent');
  content.innerHTML = 'Cargando historial...';
  
  if (!window.db) {
    content.innerHTML = 'Error: Base de datos no conectada.';
    return;
  }
  
  try {
    const snapshot = await db.collection("anonymous_sessions").orderBy('updatedAt', 'desc').limit(20).get();
    if (snapshot.empty) {
      content.innerHTML = 'No hay sesiones registradas.';
      return;
    }
    
    let html = '';
    snapshot.forEach(doc => {
      const data = doc.data();
      const date = data.updatedAt ? data.updatedAt.toDate().toLocaleString('es-MX') : 'Fecha desconocida';
      html += `<div style="background: rgba(255,255,255,0.05); margin-bottom: 1rem; padding: 1rem; border-radius: 8px;">`;
      html += `<div style="color: var(--primary-orange); font-weight: bold; margin-bottom: 0.5rem;">${data.scenario}</div>`;
      html += `<div style="font-size: 0.8rem; color: #94A3B8; margin-bottom: 1rem;">ID: ${doc.id} | Última act: ${date}</div>`;
      
      const history = data.history || [];
      if (history.length > 0) {
        html += `<div style="max-height: 200px; overflow-y: auto; background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 4px;">`;
        history.forEach(msg => {
          const isUser = msg.role === 'user';
          const text = msg.parts[0].text;
          const color = isUser ? '#60A5FA' : '#FFF';
          const sender = isUser ? 'Estudiante' : 'Copiloto';
          html += `<div style="margin-bottom: 0.5rem;"><strong style="color: ${color};">${sender}:</strong> ${text}</div>`;
        });
        html += `</div>`;
      } else {
        html += `<div style="color: #94A3B8; font-style: italic;">Sin mensajes en esta sesión.</div>`;
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
