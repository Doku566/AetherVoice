
import { AetherBrain } from './brain.js';

const micBtn = document.getElementById('mic-btn');
const micIcon = document.getElementById('mic-icon');
const promptInput = document.getElementById('prompt-input');
const chatContainer = document.getElementById('chat-container');
const welcomeMsg = document.getElementById('welcome-message');
const sendBtn = document.getElementById('send-btn');
const attachmentPreview = document.getElementById('attachment-preview');

// --- LIVE MODE VARIABLES ---
let isLiveMode = false;
let audioContext, analyser, dataArray;
const liveOverlay = document.getElementById('live-overlay');
const liveStatus = document.getElementById('live-status');
const liveScreenFeed = document.getElementById('live-screen-feed');

// --- STATE MANAGEMENT ---
let isListening = false;
let isProcessing = false; // "Thinking" state
let isAI_Speaking = false; // "Speaking" state
let recognition;
let firstMessage = true;
let currentAttachment = null;
const brain = new AetherBrain();

// --- SESSION MANAGEMENT ---
let currentSessionId = Date.now().toString();
const STORAGE_KEY = 'AETHERVOICE_SESSIONS';
let sessions = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};

// Ensure current session exists
if (!sessions[currentSessionId]) {
    sessions[currentSessionId] = { messages: [], title: 'New Chat', timestamp: Date.now() };
}

// MDL Loader UI
const modelLoader = document.getElementById('model-loader');
const loadBar = document.getElementById('load-bar');
const loadPercent = document.getElementById('load-percent');
const loadStatus = document.getElementById('load-status');

