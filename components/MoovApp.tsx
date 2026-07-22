"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Bell, Bot, ChartNoAxesCombined, ChevronRight, Gift, Headphones, Home, IdCard,
  LayoutDashboard, LockKeyhole, LogOut, Menu, Moon, Send, ShieldCheck, Sparkles,
  Sun, UserRound, WalletCards, X,
} from "lucide-react";
import { devices, transactions } from "../lib/mock-data";
import {
  AdminDashboard, AuthWorkflow, KycWorkflow, NotificationsCenter,
  PersonalizedOffers, SupportWorkflow, TransactionWorkflow,
} from "./Workflows";
import ComingSoonBarrier from "./ComingSoonBarrier";
import AssistantStage from "./AssistantStage";
import PwaRegister from "./PwaRegister";
import MoovLogo from "./MoovLogo";

const LIVE_SCREENS = new Set(["auth", "assistant", "dashboard"]);
const PUBLIC_SCREENS = new Set(["auth"]);

const navigation = [
  ["assistant", "Assistant", Bot],
  ["dashboard", "Accueil", Home],
  ["payments", "Paiements", WalletCards],
  ["support", "Assistance", Headphones],
  ["kyc", "Identité", IdCard],
  ["security", "Sécurité", LockKeyhole],
  ["notifications", "Notifications", Bell],
  ["offers", "Offres", Gift],
  ["profile", "Profil", UserRound],
  ["admin", "Administration", LayoutDashboard],
] as const;

