//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'role_row.g.dart';

/// One role of a shop (api-spec §3.6). Read-only in F-002; F-003 adds create/update/delete and per-role capability editing.  ⛔ `capabilities` is deliberately NOT published here. It is the field that decides authorization (`full_access` ⇒ Owner), and putting it on a list any active member can read invites a client to compute permissions from it. The server refuses an over-privileged invitation itself (C-1/D-028), so the invite dropdown never needs to filter.  `grantsOwnership` is the ONE derived bit that is published, added for B-9. Without it a client cannot tell which role is the Owner role unless the VIEWER holds it, so ux-wireframe §10.1's rule — show the Owner option, disabled, with the reason — was unimplementable for an Admin, and S7's filter silently filtered nothing. The alternative a client reaches for is `key === \"owner\"`, which is exactly what the golden rule forbids and what F-003's custom roles break. Publishing the bit keeps the capability list private while removing the temptation. 
///
/// Properties:
/// * [id] 
/// * [name] - Display name. Display rule (AC-1.5): `nameCustomized ? name : (translate key ?? name)` — a role the shop renamed shows THIS string, otherwise translate `key` and fall back to it. (A client that ignores `nameCustomized` shows the translation instead of the shop's own name — cosmetic, never a permission issue.) 
/// * [key] - Stable slug for TRANSLATION ONLY (ux Q4). Guaranteed `owner`, `admin` or `staff` for the three system roles — those values are part of the contract and changing one is a breaking change. `null` for any role F-003 lets a user create, because `key` is the system's namespace.  OPEN SET: on `null` or an unrecognised value the client MUST fall back to `name`. Never `switch` without a default.  ⛔ NEVER a permission input, on either side. \"Is this the Owner?\" is answered by capabilities alone (architecture §3.2 / data-model §5.2); @qa's I-45 flips a Staff role's `key` to `\"owner\"` in the database to prove a client that trusted it would be wrong. 
/// * [grantsOwnership] - Does granting this role grant OWNERSHIP? Derived server-side from `capabilities` (`full_access`), never from `key` — @qa's I-45 flips a Staff role's key to `\"owner\"` in the database precisely to prove the difference.  ⚠️ OPTIONAL on purpose (contract-evolution): a client newer than the server must not fail to parse a role list, so absent means \"this server does not say\" and the client falls back to its previous behaviour. It is a UX input — which option to disable, and why — never a permission check: the server refuses an over-privileged grant regardless (C-1/D-028). 
/// * [isSystem] - `true` only for the shop's locked Owner role (F-003): it can be neither edited, renamed nor deleted. Admin and Staff are presets the shop may edit, so they read `false`. Labelling only — use `grantsOwnership` for \"is this ownership?\". 
/// * [nameCustomized] - F-003 (AC-1.5) — the shop renamed this role (always `true` for a role with `key: null`). When `true`, show `name` as-is instead of translating `key`. Absent (older server) = `false`. 
/// * [viewerCanAssign] - F-003 (AC-2.2) — may the CALLER hand out this role (invite with it, or change a member to it)? The same rule the write applies: the role must not grant ownership unless you are an Owner, and must not hold a permission you lack. Show a `false` option DISABLED with the reason — never hide it. A UX input, never enforcement.  Present only when the caller holds `manage_members`. 
/// * [assignBlockedReason] - Present with `viewerCanAssign`; `null` when it is `true`. OPEN SET: `owner_only` · `exceeds_your_permissions`. Never names the missing permission (`capabilities` stays unpublished here). Any other value → generic copy. 
@BuiltValue()
abstract class RoleRow implements Built<RoleRow, RoleRowBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  /// Display name. Display rule (AC-1.5): `nameCustomized ? name : (translate key ?? name)` — a role the shop renamed shows THIS string, otherwise translate `key` and fall back to it. (A client that ignores `nameCustomized` shows the translation instead of the shop's own name — cosmetic, never a permission issue.) 
  @BuiltValueField(wireName: r'name')
  String get name;

  /// Stable slug for TRANSLATION ONLY (ux Q4). Guaranteed `owner`, `admin` or `staff` for the three system roles — those values are part of the contract and changing one is a breaking change. `null` for any role F-003 lets a user create, because `key` is the system's namespace.  OPEN SET: on `null` or an unrecognised value the client MUST fall back to `name`. Never `switch` without a default.  ⛔ NEVER a permission input, on either side. \"Is this the Owner?\" is answered by capabilities alone (architecture §3.2 / data-model §5.2); @qa's I-45 flips a Staff role's `key` to `\"owner\"` in the database to prove a client that trusted it would be wrong. 
  @BuiltValueField(wireName: r'key')
  String? get key;

  /// Does granting this role grant OWNERSHIP? Derived server-side from `capabilities` (`full_access`), never from `key` — @qa's I-45 flips a Staff role's key to `\"owner\"` in the database precisely to prove the difference.  ⚠️ OPTIONAL on purpose (contract-evolution): a client newer than the server must not fail to parse a role list, so absent means \"this server does not say\" and the client falls back to its previous behaviour. It is a UX input — which option to disable, and why — never a permission check: the server refuses an over-privileged grant regardless (C-1/D-028). 
  @BuiltValueField(wireName: r'grantsOwnership')
  bool? get grantsOwnership;

  /// `true` only for the shop's locked Owner role (F-003): it can be neither edited, renamed nor deleted. Admin and Staff are presets the shop may edit, so they read `false`. Labelling only — use `grantsOwnership` for \"is this ownership?\". 
  @BuiltValueField(wireName: r'isSystem')
  bool get isSystem;

  /// F-003 (AC-1.5) — the shop renamed this role (always `true` for a role with `key: null`). When `true`, show `name` as-is instead of translating `key`. Absent (older server) = `false`. 
  @BuiltValueField(wireName: r'nameCustomized')
  bool? get nameCustomized;

  /// F-003 (AC-2.2) — may the CALLER hand out this role (invite with it, or change a member to it)? The same rule the write applies: the role must not grant ownership unless you are an Owner, and must not hold a permission you lack. Show a `false` option DISABLED with the reason — never hide it. A UX input, never enforcement.  Present only when the caller holds `manage_members`. 
  @BuiltValueField(wireName: r'viewerCanAssign')
  bool? get viewerCanAssign;

  /// Present with `viewerCanAssign`; `null` when it is `true`. OPEN SET: `owner_only` · `exceeds_your_permissions`. Never names the missing permission (`capabilities` stays unpublished here). Any other value → generic copy. 
  @BuiltValueField(wireName: r'assignBlockedReason')
  String? get assignBlockedReason;

  RoleRow._();

  factory RoleRow([void updates(RoleRowBuilder b)]) = _$RoleRow;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(RoleRowBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<RoleRow> get serializer => _$RoleRowSerializer();
}