// --- PERSISTENCE LOGIC ---
function saveChat(role, text) {
    if (!text) return;
    const session = sessions[currentSessionId];
    session.messages.push({ role, text, timestamp: Date.now() });
    
    // Update title if it's the first user message
    if (role === 'user' && session.title === 'New Chat') {
        session.title = text.substring(0, 30);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    updateSidebarHistory();
}

function loadSession(id) {
    if (!sessions[id]) return;
    currentSessionId = id;
    
    // Clear UI
    chatContainer.innerHTML = '';
    welcomeMsg.style.display = 'none';
    firstMessage = false;

    // Render messages
    sessions[id].messages.forEach(msg => {
        if (msg.role === 'user') {
            appendUserBubble(msg.text);
        } else {
            const contentId = 'ai-text-' + Date.now() + Math.random();
            const div = document.createElement('div');
            div.className = "flex gap-4 mb-6";
            div.innerHTML = `
                <div class="w-8 h-8 rounded-full bg-transparent border border-white/10 flex items-center justify-center shrink-0">
                     <i class="fa-solid fa-bolt text-xs text-blue-400 opacity-80"></i>
                </div>
                <div class="text-gray-100 leading-relaxed pt-1 w-full relative group">
                    <div id="${contentId}" class="markdown-body min-h-[20px]"></div> 
                </div>
            `;
            chatContainer.appendChild(div);
            updateChatUI(document.getElementById(contentId), msg.text);
        }
    });
    scrollToBottom();
}

function createNewChat() {
    currentSessionId = Date.now().toString();
    sessions[currentSessionId] = { messages: [], title: 'New Chat', timestamp: Date.now() };
    chatContainer.innerHTML = '';
    welcomeMsg.style.display = 'block';
    firstMessage = true;
    updateSidebarHistory();
}

function updateSidebarHistory() {
    const container = document.getElementById('recent-chats');
    if (!container) return;
    const sessionList = Object.entries(sessions)
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
        .slice(0, 10);

    container.innerHTML = `<h3 class="text-xs font-medium text-gray-500 mb-2 px-2 uppercase tracking-wider">Recent Chats</h3>`;
    
    if (sessionList.length === 0) {
        container.innerHTML += `<div class="px-2 text-xs text-gray-600">No history yet</div>`;
        return;
    }

    sessionList.forEach(([id, session]) => {
        if (session.messages.length === 0 && id !== currentSessionId) return;
        const item = document.createElement('div');
        const isActive = id === currentSessionId;
        item.className = `p-2 rounded-xl text-sm truncate cursor-pointer flex gap-3 items-center transition-all ${isActive ? 'bg-white/10 text-primary' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`;
        item.innerHTML = `<i class="fa-regular fa-message text-xs"></i> <span>${session.title}</span>`;
        item.onclick = () => loadSession(id);
        container.appendChild(item);
    });
}

// Helper Functions
function appendSystemBubble(text) {
    const div = document.createElement('div');
    div.className = "flex justify-center mb-6";
    div.innerHTML = `<span class="text-[10px] font-mono text-primary/50 border border-primary/20 px-2 py-1 rounded bg-black/50">${text}</span>`;
    chatContainer.appendChild(div);
}

function appendLoadingBubble() {
    const id = 'loading-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = "flex gap-4 mb-6";
    div.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-red-500 flex items-center justify-center text-white text-xs font-bold animate-spin-slow">
            <i class="fa-solid fa-circle-nodes"></i>
        </div>
        <div class="mt-2 flex flex-col justify-center">
            <div class="text-xs text-gray-400 font-mono loading-text mb-1">Processing...</div>
            <div class="flex gap-1 animate-pulse">
                <div class="w-1.5 h-1.5 bg-gray-500 rounded-full"></div>
                <div class="w-1.5 h-1.5 bg-gray-500 rounded-full"></div>
                <div class="w-1.5 h-1.5 bg-gray-500 rounded-full"></div>
            </div>
        </div>
    `;
    chatContainer.appendChild(div);
    scrollToBottom();
    return id;
}

function removeLoadingBubble(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

async function simulateReasoningSteps(elementId) {
    const steps = ["Analyzing intent...", "Retrieving context...", "Generating..."];
    const label = document.querySelector(`#${elementId} .loading-text`);
    if (!label) return;
    const delay = isLiveMode ? 50 : 200; // Optimized delays
    for (const step of steps) {
        label.textContent = step;
        await new Promise(r => setTimeout(r, delay));
    }
}

// Init Brain Immediately
(async () => {
    updateSidebarHistory();
    modelLoader.classList.remove('hidden');
    try {
        await brain.init((report) => {
            const pct = Math.round(report.progress * 100);
            loadBar.style.width = pct + '%';
            loadPercent.innerText = pct + '%';
            let statusText = report.text;
            if (statusText.includes("Fetching param cache")) statusText += " (Total: ~4.7 GB - One time only)";
            loadStatus.innerText = statusText;
        });
        modelLoader.classList.add('hidden');
        appendSystemBubble("Neural Engine Online. Mode: WebGPU/CPU Hybrid Ready.");
    } catch (err) {
        loadStatus.innerText = "Error: " + err.message;
        loadStatus.classList.add('text-red-500');
    }
})();

// --- 3D ENGINE VARIABLES ---
let lastFrameTime = 0;
let scene, camera, renderer, sphere, originalPositions, particles;
let isAudioInitialized = false;

function initThreeJS() {
    const container = document.getElementById('scene-container');
    if (!container) return;

    // SCENE
    scene = new THREE.Scene();

    // CAMERA
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // RENDERER (Optimized)
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x for performance
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // AVATAR (OPTIMIZED SPHERE - 32x32 by default)
    const geometry = new THREE.SphereGeometry(2, 32, 32);

    // Save original positions for morphing reference
    originalPositions = geometry.attributes.position.array.slice();

    const material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, // Tinted via code
        metalness: 0.2, // Slightly more metallic for better reflections
        roughness: 0.1,
        transmission: 0.6,
        opacity: 0.9,
        transparent: true,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        side: THREE.DoubleSide
    });

    sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // PARTICLES (Reduced Count)
    const pGeo = new THREE.BufferGeometry();
    const pCount = 75; // Further Optimized
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i++) {
        pPos[i] = (Math.random() - 0.5) * 20;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0x88CCFF, size: 0.05, transparent: true, opacity: 0.7 });
    particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // LIGHTS (Rainbow Setup - SAFETY BRIGHTNESS)
    const ambientLight = new THREE.AmbientLight(0x404040); // Brighter ambient
    scene.add(ambientLight);

    // Primary Glow
    const light1 = new THREE.PointLight(0x00FFFF, 8, 20); // Cyan - Intensity 8
    light1.position.set(2, 2, 2);
    light1.userData = { offset: 0 };
    scene.add(light1);

    // Secondary Glow
    const light2 = new THREE.PointLight(0xFF00FF, 8, 20); // Magenta - Intensity 8
    light2.position.set(-2, -2, 2);
    light2.userData = { offset: 2 };
    scene.add(light2);

    // Tertiary Glow
    const light3 = new THREE.PointLight(0x4285F4, 8, 20); // Blue - Intensity 8
    light3.position.set(0, 2, -2);
    light3.userData = { offset: 4 };
    scene.add(light3);

    // Store lights for animation
    window.sphereLights = [light1, light2, light3];

    // Resize Handler
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// LIVE MODE LOGIC
function startLiveMode() {
    isLiveMode = true;
    liveOverlay.classList.remove('hidden');
    liveOverlay.classList.remove('opacity-0');

    if (recognition) {
        recognition.stop();
        setTimeout(() => {
            // Start listening initially
            recognition.start();
        }, 500);
    }
    initAudioVisualizer();
}

