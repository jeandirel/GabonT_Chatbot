"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { AlertTriangle, ArrowLeft, Bell, Bot, Check, ChevronRight, CircleHelp, Clock3, CreditCard, FileText, Headphones, KeyRound, LockKeyhole, MessageSquareText, Phone, ScanLine, Send, ShieldCheck, Smartphone, Upload, UserCheck, Users } from "lucide-react";
import MoovLogo from "./MoovLogo";

type Notify = (message: string) => void;

const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
const Steps = ({ current, labels }: { current: number; labels: string[] }) => <div className="stepper">{labels.map((label, index) => <div className={index <= current ? "done" : ""} key={label}><i>{index < current ? <Check size={14}/> : index + 1}</i><span>{label}</span></div>)}</div>;

export function AuthWorkflow({ notify }: { notify: Notify }) {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login"|"register">("login");
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometrics, setBiometrics] = useState(true);
  const validPhone = /^0[1-7]\d{6,7}$/.test(phone.replace(/\s/g, ""));

  useEffect(() => {
    const m = searchParams.get("mode");
    if (m === "register" || m === "login") {
      setMode(m);
      setStep(0);
    }
  }, [searchParams]);

  const next = async () => {
    if (step === 0 && !validPhone) return notify("Saisissez un numéro gabonais valide à 9 chiffres.");
    setLoading(true);
    if (step === 0) {
      const response = await fetch("/api/auth/otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setLoading(false); return notify(payload.error || "Impossible d’envoyer le code de vérification."); }
      if (payload.hint) notify(payload.hint);
    }
    if (step === 1) {
      const response = await fetch("/api/auth/otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code: otp }) });
      const payload = await response.json();
      if (!payload.verified) { setLoading(false); return notify(payload.error || "Code incorrect. Utilisez 123456 pour la démonstration."); }
      // POC provisoire : session créée, on saute la passkey et on ouvre l’assistant
      if (payload.provisional || payload.verified) {
        setLoading(false);
        notify(`Bienvenue ${payload.user?.displayName || ""}`.trim());
        const nextPath = searchParams.get("next");
        window.location.href = nextPath && nextPath.startsWith("/") ? nextPath : "/assistant";
        return;
      }
    }
    if (step === 2) {
      try {
        if (biometrics && mode === "register") {
          const optionsResponse = await fetch("/api/webauthn/register/options", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, displayName: "Jean Direl" }) });
          const optionsPayload = await optionsResponse.json();
          if (!optionsResponse.ok) throw new Error(optionsPayload.error);
          const credential = await startRegistration({ optionsJSON: optionsPayload.options });
          const verifyResponse = await fetch("/api/webauthn/register/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, response: credential }) });
          if (!verifyResponse.ok) throw new Error((await verifyResponse.json()).error);
        }
        if (biometrics && mode === "login") {
          const optionsResponse = await fetch("/api/webauthn/authenticate/options", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
          const optionsPayload = await optionsResponse.json();
          if (!optionsResponse.ok) throw new Error(optionsPayload.error);
          const credential = await startAuthentication({ optionsJSON: optionsPayload.options });
          const verifyResponse = await fetch("/api/webauthn/authenticate/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, response: credential }) });
          if (!verifyResponse.ok) throw new Error((await verifyResponse.json()).error);
        }
        setLoading(false); return notify(mode === "login" ? "Connexion biométrique réussie." : "Passkey créée. Vous pouvez poursuivre le KYC.");
      } catch (error) { setLoading(false); return notify(error instanceof Error ? error.message : "La vérification biométrique a échoué."); }
    }
    setLoading(false); setStep((value) => value + 1);
  };
  return <div className="workflow narrow"><div className="auth-logo-wrap"><MoovLogo height={64} plate /></div><div className="tabs"><button className={mode === "login" ? "active" : ""} onClick={() => {setMode("login");setStep(0)}}>Connexion</button><button className={mode === "register" ? "active" : ""} onClick={() => {setMode("register");setStep(0)}}>Créer un compte</button></div><Steps current={step} labels={["Téléphone", "Vérification", "Sécurité"]}/><section className="glass form-card">
    {step === 0 && <><span className="form-icon"><Phone/></span><h2>{mode === "login" ? "Ravi de vous revoir" : "Rejoignez Moov Assist"}</h2><p>Comptes provisoires POC Gabon Telecom — Moov Africa.</p><Field label="Numéro de téléphone" hint="06123456 Jean Direl · 06123457 Christian BEYEME · 06123458 Xavier Ondo"><div className="phone-input"><b>+241</b><input inputMode="numeric" value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9 ]/g,""))} placeholder="06 12 34 56"/></div></Field></>}
    {step === 1 && <><span className="form-icon"><Smartphone/></span><h2>Confirmez votre numéro</h2><p>Un code à six chiffres a été envoyé au +241 {phone}.</p><Field label="Code de vérification" hint="Code de démonstration : 123456"><input className="otp" inputMode="numeric" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,""))} placeholder="••••••"/></Field></>}
    {step === 2 && <><span className="form-icon"><KeyRound/></span><h2>{mode === "login" ? "Confirmez avec votre passkey" : "Sécurisez cet appareil"}</h2><p>L’empreinte ou Face ID reste dans votre téléphone. Moov Assist reçoit uniquement une preuve cryptographique.</p>{mode === "register" && <Field label="Code PIN Moov Money"><input className="otp" type="password" inputMode="numeric" maxLength={4} autoComplete="off" placeholder="••••"/><small>Ce champ ne sera ni enregistré ni envoyé à Chatbase.</small></Field>}<label className="check"><input type="checkbox" checked={biometrics} onChange={e => setBiometrics(e.target.checked)}/> Utiliser la biométrie sécurisée de cet appareil</label></>}
    <div className="form-actions">{step > 0 && <button className="secondary" onClick={() => setStep(step - 1)}><ArrowLeft size={17}/> Retour</button>}<button className="primary" disabled={loading} onClick={next}>{loading ? "Vérification…" : step === 2 ? "Terminer" : "Continuer"}<ChevronRight size={17}/></button></div>
  </section></div>;
}

