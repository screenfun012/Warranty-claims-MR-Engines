import { redirect } from "next/navigation";

/** Mail je ujedno sa Pristiglo (/inbox). Stari linkovi /mail vode na inbox. */
export default function MailPageRedirect() {
  redirect("/inbox");
}
