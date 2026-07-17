"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Bot, ChartNoAxesCombined, ChevronRight, Gift, Headphones, Home, IdCard, LayoutDashboard, LockKeyhole, LogIn, Menu, Send, ShieldCheck, Sparkles, UserRound, WalletCards, X } from "lucide-react";
import { devices, transactions } from "../lib/mock-data";
import { AdminDashboard, AuthWorkflow, KycWorkflow, NotificationsCenter, PersonalizedOffers, SupportWorkflow, TransactionWorkflow } from "./Workflows";

const navigation = [
  ["dashboard", "Accueil", Home],
  ["assistant", "Assistant", Bot],
  ["payments", "Paiements", WalletCards],
  ["support", "Assistance", Headphones],
  ["kyc", "Identité", IdCard],
  ["security", "Sécurité", LockKeyhole],
  ["notifications", "Notifications", Bell],
  ["offers", "Offres", Gift],
  ["profile", "Profil", UserRound],
  ["auth", "Connexion", LogIn],
  ["admin", "Administration", LayoutDashboard],
] as const;

type LiveData = {
  balance?: { available: number; currency: string };
  transactions?: { id: string; label?: string; recipient?: string; amount: number; createdAt?: string }[];
  profile?: { displayName?: string; phone?: string; locale?: string };
  insights?: { monthlySpend: number; projectedSavings: number; score: number };
  devices?: { id: string; deviceType: string; backedUp: boolean; lastUsedAt?: string }[];
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`glass ${className}`}>{children}</section>;
}