export function SupportWorkflow({ notify }: { notify: Notify }) {
  const [view, setView] = useState<"home"|"ticket"|"track"|"diagnostic">("home");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [diagnostic, setDiagnostic] = useState<{ kind: string; status: string; checks: { label: string; status: string }[]; recommendation: string; requiresAgent: boolean }>();
  const runDiagnostic = async (kind: string) => {
    setSubmitting(true); setDiagnostic(undefined);
    const response = await fetch("/api/diagnostics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
    const payload = await response.json(); setSubmitting(false);
    if (!response.ok) return notify(payload.error || "Diagnostic indisponible.");
    setDiagnostic(payload);
  };
  const create = async () => {
    setSubmitting(true);
    const response = await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, description }) });
    const payload = await response.json(); setSubmitting(false);
    if (!response.ok) return notify(payload.error || "Création du ticket impossible.");
    setTicketId(payload.id);
  };
  if (view === "diagnostic") return <div className="workflow"><button className="back" onClick={() => {setView("home");setDiagnostic(undefined)}}><ArrowLeft/> Centre d’aide</button><div className="workflow-grid"><section className="glass form-card"><p className="eyebrow">DIAGNOSTIC DE COMPTE</p><h2>Quel problème rencontrez-vous ?</h2><div className="action-grid">{[["PIN_LOCKED","PIN ou compte bloqué"],["SIM_ISSUE","Problème de carte SIM"],["TRANSFER_PENDING","Transfert en attente"],["BALANCE_MISMATCH","Solde incohérent"]].map(([kind,label]) => <button key={kind} disabled={submitting} onClick={() => runDiagnostic(kind)}><ShieldCheck/><div><b>{label}</b><small>Lancer les contrôles sécurisés</small></div><ChevronRight/></button>)}</div></section><aside className="glass help-panel">{submitting ? <><Clock3/><h3>Contrôles en cours…</h3><p>Moov Assist interroge les services autorisés sans demander votre PIN.</p></> : diagnostic ? <><span className="success"><Check/></span><h3>Diagnostic terminé</h3><div className="check-list">{diagnostic.checks.map(check => <span key={check.label}>{check.status === "passed" ? <Check/> : <Clock3/>} {check.label}</span>)}</div><p>{diagnostic.recommendation}</p>{diagnostic.requiresAgent && <button className="primary full" onClick={() => {setCategory("Diagnostic de compte");setDescription(`Diagnostic ${diagnostic.kind} : ${diagnostic.recommendation}`);setView("ticket")}}><Headphones/> Transmettre à un conseiller</button>}</> : <><ShieldCheck/><h3>Aucun secret demandé</h3><p>Ne saisissez jamais votre PIN ni votre code OTP dans un diagnostic ou une réclamation.</p></>}</aside></div></div>;
  if (view === "ticket") return <div className="workflow"><button className="back" onClick={() => setView("home")}><ArrowLeft/> Centre d’aide</button><div className="workflow-grid"><section className="glass form-card"><p className="eyebrow">NOUVELLE RÉCLAMATION</p><h2>Expliquez-nous le problème</h2><Field label="Catégorie"><select value={category} onChange={e => setCategory(e.target.value)}><option value="">Sélectionner</option><option>Transaction non reçue</option><option>Compte ou PIN bloqué</option><option>Problème de carte SIM</option><option>Paiement de facture</option></select></Field><Field label="Description"><textarea rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder="Décrivez les faits, la date et le montant concerné…"/></Field><Field label="Pièce jointe (facultative)"><button className="upload"><Upload/> Ajouter une capture ou un reçu</button></Field><button className="primary full" disabled={!category || description.length < 15 || submitting} onClick={create}><Send size={17}/>{submitting ? "Transmission…" : "Envoyer la réclamation"}</button></section><aside className="glass help-panel"><ShieldCheck/><h3>Vos informations sont protégées</h3><p>Ne communiquez jamais votre code PIN ou un code OTP dans votre réclamation.</p><span>Délai moyen de réponse</span><strong>Moins de 4 heures</strong></aside></div>{ticketId && <div className="dialog"><div className="glass"><span className="success"><Check/></span><h2>Réclamation créée</h2><p>Votre demande <b>#{ticketId}</b> a été transmise au service client.</p><button className="primary" onClick={() => {setTicketId("");setView("track");notify("Suivi de la réclamation ouvert.")}}>Suivre ma demande</button></div></div>}</div>;
  if (view === "track") return <div className="workflow"><button className="back" onClick={() => setView("home")}><ArrowLeft/> Centre d’aide</button><section className="glass ticket-detail"><div className="section-title"><div><p className="eyebrow">RÉCLAMATION #MV-2026-10482</p><h2>Transaction non reçue</h2></div><span className="pill warning">En cours</span></div><div className="timeline"><div className="complete"><i><Check/></i><div><b>Demande reçue</b><small>Aujourd’hui, 10:14</small></div></div><div className="complete"><i><UserCheck/></i><div><b>Prise en charge par un conseiller</b><small>Aujourd’hui, 10:32</small></div></div><div><i><Clock3/></i><div><b>Analyse de la transaction</b><small>Estimation : moins de 4 heures</small></div></div><div><i><Check/></i><div><b>Résolution</b><small>À venir</small></div></div></div><button className="secondary" onClick={() => notify("Un conseiller va rejoindre la conversation.")}><Headphones/> Parler à un conseiller</button></section></div>;
  return <div className="workflow"><div className="support-hero"><div><p className="eyebrow">ASSISTANCE MOOV MONEY</p><h2>Comment pouvons-nous vous aider ?</h2><div className="searchbox"><CircleHelp/><input placeholder="Rechercher dans plus de 200 réponses…"/></div></div><Bot size={76}/></div><div className="action-grid">{[[LockKeyhole,"PIN ou compte bloqué","Lancer un diagnostic guidé"],[CreditCard,"Transaction problématique","Créer une réclamation"],[MessageSquareText,"Suivre une demande","Consulter son avancement"],[Headphones,"Conseiller humain","Demander une assistance"]].map(([Icon,title,text], index) => <button key={String(title)} onClick={() => index === 0 ? setView("diagnostic") : index === 1 ? setView("ticket") : index === 2 ? setView("track") : (setCategory("Assistance humaine"), setDescription("Je souhaite être mis en relation avec un conseiller Moov Money."), setView("ticket"))}><Icon/><div><b>{String(title)}</b><small>{String(text)}</small></div><ChevronRight/></button>)}</div><section className="glass faq"><div className="section-title"><h3>Questions fréquentes</h3><span>200+ réponses disponibles</span></div>{["Comment réinitialiser mon code PIN ?","Pourquoi mon transfert est-il en attente ?","Comment augmenter mon plafond ?","Comment annuler une transaction ?"].map(q => <details key={q}><summary>{q}<ChevronRight/></summary><p>Moov Assist vous guidera étape par étape selon la situation de votre compte.</p></details>)}</section></div>;
}

