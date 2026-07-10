/// Domain entity for one row of "อุปกรณ์ที่เข้าสู่ระบบ" (ux-wireframe §4/§11.5) —
/// PURE DART (docs/mobile-architecture.md §2/§5: "Session, AuthTokens
/// (ไม่ใช่ DTO ที่ gen มา)"), so `presentation/` never imports the generated
/// `omnistock_api_client` package directly (boundary rule: generated client
/// import is only allowed in `features/*/data/**` + `core/api/**`).
///
/// `features/auth/data/auth_repository_impl.dart` maps the wire
/// `omnistock_api_client.Session` (built_value DTO) to this entity —
/// field-for-field, no reshaping of meaning (frontend does not decide
/// API/data shape; this is purely "stop leaking the generated type into the
/// widget tree").
class Session {
  const Session({
    required this.familyId,
    required this.deviceId,
    required this.createdAt,
    required this.lastUsedAt,
    required this.current,
  });

  final String familyId;
  final String? deviceId;
  final DateTime createdAt;
  final DateTime? lastUsedAt;

  /// True for the family matching the caller's `omni_rt` cookie (C-1) — on
  /// mobile (Bearer-only, body-transport) this is always `false` server-side
  /// (api-spec §2.6); see `AuthTh.sessionsMobileCannotIdentifyCurrent` /
  /// `SessionListState`'s L-4 notice.
  final bool current;
}
