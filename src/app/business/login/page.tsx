import { Suspense } from "react";
import LoginForm from "./form";

export default function Page() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
