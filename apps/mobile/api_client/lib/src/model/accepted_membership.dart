//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'accepted_membership.g.dart';

/// AcceptedMembership
///
/// Properties:
/// * [roleId] 
/// * [roleName] 
/// * [roleKey] 
/// * [status] 
@BuiltValue()
abstract class AcceptedMembership implements Built<AcceptedMembership, AcceptedMembershipBuilder> {
  @BuiltValueField(wireName: r'roleId')
  String get roleId;

  @BuiltValueField(wireName: r'roleName')
  String get roleName;

  @BuiltValueField(wireName: r'roleKey')
  String? get roleKey;

  @BuiltValueField(wireName: r'status')
  AcceptedMembershipStatusEnum get status;
  // enum statusEnum {  active,  };

  AcceptedMembership._();

  factory AcceptedMembership([void updates(AcceptedMembershipBuilder b)]) = _$AcceptedMembership;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AcceptedMembershipBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AcceptedMembership> get serializer => _$AcceptedMembershipSerializer();
}

class _$AcceptedMembershipSerializer implements PrimitiveSerializer<AcceptedMembership> {
  @override
  final Iterable<Type> types = const [AcceptedMembership, _$AcceptedMembership];

  @override
  final String wireName = r'AcceptedMembership';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AcceptedMembership object, {
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
    yield r'status';
    yield serializers.serialize(
      object.status,
      specifiedType: const FullType(AcceptedMembershipStatusEnum),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AcceptedMembership object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AcceptedMembershipBuilder result,
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
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AcceptedMembershipStatusEnum),
          ) as AcceptedMembershipStatusEnum;
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
  AcceptedMembership deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AcceptedMembershipBuilder();
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

class AcceptedMembershipStatusEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'active')
  static const AcceptedMembershipStatusEnum active = _$acceptedMembershipStatusEnum_active;

  static Serializer<AcceptedMembershipStatusEnum> get serializer => _$acceptedMembershipStatusEnumSerializer;

  const AcceptedMembershipStatusEnum._(String name): super(name);

  static BuiltSet<AcceptedMembershipStatusEnum> get values => _$acceptedMembershipStatusEnumValues;
  static AcceptedMembershipStatusEnum valueOf(String name) => _$acceptedMembershipStatusEnumValueOf(name);
}