export function TransactionWorkflow({ notify }: { notify: Notify }) {
  const [flow, setFlow] = useState<"menu"|"transfer"|"bill"|"airtime">("menu");
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [receiptId, setReceiptId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const reset = () => {setFlow("menu");setStep(0);setPhone("");setAmount("");setReference("");setReceiptId("")};
  const confirm = async () => {
    setSubmitting(true);
    try {
      const isBill = flow === "bill";
      const isAirtime = flow === "airtime";
      const context = isBill ? { type: "bill", provider: phone, reference, amount: Number(amount) } : { type: flow, recipient: phone, amount: Number(amount) };
      const optionResponse = await fetch("/api/webauthn/authenticate/options", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context }) });
      const optionPayload = await optionResponse.json();
      if (!optionResponse.ok) throw new Error(optionPayload.error || "Enregistrez d’abord une passkey dans Connexion.");
      const credential = await startAuthentication({ optionsJSON: optionPayload.options });
      const verifyResponse = await fetch("/api/webauthn/authenticate/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response: credential }) });
      const verification = await verifyResponse.json();
      if (!verifyResponse.ok || !verification.confirmationToken) throw new Error(verification.error || "Confirmation biométrique invalide.");
      const endpoint = isBill ? "/api/moov-money/bills" : isAirtime ? "/api/moov-money/airtime" : "/api/moov-money/transactions";
      const operation = isBill ? { provider: phone, reference, amount: Number(amount), confirmationToken: verification.confirmationToken } : { recipient: phone, amount: Number(amount), confirmationToken: verification.confirmationToken };
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(operation) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "La transaction n’a pas pu être exécutée.");
      setReceiptId(payload.id);
    } catch (error) { notify(error instanceof Error ? error.message : "La transaction a échoué."); }
    finally { setSubmitting(false); }
  };
  if (flow === "menu") return <div className="workflow"><div className="support-hero payment"><div><p className="eyebrow">MOOV MONEY</p><h2>Que souhaitez-vous faire ?</h2><p>Des opérations rapides, confirmées par PIN ou biométrie.</p></div><CreditCard size={74}/></div><div className="payment-menu">{[["transfer",Send,"Envoyer de l’argent","Vers un numéro Moov Money"],["airtime",Smartphone,"Acheter du crédit","Pour vous ou un proche"],["bill",FileText,"Payer une facture","SEEG, Canal+ et partenaires"],["history",Clock3,"Voir l’historique","Transactions et reçus"]].map(([id,Icon,title,text]) => <button key={String(id)} onClick={() => id === "history" ? notify("Historique chargé.") : setFlow(id as typeof flow)}><span><Icon/></span><div><b>{String(title)}</b><small>{String(text)}</small></div><ChevronRight/></button>)}</div></div>;
  const labels = flow === "bill" ? ["Fournisseur","Référence","Confirmation"] : ["Bénéficiaire","Montant","Confirmation"];
  return <div className="workflow narrow"><button className="back" onClick={reset}><ArrowLeft/> Paiements</button><Steps current={step} labels={labels}/><section className="glass form-card">
    {receiptId ? <div className="receipt"><span className="success"><Check/></span><p className="eyebrow">TRANSACTION RÉUSSIE</p><h2>{Number(amount || 15000).toLocaleString("fr-FR")} FCFA</h2><p>La transaction a été exécutée et enregistrée.</p><dl><div><dt>Référence</dt><dd>{receiptId}</dd></div><div><dt>Date</dt><dd>17 juillet 2026 · 15:42</dd></div><div><dt>Statut</dt><dd className="good">Confirmée</dd></div></dl><button className="primary full" onClick={reset}>Terminer</button></div> : <>{step === 0 && <><span className="form-icon">{flow === "bill" ? <FileText/> : <Users/>}</span><h2>{flow === "bill" ? "Choisissez le fournisseur" : "Qui est le bénéficiaire ?"}</h2>{flow === "bill" ? <div className="provider-grid">{["SEEG","Canal+","Gabon Telecom"].map(p => <button key={p} onClick={() => {setPhone(p);setStep(1)}}>{p}</button>)}</div> : <Field label="Numéro Moov Money"><div className="phone-input"><b>+241</b><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="06 12 34 56"/></div></Field>}</>}{step === 1 && <><span className="form-icon"><CreditCard/></span><h2>{flow === "bill" ? `Référence client ${phone}` : "Quel montant envoyer ?"}</h2>{flow === "bill" && <Field label="Référence client"><input value={reference} onChange={e => setReference(e.target.value)} placeholder="Numéro de compteur ou d’abonné"/></Field>}<Field label="Montant"><div className="money-input"><input inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g,""))} placeholder="0"/><b>FCFA</b></div></Field></>}{step === 2 && <><span className="form-icon"><ScanLine/></span><h2>Confirmez l’opération</h2><div className="summary"><div><span>Destinataire</span><b>{phone}</b></div><div><span>Montant</span><b>{Number(amount).toLocaleString("fr-FR")} FCFA</b></div><div><span>Frais</span><b>0 FCFA</b></div><div className="total"><span>Total</span><b>{Number(amount).toLocaleString("fr-FR")} FCFA</b></div></div><button className="biometric" disabled={submitting} onClick={confirm}><ScanLine/>{submitting ? "Autorisation…" : "Confirmer par biométrie"}</button></>}
    {step < 2 && <div className="form-actions">{step > 0 && <button className="secondary" onClick={() => setStep(step-1)}>Retour</button>}<button className="primary" disabled={(step === 0 && !phone) || (step === 1 && (!amount || (flow === "bill" && !reference)))} onClick={() => setStep(step+1)}>Continuer <ChevronRight size={17}/></button></div>}</>}
  </section></div>;
}

