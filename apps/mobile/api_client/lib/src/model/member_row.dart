//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'member_row.g.dart';

/// One row of `GET /orgs/{orgId}/members`, and the `200` body of `PATCH /orgs/{orgId}/members/{userId}` (api-spec §3.7/§3.8) — so a client never has to refetch the list to render the new state. 
///
/// Properties:
/// * [userId] 
/// * [email] - PII under PDPA — the reason this READ requires `manage_members` and the reason the response is `no-store`. 
/// * [roleId] 
/// * [roleName] 
/// * [roleKey] 
/// * [status] - `invited` is a dead state: memberships are created at ACCEPT time only (data-model §7). It is listed because the column allows it, not because a write path produces it. 
/// * [activatedAt] 
/// * [revokedAt] 
/// * [createdAt] 
/// * [isMe] - Decided server-side, so the client never compares ids itself.
/// * [isOwner] - This row's role holds `full_access`. Computed from CAPABILITIES, never from the role's name or key. Use it to hide buttons; the server enforces. 
/// * [roleNameCustomized] - F-003 (AC-1.5) — the shop renamed this role (always `true` when `roleKey` is `null`). Display `roleNameCustomized ? roleName : (translate roleKey ?? roleName)`. 
/// * [viewerCanManage] - F-003 (api-spec §3.1) — may the CALLER change this member's role or remove them? The same rule the write applies (the target must hold strictly less than the caller; your own row is `true`). A UX input, never enforcement: the write re-reads permissions and may still refuse.  ⚠️ PRESENT ONLY when the caller holds BOTH `manage_members` and `manage_roles`, and only on `active` rows (architecture §1.2 — anyone else would learn \"this role equals mine exactly\"). Absent ⇒ keep the F-002 behaviour (show the buttons on active, non-Owner, non-self rows) and show generic copy if the write answers `403 TARGET_NOT_BELOW_ACTOR`. `LAST_OWNER` is shop state, not part of this verdict. 
/// * [manageBlockedReason] - Present with `viewerCanManage`; `null` when it is `true`. OPEN SET, in this fixed order: `owner_only` → `equal_permissions` (same permissions as you — ask the Owner) → `exceeds_your_permissions`. Any other value → generic copy. 
/// * [viewerCanResetPassword] - F-003 — may the CALLER reset this member's password? Same audience as `viewerCanManage`. `true` means \"no rule you can see blocks it\": the reset may still answer its uniform `404` for a reason that is not yours to see (e.g. the member also belongs to another shop). 
/// * [resetBlockedReason] - Present with `viewerCanResetPassword`; `null` when it is `true`. OPEN SET, in this fixed order: `self` → `owner_only` → `equal_permissions` → `exceeds_your_permissions`. Any other value → generic copy. 
@BuiltValue()
abstract class MemberRow implements Built<MemberRow, MemberRowBuilder> {
  @BuiltValueField(wireName: r'userId')
  String get userId;

  /// PII under PDPA — the reason this READ requires `manage_members` and the reason the response is `no-store`. 
  @BuiltValueField(wireName: r'email')
  String get email;

  @BuiltValueField(wireName: r'roleId')
  String get roleId;

  @BuiltValueField(wireName: r'roleName')
  String get roleName;

  @BuiltValueField(wireName: r'roleKey')
  String? get roleKey;

  /// `invited` is a dead state: memberships are created at ACCEPT time only (data-model §7). It is listed because the column allows it, not because a write path produces it. 
  @BuiltValueField(wireName: r'status')
  MemberRowStatusEnum get status;
  // enum statusEnum {  active,  invited,  revoked,  };

  @BuiltValueField(wireName: r'activatedAt')
  DateTime? get activatedAt;

  @BuiltValueField(wireName: r'revokedAt')
  DateTime? get revokedAt;

  @BuiltValueField(wireName: r'createdAt')
  DateTime get createdAt;

  /// Decided server-side, so the client never compares ids itself.
  @BuiltValueField(wireName: r'isMe')
  bool get isMe;