function endLiveMode() {
    isLiveMode = false;
    liveOverlay.classList.add('hidden');
    if (recognition) {
        recognition.stop();
    }
    if (liveScreenFeed.srcObject) {
        liveScreenFeed.srcObject.getTracks().forEach(track => track.stop());
        liveScreenFeed.classList.add('hidden');
    }
    if (scene) {
        // Optional Cleanup if needed to save full GPU
        // scene.clear(); 
    }
}

async function initAudioVisualizer() {
    initThreeJS();
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 512;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        isAudioInitialized = true;
        drawVisualizer(0); // Start the visualizer loop
    } catch (e) {
        console.warn("Visualizer failed init:", e);
    }
}

function drawVisualizer(time) {
    if (!isLiveMode || !renderer || !sphere || document.visibilityState === 'hidden') {
        requestAnimationFrame(drawVisualizer);
        return;
    }

    // 60FPS Cap logic
    if (time - lastFrameTime < 16) {
        requestAnimationFrame(drawVisualizer);
        return;
    }
    lastFrameTime = time;

    let audioFactor = 1.0;
    if (isAudioInitialized && analyser) {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
        audioFactor = 1.0 + (sum / dataArray.length) / 100;
    }

    const positions = sphere.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const ix = i * 3;
        const iy = i * 3 + 1;
        const iz = i * 3 + 2;

        const ox = originalPositions[ix];
        const oy = originalPositions[iy];
        const oz = originalPositions[iz];

        // Senior Reactivity Logic: Wave + Audio Displacement
        const freq = 0.001 * time;
        const wave = Math.sin(ox * 2 + freq) * Math.cos(oy * 2 + freq) * 0.2;
        const displacement = wave * audioFactor;

        positions.array[ix] = ox + (ox / 2) * displacement;
        positions.array[iy] = oy + (oy / 2) * displacement;
        positions.array[iz] = oz + (oz / 2) * displacement;
    }
    positions.needsUpdate = true;

    // Dynamic Rotation & Particle Spin
    sphere.rotation.y += 0.003;
    particles.rotation.y -= 0.001;
    
    // HSL Pulsing (Voice matching)
    let hue;
    if (isAI_Speaking) {
        hue = (210 + Math.sin(time * 0.01) * 20) % 360; // Blue pulse
        sphere.scale.setScalar(1.05 + Math.sin(time * 0.05) * 0.05 * audioFactor);
    } else if (isProcessing) {
        hue = (45 + Math.sin(time * 0.005) * 10) % 360; // Gold thinking
        sphere.scale.setScalar(1.0);
    } else {
        hue = (time * 0.01) % 360; // Rainbow idle
        sphere.scale.setScalar(1.0);
    }
    sphere.material.color.setHSL(hue / 360, 0.7, 0.6);

    renderer.render(scene, camera);
    requestAnimationFrame(drawVisualizer);
}

