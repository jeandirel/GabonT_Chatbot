"use client";

type Props = {
  title?: string;
  children?: React.ReactNode;
  /** Si true, affiche le contenu flou derrière la barrière */
  showPreview?: boolean;
};

/** Barrière translucide pour écrans non branchés au backend FastAPI. */
export default function ComingSoonBarrier({
  title = "Bientôt disponible",
  children,
  showPreview = true,
}: Props) {
  return (
    <div className="soon-wrap">
      {showPreview && children ? (
        <div className="soon-preview" aria-hidden>
          {children}
        </div>
      ) : null}
      <div className="soon-barrier" role="dialog" aria-modal="true" aria-labelledby="soon-title">
        <div className="soon-card glass">
          <p className="eyebrow">GABON TELECOM · MOOV AFRICA</p>
          <h2 id="soon-title">{title}</h2>
          <p>
            Cette interface fait partie du périmètre CDC (Kimba Connect) et sera
            branchée lorsque le POC sera retenu. En attendant, utilisez{" "}
            <a href="/assistant"><strong>Moov Assist</strong></a> — l’expérience
            vocale principale.
          </p>
          <p className="soon-status">En cours de développement</p>
          <a className="primary" href="/assistant" style={{ marginTop: 18 }}>
            Ouvrir l’assistant
          </a>
        </div>
      </div>
    </div>
  );
}
