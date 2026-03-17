
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

    async process(input, lang, onToken, searchContext) {
        if (searchContext && searchContext.length > 10) {
            let response = lang === 'es' 
                ? "### Resultados Obtenidos\n\nHe analizado los datos externos y esto es lo que encontré:\n\n"
                : "### Search Summary\n\nI have processed the external data and here is the report:\n\n";

            const imgMatch = searchContext.match(/\* IMAGE: (.*?) \| Link: (.*?) \|/);
            if (imgMatch) response += `![${imgMatch[1]}](${imgMatch[2]})\n\n`;

            const facts = [...searchContext.matchAll(/\* ACT: (.*?): (.*?) \((.*?)\)/g)];
            facts.slice(0, 3).forEach(f => {
                response += `* **${f[1]}**: ${f[2]} [Fuente](${f[3]})\n`;
            });

            const vidMatch = searchContext.match(/\* VIDEO AVAILABLE: (.*?) \| Link: (.*?) \|/);
            if (vidMatch) response += `\n### Video Recomendado\n🔗 [${vidMatch[1]}](${vidMatch[2]})\n`;

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
            await new Promise(r => setTimeout(r, 2));
            if (onToken) onToken(chars[i]);
        }
        return text;
    }
}

export class AetherBrain {
    constructor() {
        this.engine = null;
        this.modelId = "Phi-3.5-mini-instruct-q4f16_1-MLC";
        this.loaded = false;
        this.context = { lang: 'en', messages: [] };
        this.offline = new OfflineSystem();
        this.useBackup = false;
    }

    async init(progressCallback) {
        if (this.loaded) return;
        try {
            if (!navigator.gpu) throw new Error("No GPU.");
            this.engine = await CreateMLCEngine(this.modelId, { initProgressCallback: progressCallback });
            this.loaded = true;
        } catch (error) {
            console.warn("Fallback to CPU:", error);
            this.useBackup = true;
            this.loaded = true;
            if (progressCallback) progressCallback({ progress: 1, text: "Standard Mode Active (CPU)." });
        }
    }

    async process(input, onToken) {
        if (!this.loaded && !this.useBackup) await this.init(() => { });

        const isSpanish = /[¿¡áéíóúñ]|hola|como|que/.test(input.toLowerCase());
        this.context.lang = isSpanish ? 'es' : 'en';

        let searchContext = "";
        const searchTriggers = [/who is/i, /what is/i, /latest/i, /current/i, /price/i, /news/i, /search for/i, /show me/i, /video/i, /tutorial/i, /how to/i, /guide/i, /buscar/i, /precio/i, /noticias/i, /como hacer/i];
        const shouldSearch = searchTriggers.some(rx => rx.test(input));
        const videoIntent = /video|tutorial|watch|guide|how to|como hacer|ver|guia/i.test(input);

        if (shouldSearch) {
            if (onToken) onToken(isSpanish ? "🔍 *Buscando en la red...*\n\n" : "🔍 *Browsing the web...*\n\n");
            try {
                const results = await this.searchWeb(input);
                if (results && results.length > 0) {
                    const keywords = input.toLowerCase().split(' ').filter(w => w.length > 4);
                    results.sort((a, b) => {
                        const aScore = keywords.filter(k => (a.title + a.body).toLowerCase().includes(k)).length;
                        const bScore = keywords.filter(k => (b.title + b.body).toLowerCase().includes(k)).length;
                        return bScore - aScore;
                    });

                    searchContext = isSpanish ? "\n[SISTEMA: DATOS EXTERNOS]\n" : "\n[SYSTEM: EXTERNAL DATA]\n";
                    results.slice(0, 4).forEach(r => {
                        if (r.error) return;
                        if (r.type === 'text') searchContext += `* ACT: ${r.title}: ${r.body} (${r.href})\n`;
                        if (r.type === 'image') searchContext += `* IMAGE: ${r.title} | Link: ${r.href} | Thumb: ${r.thumbnail}\n`;
                        const isYouTube = r.href && (r.href.includes('youtube.com') || r.href.includes('youtu.be'));
                        if (videoIntent && (r.type === 'video' || isYouTube)) {
                            searchContext += `* VIDEO AVAILABLE: ${r.title} | Link: ${r.href} | Desc: ${r.description || r.body}\n`;
                        }
                    });

                    searchContext += isSpanish ? "\n[INSTRUCCIÓN: Responde usando estos datos.]\n" : "\n[INSTRUCTION: Answer using this data.]\n";
                }
            } catch (e) { console.warn("Search failed:", e); }
        }

        if (this.useBackup || !this.loaded) {
            const text = await this.offline.process(input, this.context.lang, onToken, searchContext);
            return { text, lang: this.context.lang };
        }

        const systemPrompt = isSpanish
            ? "Eres AetherVoice. Responde directamente con la información encontrada. USA ENLACES REALES. Si hay imágenes: ![título](url). Si hay videos: [Título](enlace)."
            : "You are AetherVoice. Answer directly using provided information. ALWAYS USE REAL LINKS.";

        if (onToken) onToken(isSpanish ? "_🧠 Sintetizando..._\n\n" : "_🧠 Synthesizing..._\n\n");

        try {
            const chunks = await this.engine.chat.completions.create({
                messages: [{ role: "system", content: systemPrompt }, ...this.context.messages.slice(-4), { role: "user", content: input + (searchContext ? `\n\nContext:\n${searchContext}` : "") }],
                temperature: 0.6, top_p: 0.9, max_gen_len: 448, repetition_penalty: 1.1, stream: true,
            });

            if (onToken) onToken(isSpanish ? "_✨ Generando..._\n\n" : "_✨ Generating..._\n\n");

            let fullText = "", chunkBuffer = "";
            for await (const chunk of chunks) {
                const content = chunk.choices[0]?.delta?.content || "";
                if (content) {
                    fullText += content; chunkBuffer += content;
                    if (chunkBuffer.length > 5 || /[.!?\n]/.test(content)) {
                        await this.streamKinetic(chunkBuffer, onToken);
                        chunkBuffer = "";
                    }
                }
            }
            if (chunkBuffer) await this.streamKinetic(chunkBuffer, onToken);

            this.context.messages.push({ role: "user", content: input });
            this.context.messages.push({ role: "assistant", content: fullText });
            return { text: fullText, lang: this.context.lang };
        } catch (err) {
            console.error("Neural Failure:", err);
            this.useBackup = true;
            return await this.offline.process(input, this.context.lang, onToken, searchContext);
        }
    }

    async streamKinetic(text, onToken) {
        if (!text) return;
        const parts = text.split(/([.!?\n])/).filter(Boolean);
        for (const part of parts) {
            for (const char of part) {
                await new Promise(r => setTimeout(r, 1 + Math.random() * 2));
                if (onToken) onToken(char);
            }
            if (".!?\n".includes(part)) await new Promise(r => setTimeout(r, 100));
        }
    }

    async searchWeb(query) {
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            return res.ok ? await res.json() : [];
        } catch (e) { return []; }
    }

    static async deleteCache() {
        const dbs = ['nextjs', 'mlc-ai']; 
        for (const dbName of dbs) indexedDB.deleteDatabase(dbName);
        Object.keys(localStorage).forEach(key => {
            if (key.includes('mlc') || key.includes('web-llm')) localStorage.removeItem(key);
        });
        return true;
    }
}
