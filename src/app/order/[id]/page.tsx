import { Suspense } from "react";
import OrderStatusView from "./status";

export default function Page() {
  return (
    <Suspense>
      <OrderStatusView />
    </Suspense>
  );
}