  /// This row's role holds `full_access`. Computed from CAPABILITIES, never from the role's name or key. Use it to hide buttons; the server enforces. 
  @BuiltValueField(wireName: r'isOwner')
  bool get isOwner;

  /// F-003 (AC-1.5) — the shop renamed this role (always `true` when `roleKey` is `null`). Display `roleNameCustomized ? roleName : (translate roleKey ?? roleName)`. 
  @BuiltValueField(wireName: r'roleNameCustomized')
  bool? get roleNameCustomized;

  /// F-003 (api-spec §3.1) — may the CALLER change this member's role or remove them? The same rule the write applies (the target must hold strictly less than the caller; your own row is `true`). A UX input, never enforcement: the write re-reads permissions and may still refuse.  ⚠️ PRESENT ONLY when the caller holds BOTH `manage_members` and `manage_roles`, and only on `active` rows (architecture §1.2 — anyone else would learn \"this role equals mine exactly\"). Absent ⇒ keep the F-002 behaviour (show the buttons on active, non-Owner, non-self rows) and show generic copy if the write answers `403 TARGET_NOT_BELOW_ACTOR`. `LAST_OWNER` is shop state, not part of this verdict. 
  @BuiltValueField(wireName: r'viewerCanManage')
  bool? get viewerCanManage;

  /// Present with `viewerCanManage`; `null` when it is `true`. OPEN SET, in this fixed order: `owner_only` → `equal_permissions` (same permissions as you — ask the Owner) → `exceeds_your_permissions`. Any other value → generic copy. 
  @BuiltValueField(wireName: r'manageBlockedReason')
  String? get manageBlockedReason;

  /// F-003 — may the CALLER reset this member's password? Same audience as `viewerCanManage`. `true` means \"no rule you can see blocks it\": the reset may still answer its uniform `404` for a reason that is not yours to see (e.g. the member also belongs to another shop). 
  @BuiltValueField(wireName: r'viewerCanResetPassword')
  bool? get viewerCanResetPassword;

  /// Present with `viewerCanResetPassword`; `null` when it is `true`. OPEN SET, in this fixed order: `self` → `owner_only` → `equal_permissions` → `exceeds_your_permissions`. Any other value → generic copy. 
  @BuiltValueField(wireName: r'resetBlockedReason')
  String? get resetBlockedReason;

  MemberRow._();

  factory MemberRow([void updates(MemberRowBuilder b)]) = _$MemberRow;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(MemberRowBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<MemberRow> get serializer => _$MemberRowSerializer();
}

class _$MemberRowSerializer implements PrimitiveSerializer<MemberRow> {
  @override
  final Iterable<Type> types = const [MemberRow, _$MemberRow];