export function NotificationsCenter({ notify }: { notify: Notify }) {
  const [filter, setFilter] = useState("Toutes");
  const fallback = useMemo(() => [
    {type:"Sécurité",icon:ShieldCheck,title:"Nouvelle connexion vérifiée",text:"Chrome sur Windows · Rouen",time:"Il y a 2 h",unread:true},
    {type:"Transactions",icon:Send,title:"Transfert confirmé",text:"75 000 FCFA reçus de Alain N.",time:"Hier",unread:true},
    {type:"Support",icon:Headphones,title:"Votre réclamation avance",text:"Un conseiller analyse la transaction #MV-2026-10482.",time:"Hier",unread:false},
    {type:"Promotions",icon:Bell,title:"Bonus crédit Moov",text:"Profitez de votre offre disponible cette semaine.",time:"14 juillet",unread:false},
  ],[]);
  const [items, setItems] = useState(fallback);
  useEffect(() => { fetch("/api/notifications").then(response => response.ok ? response.json() : undefined).then(payload => {
    if (!payload?.items?.length) return;
    setItems(payload.items.map((item: { id: string; type: string; title: string; body: string; createdAt: string; readAt?: string }) => ({ type: item.type, icon: item.type.toLowerCase().includes("support") ? Headphones : item.type.toLowerCase().includes("security") ? ShieldCheck : Send, title: item.title, text: item.body, time: new Date(item.createdAt).toLocaleString("fr-FR"), unread: !item.readAt })));
  }).catch(() => undefined); }, []);
  const markRead = async () => { const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" }); if (response.ok) { setItems(old => old.map(item => ({ ...item, unread: false }))); notify("Toutes les notifications sont marquées comme lues."); } };
  return <div className="workflow"><div className="page-heading"><div><p className="eyebrow">CENTRE DE NOTIFICATIONS</p><h2>Restez informé en temps réel.</h2></div><button className="secondary" onClick={markRead}><Check/> Tout marquer comme lu</button></div><div className="filterbar">{["Toutes","Transactions","Sécurité","Support","Promotions"].map(x => <button key={x} className={filter === x ? "active" : ""} onClick={() => setFilter(x)}>{x}</button>)}</div><section className="glass notification-list">{items.filter(x => filter === "Toutes" || x.type === filter).map(item => <button key={item.title} className={item.unread ? "unread" : ""}><span className="notification-icon"><item.icon/></span><div><b>{item.title}</b><p>{item.text}</p><small>{item.time}</small></div><ChevronRight/>{item.unread && <i/>}</button>)}</section></div>;
}

export function KycWorkflow({ notify }: { notify: Notify }) {
  const [step, setStep] = useState(0);
  const [documentType, setDocumentType] = useState("CNI");
  const [identityFile, setIdentityFile] = useState<File>();
  const [addressFile, setAddressFile] = useState<File>();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: string; reference: string }>();
  const [ocr, setOcr] = useState<{ text: string; confidence: number; sha256: string; fields: Record<string,string>; uploadId?: string; fileName: string; mimeType: string }>();
  const analyze = async () => {
    if (!identityFile) return notify("Ajoutez une pièce d’identité.");
    setLoading(true);
    const form = new FormData(); form.append("document", identityFile);
    const response = await fetch("/api/ocr", { method: "POST", body: form });
    const payload = await response.json(); setLoading(false);
    if (!response.ok) return notify(payload.error || "Analyse OCR impossible.");
    setOcr(payload); setStep(2);
  };
  const submit = async () => {
    if (!addressFile) return notify("Ajoutez un justificatif de domicile.");
    setLoading(true);
    const upload = new FormData(); upload.append("document", addressFile);
    const uploadResponse = await fetch("/api/uploads", { method: "POST", body: upload });
    const stored = await uploadResponse.json();
    if (!uploadResponse.ok) { setLoading(false); return notify(stored.error || "Envoi du justificatif impossible."); }
    const response = await fetch("/api/kyc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentType, identityUploadId: ocr?.uploadId, identityFileName: ocr?.fileName || identityFile?.name, identityMimeType: ocr?.mimeType, addressUploadId: stored.uploadId, addressFileName: addressFile.name, addressMimeType: stored.mimeType, addressSha256: stored.sha256, ocrText: ocr?.text, confidence: ocr?.confidence, sha256: ocr?.sha256, extractedData: ocr?.fields }) });
    const payload = await response.json(); setLoading(false);
    if (!response.ok) return notify(payload.error || "Soumission KYC impossible.");
    setResult(payload); setStep(3);
  };
  return <div className="workflow narrow"><Steps current={step} labels={["Identité","Analyse OCR","Domicile","Suivi"]}/><section className="glass form-card">
    {step === 0 && <><span className="form-icon"><UserCheck/></span><h2>Vérifiez votre identité</h2><p>Les documents sont utilisés uniquement pour l’ouverture et la conformité du compte.</p><Field label="Type de pièce"><select value={documentType} onChange={e => setDocumentType(e.target.value)}><option>CNI</option><option>Passeport</option></select></Field><Field label="Photo du document"><label className="file-drop"><Upload/><b>{identityFile?.name || "Choisir une photo"}</b><small>JPG, PNG ou WebP · 10 Mo maximum</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setIdentityFile(e.target.files?.[0])}/></label></Field><button className="primary full" disabled={!identityFile} onClick={() => setStep(1)}>Analyser le document <ChevronRight/></button></>}
    {step === 1 && <div className="ocr"><span className="scan-frame"><ScanLine/></span><h2>Contrôle OCR sécurisé</h2><p>Nous vérifions la lisibilité, le type de pièce et la cohérence des informations.</p><div className="check-list"><span><Check/> Document lisible</span><span><Check/> Informations extraites</span><span><Check/> Contrôle de cohérence</span></div><button className="primary full" onClick={analyze} disabled={loading}>{loading ? "Analyse en cours…" : "Confirmer les informations"}</button></div>}
    {step === 2 && <><span className="form-icon"><FileText/></span><h2>Justificatif de domicile</h2><p>Ajoutez un document récent correspondant à l’adresse déclarée.</p><Field label="Justificatif"><label className="file-drop"><Upload/><b>{addressFile?.name || "Choisir le justificatif"}</b><small>Facture ou attestation de moins de 3 mois</small><input type="file" accept="image/jpeg,image/png,application/pdf" onChange={e => setAddressFile(e.target.files?.[0])}/></label></Field><button className="primary full" disabled={!addressFile || loading} onClick={submit}>{loading ? "Envoi sécurisé…" : "Soumettre le dossier"}</button></>}
    {step === 3 && <div className="receipt"><span className="success"><Clock3/></span><p className="eyebrow">DOSSIER {result?.reference}</p><h2>Vérification en cours</h2><p>Votre dossier est complet. Vous recevrez une notification à chaque changement de statut.</p><div className="timeline compact"><div className="complete"><i><Check/></i><div><b>Documents reçus</b><small>Terminé</small></div></div><div className="complete"><i><Check/></i><div><b>Analyse automatique</b><small>Terminé</small></div></div><div><i><Clock3/></i><div><b>Validation conformité</b><small>Délai estimé : 24 heures</small></div></div></div></div>}
  </section></div>;
}

