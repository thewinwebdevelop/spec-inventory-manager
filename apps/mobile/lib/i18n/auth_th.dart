/// i18n copy for the F-001 auth screens — Thai default, per
/// docs/design-system.md §3 ("ทุก string เป็น i18n key ... default ไทย").
/// Values copied **verbatim** from docs/features/F-001/ui.md §3 (owned by
/// `ux`) — identical to `apps/web/src/i18n/auth.ts` so web/mobile copy never
/// drifts (ux-wireframe §8/§9.6: "copy เดียวกันทุกตัวอักษร"). Do not hand-edit
/// copy here; request changes from `ux`.
///
/// English is not implemented yet (design-system.md §3: "ไทยครบก่อน") — this
/// only exports the Thai table, keyed to mirror ui.md so a future locale
/// layer can slot in without renaming.
class AuthTh {
  AuthTh._();

  // ---- Signup (auth.signup.*) ----
  static const signupTitle = 'สมัครใช้งาน OmniStock';
  static const signupSubtitle = 'เริ่มต้นจัดการสต๊อกและบัญชีร้านค้าของคุณ';
  static const signupEmailLabel = 'อีเมล';
  static const signupEmailPlaceholder = 'เช่น somchai@shop.com';
  static const signupPasswordLabel = 'รหัสผ่าน';
  static const signupPasswordPlaceholder = 'อย่างน้อย 8 ตัวอักษร';
  static const signupPasswordHelper =
      'ใช้ตัวอักษร ตัวเลข หรือวลีที่จำง่าย — ไม่ต้องมีอักขระพิเศษก็ได้';
  static const signupSubmit = 'สมัครใช้งาน';
  static const signupSubmitLoading = 'กำลังสมัคร...';
  static const signupLinkToLogin = 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ';
  static const signupSuccessToast = 'สมัครสำเร็จ! เข้าสู่ระบบเพื่อเริ่มใช้งาน';
  static const signupErrorEmailInvalid = 'รูปแบบอีเมลไม่ถูกต้อง';
  static const signupErrorPasswordTooShort =
      'รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 8 ตัวอักษร';
  static const signupErrorPasswordBreached =
      'รหัสผ่านนี้ถูกใช้งานทั่วไปมาก ไม่ปลอดภัย ลองตั้งรหัสผ่านที่คาดเดายากขึ้น';
  static const signupErrorEmailTaken = 'อีเมลนี้มีผู้ใช้งานแล้ว';
  static const signupErrorEmailTakenLoginLink = 'เข้าสู่ระบบ';
  static const signupErrorGeneric = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';

  // ---- Login (auth.login.*) ----
  static const loginTitle = 'เข้าสู่ระบบ';
  static const loginEmailLabel = 'อีเมล';
  static const loginPasswordLabel = 'รหัสผ่าน';
  static const loginSubmit = 'เข้าสู่ระบบ';
  static const loginSubmitLoading = 'กำลังเข้าสู่ระบบ...';
  static const loginForgotPassword = 'ลืมรหัสผ่าน?';
  static const loginLinkToSignup = 'ยังไม่มีบัญชี? สมัครใช้งาน';
  static const loginErrorInvalidCredentials = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  static const loginErrorGeneric = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';

  // ---- Throttle (auth.throttle.*) — shared login/signup/change-password ----
  static String throttleBannerLong(String mm, String ss) =>
      'ลองเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ · เหลือ $mm:$ss นาที';
  static String throttleBannerShort(int n) => 'รอสักครู่แล้วลองใหม่ · เหลือ $n วินาที';
  static const throttleHelper =
      'เพื่อความปลอดภัยของบัญชีคุณ ระบบจะให้ลองใหม่ได้เองเมื่อครบเวลา';

  // ---- Help / forgot password (auth.help.*) ----
  static const helpTitle = 'ลืมรหัสผ่าน?';
  static const helpBody =
      'ตอนนี้ระบบยังไม่รองรับการขอรีเซ็ตรหัสผ่านด้วยตัวเอง กรุณาติดต่อเจ้าของร้าน/ผู้ดูแลระบบ (Owner/Admin) ในทีมของคุณ เพื่อให้ตั้งรหัสผ่านใหม่ให้';
  static const helpBodySoloOwner =
      'หากคุณเป็นเจ้าของร้านเพียงคนเดียวและลืมรหัสผ่าน กรุณารอสักครู่แล้วลองพิมพ์รหัสผ่านที่คิดว่าถูกต้องอีกครั้ง (ระบบจะไม่ล็อกบัญชีคุณถาวร)';
  static const helpBackToLogin = 'กลับไปเข้าสู่ระบบ';

