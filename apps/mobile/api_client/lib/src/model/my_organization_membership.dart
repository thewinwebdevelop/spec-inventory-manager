//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'my_organization_membership.g.dart';

/// THE SHAPE DEPENDS ON `status` (M-10). For an `active` membership the role fields are present. For a shop the caller has been removed from (only reachable via `?status=all`) the server returns `status` + `revokedAt` and NOTHING else — the role they held is an internal fact about an org they are no longer part of. 
///
/// Properties:
/// * [status] 
/// * [roleId] - Present only on the `active` (full) shape.
/// * [roleName] - Present only on the `active` (full) shape.
/// * [roleKey] - Present only on the `active` (full) shape.
/// * [revokedAt] - Present only on the revoked (short) shape.
@BuiltValue()
abstract class MyOrganizationMembership implements Built<MyOrganizationMembership, MyOrganizationMembershipBuilder> {
  @BuiltValueField(wireName: r'status')
  MyOrganizationMembershipStatusEnum get status;
  // enum statusEnum {  active,  invited,  revoked,  };

  /// Present only on the `active` (full) shape.
  @BuiltValueField(wireName: r'roleId')
  String? get roleId;

  /// Present only on the `active` (full) shape.
  @BuiltValueField(wireName: r'roleName')
  String? get roleName;

  /// Present only on the `active` (full) shape.
  @BuiltValueField(wireName: r'roleKey')
  String? get roleKey;

  /// Present only on the revoked (short) shape.
  @BuiltValueField(wireName: r'revokedAt')
  DateTime? get revokedAt;

  MyOrganizationMembership._();

  factory MyOrganizationMembership([void updates(MyOrganizationMembershipBuilder b)]) = _$MyOrganizationMembership;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(MyOrganizationMembershipBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<MyOrganizationMembership> get serializer => _$MyOrganizationMembershipSerializer();
}

class _$MyOrganizationMembershipSerializer implements PrimitiveSerializer<MyOrganizationMembership> {
  @override
  final Iterable<Type> types = const [MyOrganizationMembership, _$MyOrganizationMembership];

  @override
  final String wireName = r'MyOrganizationMembership';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    MyOrganizationMembership object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'status';
    yield serializers.serialize(
      object.status,
      specifiedType: const FullType(MyOrganizationMembershipStatusEnum),
    );
    if (object.roleId != null) {
      yield r'roleId';
      yield serializers.serialize(
        object.roleId,
        specifiedType: const FullType(String),
      );
    }
    if (object.roleName != null) {
      yield r'roleName';
      yield serializers.serialize(
        object.roleName,
        specifiedType: const FullType(String),
      );
    }
    if (object.roleKey != null) {
      yield r'roleKey';
      yield serializers.serialize(
        object.roleKey,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.revokedAt != null) {
      yield r'revokedAt';
      yield serializers.serialize(
        object.revokedAt,
        specifiedType: const FullType.nullable(DateTime),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    MyOrganizationMembership object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required MyOrganizationMembershipBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(MyOrganizationMembershipStatusEnum),
          ) as MyOrganizationMembershipStatusEnum;
          result.status = valueDes;
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
        case r'revokedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(DateTime),
          ) as DateTime?;
          if (valueDes == null) continue;
          result.revokedAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  MyOrganizationMembership deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = MyOrganizationMembershipBuilder();
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

class MyOrganizationMembershipStatusEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'active')
  static const MyOrganizationMembershipStatusEnum active = _$myOrganizationMembershipStatusEnum_active;
  @BuiltValueEnumConst(wireName: r'invited')
  static const MyOrganizationMembershipStatusEnum invited = _$myOrganizationMembershipStatusEnum_invited;
  @BuiltValueEnumConst(wireName: r'revoked')
  static const MyOrganizationMembershipStatusEnum revoked = _$myOrganizationMembershipStatusEnum_revoked;

  static Serializer<MyOrganizationMembershipStatusEnum> get serializer => _$myOrganizationMembershipStatusEnumSerializer;

  const MyOrganizationMembershipStatusEnum._(String name): super(name);

  static BuiltSet<MyOrganizationMembershipStatusEnum> get values => _$myOrganizationMembershipStatusEnumValues;
  static MyOrganizationMembershipStatusEnum valueOf(String name) => _$myOrganizationMembershipStatusEnumValueOf(name);
}