export function PersonalizedOffers({ notify }: { notify: Notify }) {
  const defaults = useMemo(() => [
    { label:"Bonus airtime", title:"20 % de crédit offert", text:"Sur votre prochaine recharge de 5 000 FCFA ou plus.", color:"green" },
    { label:"Épargne", title:"Objectif rentrée scolaire", text:"Mettez automatiquement 10 000 FCFA de côté chaque semaine.", color:"gold" },
    { label:"Canal+", title:"Paiement sans frais", text:"Réglez votre abonnement depuis Moov Assist cette semaine.", color:"blue" },
  ], []);
  const [offers, setOffers] = useState(defaults);
  useEffect(() => { fetch("/api/offers").then(response => response.ok ? response.json() : undefined).then(payload => { if (payload?.items?.length) setOffers(payload.items); }).catch(() => undefined); }, []);
  return <div className="workflow"><div className="page-heading"><div><p className="eyebrow">OFFRES PERSONNALISÉES</p><h2>Des avantages adaptés à vos usages.</h2><p>Chaque recommandation peut être expliquée ou désactivée.</p></div></div><div className="offer-grid">{offers.map(offer => <section className={`glass offer ${offer.color}`} key={offer.title}><span>{offer.label}</span><h3>{offer.title}</h3><p>{offer.text}</p><button onClick={() => notify(`${offer.title} sélectionnée.`)}>Découvrir <ChevronRight/></button><button className="why" onClick={() => notify("Cette offre est proposée selon vos services Moov Money utilisés, sans décision automatisée opposable.")}>Pourquoi cette recommandation ?</button></section>)}</div></div>;
}

