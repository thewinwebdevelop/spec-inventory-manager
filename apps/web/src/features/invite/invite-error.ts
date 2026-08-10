/**
 * T-002-W6 — `/invite`'s error table (ux-wireframe §11.4), as data.
 *
 * Ten rows, and nine of them are distinguished only by an error code. Written
 * as a table rather than a `switch` inside JSX for the same reason the API
 * writes its refusal mapping as a total record: every code needs an answer,
 * and the compiler should be the one asking.
 *
 * Each row carries a WAY OUT. §11.4 gives every failure a next step, because
 * the person reading it did nothing wrong — they clicked a link somebody sent
 * them, and a dead end here means asking the shop owner over chat with no idea
 * what to ask for.
 */
import { toApiFailure } from "../../lib/api/error";

export type InviteNextStep =
  /** Back to the app's front door. */
  | { readonly kind: "home" }
  /** Sign in — the invitation is fine, the session is not. */
  | { readonly kind: "login" }
  /** Already a member: go straight into the shop. */
  | { readonly kind: "enter-org" }
  /** Sign out and come back as the invited person (§11.3). */
  | { readonly kind: "switch-account" }
  /** Transient — offer the same button again. */
  | { readonly kind: "retry" };

export interface InviteError {
  readonly title: string;
  readonly body: string;
  readonly next: InviteNextStep;
  /** Throttling gets the countdown banner instead of a plain message. */
  readonly retryAfterSeconds?: number;
}

const HOME: InviteNextStep = { kind: "home" };

/**
 * Copy is inline here rather than in `i18n.ts` because each string is bound to
 * exactly one code and reads as part of the table. `ux` owns the wording;
 * every line is verbatim from §11.4.
 */
const BY_CODE: Readonly<Record<string, InviteError>> = Object.freeze({
  INVITATION_INVALID: {
    title: "ลิงก์คำเชิญนี้ใช้ไม่ได้",
    body: "ลิงก์อาจถูกคัดลอกมาไม่ครบ หรือถูกยกเลิกไปแล้ว — ขอลิงก์ใหม่จากเจ้าของร้าน",
    next: HOME,
  },
  INVITATION_EXPIRED: {
    title: "ลิงก์คำเชิญหมดอายุแล้ว",
    body: 'ขอให้เจ้าของร้านกด "ออกลิงก์ใหม่" แล้วส่งลิงก์ใหม่ให้คุณ',
    next: HOME,
  },
  INVITATION_CANCELLED: {
    title: "คำเชิญนี้ถูกยกเลิกแล้ว",
    body: "ติดต่อเจ้าของร้านถ้าคุณยังต้องการเข้าร่วม",
    next: HOME,
  },
  INVITATION_ALREADY_ACCEPTED: {
    title: "คำเชิญนี้ถูกใช้ไปแล้ว",
    body: "ถ้าคุณเป็นคนกดรับเอง ให้เข้าสู่ระบบแล้วเลือกร้านนี้ได้เลย",
    next: { kind: "login" },
  },
  ALREADY_MEMBER: {
    title: "คุณเป็นสมาชิกของร้านนี้อยู่แล้ว",
    // I-9: accepting again must not silently change anything, and the copy
    // says so — otherwise a second click reads as "did that do something?".
    body: "เข้าใช้งานได้เลย — สิทธิ์เดิมของคุณไม่ถูกเปลี่ยน",
    next: { kind: "enter-org" },
  },
  INVITATION_SUPERSEDED: {
    title: "คำเชิญนี้ใช้ไม่ได้แล้ว",
    // I-1: the link predates the removal, so honouring it would resurrect a
    // membership somebody deliberately ended.
    body: "คำเชิญนี้ถูกออกก่อนที่คุณจะถูกถอดออกจากร้าน — ขอคำเชิญใหม่จากเจ้าของร้าน",
    next: HOME,
  },
  INVITATION_ROLE_UNAVAILABLE: {
    title: "คำเชิญนี้ใช้ไม่ได้แล้ว",
    body: "สิทธิ์ที่ระบุในคำเชิญถูกเปลี่ยนไปแล้ว — ขอลิงก์ใหม่จากเจ้าของร้าน",
    next: HOME,
  },
  INVITATION_EMAIL_MISMATCH: {
    title: "บัญชีไม่ตรงกับคำเชิญ",
    body: "กรุณาเข้าสู่ระบบด้วยบัญชีที่ถูกเชิญ",
    next: { kind: "switch-account" },
  },
});

const GENERIC: InviteError = Object.freeze({
  title: "เปิดคำเชิญไม่สำเร็จ",
  body: "กรุณาลองใหม่อีกครั้ง",
  next: { kind: "retry" } as const,
});

const THROTTLED_TITLE = "เปิดลิงก์คำเชิญถี่เกินไป";

export function toInviteError(error: unknown): InviteError {
  const failure = toApiFailure(error);

  if (failure.kind === "throttled") {
    return {
      title: THROTTLED_TITLE,
      body: "กรุณารอสักครู่แล้วลองใหม่",
      next: { kind: "retry" },
      // The countdown owns the presentation; 60s when the server sent none, so
      // the banner never ends the instant it appears.
      retryAfterSeconds: failure.retryAfterSeconds ?? 60,
    };
  }

  // Every mapped case is keyed by CODE, not by status: `409` alone covers six
  // different outcomes here, and they need six different next steps.
  const code =
    failure.kind === "conflict" || failure.kind === "not-found" || failure.kind === "forbidden"
      ? failure.code
      : undefined;

  return (code !== undefined && BY_CODE[code]) || GENERIC;
}

/** Codes this screen has bespoke copy for — exported so a test can enumerate them. */
export const HANDLED_INVITE_CODES: readonly string[] = Object.freeze(Object.keys(BY_CODE));