// --- VOICE & CHAT ---
let voices = [];
function loadVoices() { voices = window.speechSynthesis.getVoices(); }
window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false; // Turn-based
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isListening = true;
        micIcon.className = "fa-solid fa-microphone-lines text-primary animate-pulse";
        if (isLiveMode) {
            liveStatus.innerText = "Listening...";
            liveStatus.className = "absolute bottom-32 text-blue-200/80 text-sm font-medium tracking-widest uppercase animate-pulse";
        }
    };
    recognition.onend = () => {
        isListening = false;
        micIcon.className = "fa-solid fa-microphone text-gray-100";
        // RESTART ONLY IF IDLE (Not processing, Not Speaking) and Mode is Active
        if (isLiveMode && !isProcessing && !isAI_Speaking) {
            recognition.start();
        }
    };
    recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        if (transcript.trim()) {
            promptInput.value = transcript;
            sendMessage();
        }
    };
}

async function toggleMic() {
    if (!recognition) return;
    if (isListening) recognition.stop();
    else { 
        // Assuming initAudio() is a function that sets up audioContext and analyser
        // For now, we'll just start recognition. If initAudio() is needed, it should be defined.
        // await initAudio(); // Start AudioContext on user interaction
        recognition.start(); 
        isListening = true; 
    }
}

async function sendMessage() {
    const text = promptInput.value.trim();
    if (!text && !currentAttachment) return;

    // LIVE MODE: ENTER "THINKING" STATE
    if (isLiveMode) {
        if (recognition) recognition.stop(); // Ensure mic is off
        isProcessing = true;
        liveStatus.innerText = "Thinking...";
        liveStatus.className = "absolute bottom-32 text-yellow-400 text-sm font-bold tracking-widest uppercase animate-bounce";
    }

    if (firstMessage) {
        welcomeMsg.style.display = 'none';
        firstMessage = false;
    }
    // UI Reset
    promptInput.value = '';
    promptInput.style.height = 'auto';
    micBtn.classList.remove('hidden');
    sendBtn.classList.add('hidden');

    const attachmentRef = currentAttachment;
    if (attachmentRef && !isLiveMode) {
        attachmentPreview.innerHTML = '';
        attachmentPreview.classList.add('hidden');
        currentAttachment = null;
    }

    if (!isLiveMode) appendUserBubble(text, attachmentRef);
    saveChat('user', text);

    // AI Container (Verify NO DIAMOND IS HERE)
    const div = document.createElement('div');
    div.className = isLiveMode ? "hidden" : "flex gap-4 mb-6";
    const contentId = 'ai-text-' + Date.now();
    div.innerHTML = `
        <!-- HERE: Replaced star/diamond with aether logo or simple generic brain/star -->
        <div class="w-8 h-8 rounded-full bg-transparent border border-white/10 flex items-center justify-center shrink-0">
             <i class="fa-solid fa-bolt text-xs text-blue-400 opacity-80"></i>
        </div>
        <div class="text-gray-100 leading-relaxed pt-1 w-full relative group">
            <div id="${contentId}" class="markdown-body min-h-[20px]"></div> 
        </div>
    `;
    chatContainer.appendChild(div);
    const textEl = document.getElementById(contentId);
    if (!isLiveMode) scrollToBottom();

    let fullResponse = "";
    let processedInput = text;
    if (attachmentRef && attachmentRef.type === 'screen') {
        processedInput = "[System: User is sharing their screen. Context: " + (isLiveMode ? "Live Feed" : "Snapshot") + "] " + text;
    }

    // Process Response
    const result = await brain.process(processedInput, (token) => {
        fullResponse += token;
        if (!isLiveMode) {
            updateChatUI(textEl, fullResponse);
            scrollToBottom();
        }
    });

    saveChat('ai', fullResponse);

    if (!isLiveMode) {
        updateChatUI(textEl, fullResponse);
        if (window.hljs) textEl.querySelectorAll('pre code').forEach(b => window.hljs.highlightElement(b));
    }

    // LIVE MODE: ENTER "SPEAKING" STATE
    if (isLiveMode) {
        isProcessing = false; // Done thinking
        liveStatus.innerText = "Speaking...";
        liveStatus.className = "absolute bottom-32 text-blue-400 text-sm font-bold tracking-widest uppercase";
        speak(fullResponse, result.lang);
    }
}

