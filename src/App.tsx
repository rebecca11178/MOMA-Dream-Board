import { useStore } from "./lib/store";
import Onboarding from "./components/Onboarding";
import PetHome from "./components/PetHome";

export default function App() {
  const onboarded = useStore((s) => s.onboarded);
  return onboarded ? <PetHome /> : <Onboarding />;
}
