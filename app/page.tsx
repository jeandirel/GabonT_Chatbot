import WelcomeScreen from "../components/WelcomeScreen";
import PwaRegister from "../components/PwaRegister";

/** Entrée produit : présentation + PWA, puis auth. */
export default function Home() {
  return (
    <>
      <PwaRegister />
      <WelcomeScreen />
    </>
  );
}
