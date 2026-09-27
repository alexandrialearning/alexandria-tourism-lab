const state = {
  currentScenario: 'mentor',
  isSpeaking: false,
  isRecording: false,
  sidebarOpen: true,
  callDurationSeconds: 0,
  timerInterval: null,
  currentProject: null,
  customVoiceId: 'sDh3eviBhiuHKi0MjTNq',
  ttsApiKey: 'sk_4197546279e7106e0b4d72bfa7f870dd1316bd4e71fbd682'
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

async function startSimulation() {
  document.getElementById('startOverlay').style.display = 'none';
  startCallTimer();
  
  elements.participantName.innerText = "Alex (Copiloto Alexandr.ia)";
  elements.roleLabel.innerText = "Tutor Pedagógico";
  
  const intro = "¡Hola! Bienvenido a tu sala de videollamada interactiva. Soy tu copiloto en Alexandr.ia Tourism Lab. ¿Qué proyecto o simulación quieres trabajar hoy?";
  addTranscriptMsg('Alex (Copiloto)', intro);
  await speakCaption('Alex', intro);
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
  if (state.isRecording) {
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
    elements.participantName.innerText = 'Alex (Copiloto Alexandr.ia)';
    elements.roleLabel.innerText = 'Tutor Pedagógico';
    const msg = '¡De vuelta a nuestro espacio de tutoría socrática! ¿Revisamos tu borrador de proyecto o tienes alguna duda legal?';
    addTranscriptMsg('Alex (Mentor)', msg);
    speakCaption('Alex', msg);
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

function generateResponse(userText) {
  const textLower = userText.toLowerCase();
  let reply = 'Excelente planteamiento. ¿Cómo garantiza tu propuesta que la derrama económica se quede en la comunidad local?';
  
  if (state.currentScenario === 'mentor' && (textLower.includes('capacidad de carga') || textLower.includes('sendero'))) {
    reply = 'Para calcular la capacidad de carga física, debes multiplicar el área del sendero por la densidad permitida de visitantes y ajustar por factores ecológicos. ¿Qué área tiene tu ruta?';
  } else if (state.currentScenario === 'overbooking') {
    reply = '¡Pagué mi reservación hace 3 meses! Si no me trasladan inmediatamente a un hotel equivalente, llamaré a la Procuraduría del Consumidor.';
  } else if (state.currentScenario === 'community') {
    reply = 'Queremos ver una propuesta formal firmada donde el 30% de los guías de la ruta sean miembros de nuestra asamblea ejidal.';
  } else if (state.currentScenario === 'investor') {
    reply = 'Sus proyecciones de ocupación en temporada baja son arriesgadas. Ajuste la TIR al 18% y volveremos a negociar.';
  }
  
  addTranscriptMsg(state.currentScenario === 'mentor' ? 'Alex (Mentor)' : 'Simulador', reply);
  speakCaption(state.currentScenario === 'mentor' ? 'Alex' : 'Simulador', reply);
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

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    state.currentProject = file.name;
    document.getElementById('projectName').innerText = `📄 ${file.name} (Indexado en RAG)`;
    document.getElementById('projectInfo').style.display = 'block';
    
    // Read file as Base64 for Gemini
    const reader = new FileReader();
    reader.onload = (event) => {
      // Remover el prefijo 'data:application/pdf;base64,'
      state.currentFileBase64 = event.target.result.split(',')[1];
    };
    reader.readAsDataURL(file);
  }
}

function askLaw(lawTitle) {
  switchSidebarTab('transcript');
  sendPrompt(`¿Qué establece la regulación sobre "${lawTitle}" para proyectos turísticos?`);
}

function resetCall() {
  if (confirm('¿Deseas reiniciar la sesión de videollamada?')) {
    state.callDurationSeconds = 0;
    elements.transcriptTimeline.innerHTML = '';
    selectScenario('mentor');
    const msg = "¡Hola! Bienvenido a tu sala de videollamada interactiva. Soy tu copiloto en Alexandr.ia Tourism Lab. ¿Qué proyecto o simulación quieres trabajar hoy?";
    addTranscriptMsg('Alex (Copiloto)', msg);
    speakCaption('Alex', msg);
  }
}

// -----------------------------------------------------------------
// Agentic Scenario Generator (Syllabus based)
// -----------------------------------------------------------------
const agenticSystemPrompt = `
Eres un Generador de Escenarios Agénticos para 'Alexandr.ia Tourism Lab'.
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

async function triggerAgenticGenerator() {
  elements.scenarioDropdown.classList.remove('show');
  state.currentScenario = 'agentic';
  elements.videoBg.className = 'video-bg theme-investor'; // Tema dinámico oscuro
  
  elements.pillLabel.innerText = 'Generando escenario aleatorio...';
  elements.participantName.innerText = 'Gemini Inventando Rol...';
  elements.roleLabel.innerText = 'Consultando Temarios';
  
  updateOrb('working');
  
  let GEMINI_API_KEY = localStorage.getItem('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    GEMINI_API_KEY = prompt("Para iniciar la simulación, ingresa tu API Key de Gemini:");
    if (GEMINI_API_KEY) {
      localStorage.setItem('GEMINI_API_KEY', GEMINI_API_KEY);
    } else {
      updateOrb('breathing');
      return;
    }
  }
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const promptText = agenticSystemPrompt + "\n\nResponde ÚNICAMENTE con un JSON válido con la siguiente estructura exacta:\n{\n  \"title\": \"Ej. 🌿 Auditoría GSTC\",\n  \"ai_name\": \"Ej. Auditora Internacional\",\n  \"ai_role\": \"Ej. Evaluando Economía Circular\",\n  \"first_message\": \"Ej. Como auditora he revisado sus indicadores...\"\n}";
  
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: promptText }]
        }],
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
    
    addTranscriptMsg(scenario.ai_name, scenario.first_message);
    speakCaption(scenario.ai_name, scenario.first_message);
    
  } catch (error) {
    console.error(error);
    elements.pillLabel.innerText = "Error generando escenario";
    elements.participantName.innerText = "Error";
    elements.roleLabel.innerText = "Revisa la API Key";
    updateOrb('breathing');
  }
}
