//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'update_member_role_request.g.dart';

/// UpdateMemberRoleRequest
///
/// Properties:
/// * [roleId] - Must be a role OF THIS SHOP — otherwise `422 ROLE_INVALID`. A role id from another tenant and one that never existed are indistinguishable by construction (no cross-tenant existence oracle). 
@BuiltValue()
abstract class UpdateMemberRoleRequest implements Built<UpdateMemberRoleRequest, UpdateMemberRoleRequestBuilder> {
  /// Must be a role OF THIS SHOP — otherwise `422 ROLE_INVALID`. A role id from another tenant and one that never existed are indistinguishable by construction (no cross-tenant existence oracle). 
  @BuiltValueField(wireName: r'roleId')
  String get roleId;

  UpdateMemberRoleRequest._();

  factory UpdateMemberRoleRequest([void updates(UpdateMemberRoleRequestBuilder b)]) = _$UpdateMemberRoleRequest;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(UpdateMemberRoleRequestBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<UpdateMemberRoleRequest> get serializer => _$UpdateMemberRoleRequestSerializer();
}

class _$UpdateMemberRoleRequestSerializer implements PrimitiveSerializer<UpdateMemberRoleRequest> {
  @override
  final Iterable<Type> types = const [UpdateMemberRoleRequest, _$UpdateMemberRoleRequest];

  @override
  final String wireName = r'UpdateMemberRoleRequest';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    UpdateMemberRoleRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'roleId';
    yield serializers.serialize(
      object.roleId,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    UpdateMemberRoleRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required UpdateMemberRoleRequestBuilder result,
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
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  UpdateMemberRoleRequest deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = UpdateMemberRoleRequestBuilder();
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

