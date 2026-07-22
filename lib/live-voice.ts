/** Client navigateur → FastAPI `/ws/live` (PCM bidirectionnel Gemini Live). */

export type LiveTranscriptRole = "user" | "assistant";

export type LiveVoiceHandlers = {
  onReady?: (info: { model?: string }) => void;
  onLevel?: (level: number) => void;
  onTranscript?: (role: LiveTranscriptRole, text: string) => void;
  onTurnComplete?: () => void;
  onSpeaking?: (speaking: boolean) => void;
  onInterrupted?: () => void;
  onError?: (message: string) => void;
  onDebug?: (message: string) => void;
};

function moovWsOrigin(): string {
  const http = (
    process.env.NEXT_PUBLIC_MOOV_API_URL ||
    process.env.NEXT_PUBLIC_MOOV_WS_ORIGIN ||
    "http://127.0.0.1:8020"
  ).replace(/\/$/, "");
  if (http.startsWith("ws")) return http;
  return http.replace(/^http/, "ws");
}

function floatToPcm16Base64(input: Float32Array): string {
  const buf = new ArrayBuffer(input.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]!));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x2000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}

/** Downsample linéaire vers 16 kHz (meilleure intelligibilité que le décimation naïve). */
function downsampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === 16000) return input;
  const ratio = inputRate / 16000;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const src = i * ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = src - i0;
    out[i] = (input[i0] ?? 0) * (1 - frac) + (input[i1] ?? 0) * frac;
  }
  return out;
}

function peakLevel(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]!);
    if (a > peak) peak = a;
  }
  return Math.min(1, peak);
}

function base64ToInt16(b64: string): Int16Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
}

class PcmPlayer {
  private ctx: AudioContext | null = null;
  private nextTime = 0;
  private sources: AudioBufferSourceNode[] = [];

  private ensureCtx(sampleRate: number): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext({ sampleRate });
      this.nextTime = 0;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  play(pcm: Int16Array, sampleRate: number) {
    if (!pcm.length) return;
    const ctx = this.ensureCtx(sampleRate);
    const f32 = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      f32[i] = (pcm[i] ?? 0) / 32768;
    }
    const buffer = ctx.createBuffer(1, f32.length, sampleRate);
    buffer.copyToChannel(f32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const start = Math.max(ctx.currentTime + 0.02, this.nextTime);
    src.start(start);
    this.nextTime = start + buffer.duration;
    this.sources.push(src);
    src.onended = () => {
      this.sources = this.sources.filter((s) => s !== src);
    };
  }

  interrupt() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* ignore */
      }
    }
    this.sources = [];
    if (this.ctx) this.nextTime = this.ctx.currentTime;
  }

  async dispose() {
    this.interrupt();
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        /* ignore */
      }
      this.ctx = null;
    }
  }
}

export class LiveVoiceSession {
  private ws: WebSocket | null = null;
  private micCtx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;
  private player = new PcmPlayer();
  private active = false;
  private assistantSpeaking = false;
  private chunksSent = 0;
  private generation = 0;

  get isActive() {
    return this.active;
  }

  get audioChunksSent() {
    return this.chunksSent;
  }