export default function MoovApp({ initialScreen }: { initialScreen: string }) {
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<{ role: "user"|"assistant"; text: string }[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [chatLoading, setChatLoading] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [liveData, setLiveData] = useState<LiveData>({});
  const notify = (text: string) => { setToast(text); window.setTimeout(() => setToast(""), 2600); };
  const send = async () => {
    const prompt = message.trim();
    if (!prompt || chatLoading) return;
    setMessages((old) => [...old, { role: "user", text: prompt }]);
    setMessage("");
    setChatLoading(true);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: prompt, conversationId, userId: "jean-direl-demo" }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Le service conversationnel est indisponible.");
      setConversationId(payload.conversationId);
      setMessages((old) => [...old, { role: "assistant", text: payload.message }]);
    } catch (error) {
      setMessages((old) => [...old, { role: "assistant", text: error instanceof Error ? error.message : "Une erreur est survenue." }]);
    } finally { setChatLoading(false); }
  };
  const startVoice = () => {
    type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };
    const BrowserRecognition = (window as typeof window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition
      || (window as typeof window & { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
    if (!BrowserRecognition) return notify("La reconnaissance vocale n’est pas disponible dans ce navigateur.");
    const recognition = new BrowserRecognition();
    recognition.lang = "fr-FR"; recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = event => setMessage(event.results[0]?.[0]?.transcript || "");
    recognition.onerror = () => notify("La dictée vocale n’a pas pu être reconnue.");
    recognition.onend = () => setVoiceListening(false);
    setVoiceListening(true); recognition.start();
  };
  useEffect(() => {
    const load = async () => {
      const requests: Promise<void>[] = [];
      if (["dashboard", "profile"].includes(initialScreen)) {
        requests.push(fetch("/api/profile").then(r => r.ok ? r.json() : undefined).then(profile => profile && setLiveData(old => ({ ...old, profile }))));
        requests.push(fetch("/api/financial-insights").then(r => r.ok ? r.json() : undefined).then(insights => insights && setLiveData(old => ({ ...old, insights }))));
      }
      if (initialScreen === "dashboard") {
        requests.push(fetch("/api/moov-money/balance").then(r => r.ok ? r.json() : undefined).then(balance => balance && setLiveData(old => ({ ...old, balance }))));
        requests.push(fetch("/api/moov-money/transactions").then(r => r.ok ? r.json() : undefined).then(data => data?.items && setLiveData(old => ({ ...old, transactions: data.items }))));
      }
      if (initialScreen === "security") requests.push(fetch("/api/security/devices").then(r => r.ok ? r.json() : undefined).then(data => data?.items && setLiveData(old => ({ ...old, devices: data.items }))));
      await Promise.allSettled(requests);
    };
    void load();
  }, [initialScreen]);

  return <div className="app-shell">
    <aside className={`sidebar ${menu ? "open" : ""}`}>
      <button className="close" onClick={() => setMenu(false)}><X /></button>
      <div className="brand"><strong>Moov</strong><span>Aetheric Intelligence</span></div>
      <nav>{navigation.map(([path, label, Icon]) => <Link key={path} href={`/${path}`} className={initialScreen === path ? "active" : ""}><Icon size={20}/><span>{label}</span></Link>)}</nav>
      <div className="trust"><ShieldCheck/><div><b>Protection active</b><small>Chiffrement de bout en bout</small></div></div>
    </aside>
    <main>
      <header><button className="menu" onClick={() => setMenu(true)}><Menu/></button><div><span className="eyebrow">MOOV ASSIST</span><h1>{navigation.find(([p]) => p === initialScreen)?.[1]}</h1></div><button className="avatar">JN</button></header>
      <div className="content">{renderScreen(initialScreen, notify, message, setMessage, send, messages, chatLoading, startVoice, voiceListening, liveData)}</div>
    </main>
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

function renderScreen(screen: string, notify: (s: string) => void, message: string, setMessage: (s: string) => void, send: () => void, messages: { role: "user"|"assistant"; text: string }[], chatLoading: boolean, startVoice: () => void, voiceListening: boolean, liveData: LiveData) {
  if (screen === "auth") return <AuthWorkflow notify={notify}/>;
  if (screen === "support") return <SupportWorkflow notify={notify}/>;
  if (screen === "payments") return <TransactionWorkflow notify={notify}/>;
  if (screen === "kyc") return <KycWorkflow notify={notify}/>;
  if (screen === "notifications") return <NotificationsCenter notify={notify}/>;
  if (screen === "offers") return <PersonalizedOffers notify={notify}/>;
  if (screen === "admin") return <AdminDashboard/>;
  if (screen === "assistant") return <><div className="hero compact"><span className="orb"><Sparkles/></span><div><p className="eyebrow">ASSISTANT AUTOMATISÉ · FRANÇAIS</p><h2>Bonjour Jean, comment puis-je vous aider ?</h2><p>Je m’appuie sur la documentation Moov Money. Vous pouvez demander un conseiller humain à tout moment.</p></div></div><div className="chat" aria-live="polite"><div className="ai-bubble">Bonjour, je suis Moov Assist. Je peux répondre à vos questions, lancer un diagnostic, consulter vos opérations ou préparer une transaction sécurisée.</div>{messages.map((m, i) => <div className={m.role === "user" ? "user-bubble" : "ai-bubble"} key={i}>{m.text}</div>)}{chatLoading && <div className="ai-bubble typing"><i/><i/><i/><span>Moov Assist analyse votre demande…</span></div>}</div><div className="suggestions">{["Consulter mon solde", "Réinitialiser mon PIN", "Suivre ma réclamation", "Parler à un conseiller"].map(x => <button key={x} onClick={() => setMessage(x)}>{x}</button>)}</div><div className="composer"><button className="voice" aria-label="Commande vocale" aria-pressed={voiceListening} onClick={startVoice}>{voiceListening ? "●" : "◉"}</button><input aria-label="Votre message" value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Écrivez à Moov Assist…"/><button aria-label="Envoyer" disabled={chatLoading} onClick={send}><Send/></button></div></>;
  if (screen === "security") { const registered = liveData.devices?.length ? liveData.devices.map((device, index) => ({ label: `Passkey ${index + 1}`, detail: `${device.deviceType}${device.lastUsedAt ? ` · ${new Date(device.lastUsedAt).toLocaleDateString("fr-FR")}` : ""}`, state: device.backedUp ? "Synchronisée" : "Cet appareil" })) : devices; return <><div className="hero compact"><span className="orb"><ShieldCheck/></span><div><p className="eyebrow">CENTRE DE SÉCURITÉ</p><h2>Votre compte est bien protégé.</h2><p>Les appareils affichés proviennent des passkeys enregistrées sur votre compte.</p></div></div><div className="stats"><Card><small>Score de sécurité</small><strong>92/100</strong><span className="good">Excellent</span></Card><Card><small>Passkeys actives</small><strong>{registered.length}</strong><span className="good">Vérifiées</span></Card><Card><small>Protection</small><strong>WebAuthn</strong><span>Biométrie locale</span></Card></div><Card><div className="section-title"><h3>Appareils connectés</h3><Link href="/auth">Ajouter</Link></div>{registered.map(d => <div className="row" key={d.label}><div><b>{d.label}</b><small>{d.detail}</small></div><span className="pill">{d.state}</span></div>)}</Card></>; }
  if (screen === "profile") return <><div className="profile-head"><div className="avatar big">JN</div><div><h2>{liveData.profile?.displayName || "Jean Direl Nze"}</h2><p>Compte Moov Money · +241 {liveData.profile?.phone || "06 ** ** 70"}</p></div><button onClick={() => notify("Les préférences sont enregistrées via l’API profil.")}>Modifier</button></div><div className="stats"><Card><small>Dépenses sur 30 jours</small><strong>{Math.round(liveData.insights?.monthlySpend || 480000).toLocaleString("fr-FR")}</strong><span>FCFA</span></Card><Card><small>Épargne possible</small><strong>{Math.round(liveData.insights?.projectedSavings || 32000).toLocaleString("fr-FR")}</strong><span className="good">FCFA</span></Card><Card><small>Score financier</small><strong>{Math.round(liveData.insights?.score || 84)}</strong><span className="good">Très bon</span></Card></div><Card><h3>Préférences de l’assistant</h3><div className="setting"><div><b>Langue</b><small>{liveData.profile?.locale || "fr"}</small></div><Link href="/assistant">Configurer</Link></div><div className="setting"><div><b>Alertes intelligentes</b><small>Être informé des dépenses inhabituelles</small></div><button className="switch on"/></div></Card></>;
  const recent = liveData.transactions?.slice(0, 2); return <><div className="hero"><div><p className="eyebrow">BONJOUR {(liveData.profile?.displayName || "JEAN").split(" ")[0].toUpperCase()}</p><h2>Votre argent, plus intelligent.</h2><p>Moov Assist anticipe vos besoins et sécurise chaque mouvement.</p><Link className="primary" href="/assistant"><Sparkles size={18}/> Demander à Moov Assist</Link></div><div className="balance"><small>SOLDE DISPONIBLE</small><strong>{Math.round(liveData.balance?.available || 1248500).toLocaleString("fr-FR")} <em>{liveData.balance?.currency || "FCFA"}</em></strong><span>Données actualisées par l’API Moov Money</span></div></div><div className="quick-grid">{[["↗","Envoyer","/payments"],["▦","Identité","/kyc"],["+","Recharger","/payments"],["◎","Historique","/payments"]].map(([icon,label,href]) => <Link key={label} href={href}><span>{icon}</span>{label}</Link>)}</div><div className="dashboard-grid"><Card><div className="section-title"><h3>Activité récente</h3><Link href="/payments">Tout voir <ChevronRight size={15}/></Link></div>{recent?.length ? recent.map(t => <div className="row" key={t.id}><div><b>{t.label || t.recipient || "Opération Moov Money"}</b><small>{t.createdAt ? new Date(t.createdAt).toLocaleString("fr-FR") : "Récente"}</small></div><strong>{Number(t.amount).toLocaleString("fr-FR")} FCFA</strong></div>) : transactions.slice(0,2).map(t => <div className="row" key={t.label}><div><b>{t.label}</b><small>{t.date}</small></div><strong>{t.amount}</strong></div>)}</Card><Card className="insight"><ChartNoAxesCombined/><p className="eyebrow">CONSEIL DU JOUR</p><h3>Vous pouvez économiser {Math.round(liveData.insights?.projectedSavings || 32000).toLocaleString("fr-FR")} FCFA ce mois-ci.</h3><p>Cette estimation est recalculée à partir de vos opérations récentes.</p></Card></div></>;
}
