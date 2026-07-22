"use client";

import Link from "next/link";
import { Smartphone, Sparkles, MonitorSmartphone, Share } from "lucide-react";
import InstallPrompt from "./InstallPrompt";
import MoovLogo from "./MoovLogo";

/** Écran de présentation — entrée produit avant auth. */
export default function WelcomeScreen() {
  return (
    <div className="welcome-page">
      <div className="welcome-aurora" aria-hidden />
      <header className="welcome-top">
        <MoovLogo height={52} priority plate />
      </header>

      <main className="welcome-main">
        <div className="welcome-hero-logo">
          <MoovLogo height={120} priority />
        </div>

        <p className="welcome-kicker">Gabon Telecom · Moov Africa</p>
        <h1 className="welcome-title">Moov Assist</h1>
        <p className="welcome-lead">
          Votre assistant conversationnel vocal pour les forfaits, Moov Money et
          l’assistance client. Installez l’application, connectez-vous, puis
          parlez naturellement.
        </p>

        <div className="welcome-actions">
          <Link className="primary" href="/auth?mode=login">
            Connexion
          </Link>
          <Link className="secondary welcome-cta" href="/auth?mode=register">
            Créer un compte
          </Link>
        </div>

        <InstallPrompt />

        <section className="welcome-platforms glass">
          <h2>
            <Sparkles size={18} /> Installation PWA
          </h2>
          <p>Disponible sur desktop, iPhone, Android et webviews SuperApp.</p>
          <ul>
            <li>
              <MonitorSmartphone size={18} />
              <span>
                <b>Desktop</b> — Chrome / Edge : icône Installer dans la barre
                d’adresse, ou le bouton ci-dessus.
              </span>
            </li>
            <li>
              <Share size={18} />
              <span>
                <b>iOS</b> — Safari → Partager → Sur l’écran d’accueil.
              </span>
            </li>
            <li>
              <Smartphone size={18} />
              <span>
                <b>Android</b> — Chrome → Ajouter à l’écran d’accueil / Installer.
              </span>
            </li>
            <li>
              <Sparkles size={18} />
              <span>
                <b>SuperApp</b> — ouverture en mode standalone (PWA / WebView).
              </span>
            </li>
          </ul>
        </section>

        <p className="welcome-demo">
          Démo POC : <code>06123456</code> · <code>06123457</code> ·{" "}
          <code>06123458</code> — OTP <code>123456</code>
        </p>
        <p className="assist-cdc">POC Kimba Connect · CDC-MM-BOT-2026-03</p>
      </main>
    </div>
  );
}
