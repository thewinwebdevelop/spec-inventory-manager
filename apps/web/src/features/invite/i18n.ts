/**
 * S11 copy (ux-wireframe §11). Owned by `ux`; the per-code failure copy lives
 * in `invite-error.ts` next to the row it belongs to.
 */
export const inviteScreenTh = {
  title: "คำเชิญเข้าร่วมร้าน",
  invitedAs: (role: string) => `ชวนคุณเข้าร่วมเป็น "${role}"`,
  issuedTo: (masked: string) => `คำเชิญนี้ออกให้ ${masked}`,
  sameEmailOnly: "ใช้อีเมลเดียวกับที่ถูกเชิญเท่านั้น",
  loginToAccept: "เข้าสู่ระบบเพื่อรับคำเชิญ",
  signup: "สมัครบัญชีใหม่",
  join: "เข้าร่วมร้านนี้",
  joining: "กำลังเข้าร่วม...",
  joinedTitle: (org: string) => `เข้าร่วม "${org}" เรียบร้อย`,
  joinedRole: (role: string) => `สิทธิ์ของคุณ: ${role}`,
  enterOrg: "เริ่มใช้งานร้านนี้",
  mobileHint: "ถ้าคุณใช้แอปบนมือถือ เปิดแอปแล้วสลับมาที่ร้านนี้ได้เลย",
  retry: "ลองใหม่",
  login: "เข้าสู่ระบบ",
  switchAccount: "ออกจากระบบแล้วเข้าด้วยบัญชีนั้น",
  home: "กลับหน้าแรก",
} as const;
