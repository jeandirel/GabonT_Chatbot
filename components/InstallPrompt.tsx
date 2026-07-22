"use client";

import { useEffect, useId, useState } from "react";
import { Download, Share, Smartphone } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "ios" | "android" | "other";

function detectMobile(): { mobile: boolean; platform: Platform } {
  if (typeof window === "undefined") return { mobile: false, platform: "other" };
  const ua = navigator.userAgent || "";
  const ios = /iphone|ipad|ipod/i.test(ua);
  const android = /android/i.test(ua);
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 820px)").matches;
  const mobile = ios || android || (coarse && narrow);
  const platform: Platform = ios ? "ios" : android ? "android" : "other";
  return { mobile, platform };
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

type Props = {
  /** Variante compacte (bandeau shell) vs carte welcome. */
  compact?: boolean;
};

/** Lien / CTA d’installation PWA — prioritaire sur mobile. */
export default function InstallPrompt({ compact = false }: Props) {
  const guideId = useId();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [guideOpen, setGuideOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const info = detectMobile();
    setMobile(info.mobile);
    setPlatform(info.platform);
    setInstalled(isStandalone());
    setReady(true);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!ready || installed || !mobile) return null;

  const installNative = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  if (compact) {
    return (
      <div className="install-mobile-bar" id="installer">
        {deferred ? (
          <button type="button" className="install-mobile-link" onClick={() => void installNative()}>
            <Download size={16} />
            Installer l’application
          </button>
        ) : (
          <a
            href="#installer-guide"
            className="install-mobile-link"
            onClick={(e) => {
              e.preventDefault();
              setGuideOpen((v) => !v);
            }}
          >
            <Smartphone size={16} />
            Installer l’application
          </a>
        )}
        {guideOpen && (
          <p className="install-mobile-hint" id="installer-guide">
            {platform === "ios" ? (
              <>
                <Share size={14} /> Safari → <b>Partager</b> → <b>Sur l’écran d’accueil</b>
              </>
            ) : (
              <>
                Menu du navigateur → <b>Installer l’application</b> / Ajouter à l’écran d’accueil
              </>
            )}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="install-mobile-card glass" id="installer">
      <div className="install-mobile-row">
        <div>
          <p className="install-mobile-title">Installer Moov Assist</p>
          <p className="install-mobile-sub">
            {platform === "ios"
              ? "Ajoutez l’app sur l’écran d’accueil (iPhone / iPad)."
              : "Installez l’app pour un accès rapide hors navigateur."}
          </p>
        </div>
        {deferred ? (
          <button type="button" className="primary install-btn" onClick={() => void installNative()}>
            <Download size={18} /> Installer
          </button>
        ) : (
          <a
            href={`#${guideId}`}
            className="primary install-btn install-link"
            onClick={(e) => {
              e.preventDefault();
              setGuideOpen(true);
              document.getElementById(guideId)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }}
          >
            <Download size={18} /> Lien d’installation
          </a>
        )}
      </div>

      <div
        id={guideId}
        className={`install-guide ${guideOpen || platform === "ios" || !deferred ? "open" : ""}`}
        hidden={!(guideOpen || platform === "ios" || !deferred)}
      >
        {platform === "ios" ? (
          <ol>
            <li>
              Appuyez sur <b>Partager</b> <Share size={14} className="inline-ico" /> en bas de Safari
            </li>
            <li>
              Choisissez <b>Sur l’écran d’accueil</b>
            </li>
            <li>
              Validez <b>Ajouter</b> — Moov Assist s’ouvre comme une app
            </li>
          </ol>
        ) : (
          <ol>
            <li>
              Ouvrez le <b>menu</b> du navigateur (⋮)
            </li>
            <li>
              Touchez <b>Installer l’application</b> ou <b>Ajouter à l’écran d’accueil</b>
            </li>
            <li>Confirmez — l’icône Moov Assist apparaît sur votre téléphone</li>
          </ol>
        )}
      </div>
    </div>
  );
}
