import MyOrders from "./my-orders";
import { getCustomerSession } from "@/lib/auth/customer-session";

export const instant = false;

export default async function Page() {
  const sessionPhone = await getCustomerSession();
  return (
    <MyOrders sessionPhone={sessionPhone ?? ""} />
  );
}
