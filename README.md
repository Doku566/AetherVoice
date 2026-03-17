# AetherVoice (WebGPU Experiment)

Estuve probando con `WebLLM` para ver si podía correr modelos tipo Llama-3 directo en el navegador sin pagar servidores. 

La verdad: Se puede, pero pide muchos recursos. Si no tienes GPU dedicada (NVIDIA/AMD), va algo lento porque el navegador no está tan optimizado como una app nativa, pero funciona para experimentar.

Básicamente es un chat local que corre 100% en tu compu, así que es privado.

![Interfaz Principal](screenshots/interface.png)
*Interfaz limpia y moderna.*

### Como se ve funcionando

Aquí grabé una prueba de cómo está jalando todo en tiempo real:

![Full Demo Recording](screenshots/demo.webp)

### Cosas que ya funcionan:
- Audio local: Le puedes hablar y te contesta con voz usando el Speech API del navegador.
- Vision: Si le compartes pantalla, puede ver qué estás haciendo.
- Esfera 3D: Puse una esfera con Three.js que reacciona cuando la IA piensa o habla. Cambia de colores tipo arcoiris.
- YouTube: Si le pides un video, lo busca y lo pone ahí mismo en el chat.
- Búsqueda: Si no sabe algo, usa un script de Python (server.py) para buscar en la red.

### Lo que quiero mejorar (Optimización)
Una de las cosas que me di cuenta es que la IA es pesadísima para el navegador. Mi idea es buscar alguna manera de optimizar las cargas para que no sea tan pesado y se pueda usar en cualquier compu sin que se trabe. Quizás usando modelos más chicos o cargando por partes.

### Retos y problemas
El frontend está hecho con JS puro, no quise usar React porque no quería líos con el build system. 

Me dio problemas la memoria RAM, si recargas mucho la página se llena (Chrome no suelta el modelo rápido). También lo de las búsquedas, Google me bloqueaba si hacía muchas seguidas así que le puse DuckDuckGo como respaldo.

### Como correrlo
Solo ocupas Python para el proxy de búsqueda.

```bash
pip install -r requirements.txt
python server.py
```
Luego abres localhost:8097.
(Importante: la primera vez tarda porque descarga como 4GB del modelo).