// Helper: Parse Markdown + Enrich Multimedia
function updateChatUI(element, markdown) {
    if (!window.marked) {
        element.innerHTML = markdown;
        return;
    }
    let html = window.marked.parse(markdown);

    // ENHANCEMENT: Embed YouTube Videos
    // ENHANCEMENT: Embed YouTube Videos (Links and Images)
    // Robust: Handles markdown links, raw links, and images
    const ytRegex = /(?:<a\s+(?:[^>]*?\s+)?href="([^"]+)"[^>]*>.*?<\/a>|<img\s+(?:[^>]*?\s+)?src="([^"]+)"[^>]*>|(?:\s|^)(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+))/gi;

    html = html.replace(ytRegex, (match, linkUrl, imgUrl, rawUrl) => {
        const url = linkUrl || imgUrl || rawUrl;
        if (!url) return match;

        // Robust Matcher: allow youtube.0com, youtube.mi.com, youtube.co.uk, etc.
        const ytMatch = url.match(/(?:youtube(?:.*?)\/watch\?v=|youtu\.be\/)([\w-]+)/);
        if (ytMatch && ytMatch[1]) {
            const vidId = ytMatch[1];

            // SECURITY: Block common LLM hallucinations/placeholders
            const banList = ['exampleLink', 'example', 'your_id_here', 'VIDEO_ID', 'insert_link'];
            if (banList.includes(vidId)) return match;

            // Extract title if available from link text, otherwise generic
            let title = "YouTube Video";
            if (linkUrl && match.includes('>')) {
                const textMatch = match.match(/>([^<]+)</);
                if (textMatch) title = textMatch[1];
            } else if (imgUrl) {
                const altMatch = match.match(/alt="([^"]*)"/);
                if (altMatch) title = altMatch[1];
            }

            return `
            <div class="my-4 bg-black/40 border border-white/10 rounded-xl overflow-hidden shadow-2xl max-w-md mx-auto group hover:border-white/20 transition-colors">
                <div class="relative w-full aspect-video">
                    <iframe 
                        src="https://www.youtube.com/embed/${vidId}" 
                        title="${title}"
                        class="absolute inset-0 w-full h-full"
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen>
                    </iframe>
                </div>
                <div class="p-3 bg-surface/50 backdrop-blur-sm flex items-center justify-between">
                    <div class="text-sm font-medium text-gray-200 truncate flex-1" title="${title}">
                        <i class="fa-brands fa-youtube text-red-500 mr-2"></i>${title}
                    </div>
                    <a href="https://www.youtube.com/watch?v=${vidId}" target="_blank" class="text-xs text-blue-400 hover:text-blue-300 ml-2">
                        Open <i class="fa-solid fa-external-link-alt ml-1"></i>
                    </a>
                </div>
            </div>`;
        }
        return match;
    });

    element.innerHTML = html;
}

// ... (helpers same as before) ...
function appendUserBubble(text, attachment) {
    const div = document.createElement('div');
    div.className = "flex flex-col items-end mb-6 gap-2";
    let attachmentHTML = '';
    if (attachment) {
        if (attachment.type === 'image') attachmentHTML = `<img src="${attachment.src}" class="max-w-[200px] rounded-lg border border-white/10 mb-2">`;
        else if (attachment.type === 'screen') attachmentHTML = `<div class="bg-surface border border-white/10 rounded-lg p-3 text-sm text-primary flex items-center gap-2 mb-2"><i class="fa-solid fa-desktop"></i> Screen Shared</div>`;
    }
    div.innerHTML = `${attachmentHTML}${text ? `<div class="bg-surface text-gray-100 px-5 py-3 rounded-2xl rounded-tr-sm max-w-[80%] leading-relaxed shadow-lg">${text}</div>` : ''}`;
    chatContainer.appendChild(div);
    scrollToBottom();
}

function scrollToBottom() { chatContainer.scrollTop = chatContainer.scrollHeight; }

async function triggerScreenShare() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const video = document.createElement('video');
        video.srcObject = stream; video.autoplay = true; video.muted = true;
        createAttachmentPreview(video, 'screen');
        currentAttachment = { type: 'screen', media: stream };
        micBtn.classList.add('hidden'); sendBtn.classList.remove('hidden');
    } catch (err) { console.error("Screen Share cancelled: ", err); }
}

