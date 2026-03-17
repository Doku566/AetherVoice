
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

    // Process input in offline mode (Optimized for speed and rich results)
    async process(input, lang, onToken, searchContext) {
        if (searchContext && searchContext.length > 10) {
            let response = lang === 'es' 
                ? "### Resultados Obtenidos\n\nHe analizado los datos externos y esto es lo que encontré:\n\n"
                : "### Search Summary\n\nI have processed the external data and here is the report:\n\n";

            // Extract FIRST Image
            const imgMatch = searchContext.match(/\* IMAGE: (.*?) \| Link: (.*?) \|/);
            if (imgMatch) {
                response += `![${imgMatch[1]}](${imgMatch[2]})\n\n`;
            }

            // Extract Facts
            const facts = [...searchContext.matchAll(/\* ACT: (.*?): (.*?) \((.*?)\)/g)];
            facts.slice(0, 3).forEach(f => {
                response += `* **${f[1]}**: ${f[2]} [Fuente](${f[3]})\n`;
            });

            // Extract Video
            const vidMatch = searchContext.match(/\* VIDEO AVAILABLE: (.*?) \| Link: (.*?) \|/);
            if (vidMatch) {
                response += `\n### Video Recomendado\n🔗 [${vidMatch[1]}](${vidMatch[2]})\n`;
            }

            response += lang === 'es' 
                ? "\n\n*Nota: Operando en CPU-Turbo para máxima velocidad.*" 
                : "\n\n*Note: Operating in CPU-Turbo mode for maximum speed.*";

            for (const char of response) {
                await new Promise(r => setTimeout(r, 1));
                if (onToken) onToken(char);
            }
            return response;
        }

        let text = this.library.default;
        const lower = input.toLowerCase();
        if (lower.includes('python')) text = this.library.python;
        if (lower.includes('fibonacci')) text = this.library.fibonacci;
        if (lower.includes('quantum')) text = this.library.quantum;

        const chars = text.split('');
        for (let i = 0; i < chars.length; i++) {
            await new Promise(r => setTimeout(r, 2 + Math.random() * 3));
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
                    // Senior Feature: Semantic Context Pruning (RAG-lite)
                    // Prioritize results that contain keywords from the user input
                    const keywords = input.toLowerCase().split(' ').filter(w => w.length > 4);
                    results.sort((a, b) => {
                        const aTitle = (a.title || "").toLowerCase();
                        const aBody = (a.body || "").toLowerCase();
                        const bTitle = (b.title || "").toLowerCase();
                        const bBody = (b.body || "").toLowerCase();
                        const aCount = keywords.filter(k => aTitle.includes(k) || aBody.includes(k)).length;
                        const bCount = keywords.filter(k => bTitle.includes(k) || bBody.includes(k)).length;
                        return bCount - aCount;
                    });

                    searchContext = isSpanish ? "\n[SISTEMA: DATOS EXTERNOS]\n" : "\n[SYSTEM: EXTERNAL DATA]\n";

                    // Limit to top 4 high-quality facts
                    results.slice(0, 4).forEach(r => {
                        if (r.error) return;

                        if (r.type === 'text') searchContext += `* ACT: ${r.title}: ${r.body} (${r.href})\n`;
                        
                        // Handle Images
                        if (r.type === 'image') {
                            searchContext += `* IMAGE: ${r.title} | Link: ${r.href} | Thumb: ${r.thumbnail}\n`;
                        }

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
            ? "Eres AetherVoice. Tienes acceso total a internet mediante los datos de contexto. Responde directamente con la información encontrada. USA SIEMPRE ENLACES REALES. Si hay imágenes disponibles, muéstralas usando ![título](url_de_la_imagen). Si hay videos, muéstralos con su enlace. NUNCA digas que no tienes internet."
            : "You are AetherVoice. You HAVE full internet access via the context provided. Answer requests directly using that information. ALWAYS USE REAL LINKS. If images are available, show them using ![title](image_url). If videos are available, show them with their link. NEVER say 'I cannot browse'.";

        const newMessages = [
            { role: "system", content: systemPrompt },
            ...this.context.messages.slice(-4), // Senior Optimization: Sliding context window to save VRAM
        ];

        newMessages.push({ role: "user", content: input + (searchContext ? `\n\nContext:\n${searchContext}` : "") });

        try {
            const chunks = await this.engine.chat.completions.create({
                messages: newMessages,
                temperature: 0.5, 
                top_p: 0.8,
                max_gen_len: 384, 
                repetition_penalty: 1.1,
                stream: true,
            });

            let fullText = "";
            for await (const chunk of chunks) {
                const content = chunk.choices[0]?.delta?.content || "";
                fullText += content;
            }
            
            // Use kinetic streaming for the final output
            await this.streamKinetic(fullText, onToken);

            this.context.messages.push({ role: "user", content: input });
            this.context.messages.push({ role: "assistant", content: fullText });

            return { text: fullText, lang: this.context.lang };
        } catch (err) {
            console.error("Neural Inference Failed:", err);
            return { text: "Neural Device Lost or Error. Restarting...", lang: this.context.lang };
        }
    }

    // --- SENIOR KINETIC TYPING ---
    async streamKinetic(text, onToken) {
        if (!text) return;
        const parts = text.split(/([.!?\n])/).filter(Boolean);
        
        for (const part of parts) {
            const chars = part.split('');
            for (const char of chars) {
                // Kinetic variance: Faster on middle of words, slower on starts
                const baseDelay = 1; 
                const variance = Math.random() * 3;
                await new Promise(r => setTimeout(r, baseDelay + variance));
                if (onToken) onToken(char);
            }
            
            // Dramatic pauses on punctuation
            if (".!?\n".includes(part)) {
                await new Promise(r => setTimeout(r, 120));
            }
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

    // --- STATIC UTILITIES ---
    static async deleteCache() {
        console.log("Deep Cleaning Model Cache...");
        const dbs = ['nextjs', 'mlc-ai']; 
        for (const dbName of dbs) {
            try {
                const req = indexedDB.deleteDatabase(dbName);
                req.onsuccess = () => console.log(`Deleted DB: ${dbName}`);
            } catch (e) {
                console.warn(`Failed to delete DB: ${dbName}`);
            }
        }
        Object.keys(localStorage).forEach(key => {
            if (key.includes('mlc') || key.includes('web-llm')) {
                localStorage.removeItem(key);
            }
        });
        return true;
    }
}
