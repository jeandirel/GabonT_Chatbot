"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** CTA d’installation PWA (Chrome/Edge/Android) + conseils iOS. */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setInstalled(standalone);

    const isIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !/crios|fxios|edgios/i.test(navigator.userAgent);
    setIosHint(isIos && !standalone);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setDeferred(null);
    });
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (installed) {
    return (
      <p className="install-ok">
        Application installée — mode autonome actif.
      </p>
    );
  }

  if (iosHint) {
    return (
      <div className="install-card glass">
        <p>
          Sur iPhone : appuyez sur <b>Partager</b> puis{" "}
          <b>Sur l’écran d’accueil</b> pour installer Moov Assist.
        </p>
      </div>
    );
  }

  if (!deferred) {
    return (
      <div className="install-card glass">
        <p>
          Pour installer : menu du navigateur → <b>Installer l’application</b> /
          Ajouter à l’écran d’accueil.
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="primary install-btn"
      onClick={async () => {
        await deferred.prompt();
        await deferred.userChoice;
        setDeferred(null);
      }}
    >
      <Download size={18} /> Installer Moov Assist
    </button>
  );
}
