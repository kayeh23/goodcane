import { Suspense } from "react";
import MyOrders from "./my-orders";

export default function Page() {
  return (
    <Suspense>
      <MyOrders />
    </Suspense>
  );
}
