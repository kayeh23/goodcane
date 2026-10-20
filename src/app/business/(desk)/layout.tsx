import { Suspense } from "react";
import Shell from "./shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
