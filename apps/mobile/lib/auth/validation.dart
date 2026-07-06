/// Client-side validation mirroring the server rules (ux-wireframe §2: "email
/// รูปแบบผิด" on blur/submit, password length hint). This NEVER authorizes
/// anything (client-security skill) — the server remains the source of truth
/// for PASSWORD_BREACHED / EMAIL_TAKEN / etc.; this only gives fast feedback
/// for the two structural checks the server also enforces first (email
/// shape, min length 8). Mirrors apps/web/src/lib/validation.ts exactly.
const int passwordMinLength = 8;

final RegExp _emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

bool isValidEmailShape(String email) => _emailRe.hasMatch(email.trim());

/// Uses `.runes.length` (code-point count) rather than `.length`
/// (UTF-16-code-unit count) so a password containing characters outside the
/// BMP is not over-counted — matches the server's length semantics more
/// closely than a raw UTF-16 length would.
bool isPasswordLongEnough(String password) => password.runes.length >= passwordMinLength;
