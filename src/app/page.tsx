import { Suspense } from "react";
import Shop from "./shop";

export default function Page() {
  return (
    <Suspense>
      <Shop />
    </Suspense>
  );
}