  @override
  final String wireName = r'MemberRow';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    MemberRow object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'userId';
    yield serializers.serialize(
      object.userId,
      specifiedType: const FullType(String),
    );
    yield r'email';
    yield serializers.serialize(
      object.email,
      specifiedType: const FullType(String),
    );
    yield r'roleId';
    yield serializers.serialize(
      object.roleId,
      specifiedType: const FullType(String),
    );
    yield r'roleName';
    yield serializers.serialize(
      object.roleName,
      specifiedType: const FullType(String),
    );
    yield r'roleKey';
    yield object.roleKey == null ? null : serializers.serialize(
      object.roleKey,
      specifiedType: const FullType.nullable(String),
    );
    yield r'status';
    yield serializers.serialize(
      object.status,
      specifiedType: const FullType(MemberRowStatusEnum),
    );
    yield r'activatedAt';
    yield object.activatedAt == null ? null : serializers.serialize(
      object.activatedAt,
      specifiedType: const FullType.nullable(DateTime),
    );
    yield r'revokedAt';
    yield object.revokedAt == null ? null : serializers.serialize(
      object.revokedAt,
      specifiedType: const FullType.nullable(DateTime),
    );
    yield r'createdAt';
    yield serializers.serialize(
      object.createdAt,
      specifiedType: const FullType(DateTime),
    );
    yield r'isMe';
    yield serializers.serialize(
      object.isMe,
      specifiedType: const FullType(bool),
    );
    yield r'isOwner';
    yield serializers.serialize(
      object.isOwner,
      specifiedType: const FullType(bool),
    );
    if (object.roleNameCustomized != null) {
      yield r'roleNameCustomized';
      yield serializers.serialize(
        object.roleNameCustomized,
        specifiedType: const FullType(bool),
      );
    }
    if (object.viewerCanManage != null) {
      yield r'viewerCanManage';
      yield serializers.serialize(
        object.viewerCanManage,
        specifiedType: const FullType(bool),
      );
    }
    if (object.manageBlockedReason != null) {
      yield r'manageBlockedReason';
      yield serializers.serialize(
        object.manageBlockedReason,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.viewerCanResetPassword != null) {
      yield r'viewerCanResetPassword';
      yield serializers.serialize(
        object.viewerCanResetPassword,
        specifiedType: const FullType(bool),
      );
    }
    if (object.resetBlockedReason != null) {
      yield r'resetBlockedReason';
      yield serializers.serialize(
        object.resetBlockedReason,
        specifiedType: const FullType.nullable(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    MemberRow object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required MemberRowBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'userId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.userId = valueDes;
          break;
        case r'email':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.email = valueDes;
          break;
        case r'roleId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.roleId = valueDes;
          break;
        case r'roleName':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.roleName = valueDes;
          break;
        case r'roleKey':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.roleKey = valueDes;
          break;
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(MemberRowStatusEnum),
          ) as MemberRowStatusEnum;
          result.status = valueDes;
          break;
        case r'activatedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(DateTime),
          ) as DateTime?;
          if (valueDes == null) continue;
          result.activatedAt = valueDes;
          break;
        case r'revokedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(DateTime),
          ) as DateTime?;
          if (valueDes == null) continue;
          result.revokedAt = valueDes;
          break;
        case r'createdAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.createdAt = valueDes;
          break;
        case r'isMe':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.isMe = valueDes;
          break;
        case r'isOwner':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.isOwner = valueDes;
          break;
        case r'roleNameCustomized':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.roleNameCustomized = valueDes;
          break;
        case r'viewerCanManage':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.viewerCanManage = valueDes;
          break;
        case r'manageBlockedReason':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.manageBlockedReason = valueDes;
          break;
        case r'viewerCanResetPassword':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.viewerCanResetPassword = valueDes;
          break;
        case r'resetBlockedReason':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.resetBlockedReason = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  MemberRow deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = MemberRowBuilder();
    final serializedList = (serialized as Iterable<Object?>).toList();
    final unhandled = <Object?>[];
    _deserializeProperties(
      serializers,
      serialized,
      specifiedType: specifiedType,
      serializedList: serializedList,
      unhandled: unhandled,
      result: result,
    );
    return result.build();
  }
}

class MemberRowStatusEnum extends EnumClass {

  /// `invited` is a dead state: memberships are created at ACCEPT time only (data-model §7). It is listed because the column allows it, not because a write path produces it. 
  @BuiltValueEnumConst(wireName: r'active')
  static const MemberRowStatusEnum active = _$memberRowStatusEnum_active;
  /// `invited` is a dead state: memberships are created at ACCEPT time only (data-model §7). It is listed because the column allows it, not because a write path produces it. 
  @BuiltValueEnumConst(wireName: r'invited')
  static const MemberRowStatusEnum invited = _$memberRowStatusEnum_invited;
  /// `invited` is a dead state: memberships are created at ACCEPT time only (data-model §7). It is listed because the column allows it, not because a write path produces it. 
  @BuiltValueEnumConst(wireName: r'revoked')
  static const MemberRowStatusEnum revoked = _$memberRowStatusEnum_revoked;

  static Serializer<MemberRowStatusEnum> get serializer => _$memberRowStatusEnumSerializer;

  const MemberRowStatusEnum._(String name): super(name);

  static BuiltSet<MemberRowStatusEnum> get values => _$memberRowStatusEnumValues;
  static MemberRowStatusEnum valueOf(String name) => _$memberRowStatusEnumValueOf(name);
}