export function AdminDashboard() {
  const metrics = [["Résolution automatique","78 %","+6,2 %"],["Conversations","24 892","+12,4 %"],["Satisfaction CSAT","4,6/5","+0,3"],["Transferts agents","14 %","−3,1 %"],["Transactions/mois","8 427","+18,6 %"],["Utilisateurs actifs","31 204","+9,8 %"]];
  return <div className="workflow admin"><div className="page-heading"><div><p className="eyebrow">TEMPS RÉEL · MIS À JOUR À 15:42</p><h2>Performance de Moov Assist</h2></div><span className="live"><i/> Systèmes opérationnels</span></div><div className="metric-grid">{metrics.map(([label,value,trend]) => <section className="glass" key={label}><small>{label}</small><strong>{value}</strong><span className="good">{trend}</span></section>)}</div><div className="admin-grid"><section className="glass chart-card"><div className="section-title"><h3>Conversations résolues</h3><select><option>7 derniers jours</option><option>30 derniers jours</option></select></div><div className="bars">{[58,70,64,82,76,91,86].map((h,i) => <div key={i}><i style={{height:`${h}%`}}/><span>{["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"][i]}</span></div>)}</div></section><section className="glass intents"><h3>Intentions principales</h3>{[["Consultation du solde",82],["Transfert d’argent",68],["PIN / compte bloqué",51],["Paiement de facture",43],["Suivi réclamation",31]].map(([label,value]) => <div key={String(label)}><span>{label}</span><b>{value}%</b><i><em style={{width:`${value}%`}}/></i></div>)}</section></div><section className="glass alerts"><div className="section-title"><h3>Alertes et qualité</h3><span>3 éléments à surveiller</span></div>{[[AlertTriangle,"Hausse des demandes PIN bloqué","+24 % depuis 14:00","warning"],[Clock3,"Temps de réponse WhatsApp","2,8 s · objectif < 3 s","good"],[MessageSquareText,"Questions sans réponse fiable","38 conversations à examiner","warning"]].map(([Icon,title,text,state]) => <div className="row" key={String(title)}><span className={`alert-icon ${state}`}><Icon/></span><div><b>{String(title)}</b><small>{String(text)}</small></div><button>Examiner</button></div>)}</section></div>;
}
