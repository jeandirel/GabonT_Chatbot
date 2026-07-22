import Image from "next/image";

type Props = {
  /** Hauteur visuelle du logo (largeur auto). */
  height?: number;
  /** Variante : wordmark Moov Africa (défaut) ou pastille Gabon Telecom. */
  variant?: "moov" | "gabon";
  /** Fond clair pour lisibilité sur thème sombre. */
  plate?: boolean;
  className?: string;
  priority?: boolean;
};

const ASSETS = {
  moov: { src: "/brand/moov_africa_logo.png", alt: "Moov Africa", ratio: 1 },
  gabon: { src: "/brand/gabon_telecom_mark.png", alt: "Gabon Telecom · Africa", ratio: 580 / 212 },
} as const;

/** Logo officiel Moov Africa / Gabon Telecom. */
export default function MoovLogo({
  height = 40,
  variant = "moov",
  plate = false,
  className = "",
  priority = false,
}: Props) {
  const asset = ASSETS[variant];
  const width = Math.round(height * asset.ratio);

  const img = (
    <Image
      src={asset.src}
      alt={asset.alt}
      width={width}
      height={height}
      priority={priority}
      className={`moov-logo-img ${className}`.trim()}
      style={{ width, height, objectFit: "contain" }}
    />
  );

  if (plate) {
    return <span className="moov-logo-plate">{img}</span>;
  }
  return img;
}
