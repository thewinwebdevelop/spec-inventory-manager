//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'org_my_membership.g.dart';

/// The CALLER's own membership in this shop.
///
/// Properties:
/// * [roleId] 
/// * [roleName] 
/// * [roleKey] - `owner|admin|staff` for a system role, `null` for an F-003 custom one. Open set — an unknown value MUST fall back to showing `roleName`. ⛔ Never use it to decide permissions; use `capabilities`. 
/// * [capabilities] - What the client may OFFER. Not enforcement — the server refuses the call regardless (architecture §3.1). 
/// * [status] - Always `active` here — a non-member cannot reach this endpoint.
@BuiltValue()
abstract class OrgMyMembership implements Built<OrgMyMembership, OrgMyMembershipBuilder> {
  @BuiltValueField(wireName: r'roleId')
  String get roleId;

  @BuiltValueField(wireName: r'roleName')
  String get roleName;

  /// `owner|admin|staff` for a system role, `null` for an F-003 custom one. Open set — an unknown value MUST fall back to showing `roleName`. ⛔ Never use it to decide permissions; use `capabilities`. 
  @BuiltValueField(wireName: r'roleKey')
  String? get roleKey;

  /// What the client may OFFER. Not enforcement — the server refuses the call regardless (architecture §3.1). 
  @BuiltValueField(wireName: r'capabilities')
  BuiltList<String> get capabilities;

  /// Always `active` here — a non-member cannot reach this endpoint.
  @BuiltValueField(wireName: r'status')
  String get status;

  OrgMyMembership._();

  factory OrgMyMembership([void updates(OrgMyMembershipBuilder b)]) = _$OrgMyMembership;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(OrgMyMembershipBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<OrgMyMembership> get serializer => _$OrgMyMembershipSerializer();
}

class _$OrgMyMembershipSerializer implements PrimitiveSerializer<OrgMyMembership> {
  @override
  final Iterable<Type> types = const [OrgMyMembership, _$OrgMyMembership];

  @override
  final String wireName = r'OrgMyMembership';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    OrgMyMembership object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
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
    yield r'capabilities';
    yield serializers.serialize(
      object.capabilities,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
    yield r'status';
    yield serializers.serialize(
      object.status,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    OrgMyMembership object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required OrgMyMembershipBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
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
        case r'capabilities':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.capabilities.replace(valueDes);
          break;
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.status = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  OrgMyMembership deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = OrgMyMembershipBuilder();
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

