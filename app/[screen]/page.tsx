import MoovApp from "../../components/MoovApp";

const screens = ["dashboard", "assistant", "payments", "support", "kyc", "security", "notifications", "offers", "profile", "auth", "admin"];

export function generateStaticParams() {
  return screens.map((screen) => ({ screen }));
}

export default async function ScreenPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params;
  return <MoovApp initialScreen={screens.includes(screen) ? screen : "assistant"} />;
}
