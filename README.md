# AetherVoice: Una Experiencia de IA con WebGPU

¡Hola! Este es mi proyecto para probar `WebLLM`. Quería ver qué tan lejos se puede llegar corriendo modelos de lenguaje potentes (como Llama-3 o Phi-3.5) directamente en el navegador, sin depender de servidores externos. 

El resultado es una IA que vive totalmente en tu computadora. Esto significa que todo lo que hablas es 100% privado, aunque, eso sí, ¡necesitas una buena tarjeta de video (GPU) para que vuele! El navegador todavía tiene sus límites comparado con una aplicación nativa, pero es emocionante ver lo que ya podemos hacer.

![Interfaz Principal](screenshots/interface.png)
*Diseño limpio con efectos de transparencia y desenfoque (Glassmorphism).*

### ¿Qué funciones he implementado?

Me propuse ir un paso más allá de un simple chat y he logrado integrar varias cosas que me parecen geniales:

- **Efecto de Voz en Tiempo Real (FFT)**: He conectado el análisis de audio del navegador con la esfera 3D. Ahora, la "nebulosa" reacciona visualmente al ritmo de tu voz y a las respuestas de la IA. No es solo una animación, es una reacción real al sonido.
- **Búsqueda Inteligente (RAG-lite)**: Si le preguntas algo sobre noticias o temas actuales, el sistema busca en internet, selecciona la información más importante y se la enseña a la IA. Así evitamos que se invente cosas y ahorramos memoria al mismo tiempo.
- **Escritura Natural**: He programado un motor que controla el ritmo de escritura. La IA hace pausas en los puntos y acelera en las frases largas, para que la interacción se sienta más humana y menos robótica.
- **Optimización de Memoria**: He incluido una herramienta para limpiar la memoria caché del modelo. Esto ayuda a que el navegador no se sature después de usarlo mucho tiempo.

### Algunos retos que estoy resolviendo

Trabajar con IA en el navegador es un desafío constante:
- **El peso del modelo**: Los archivos de la IA suelen ocupar unos 4GB. La primera vez tarda un poco en descargar, pero luego ya se quedan en tu equipo.
- **Velocidad de carga**: A veces la IA tarda unos segundos en empezar a responder mientras procesa la búsqueda. He añadido estados de "Sintetizando" y "Generando" para que siempre sepas qué está pasando.

### Cómo probar el proyecto

Para usar la función de búsqueda, necesitas tener Python instalado para ejecutar un pequeño servidor que sirve de puente.

1.  **Instala los requisitos**:
    ```bash
    pip install -r requirements.txt
    python server.py
    ```
2.  **Abre la aplicación**:
    Entra en `http://localhost:8097`. Recuerda usar Chrome o Edge (que tengan soporte para WebGPU).

¡Sigo trabajando para que el sistema sea cada vez más rápido y consuma menos recursos!
