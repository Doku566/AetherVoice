
import { CreateMLCEngine } from "https://esm.run/@mlc-ai/web-llm";

// --- Offline/Compatibility Mode ---
class OfflineSystem {
    constructor() {
        this.library = {
            default: "I'm running in Compatibility Mode (CPU). Connect a GPU to activate Neural Engine.",
            python: "Here is a Python example:\n```python\ndef hello_world():\n    print('Hello AetherVoice!')\n    return True\n```",
            fibonacci: "Here is the Fibonacci sequence in Python:\n```python\ndef fib(n):\n    a, b = 0, 1\n    while a < n:\n        print(a, end=' ')\n        a, b = b, a+b\n    print()\n```",
            quantum: "**Quantum Computing** utilizes qubits to perform superpositions. Unlike classical bits (0 or 1), a qubit can be both state |0⟩ and |1⟩ simultaneously."
        };
    }

    // Process input in offline mode
    async process(input, lang, onToken, searchContext) {
        // Check for injected context first
        if (searchContext && searchContext.length > 0) {
            // Video extraction logic
            const videoMatch = searchContext.match(/VIDEO AVAILABLE: (.*?) \| Link: (.*?) \|/);
            if (videoMatch) {
                const title = videoMatch[1];
                const link = videoMatch[2];
                const response = lang === 'es'
                    ? `He encontrado este video para ti:\n\n${title}\n${link}`
                    : `I found this video for you:\n\n${title}\n${link}`;

                // Stream response
                for (const char of response) {
                    await new Promise(r => setTimeout(r, 5));
                    if (onToken) onToken(char);
                }
                return response;
            }
        }

        let text = this.library.default;
        const lower = input.toLowerCase();
        if (lower.includes('python')) text = this.library.python;
        if (lower.includes('fibonacci')) text = this.library.fibonacci;
        if (lower.includes('quantum')) text = this.library.quantum;

        const chars = text.split('');
        for (let i = 0; i < chars.length; i++) {
            await new Promise(r => setTimeout(r, 10 + Math.random() * 20));
            if (onToken) onToken(chars[i]);
        }
        return text;
    }
}

export class AetherBrain {
    constructor() {
        this.engine = null;
        // Model Configuration (Phi-3.5)
        this.modelId = "Phi-3.5-mini-instruct-q4f16_1-MLC";
        this.loaded = false;
        this.context = { lang: 'en', messages: [] };
        this.offline = new OfflineSystem();
        this.useBackup = false;
    }

    async init(progressCallback) {
        if (this.loaded) return;

        try {
            console.log("Initializing Engine...");
            if (!navigator.gpu) throw new Error("WebGPU not supported (Headless/Mobile).");

            this.engine = await CreateMLCEngine(
                this.modelId,
                { initProgressCallback: progressCallback }
            );
            this.loaded = true;
            console.log("Engine Ready.");
        } catch (error) {
            console.warn("GPU Initialization Failed, switching to CPU fallback:", error);
            this.useBackup = true;
            this.loaded = true;
            progressCallback({ progress: 1, text: "Standard Mode Active (CPU)." });
        }
    }

    async process(input, onToken) {
        if (!this.loaded && !this.useBackup) await this.init(() => { });

        const isSpanish = /[¿¡áéíóúñ]|hola|como|que/.test(input.toLowerCase());
        this.context.lang = isSpanish ? 'es' : 'en';

        // Search Integration
        let searchContext = "";
        // Triggers for external data
        const searchTriggers = [/who is/i, /what is/i, /latest/i, /current/i, /price/i, /news/i, /search for/i, /show me/i, /video/i, /tutorial/i, /how to/i, /guide/i, /buscar/i, /precio/i, /noticias/i, /como hacer/i];
        const shouldSearch = searchTriggers.some(rx => rx.test(input));

        // Video intent detection
        const videoIntent = /video|tutorial|watch|guide|how to|como hacer|ver|guia/i.test(input);

        if (shouldSearch) {
            if (onToken) onToken(isSpanish ? "🔍 *Buscando...*\n\n" : "🔍 *Searching...*\n\n");
            try {
                const results = await this.searchWeb(input);
                if (results && results.length > 0) {
                    searchContext = isSpanish ? "\n[SISTEMA: DATOS EXTERNOS]\n" : "\n[SYSTEM: EXTERNAL DATA]\n";

                    results.forEach(r => {
                        if (r.error) return;

                        if (r.type === 'text') searchContext += `* ACT: ${r.title}: ${r.body} (${r.href})\n`;

                        // Handle Video Links
                        const isYouTube = r.href && (r.href.includes('youtube.com') || r.href.includes('youtu.be'));
                        if (videoIntent && (r.type === 'video' || isYouTube)) {
                            searchContext += `* VIDEO AVAILABLE: ${r.title} | Link: ${r.href} | Desc: ${r.description || r.body}\n`;
                        }
                    });

                    searchContext += isSpanish
                        ? "\n[INSTRUCCIÓN: Usa los datos proporcionados para responder.]\n"
                        : "\n[INSTRUCTION: Use the provided data to answer.]\n";
                } else {
                    if (onToken) onToken("(No results found)\n");
                }
            } catch (e) {
                console.warn("Search failed:", e);
            }
        }

        if (this.useBackup || !this.loaded) {
            const text = await this.offline.process(input, this.context.lang, onToken, searchContext);
            return { text, lang: this.context.lang };
        }

        // System Prompt Configuration
        const systemPrompt = isSpanish
            ? "Eres AetherVoice. Tienes acceso total a internet mediante los datos de contexto. Responde directamente con la información encontrada. Nunca digas 'soy una IA sin internet'. USA SOLO ENLACES REALES."
            : "You are AetherVoice. You HAVE full internet access via the context provided. Answer requests directly using that information. NEVER say 'I cannot browse'. USE ONLY REAL LINKS.";

        const newMessages = [
            { role: "system", content: systemPrompt },
            ...this.context.messages.slice(-4), // Shorter context for speed
            { role: "user", content: searchContext + input }
        ];

        try {
            const chunks = await this.engine.chat.completions.create({
                messages: newMessages,
                temperature: 0.6,
                top_p: 0.9,
                stream: true,
            });

            let fullText = "";
            for await (const chunk of chunks) {
                const delta = chunk.choices[0]?.delta?.content || "";
                if (delta) {
                    fullText += delta;
                    if (onToken) onToken(delta);
                }
            }

            this.context.messages.push({ role: "user", content: input });
            this.context.messages.push({ role: "assistant", content: fullText });

            return {
                text: fullText,
                lang: this.context.lang
            };
        } catch (err) {
            console.error("Neural Inference Failed:", err);
            this.useBackup = true;
            const text = await this.offline.process(input, this.context.lang, onToken, searchContext);
            return { text, lang: this.context.lang };
        }
    }

    async searchWeb(query) {
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            return [];
        }
    }
}
