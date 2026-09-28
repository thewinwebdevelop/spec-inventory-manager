//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'update_role_request.g.dart';

/// Rename and/or replace the capability set. At least one of `name` and `capabilities` must be sent. Sending the values already stored is a no-op: `200` with the current role, `version` unchanged. 
///
/// Properties:
/// * [version] - The `RoleDetail.version` the user was looking at.
/// * [name] - Same rules as `CreateRoleRequest.name`.
/// * [capabilities] - The WHOLE new set (replace, not a diff). Same rules as `CreateRoleRequest.capabilities`. 
@BuiltValue()
abstract class UpdateRoleRequest implements Built<UpdateRoleRequest, UpdateRoleRequestBuilder> {
  /// The `RoleDetail.version` the user was looking at.
  @BuiltValueField(wireName: r'version')
  int get version;

  /// Same rules as `CreateRoleRequest.name`.
  @BuiltValueField(wireName: r'name')
  String? get name;

  /// The WHOLE new set (replace, not a diff). Same rules as `CreateRoleRequest.capabilities`. 
  @BuiltValueField(wireName: r'capabilities')
  BuiltList<String>? get capabilities;

  UpdateRoleRequest._();

  factory UpdateRoleRequest([void updates(UpdateRoleRequestBuilder b)]) = _$UpdateRoleRequest;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(UpdateRoleRequestBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<UpdateRoleRequest> get serializer => _$UpdateRoleRequestSerializer();
}

class _$UpdateRoleRequestSerializer implements PrimitiveSerializer<UpdateRoleRequest> {
  @override
  final Iterable<Type> types = const [UpdateRoleRequest, _$UpdateRoleRequest];

  @override
  final String wireName = r'UpdateRoleRequest';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    UpdateRoleRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'version';
    yield serializers.serialize(
      object.version,
      specifiedType: const FullType(int),
    );
    if (object.name != null) {
      yield r'name';
      yield serializers.serialize(
        object.name,
        specifiedType: const FullType(String),
      );
    }
    if (object.capabilities != null) {
      yield r'capabilities';
      yield serializers.serialize(
        object.capabilities,
        specifiedType: const FullType(BuiltList, [FullType(String)]),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    UpdateRoleRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required UpdateRoleRequestBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'version':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.version = valueDes;
          break;
        case r'name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.name = valueDes;
          break;
        case r'capabilities':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.capabilities.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  UpdateRoleRequest deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = UpdateRoleRequestBuilder();
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

