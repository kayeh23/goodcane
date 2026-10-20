import { DEMO_PASSCODE } from "@/lib/config";
import LoginForm from "./form";

export default function Page() {
  return <LoginForm demoPasscode={DEMO_PASSCODE} />;
}
