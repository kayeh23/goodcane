import { Suspense } from "react";
import Checkout from "./checkout";

export default function Page() {
  return (
    <Suspense>
      <Checkout />
    </Suspense>
  );
}