  // ---- Sessions (auth.sessions.*) ----
  static const sessionsTitle = 'อุปกรณ์ที่เข้าสู่ระบบ';
  static const sessionsSubtitle = 'รายการอุปกรณ์ที่กำลังเข้าใช้งานบัญชีของคุณอยู่';
  static const sessionsBadgeCurrent = 'อุปกรณ์นี้';
  static String sessionsLastActive(String relativeTime) => 'ใช้งานล่าสุด: $relativeTime';
  static const sessionsDeviceUnknown = 'อุปกรณ์ไม่ทราบชื่อ';
  static const sessionsActionLogoutDevice = 'ออกจากอุปกรณ์นี้';
  static const sessionsActionLogoutAll = 'ออกจากระบบทุกอุปกรณ์';
  static const sessionsErrorLoadFailed = 'โหลดรายการอุปกรณ์ไม่สำเร็จ';
  static const sessionsActionRetry = 'ลองใหม่';
  static const sessionsToastDeviceLoggedOut = 'ออกจากอุปกรณ์แล้ว';
  static const sessionsToastDeviceLogoutFailed = 'ออกจากอุปกรณ์ไม่สำเร็จ กรุณาลองใหม่';
  // Mirrors apps/web/src/i18n/auth.ts sessions.error.logoutAllFailed — added
  // per the web client-security review (Important #3); not in the original
  // ui.md §3.5 table but kept parity with web rather than silently diverging.
  static const sessionsErrorLogoutAllFailed = 'ออกจากระบบทุกอุปกรณ์ไม่สำเร็จ ลองใหม่อีกครั้ง';
  // T-001-17 ★ (L-4, mobile-only): `GET /auth/sessions`'s `current` flag is
  // resolved from the `omni_rt` cookie (api-spec §2.6) — mobile is
  // Bearer-only and never sends that cookie, so `current` is always `false`
  // on this platform and no row can be reliably labeled/excluded as "this
  // device". Rather than silently show a misleading "อุปกรณ์นี้" badge or
  // let the user log out the very device they're holding with a
  // superficially-successful action, mobile shows this notice once above
  // the list.
  static const sessionsMobileCannotIdentifyCurrent =
      'อุปกรณ์นี้ไม่สามารถระบุตัวเองในรายการด้านล่างได้ — หากไม่แน่ใจว่าแถวไหนคืออุปกรณ์ที่ถืออยู่ กรุณาระวังก่อนกด "ออกจากอุปกรณ์นี้"';

  // ---- Confirm dialogs (auth.confirm.*) ----
  static const confirmLogoutDeviceTitle = 'ออกจากอุปกรณ์นี้?';
  static const confirmLogoutDeviceBody = 'อุปกรณ์นี้จะต้องเข้าสู่ระบบใหม่อีกครั้ง';
  static const confirmLogoutDeviceCancel = 'ยกเลิก';
  static const confirmLogoutDeviceConfirm = 'ออกจากอุปกรณ์นี้';
  static const confirmLogoutAllTitle = 'ออกจากระบบทุกอุปกรณ์?';
  static const confirmLogoutAllBody =
      'ทุกอุปกรณ์ที่เข้าสู่ระบบอยู่ (รวมเครื่องนี้) จะถูกออกจากระบบทันที และต้องเข้าสู่ระบบใหม่ทุกเครื่อง';
  static const confirmLogoutAllCancel = 'ยกเลิก';
  static const confirmLogoutAllConfirm = 'ออกจากระบบทุกอุปกรณ์';
  static const confirmLogoutAllToast = 'ออกจากระบบทุกอุปกรณ์แล้ว';

  // ---- Session expired (auth.session_expired.*) ----
  static const sessionExpiredToast = 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง';

  // ---- Change password (auth.change_password.*) ----
  static const changePasswordSectionTitle = 'เปลี่ยนรหัสผ่าน';
  static const changePasswordCurrentLabel = 'รหัสผ่านปัจจุบัน';
  static const changePasswordNewLabel = 'รหัสผ่านใหม่';
  static const changePasswordNewPlaceholder = 'อย่างน้อย 8 ตัวอักษร';
  static const changePasswordNewHelper =
      'ใช้ตัวอักษร ตัวเลข หรือวลีที่จำง่าย — ไม่ต้องมีอักขระพิเศษก็ได้';
  static const changePasswordSubmit = 'เปลี่ยนรหัสผ่าน';
  static const changePasswordSubmitLoading = 'กำลังเปลี่ยนรหัสผ่าน...';
  static const changePasswordErrorInvalidCurrent = 'รหัสผ่านปัจจุบันไม่ถูกต้อง';
  static const changePasswordErrorPasswordTooShort =
      'รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 8 ตัวอักษร';
  static const changePasswordErrorPasswordBreached =
      'รหัสผ่านนี้ถูกใช้งานทั่วไปมาก ไม่ปลอดภัย ลองตั้งรหัสผ่านที่คาดเดายากขึ้น';
  static const changePasswordErrorGeneric = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
  static const changePasswordSuccessToast =
      'เปลี่ยนรหัสผ่านแล้ว · อุปกรณ์อื่นถูกออกจากระบบเพื่อความปลอดภัย';

  // ---- Common ----
  static const commonPasswordShow = 'แสดงรหัสผ่าน';
  static const commonPasswordHide = 'ซ่อนรหัสผ่าน';
  static const commonRetry = 'ลองใหม่';
  static const commonCancel = 'ยกเลิก';

  // ---- Cold-start bootstrap (auth.bootstrap.*, T-001-17 M-2/L-3) ----
  // Loading/offline-retry copy for the one-shot "restore session on app
  // start" gate — reuses the same generic-network-error tone as the rest of
  // §7 edge states (design-system.md §2: error copy + a "ลองใหม่" button),
  // not a new error taxonomy.
  static const bootstrapLoading = 'กำลังตรวจสอบสถานะการเข้าสู่ระบบ...';
  static const bootstrapOfflineTitle = 'เชื่อมต่อไม่สำเร็จ';
  static const bootstrapOfflineBody =
      'ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง บัญชีของคุณยังเข้าสู่ระบบอยู่';
  static const bootstrapOfflineRetry = 'ลองใหม่';
}
