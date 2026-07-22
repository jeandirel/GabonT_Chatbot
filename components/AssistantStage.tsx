"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Mic, Radio, Send, Sparkles, Square } from "lucide-react";
import MoovLogo from "./MoovLogo";
import { LiveVoiceSession } from "../lib/live-voice";

type Msg = { role: "user" | "assistant"; text: string; mode?: "live" | "voice" | "text" };

const SUGGESTIONS = [
  "Forfaits Heures Liberté",
  "Contacter le 222",
  "Qu’est-ce que Moov Money ?",
  "Couverture réseau",
];

const SILENCE_MS = 3000;

type Props = {
  notify: (s: string) => void;
};

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: {
    results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;
  }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type VoiceMode = "live" | "turn";

/** Expérience assistant Moov — Live bidirectionnel (défaut) + fallback tour Whisper. */
export default function AssistantStage({ notify }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [useWhisper, setUseWhisper] = useState(true);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("turn");
  const [liveActive, setLiveActive] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [status, setStatus] = useState("Connexion à Moov Assist…");
  const chatEnd = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const silenceTimer = useRef<number | null>(null);
  const transcriptBuf = useRef("");
  const sendingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const liveRef = useRef<LiveVoiceSession | null>(null);
  const liveUserPartial = useRef("");
  const liveAssistantPartial = useRef("");
  const textModeRef = useRef(false);
  const apiBaseRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    textModeRef.current = textMode;
  }, [textMode]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const clearSilence = () => {
    if (silenceTimer.current) {
      window.clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
  };

  const stopAudio = () => {
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setSpeaking(false);
  };

  const stopRecording = () => {
    try {
      mediaRecorderRef.current?.state === "recording" && mediaRecorderRef.current.stop();
    } catch {
      /* ignore */
    }
    mediaRecorderRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  };

  const stopLive = useCallback(async () => {
    await liveRef.current?.stop();
    liveRef.current = null;
    setLiveActive(false);
    setListening(false);
    setSpeaking(false);
    setMicLevel(0);
  }, []);

  const startLive = useCallback(async () => {
    if (liveRef.current?.isActive || textModeRef.current) return;
    const session = new LiveVoiceSession(apiBaseRef.current);
    liveRef.current = session;
    setLiveActive(true);
    setListening(true);
    setStatus("Live — connexion…");
    liveUserPartial.current = "";
    liveAssistantPartial.current = "";

    try {
      await session.start("fr", {
        onReady: () => {
          setBackendOnline(true);
          setStatus("Live — micro ouvert, parlez (pas de coupure à 3 s)");
          setListening(true);
        },
        onLevel: (level: number) => {
          setMicLevel(level);
          // Feedback léger tant qu’aucune transcription n’est arrivée.
          if (
            level > 0.02 &&
            !liveUserPartial.current &&
            !liveAssistantPartial.current
          ) {
            setStatus(`Live — j’entends… ${Math.round(level * 100)} %`);
          }
        },
        onSpeaking: (isSpeaking: boolean) => {
          setSpeaking(isSpeaking);
          if (isSpeaking) {
            setStatus("Je parle… (parlez pour m’interrompre)");
          } else if (!textModeRef.current) {
            setStatus("Live — j’écoute…");
            setListening(true);
          }
        },
        onInterrupted: () => {
          setSpeaking(false);
          setListening(true);
          setStatus("Live — j’écoute…");
        },
        onTranscript: (role: "user" | "assistant", text: string) => {
          if (!text.trim()) return;
          if (role === "user") {
            liveUserPartial.current += text;
            setStatus(`Vous : ${liveUserPartial.current.trim().slice(0, 80)}`);
          } else {
            liveAssistantPartial.current += text;
            setStatus(`Moov : ${liveAssistantPartial.current.trim().slice(0, 80)}`);
          }
        },
        onTurnComplete: () => {
          const user = liveUserPartial.current.trim();
          const assistant = liveAssistantPartial.current.trim();
          liveUserPartial.current = "";
          liveAssistantPartial.current = "";
          setMessages((old) => {
            const next = [...old];
            if (user) next.push({ role: "user", text: user, mode: "live" });
            if (assistant) next.push({ role: "assistant", text: assistant, mode: "live" });
            return next;
          });
          setListening(true);
          setStatus("Live — continuez, je vous écoute");
        },
        onError: (msg: string) => {
          notify(msg);
          setBackendOnline(false);
          setLiveActive(false);
          setVoiceMode("turn");
          setStatus("Live indisponible — mode tour vocal");
        },
        onDebug: (msg: string) => {
          if (typeof console !== "undefined") console.debug("[Moov Live]", msg);
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Live indisponible";
      const name = error instanceof DOMException ? error.name : "";
      notify(msg);
      await session.stop();
      liveRef.current = null;
      setLiveActive(false);
      setListening(false);
      // Micro / geste utilisateur : rester en Live, demander un tap.
      if (name === "NotAllowedError" || /permission|micro|NotAllowed/i.test(msg)) {
        setStatus("Touchez la bulle pour autoriser le micro Live");
        return;
      }
      setVoiceMode("turn");
      setStatus("Mode tour — touchez la bulle pour parler");
    }
  }, [notify]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/assistant/status", { cache: "no-store" });
        const data = (await res.json()) as {
          online?: boolean;
          voice_mode?: string;
          api_url?: string;
        };
        if (cancelled) return;
        if (data.api_url) apiBaseRef.current = data.api_url.replace(/\/$/, "");
        setBackendOnline(Boolean(data.online));
        const mode: VoiceMode = data.voice_mode === "live" ? "live" : "turn";
        setVoiceMode(mode);
        // Ne pas auto-démarrer : sans geste utilisateur, AudioContext reste
        // suspendu → aucun audio n’est envoyé (symptôme « je parle, rien »).
        setStatus(
          mode === "live"
            ? "Touchez la bulle pour démarrer le Live (micro)"
            : "Touchez la bulle pour parler",
        );
      } catch {
        if (!cancelled) {
          setBackendOnline(false);
          setVoiceMode("turn");
          setStatus("API hors ligne — mode tour si disponible");
        }
      }
    })();
    return () => {
      cancelled = true;
      void liveRef.current?.stop();
      liveRef.current = null;
      if (silenceTimer.current) window.clearTimeout(silenceTimer.current);
      recognitionRef.current?.stop();
      stopRecording();
      stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playServerAudio = (b64: string, mime: string, fallbackText: string) => {
    if (!b64) {
      speakBrowser(fallbackText);
      return;
    }
    stopAudio();
    const url = `data:${mime || "audio/wav"};base64,${b64}`;
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onplay = () => {
      setSpeaking(true);
      setStatus("Je parle… (touchez pour arrêter)");
    };
    audio.onended = () => {
      setSpeaking(false);
      audioRef.current = null;
      setStatus(textMode ? "Écrivez votre question" : "Touchez la bulle pour parler");
    };
    audio.onerror = () => {
      audioRef.current = null;
      speakBrowser(fallbackText);
    };
    void audio.play().catch(() => speakBrowser(fallbackText));
  };

  const speakBrowser = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    stopAudio();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    u.rate = 1.02;
    u.onstart = () => {
      setSpeaking(true);
      setStatus("Je parle… (touchez pour arrêter)");
    };
    u.onend = () => {
      setSpeaking(false);
      setStatus(textMode ? "Écrivez votre question" : "Touchez la bulle pour parler");
    };
    window.speechSynthesis.speak(u);
  };

  const applyReply = (payload: {
    message?: string;
    spoken?: string;
    conversationId?: string;
    audio_base64?: string;
    audio_mime?: string;
  }) => {
    if (payload.conversationId) setConversationId(payload.conversationId);
    const reply = (payload.message || "").trim();
    const spoken = (payload.spoken || reply).trim();
    setMessages((old) => [...old, { role: "assistant", text: reply, mode: "voice" }]);
    if (!textMode) playServerAudio(payload.audio_base64 || "", payload.audio_mime || "", spoken);
    else setStatus("Écrivez votre question");
  };

  const send = async (promptRaw?: string) => {
    const prompt = (promptRaw ?? message).trim();
    if (!prompt || loading || sendingRef.current) return;

    if (liveActive && liveRef.current?.isActive && !textMode) {
      setMessages((old) => [...old, { role: "user", text: prompt, mode: "live" }]);
      setMessage("");
      liveRef.current.sendText(prompt);
      setStatus("Live — message envoyé…");
      return;
    }

    sendingRef.current = true;
    clearSilence();
    recognitionRef.current?.stop();
    setListening(false);
    transcriptBuf.current = "";
    stopAudio();
    setMessages((old) => [...old, { role: "user", text: prompt, mode: "text" }]);
    setMessage("");
    setLoading(true);
    setStatus("Je contrôle la réponse…");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          conversationId,
          language: "fr",
          includeAudio: !textMode,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Service indisponible.");
      applyReply(payload);
    } catch (error) {
      const err = error instanceof Error ? error.message : "Une erreur est survenue.";
      setMessages((old) => [...old, { role: "assistant", text: err }]);
      setStatus(textMode ? "Écrivez votre question" : "Touchez la bulle pour parler");
    } finally {
      setLoading(false);
      sendingRef.current = false;
    }
  };

  const sendVoiceBlob = async (blob: Blob) => {
    if (loading || sendingRef.current) return;
    sendingRef.current = true;
    stopAudio();
    setLoading(true);
    setStatus("Whisper + contrôle LangGraph…");
    setMessages((old) => [...old, { role: "user", text: "🎤 Message vocal…", mode: "voice" }]);
    try {
      const form = new FormData();
      form.append("file", blob, "audio.webm");
      form.append("language", "fr");
      if (conversationId) form.append("conversationId", conversationId);
      form.append("includeAudio", "true");
      const response = await fetch("/api/voice", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Voice indisponible.");
      if (payload.transcript) {
        setMessages((old) => {
          const copy = [...old];
          const last = copy.length - 1;
          if (last >= 0 && copy[last].role === "user") {
            copy[last] = { role: "user", text: payload.transcript, mode: "voice" };
          }
          return copy;
        });
      }
      applyReply(payload);
    } catch (error) {
      const err = error instanceof Error ? error.message : "Erreur vocale.";
      setMessages((old) => [...old, { role: "assistant", text: err }]);
      setStatus("Touchez la bulle pour parler");
      notify(err);
    } finally {
      setLoading(false);
      sendingRef.current = false;
    }
  };

  const flushVoice = () => {
    const t = transcriptBuf.current.trim();
    transcriptBuf.current = "";
    clearSilence();
    recognitionRef.current?.stop();
    setListening(false);
    if (t) void send(t);
    else {
      setStatus("Je n’ai pas saisi. Retouchez la bulle.");
      notify("Aucune parole détectée.");
    }
  };

  const armSilence = () => {
    clearSilence();
    silenceTimer.current = window.setTimeout(() => {
      if (transcriptBuf.current.trim()) flushVoice();
    }, SILENCE_MS);
  };

  const startWhisperRec = async () => {
    if (loading || speaking) return;
    stopAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        setListening(false);
        if (blob.size > 800) void sendVoiceBlob(blob);
        else {
          setStatus("Trop court. Retouchez la bulle.");
          notify("Enregistrement trop court.");
        }
      };
      recorder.start();
      setListening(true);
      setStatus("J’écoute (Whisper)… retouchez pour envoyer");
    } catch {
      notify("Micro inaccessible — bascule navigateur STT.");
      setUseWhisper(false);
      startBrowserVoice();
    }
  };

  const stopWhisperRec = () => {
    clearSilence();
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    } else {
      setListening(false);
      stopRecording();
    }
  };

  const startBrowserVoice = () => {
    if (loading || speaking) return;
    const BrowserRecognition =
      (window as typeof window & { SpeechRecognition?: new () => Recognition }).SpeechRecognition ||
      (window as typeof window & { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
    if (!BrowserRecognition) {
      notify("Reconnaissance vocale indisponible — passez en mode texte.");
      setTextMode(true);
      setStatus("Écrivez votre question");
      return;
    }
    stopAudio();
    transcriptBuf.current = "";
    const recognition = new BrowserRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "fr-FR";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      let finalChunk = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const row = event.results[i];
        const piece = row?.[0]?.transcript || "";
        if (row.isFinal) finalChunk += piece;
        else interim += piece;
      }
      if (finalChunk.trim()) {
        transcriptBuf.current = `${transcriptBuf.current} ${finalChunk}`.trim();
      }
      if (transcriptBuf.current || interim) {
        setStatus(
          interim
            ? `J’écoute… « ${interim.trim()} »`
            : "J’écoute… pause 3 s ou Envoyer",
        );
        armSilence();
      }
    };
    recognition.onerror = () => {
      setListening(false);
      clearSilence();
      setStatus("Je n’ai pas saisi. Retouchez la bulle.");
      notify("Dictée non reconnue.");
    };
    recognition.onend = () => {
      setListening(false);
      clearSilence();
    };
    setListening(true);
    setStatus("J’écoute… pause 3 s ou Envoyer");
    recognition.start();
  };

  const startVoice = () => {
    if (useWhisper) void startWhisperRec();
    else startBrowserVoice();
  };

  const onOrbTap = () => {
    if (textMode) {
      setTextMode(false);
      if (voiceMode === "live") {
        void startLive();
      } else {
        setStatus("Touchez la bulle pour parler");
      }
      return;
    }

    if (voiceMode === "live") {
      if (liveActive) {
        void stopLive().then(() => {
          setStatus("Live arrêté — touchez pour reprendre");
        });
      } else {
        void startLive();
      }
      return;
    }

    if (listening) {
      if (useWhisper) stopWhisperRec();
      else flushVoice();
      return;
    }
    if (speaking) {
      stopAudio();
      setStatus("Audio arrêté · touchez pour parler");
      return;
    }
    startVoice();
  };

  const orbState = listening
    ? "listening"
    : loading
      ? "thinking"
      : speaking
        ? "speaking"
        : "idle";

  const modeLabel = textMode
    ? "Connecté · mode texte"
    : liveActive
      ? "Live · conversation ouverte"
      : voiceMode === "live"
        ? "Connecté · voix Live"
        : backendOnline
          ? "Connecté · voix tour"
          : "API hors ligne";

  return (
    <div className="assist-stage">
      <div className="assist-brand">
        <MoovLogo height={72} priority plate />
        <p className="assist-brand-tag">Gabon Telecom · Africa</p>
      </div>

      <div className="assist-orb-wrap">
        <span className="assist-orb-halo" aria-hidden />
        <button
          type="button"
          className={`assist-orb moov-orb ${orbState}`}
          onClick={onOrbTap}
          aria-label={
            voiceMode === "live"
              ? liveActive
                ? "Arrêter la conversation Live"
                : "Démarrer la conversation Live"
              : speaking
                ? "Arrêter l’audio"
                : listening
                  ? "Envoyer la dictée"
                  : "Parler à Moov Assist"
          }
        >
          <Sparkles size={40} strokeWidth={1.6} />
        </button>
      </div>

      <h2 className="assist-title">Moov Assist</h2>
      <p className="assist-status" key={status}>
        {status}
      </p>
      <p className="assist-sub">
        {liveActive ? (
          <>
            <Radio size={14} style={{ display: "inline", verticalAlign: "-2px" }} /> Live
            continu (pas de coupure 3 s) · niveau micro {Math.round(micLevel * 100)} %
          </>
        ) : (
          "Vocal Live · touchez la bulle pour ouvrir le micro · texte en option"
        )}
      </p>
      <p className="assist-sub" style={{ opacity: 0.75, marginTop: 4 }}>
        {modeLabel}
      </p>
      {liveActive && (
        <div
          aria-hidden
          style={{
            width: "min(220px, 60%)",
            height: 4,
            margin: "8px auto 0",
            borderRadius: 999,
            background: "rgba(0,0,0,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.min(100, Math.round(micLevel * 100))}%`,
              height: "100%",
              background: "linear-gradient(90deg, #0066b3, #ff6600)",
              transition: "width 80ms linear",
            }}
          />
        </div>
      )}

      <div className="assist-toolbar">
        <button
          type="button"
          className={!textMode ? "active" : ""}
          onClick={() => {
            setTextMode(false);
            if (voiceMode === "live" && !liveActive) void startLive();
            else setStatus(liveActive ? "Live — parlez librement" : "Touchez la bulle pour parler");
          }}
        >
          <Mic size={16} /> Vocal
        </button>
        <button
          type="button"
          className={textMode ? "active" : ""}
          onClick={() => {
            recognitionRef.current?.stop();
            stopRecording();
            clearSilence();
            setListening(false);
            void stopLive();
            setTextMode(true);
            setStatus("Écrivez votre question");
          }}
        >
          <Keyboard size={16} /> Texte
        </button>
        {(speaking || liveActive) && (
          <button
            type="button"
            className="active"
            onClick={() => {
              if (liveActive) void stopLive().then(() => setStatus("Live arrêté"));
              else stopAudio();
            }}
            aria-label="Stop"
          >
            <Square size={14} fill="currentColor" /> Stop
          </button>
        )}
      </div>

      {listening && voiceMode === "turn" && (
        <button
          type="button"
          className="assist-send"
          onClick={() => (useWhisper ? stopWhisperRec() : flushVoice())}
        >
          <Send size={16} /> Envoyer
        </button>
      )}

      <div className="assist-chat" aria-live="polite">
        {messages.length === 0 && (
          <div className="ai-bubble">
            Bonjour, je suis Moov Assist. En Live, parlez naturellement — je vous écoute en continu.
            Posez une question sur les forfaits, Moov Money, le 222 ou nos offres.
          </div>
        )}
        {messages.map((m, i) => (
          <div className={m.role === "user" ? "user-bubble" : "ai-bubble"} key={`${m.role}-${i}`}>
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="ai-bubble typing">
            <i />
            <i />
            <i />
            <span>Moov Assist réfléchit…</span>
          </div>
        )}
        <div ref={chatEnd} />
      </div>

      <div className="suggestions">
        {SUGGESTIONS.map((x) => (
          <button key={x} type="button" onClick={() => void send(x)}>
            {x}
          </button>
        ))}
      </div>

      {textMode && (
        <div className="composer assist-composer">
          <input
            aria-label="Votre message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void send()}
            placeholder="Demandez à Moov Assist…"
          />
          <button type="button" aria-label="Envoyer" disabled={loading} onClick={() => void send()}>
            <Send size={18} />
          </button>
        </div>
      )}

      <p className="assist-cdc">POC Kimba Connect · CDC-MM-BOT-2026-03</p>
    </div>
  );
}