class _$RoleRowSerializer implements PrimitiveSerializer<RoleRow> {
  @override
  final Iterable<Type> types = const [RoleRow, _$RoleRow];

  @override
  final String wireName = r'RoleRow';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    RoleRow object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'name';
    yield serializers.serialize(
      object.name,
      specifiedType: const FullType(String),
    );
    yield r'key';
    yield object.key == null ? null : serializers.serialize(
      object.key,
      specifiedType: const FullType.nullable(String),
    );
    if (object.grantsOwnership != null) {
      yield r'grantsOwnership';
      yield serializers.serialize(
        object.grantsOwnership,
        specifiedType: const FullType(bool),
      );
    }
    yield r'isSystem';
    yield serializers.serialize(
      object.isSystem,
      specifiedType: const FullType(bool),
    );
    if (object.nameCustomized != null) {
      yield r'nameCustomized';
      yield serializers.serialize(
        object.nameCustomized,
        specifiedType: const FullType(bool),
      );
    }
    if (object.viewerCanAssign != null) {
      yield r'viewerCanAssign';
      yield serializers.serialize(
        object.viewerCanAssign,
        specifiedType: const FullType(bool),
      );
    }
    if (object.assignBlockedReason != null) {
      yield r'assignBlockedReason';
      yield serializers.serialize(
        object.assignBlockedReason,
        specifiedType: const FullType.nullable(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    RoleRow object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required RoleRowBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.id = valueDes;
          break;
        case r'name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.name = valueDes;
          break;
        case r'key':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.key = valueDes;
          break;
        case r'grantsOwnership':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.grantsOwnership = valueDes;
          break;
        case r'isSystem':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.isSystem = valueDes;
          break;
        case r'nameCustomized':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.nameCustomized = valueDes;
          break;
        case r'viewerCanAssign':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.viewerCanAssign = valueDes;
          break;
        case r'assignBlockedReason':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.assignBlockedReason = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  RoleRow deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = RoleRowBuilder();
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

