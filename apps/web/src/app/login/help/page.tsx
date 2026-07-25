import Link from "next/link";
import { AuthCard } from "../../../components/ui/AuthCard";
import { Button } from "../../../components/ui/Button";
import { authTh } from "../../../i18n/auth";

/**
 * `/login/help` — static "ลืมรหัสผ่าน?" help screen (ux-wireframe §3.3,
 * ui.md #3). No form, no API call — MVP has no self-serve reset (F-081
 * later). Includes the solo-owner D-005 addendum copy unconditionally (the
 * spec is explicit: this is a static/FAQ page that can't and shouldn't try
 * to detect solo-owner status — ux-wireframe §3.3).
 */
export default function LoginHelpPage() {
  return (
    <AuthCard>
      <h1 className="m-0 mb-6 text-center text-heading-md">{authTh.help.title}</h1>
      <p className="mb-6 text-body-md">{authTh.help.body}</p>
      <hr className="my-6 border-0 border-t border-border-default" />
      <p className="mb-6 text-body-sm text-text-muted">{authTh.help.bodySoloOwner}</p>
      <Link href="/login">
        <Button fullWidth>{authTh.help.backToLogin}</Button>
      </Link>
    </AuthCard>
  );
}
