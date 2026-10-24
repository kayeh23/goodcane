import Checkout from "./checkout";
import { getCustomerSession } from "@/lib/auth/customer-session";

export const instant = false;

export default async function Page() {
  const sessionPhone = await getCustomerSession();
  return (
    <Checkout sessionPhone={sessionPhone} />
  );
}