type SessionUser = {
  id: string;
  displayName: string;
  phone: string;
  initials: string;
  locale?: string;
};

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
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [liveData, setLiveData] = useState<LiveData>({});
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const notify = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 2600);
  };

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        setUser(null);
        return false;
      }
      const data = await res.json();
      if (data.authenticated && data.user) {
        setUser({
          id: data.user.id,
          displayName: data.user.displayName || "Usager Moov",
          phone: data.user.phone || "",
          initials: data.user.initials || "MA",
          locale: data.user.locale,
        });
        return true;
      }
      setUser(null);
      return false;
    } catch {
      setUser(null);
      return false;
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("moov-theme");
    const next = stored === "dark" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await refreshSession();
      if (cancelled) return;
      setAuthReady(true);
      if (!ok && !PUBLIC_SCREENS.has(initialScreen)) {
        router.replace(`/auth?next=/${initialScreen}`);
        return;
      }
      if (ok && initialScreen === "auth") {
        router.replace("/assistant");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialScreen, refreshSession, router]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("moov-theme", next);
  };

  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      setUser(null);
      setLoggingOut(false);
      notify("Déconnecté");
      router.replace("/");
    }
  };

  useEffect(() => {
    if (!user || PUBLIC_SCREENS.has(initialScreen)) return;
    const load = async () => {
      const requests: Promise<void>[] = [];
      if (["dashboard", "profile"].includes(initialScreen)) {
        requests.push(
          fetch("/api/profile")
            .then((r) => (r.ok ? r.json() : undefined))
            .then((profile) => profile && setLiveData((old) => ({ ...old, profile }))),
        );
        requests.push(
          fetch("/api/financial-insights")
            .then((r) => (r.ok ? r.json() : undefined))
            .then((insights) => insights && setLiveData((old) => ({ ...old, insights }))),
        );
      }
      if (initialScreen === "dashboard") {
        requests.push(
          fetch("/api/moov-money/balance")
            .then((r) => (r.ok ? r.json() : undefined))
            .then((balance) => balance && setLiveData((old) => ({ ...old, balance }))),
        );
        requests.push(
          fetch("/api/moov-money/transactions")
            .then((r) => (r.ok ? r.json() : undefined))
            .then((data) => data?.items && setLiveData((old) => ({ ...old, transactions: data.items }))),
        );
      }
      if (initialScreen === "security") {
        requests.push(
          fetch("/api/security/devices")
            .then((r) => (r.ok ? r.json() : undefined))
            .then((data) => data?.items && setLiveData((old) => ({ ...old, devices: data.items }))),
        );
      }
      await Promise.allSettled(requests);
    };
    void load();
  }, [initialScreen, user]);

  const assistFocus = initialScreen === "assistant";
  const showShell = initialScreen !== "auth";

  if (!authReady) {
    return (
      <div className="auth-boot">
        <PwaRegister />
        <div className="auth-boot-card glass">
          <MoovLogo height={56} plate />
          <p>Chargement Moov Assist…</p>
        </div>
      </div>
    );
  }

  if (!user && initialScreen === "auth") {
    return (
      <div className="app-shell shell-auth">
        <PwaRegister />
        <main className="auth-main">
          <header className="auth-header">
            <Link href="/" className="brand-link" aria-label="Accueil Moov Assist">
              <MoovLogo height={44} plate />
            </Link>
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === "light" ? "Passer en mode sombre" : "Passer en mode clair"}
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </header>
          <div className="content auth-content">
            <Suspense fallback={<div className="glass form-card"><p>Chargement…</p></div>}>
              <AuthWorkflow notify={notify} />
            </Suspense>
          </div>
        </main>
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-boot">
        <PwaRegister />
        <div className="auth-boot-card glass">
          <p>Redirection vers la connexion…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell ${assistFocus ? "shell-assist" : ""}`}>
      <PwaRegister />
      {menu && <button type="button" className="sidebar-backdrop" aria-label="Fermer le menu" onClick={() => setMenu(false)} />}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <button className="close" onClick={() => setMenu(false)} type="button">
          <X />
        </button>
        <div className="brand">
          <Link href="/assistant" className="brand-link" onClick={() => setMenu(false)}>
            <MoovLogo height={48} plate={theme === "dark"} />
          </Link>
          <p className="brand-caption">Gabon Telecom · Africa</p>
          <p className="sidebar-user">
            {user.displayName}
            <small>+241 {user.phone}</small>
          </p>
        </div>
        <nav>
          {navigation.map(([path, label, Icon]) => (
            <Link
              key={path}
              href={`/${path}`}
              className={`${initialScreen === path ? "active" : ""} ${path === "assistant" ? "nav-assist" : ""}`}
              onClick={() => setMenu(false)}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <button type="button" className="logout-btn" disabled={loggingOut} onClick={() => void logout()}>
          <LogOut size={18} />
          {loggingOut ? "Déconnexion…" : "Déconnexion"}
        </button>
        <div className="trust">
          <ShieldCheck />
          <div>
            <b>POC Kimba Connect</b>
            <small>CDC-MM-BOT-2026-03</small>
          </div>
        </div>
      </aside>
      <main>
        {showShell && (
          <header>
            <button className="menu" onClick={() => setMenu(true)} type="button">
              <Menu />
            </button>
            <div>
              <span className="eyebrow">MOOV ASSIST · GABON TELECOM</span>
              <h1>{navigation.find(([p]) => p === initialScreen)?.[1]}</h1>
            </div>
            <div className="header-actions">
              <button
                type="button"
                className="theme-toggle"
                onClick={toggleTheme}
                aria-label={theme === "light" ? "Passer en mode sombre" : "Passer en mode clair"}
              >
                {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
                <span className="theme-label">{theme === "light" ? " Sombre" : " Clair"}</span>
              </button>
              <button className="avatar" type="button" title={user.displayName}>
                {user.initials}
              </button>
            </div>
          </header>
        )}
        <div className={`content ${assistFocus ? "assist-focus" : ""}`}>
          {wrapScreen(
            initialScreen,
            renderScreen(initialScreen, notify, {
              ...liveData,
              profile: liveData.profile || {
                displayName: user.displayName,
                phone: user.phone,
                locale: user.locale,
              },
            }, user),
          )}
        </div>
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function wrapScreen(screen: string, node: ReactNode) {
  if (LIVE_SCREENS.has(screen)) return node;
  return <ComingSoonBarrier title="Bientôt disponible">{node}</ComingSoonBarrier>;
}

function renderScreen(
  screen: string,
  notify: (s: string) => void,
  liveData: LiveData,
  user: SessionUser,
) {
  if (screen === "auth") return <AuthWorkflow notify={notify} />;
  if (screen === "assistant") return <AssistantStage notify={notify} />;
  if (screen === "support") return <SupportWorkflow notify={notify} />;
  if (screen === "payments") return <TransactionWorkflow notify={notify} />;
  if (screen === "kyc") return <KycWorkflow notify={notify} />;
  if (screen === "notifications") return <NotificationsCenter notify={notify} />;
  if (screen === "offers") return <PersonalizedOffers notify={notify} />;
  if (screen === "admin") return <AdminDashboard />;
  if (screen === "security") {
    const registered = liveData.devices?.length
      ? liveData.devices.map((device, index) => ({
          label: `Passkey ${index + 1}`,
          detail: `${device.deviceType}${device.lastUsedAt ? ` · ${new Date(device.lastUsedAt).toLocaleDateString("fr-FR")}` : ""}`,
          state: device.backedUp ? "Synchronisée" : "Cet appareil",
        }))
      : devices;
    return (
      <>
        <div className="hero compact">
          <span className="orb">
            <ShieldCheck />
          </span>
          <div>
            <p className="eyebrow">CENTRE DE SÉCURITÉ</p>
            <h2>Votre compte est bien protégé.</h2>
            <p>Les appareils affichés proviennent des passkeys enregistrées sur votre compte.</p>
          </div>
        </div>
        <div className="stats">
          <Card>
            <small>Score de sécurité</small>
            <strong>92/100</strong>
            <span className="good">Excellent</span>
          </Card>
          <Card>
            <small>Passkeys actives</small>
            <strong>{registered.length}</strong>
            <span className="good">Vérifiées</span>
          </Card>
          <Card>
            <small>Protection</small>
            <strong>WebAuthn</strong>
            <span>Biométrie locale</span>
          </Card>
        </div>
        <Card>
          <div className="section-title">
            <h3>Appareils connectés</h3>
          </div>
          {registered.map((d) => (
            <div className="row" key={d.label}>
              <div>
                <b>{d.label}</b>
                <small>{d.detail}</small>
              </div>
              <span className="pill">{d.state}</span>
            </div>
          ))}
        </Card>
      </>
    );
  }
  if (screen === "profile") {
    return (
      <>
        <div className="profile-head">
          <div className="avatar big">{user.initials}</div>
          <div>
            <h2>{liveData.profile?.displayName || user.displayName}</h2>
            <p>Compte Moov · +241 {liveData.profile?.phone || user.phone}</p>
          </div>
        </div>
        <Card>
          <h3>Préférences de l’assistant</h3>
          <div className="setting">
            <div>
              <b>Langue</b>
              <small>{liveData.profile?.locale || user.locale || "fr"}</small>
            </div>
            <Link href="/assistant">Ouvrir Moov Assist</Link>
          </div>
        </Card>
      </>
    );
  }

  const recent = liveData.transactions?.slice(0, 2);
  return (
    <>
      <div className="hero moov-hero">
        <div>
          <p className="eyebrow">
            BONJOUR {(liveData.profile?.displayName || user.displayName).split(" ")[0].toUpperCase()}
          </p>
          <h2>Parlez à Moov Assist</h2>
          <p>
            Assistant conversationnel Gabon Telecom — Moov Africa. Vocal par défaut, texte en option.
            FAQ forfaits, Moov Money et assistance 222.
          </p>
          <Link className="primary" href="/assistant">
            <Sparkles size={18} /> Ouvrir l’assistant
          </Link>
        </div>
        <div className="balance">
          <small>GABON TELECOM · MOOV AFRICA</small>
          <strong>Moov Assist</strong>
          <span>Glass · vocal · Kimba Connect POC</span>
        </div>
      </div>
      <div className="quick-grid">
        {[
          ["◎", "Assistant", "/assistant"],
          ["↗", "Envoyer", "/payments"],
          ["▦", "Identité", "/kyc"],
          ["?", "Aide", "/support"],
        ].map(([icon, label, href]) => (
          <Link key={label} href={href}>
            <span>{icon}</span>
            {label}
          </Link>
        ))}
      </div>
      <div className="dashboard-grid">
        <Card>
          <div className="section-title">
            <h3>Activité récente</h3>
            <Link href="/payments">
              Tout voir <ChevronRight size={15} />
            </Link>
          </div>
          {recent?.length
            ? recent.map((t) => (
                <div className="row" key={t.id}>
                  <div>
                    <b>{t.label || t.recipient || "Opération Moov Money"}</b>
                    <small>{t.createdAt ? new Date(t.createdAt).toLocaleString("fr-FR") : "Récente"}</small>
                  </div>
                  <strong>{Number(t.amount).toLocaleString("fr-FR")} FCFA</strong>
                </div>
              ))
            : transactions.slice(0, 2).map((t) => (
                <div className="row" key={t.label}>
                  <div>
                    <b>{t.label}</b>
                    <small>{t.date}</small>
                  </div>
                  <strong>{t.amount}</strong>
                </div>
              ))}
        </Card>
        <Card className="insight">
          <ChartNoAxesCombined />
          <p className="eyebrow">ASSISTANT</p>
          <h3>Demandez vos forfaits ou le service 222.</h3>
          <p>Réponses basées sur la base Moov Africa (FastAPI).</p>
          <Link className="primary" href="/assistant" style={{ marginTop: 16 }}>
            <Send size={16} /> Discuter
          </Link>
        </Card>
      </div>
    </>
  );
}