  async start(language: "fr" | "en", handlers: LiveVoiceHandlers = {}) {
    await this.stop();
    const gen = ++this.generation;
    this.active = true;
    this.assistantSpeaking = false;
    this.chunksSent = 0;

    const url = `${moovWsOrigin()}/ws/live?language=${language}`;
    handlers.onDebug?.(`WS → ${url}`);
    const ws = new WebSocket(url);
    this.ws = ws;

    const ready = new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error("Connexion Live timeout (Gemini / API)")),
        15000,
      );
      ws.onopen = () => {
        if (gen !== this.generation) return;
        ws.send(JSON.stringify({ type: "start", language }));
      };
      ws.onmessage = (ev) => {
        if (gen !== this.generation) return;
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
        } catch {
          return;
        }
        const type = String(msg.type || "");
        if (type === "ready" || type === "setup_complete") {
          window.clearTimeout(timer);
          handlers.onReady?.({ model: typeof msg.model === "string" ? msg.model : undefined });
          // Ne résoudre qu'une fois (ready suffit pour démarrer le micro).
          if (type === "ready") resolve();
          return;
        }
        if (type === "audio" && typeof msg.data === "string") {
          let rate = 24000;
          const mime = typeof msg.mime === "string" ? msg.mime : "";
          const m = /rate=(\d+)/.exec(mime);
          if (m) rate = Number(m[1]) || 24000;
          this.assistantSpeaking = true;
          handlers.onSpeaking?.(true);
          this.player.play(base64ToInt16(msg.data), rate);
          return;
        }
        if (type === "interrupted") {
          this.assistantSpeaking = false;
          this.player.interrupt();
          handlers.onSpeaking?.(false);
          handlers.onInterrupted?.();
          return;
        }
        if (type === "transcript") {
          const role = msg.role === "user" ? "user" : "assistant";
          const text = typeof msg.text === "string" ? msg.text : "";
          if (text) handlers.onTranscript?.(role, text);
          return;
        }
        if (type === "turn_complete") {
          this.assistantSpeaking = false;
          handlers.onSpeaking?.(false);
          handlers.onTurnComplete?.();
          return;
        }
        if (type === "error") {
          window.clearTimeout(timer);
          const message = typeof msg.message === "string" ? msg.message : "Live error";
          handlers.onError?.(message);
          reject(new Error(message));
        }
      };
      ws.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("WebSocket Live erreur — API sur :8020 ?"));
      };
      ws.onclose = () => {
        if (gen === this.generation) this.active = false;
      };
    });

    try {
      await ready;
    } catch (err) {
      await this.stop();
      throw err;
    }
    if (gen !== this.generation) return;

    // Doit être appelé depuis un geste utilisateur (tap bulle) pour débloquer AudioContext.
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    if (gen !== this.generation) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;

    const micCtx = new AudioContext({ sampleRate: 48000 });
    this.micCtx = micCtx;
    // Critique : sans resume() après geste, aucun chunk n’est produit.
    if (micCtx.state === "suspended") {
      await micCtx.resume();
    }
    handlers.onDebug?.(
      `Micro OK · AudioContext ${micCtx.state} · ${micCtx.sampleRate} Hz`,
    );

    const source = micCtx.createMediaStreamSource(stream);
    const processor = micCtx.createScriptProcessor(4096, 1, 1);
    this.processor = processor;

    // Pas de gate local : Gemini Live fait le VAD serveur.
    // Un gate trop haut (ex. 0.055) bloquait la parole faible → silence côté API.
    processor.onaudioprocess = (event) => {
      if (gen !== this.generation) return;
      if (!this.active || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);
      const peak = peakLevel(input);
      handlers.onLevel?.(peak);

      const pcm = downsampleTo16k(input, micCtx.sampleRate);
      if (!pcm.length) return;
      const data = floatToPcm16Base64(pcm);
      this.ws.send(
        JSON.stringify({
          type: "audio",
          mime: "audio/pcm;rate=16000",
          data,
        }),
      );
      this.chunksSent += 1;
      if (this.chunksSent === 1 || this.chunksSent % 40 === 0) {
        handlers.onDebug?.(
          `Audio envoyé ×${this.chunksSent} (niveau ${Math.round(peak * 100)} %)`,
        );
      }
    };

    const mute = micCtx.createGain();
    mute.gain.value = 0;
    source.connect(processor);
    processor.connect(mute);
    mute.connect(micCtx.destination);
  }

  sendText(text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "text", text }));
  }

  async stop() {
    this.generation += 1;
    this.active = false;
    this.assistantSpeaking = false;
    try {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "end" }));
      }
    } catch {
      /* ignore */
    }
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;

    try {
      this.processor?.disconnect();
    } catch {
      /* ignore */
    }
    this.processor = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.micCtx) {
      try {
        await this.micCtx.close();
      } catch {
        /* ignore */
      }
      this.micCtx = null;
    }
    await this.player.dispose();
  }
}

export function getLiveWsOrigin(): string {
  return moovWsOrigin();
}
