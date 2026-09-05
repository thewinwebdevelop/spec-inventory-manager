//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'new_organization_membership.g.dart';

/// NewOrganizationMembership
///
/// Properties:
/// * [userId] 
/// * [roleId] 
/// * [roleName] 
/// * [roleKey] - `owner` for the creator's system role.
/// * [status] 
@BuiltValue()
abstract class NewOrganizationMembership implements Built<NewOrganizationMembership, NewOrganizationMembershipBuilder> {
  @BuiltValueField(wireName: r'userId')
  String get userId;

  @BuiltValueField(wireName: r'roleId')
  String get roleId;

  @BuiltValueField(wireName: r'roleName')
  String get roleName;

  /// `owner` for the creator's system role.
  @BuiltValueField(wireName: r'roleKey')
  String? get roleKey;

  @BuiltValueField(wireName: r'status')
  String get status;

  NewOrganizationMembership._();

  factory NewOrganizationMembership([void updates(NewOrganizationMembershipBuilder b)]) = _$NewOrganizationMembership;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(NewOrganizationMembershipBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<NewOrganizationMembership> get serializer => _$NewOrganizationMembershipSerializer();
}

class _$NewOrganizationMembershipSerializer implements PrimitiveSerializer<NewOrganizationMembership> {
  @override
  final Iterable<Type> types = const [NewOrganizationMembership, _$NewOrganizationMembership];

  @override
  final String wireName = r'NewOrganizationMembership';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    NewOrganizationMembership object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'userId';
    yield serializers.serialize(
      object.userId,
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
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    NewOrganizationMembership object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required NewOrganizationMembershipBuilder result,
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
  NewOrganizationMembership deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = NewOrganizationMembershipBuilder();
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

