/**
 * i18n copy for the F-001 auth screens — Thai default, per design-system.md §3
 * ("ทุก string เป็น i18n key ... default ไทย"). Values copied verbatim from
 * docs/features/F-001/ui.md §3 (owned by `ux`) — do not hand-edit copy here;
 * request changes from `ux`.
 *
 * English is not implemented yet (design-system.md §3: "ไทยครบก่อน · อังกฤษเติม
 * progressive") — this module only exports the Thai table, keyed exactly as
 * ui.md documents so a future locale layer can slot in without renaming keys.
 */
export const authTh = {
  signup: {
    title: "สมัครใช้งาน OmniStock",
    subtitle: "เริ่มต้นจัดการสต๊อกและบัญชีร้านค้าของคุณ",
    email: {
      label: "อีเมล",
      placeholder: "เช่น somchai@shop.com",
    },
    password: {
      label: "รหัสผ่าน",
      placeholder: "อย่างน้อย 8 ตัวอักษร",
      helper: "ใช้ตัวอักษร ตัวเลข หรือวลีที่จำง่าย — ไม่ต้องมีอักขระพิเศษก็ได้",
    },
    submit: "สมัครใช้งาน",
    submitLoading: "กำลังสมัคร...",
    linkToLogin: "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ",
    successToast: "สมัครสำเร็จ! เข้าสู่ระบบเพื่อเริ่มใช้งาน",
    error: {
      emailInvalid: "รูปแบบอีเมลไม่ถูกต้อง",
      passwordTooShort: "รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 8 ตัวอักษร",
      passwordBreached:
        "รหัสผ่านนี้ถูกใช้งานทั่วไปมาก ไม่ปลอดภัย ลองตั้งรหัสผ่านที่คาดเดายากขึ้น",
      emailTaken: "อีเมลนี้มีผู้ใช้งานแล้ว",
      emailTakenLoginLink: "เข้าสู่ระบบ",
      generic: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
    },
  },
  login: {
    title: "เข้าสู่ระบบ",
    email: { label: "อีเมล" },
    password: { label: "รหัสผ่าน" },
    submit: "เข้าสู่ระบบ",
    submitLoading: "กำลังเข้าสู่ระบบ...",
    forgotPassword: "ลืมรหัสผ่าน?",
    linkToSignup: "ยังไม่มีบัญชี? สมัครใช้งาน",
    error: {
      invalidCredentials: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
      generic: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
    },
  },
  throttle: {
    bannerLong: (mm: string, ss: string) =>
      `ลองเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ · เหลือ ${mm}:${ss} นาที`,
    bannerShort: (n: number) => `รอสักครู่แล้วลองใหม่ · เหลือ ${n} วินาที`,
    helper: "เพื่อความปลอดภัยของบัญชีคุณ ระบบจะให้ลองใหม่ได้เองเมื่อครบเวลา",
  },
  help: {
    title: "ลืมรหัสผ่าน?",
    body: "ตอนนี้ระบบยังไม่รองรับการขอรีเซ็ตรหัสผ่านด้วยตัวเอง กรุณาติดต่อเจ้าของร้าน/ผู้ดูแลระบบ (Owner/Admin) ในทีมของคุณ เพื่อให้ตั้งรหัสผ่านใหม่ให้",
    bodySoloOwner:
      "หากคุณเป็นเจ้าของร้านเพียงคนเดียวและลืมรหัสผ่าน กรุณารอสักครู่แล้วลองพิมพ์รหัสผ่านที่คิดว่าถูกต้องอีกครั้ง (ระบบจะไม่ล็อกบัญชีคุณถาวร)",
    backToLogin: "กลับไปเข้าสู่ระบบ",
  },
  sessions: {
    title: "อุปกรณ์ที่เข้าสู่ระบบ",
    subtitle: "รายการอุปกรณ์ที่กำลังเข้าใช้งานบัญชีของคุณอยู่",
    badgeCurrent: "อุปกรณ์นี้",
    lastActive: (relativeTime: string) => `ใช้งานล่าสุด: ${relativeTime}`,
    deviceUnknown: "อุปกรณ์ไม่ทราบชื่อ",
    action: {
      logoutDevice: "ออกจากอุปกรณ์นี้",
      logoutAll: "ออกจากระบบทุกอุปกรณ์",
      retry: "ลองใหม่",
    },
    error: {
      loadFailed: "โหลดรายการอุปกรณ์ไม่สำเร็จ",
      // Not in the original ui.md §3.5 table — added per the client-security
      // review (Important #3: logoutAll failure was silently treated as
      // success). Copy follows the same "cause + what happened" pattern as
      // the other auth.* error strings; flagging for `ux` to confirm/adjust
      // wording rather than silently inventing final user-facing copy.
      logoutAllFailed: "ออกจากระบบทุกอุปกรณ์ไม่สำเร็จ ลองใหม่อีกครั้ง",
    },
    toast: {
      deviceLoggedOut: "ออกจากอุปกรณ์แล้ว",
      deviceLogoutFailed: "ออกจากอุปกรณ์ไม่สำเร็จ กรุณาลองใหม่",
    },
  },
  confirm: {
    logoutDevice: {
      title: "ออกจากอุปกรณ์นี้?",
      body: "อุปกรณ์นี้จะต้องเข้าสู่ระบบใหม่อีกครั้ง",
      cancel: "ยกเลิก",
      confirm: "ออกจากอุปกรณ์นี้",
    },
    logoutAll: {
      title: "ออกจากระบบทุกอุปกรณ์?",
      body: "ทุกอุปกรณ์ที่เข้าสู่ระบบอยู่ (รวมเครื่องนี้) จะถูกออกจากระบบทันที และต้องเข้าสู่ระบบใหม่ทุกเครื่อง",
      cancel: "ยกเลิก",
      confirm: "ออกจากระบบทุกอุปกรณ์",
      toast: "ออกจากระบบทุกอุปกรณ์แล้ว",
    },
  },
  sessionExpired: {
    toast: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง",
  },
  changePassword: {
    sectionTitle: "เปลี่ยนรหัสผ่าน",
    current: { label: "รหัสผ่านปัจจุบัน" },
    new: {
      label: "รหัสผ่านใหม่",
      placeholder: "อย่างน้อย 8 ตัวอักษร",
      helper: "ใช้ตัวอักษร ตัวเลข หรือวลีที่จำง่าย — ไม่ต้องมีอักขระพิเศษก็ได้",
    },
    submit: "เปลี่ยนรหัสผ่าน",
    submitLoading: "กำลังเปลี่ยนรหัสผ่าน...",
    error: {
      invalidCurrent: "รหัสผ่านปัจจุบันไม่ถูกต้อง",
      passwordTooShort: "รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 8 ตัวอักษร",
      passwordBreached:
        "รหัสผ่านนี้ถูกใช้งานทั่วไปมาก ไม่ปลอดภัย ลองตั้งรหัสผ่านที่คาดเดายากขึ้น",
      generic: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
    },
    successToast: "เปลี่ยนรหัสผ่านแล้ว · อุปกรณ์อื่นถูกออกจากระบบเพื่อความปลอดภัย",
  },
  common: {
    passwordShow: "แสดงรหัสผ่าน",
    passwordHide: "ซ่อนรหัสผ่าน",
    retry: "ลองใหม่",
    cancel: "ยกเลิก",
  },
} as const;
