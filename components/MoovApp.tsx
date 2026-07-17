"use client";

import Link from "next/link";
import { useState } from "react";
import { Bot, ChartNoAxesCombined, ChevronRight, Fingerprint, Home, IdCard, LockKeyhole, Menu, Send, ShieldCheck, Sparkles, UserRound, WalletCards, X } from "lucide-react";
import { devices, transactions } from "../lib/mock-data";

const navigation = [
  ["dashboard", "Accueil", Home],
  ["assistant", "Assistant", Bot],
  ["payments", "Paiements", WalletCards],
  ["kyc", "Identité", IdCard],
  ["security", "Sécurité", LockKeyhole],
  ["profile", "Profil", UserRound],
] as const;

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`glass ${className}`}>{children}</section>;
}

export default function MoovApp({ initialScreen }: { initialScreen: string }) {
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const notify = (text: string) => { setToast(text); window.setTimeout(() => setToast(""), 2600); };
  const send = () => { if (!message.trim()) return; setMessages((old) => [...old, message]); setMessage(""); notify("Réponse simulée — le moteur IA sera connecté ici."); };

  return <div className="app-shell">
    <aside className={`sidebar ${menu ? "open" : ""}`}>
      <button className="close" onClick={() => setMenu(false)}><X /></button>
      <div className="brand"><strong>Moov</strong><span>Aetheric Intelligence</span></div>
      <nav>{navigation.map(([path, label, Icon]) => <Link key={path} href={`/${path}`} className={initialScreen === path ? "active" : ""}><Icon size={20}/><span>{label}</span></Link>)}</nav>
      <div className="trust"><ShieldCheck/><div><b>Protection active</b><small>Chiffrement de bout en bout</small></div></div>
    </aside>
    <main>
      <header><button className="menu" onClick={() => setMenu(true)}><Menu/></button><div><span className="eyebrow">MOOV ASSIST</span><h1>{navigation.find(([p]) => p === initialScreen)?.[1]}</h1></div><button className="avatar">JN</button></header>
      <div className="content">{renderScreen(initialScreen, notify, message, setMessage, send, messages)}</div>
    </main>
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

function renderScreen(screen: string, notify: (s: string) => void, message: string, setMessage: (s: string) => void, send: () => void, messages: string[]) {
  if (screen === "assistant") return <><div className="hero compact"><span className="orb"><Sparkles/></span><div><p className="eyebrow">INTELLIGENCE PERSONNELLE</p><h2>Bonjour Jean, comment puis-je vous aider ?</h2><p>Je peux analyser vos finances, préparer un transfert ou sécuriser votre compte.</p></div></div><div className="chat"><div className="ai-bubble">Votre situation est stable. Vos dépenses ont diminué de 8 % ce mois-ci. Souhaitez-vous voir les économies possibles ?</div>{messages.map((m, i) => <div className="user-bubble" key={i}>{m}</div>)}</div><div className="suggestions">{["Générer mon rapport", "Vérifier mon plafond", "Bloquer ma carte"].map(x => <button key={x} onClick={() => setMessage(x)}>{x}</button>)}</div><div className="composer"><input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Écrivez à Moov Assist…"/><button onClick={send}><Send/></button></div></>;
  if (screen === "payments") return <><div className="hero compact"><div><p className="eyebrow">PAIEMENTS SÉCURISÉS</p><h2>Transférez en toute confiance.</h2><p>Chaque opération sensible est protégée par une vérification biométrique.</p></div></div><div className="quick-grid">{["Envoyer de l’argent", "Paiement QR", "Payer une facture"].map((x, i) => <button key={x} onClick={() => notify(`${x} : authentification simulée.`)}><span>{i === 0 ? "↗" : i === 1 ? "▦" : "✓"}</span>{x}</button>)}</div><Card><div className="section-title"><h3>Transactions récentes</h3><button>Tout afficher</button></div>{transactions.map(t => <div className="row" key={t.label}><div><b>{t.label}</b><small>{t.date}</small></div><strong>{t.amount}</strong></div>)}</Card></>;
  if (screen === "kyc") return <><div className="hero compact"><span className="orb"><Fingerprint/></span><div><p className="eyebrow">VÉRIFICATION D’IDENTITÉ</p><h2>Protégeons votre identité.</h2><p>Une vérification rapide permet d’accéder à toutes les fonctionnalités Moov Money.</p></div></div><Card className="kyc"><div className="progress"><i/><i/><i/><i/></div><h3>Pièce d’identité</h3><p>Photographiez votre carte nationale d’identité ou votre passeport dans un endroit bien éclairé.</p><div className="document"><IdCard size={46}/><span>Déposez votre document ici</span><small>JPG, PNG ou PDF · 10 Mo maximum</small></div><button className="primary" onClick={() => notify("Document simulé ajouté avec succès.")}>Continuer la vérification</button></Card></>;
  if (screen === "security") return <><div className="hero compact"><span className="orb"><ShieldCheck/></span><div><p className="eyebrow">CENTRE DE SÉCURITÉ</p><h2>Votre compte est bien protégé.</h2><p>Aucune activité suspecte détectée au cours des 30 derniers jours.</p></div></div><div className="stats"><Card><small>Score de sécurité</small><strong>92/100</strong><span className="good">Excellent</span></Card><Card><small>Alertes actives</small><strong>0</strong><span className="good">Tout va bien</span></Card><Card><small>Dernière analyse</small><strong>2 min</strong><span>Automatique</span></Card></div><Card><div className="section-title"><h3>Appareils connectés</h3><button onClick={() => notify("Ajout d’appareil simulé.")}>Ajouter</button></div>{devices.map(d => <div className="row" key={d.label}><div><b>{d.label}</b><small>{d.detail}</small></div><span className="pill">{d.state}</span></div>)}</Card></>;
  if (screen === "profile") return <><div className="profile-head"><div className="avatar big">JN</div><div><h2>Jean Direl Nze</h2><p>Compte Moov Money Premium · +241 06 ** ** 70</p></div><button onClick={() => notify("Mode modification activé.")}>Modifier</button></div><div className="stats"><Card><small>Budget mensuel</small><strong>480 000</strong><span>FCFA</span></Card><Card><small>Épargne prévue</small><strong>125 000</strong><span className="good">+12 %</span></Card><Card><small>Score financier</small><strong>84</strong><span className="good">Très bon</span></Card></div><Card><h3>Préférences de l’assistant</h3><div className="setting"><div><b>Conseils personnalisés</b><small>Recevoir des recommandations selon vos habitudes</small></div><button className="switch on"/></div><div className="setting"><div><b>Alertes intelligentes</b><small>Être informé des dépenses inhabituelles</small></div><button className="switch on"/></div></Card></>;
  return <><div className="hero"><div><p className="eyebrow">BONJOUR JEAN</p><h2>Votre argent, plus intelligent.</h2><p>Moov Assist anticipe vos besoins et sécurise chaque mouvement.</p><button className="primary" onClick={() => notify("Assistant Moov prêt à vous répondre.")}><Sparkles size={18}/> Demander à Moov Assist</button></div><div className="balance"><small>SOLDE DISPONIBLE</small><strong>1 248 500 <em>FCFA</em></strong><span>+ 12,4 % ce mois</span></div></div><div className="quick-grid">{[["↗","Envoyer"],["▦","Scanner"],["+","Recharger"],["◎","Historique"]].map(([icon,label]) => <button key={label} onClick={() => notify(`${label} : mode démonstration.`)}><span>{icon}</span>{label}</button>)}</div><div className="dashboard-grid"><Card><div className="section-title"><h3>Activité récente</h3><Link href="/payments">Tout voir <ChevronRight size={15}/></Link></div>{transactions.slice(0,2).map(t => <div className="row" key={t.label}><div><b>{t.label}</b><small>{t.date}</small></div><strong>{t.amount}</strong></div>)}</Card><Card className="insight"><ChartNoAxesCombined/><p className="eyebrow">CONSEIL DU JOUR</p><h3>Vous pouvez économiser 32 000 FCFA ce mois-ci.</h3><p>Vos abonnements représentent 18 % de vos dépenses récurrentes.</p></Card></div></>;
}