async function toggleLiveScreen() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        liveScreenFeed.srcObject = stream; liveScreenFeed.play(); liveScreenFeed.classList.remove('hidden');
        currentAttachment = { type: 'screen', media: stream, isLive: true };
        appendSystemBubble("Live Vision Activated");
    } catch (e) { console.error("Screen Share failed:", e); }
}

function handleFileUpload(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img'); img.src = e.target.result;
            createAttachmentPreview(img, 'image');
            currentAttachment = { type: 'image', src: e.target.result };
            micBtn.classList.add('hidden'); sendBtn.classList.remove('hidden');
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function createAttachmentPreview(element, type) {
    attachmentPreview.innerHTML = ''; attachmentPreview.classList.remove('hidden');
    const container = document.createElement('div');
    container.className = "relative flex-shrink-0";
    element.className = "h-16 rounded-lg border border-white/20 object-cover";
    container.appendChild(element);
    const badge = document.createElement('div');
    badge.className = "absolute -top-1 -right-1 bg-surface rounded-full p-0.5 border border-white/10";
    badge.innerHTML = type === 'screen' ? '<i class="fa-solid fa-desktop text-[10px] text-primary p-1"></i>' : '<i class="fa-regular fa-image text-[10px] text-green-400 p-1"></i>';
    container.appendChild(badge); attachmentPreview.appendChild(container);
}

function speak(text, lang = 'en') {
    window.speechSynthesis.cancel();
    isAI_Speaking = true;
    const utterance = new SpeechSynthesisUtterance(text);
    let outputVoice = null;
    if (lang === 'es') outputVoice = voices.find(v => v.name.includes("Mexico") || v.name.includes("Sabina") || v.lang.includes("es"));
    else outputVoice = voices.find(v => v.name.includes("Google US English") || v.lang.includes("en"));
    if (outputVoice) utterance.voice = outputVoice;
    utterance.rate = 1.05; utterance.pitch = 1.0;

    utterance.onend = () => {
        isAI_Speaking = false;
        if (isLiveMode) {
            recognition.start();
        }
    };

    window.speechSynthesis.speak(utterance);
}

// UI Event Listeners
promptInput.addEventListener('input', () => {
    promptInput.style.height = 'auto'; promptInput.style.height = promptInput.scrollHeight + 'px';
    if (promptInput.value.trim().length > 0) { micBtn.classList.add('hidden'); sendBtn.classList.remove('hidden'); }
    else { micBtn.classList.remove('hidden'); sendBtn.classList.add('hidden'); }
});
promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// Sidebar & Modals
const settingsModal = document.getElementById('settings-modal');
const settingsTrigger = document.getElementById('settings-trigger');
const newChatBtn = document.getElementById('new-chat-btn');

if (settingsTrigger) settingsTrigger.onclick = () => settingsModal.classList.remove('hidden');
if (newChatBtn) newChatBtn.onclick = createNewChat;

// --- DEEP OPTIMIZATION UTILS ---
window.cleanModelCache = async () => {
    if (confirm("This will delete the 4.7GB local model cache. You will need to re-download it to use the GPU/Neural Engine again. Continue?")) {
        await AetherBrain.deleteCache();
        alert("Cache deleted. Reloading...");
        window.location.reload();
    }
};

const perfModeSelect = document.getElementById('perf-mode');
if (perfModeSelect) {
    perfModeSelect.onchange = () => {
        const mode = perfModeSelect.value;
        if (mode === 'power') {
            document.getElementById('scene-container').classList.add('hidden');
            endLiveMode();
        } else {
            document.getElementById('scene-container').classList.remove('hidden');
            if (!renderer) initThreeJS();
            // In a real app we'd recreate the geometry with mode-specific segments
        }
    };
}

// EXPOSE GLOBALS
window.toggleMic = toggleMic;
window.sendMessage = sendMessage;
window.triggerScreenShare = triggerScreenShare;
window.handleFileUpload = handleFileUpload;
window.startLiveMode = startLiveMode;
window.endLiveMode = endLiveMode;
window.toggleLiveScreen = toggleLiveScreen;
