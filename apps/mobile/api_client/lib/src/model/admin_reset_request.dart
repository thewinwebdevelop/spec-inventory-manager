//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_reset_request.g.dart';

/// AdminResetRequest
///
/// Properties:
/// * [newPassword] 
@BuiltValue()
abstract class AdminResetRequest implements Built<AdminResetRequest, AdminResetRequestBuilder> {
  @BuiltValueField(wireName: r'newPassword')
  String get newPassword;

  AdminResetRequest._();

  factory AdminResetRequest([void updates(AdminResetRequestBuilder b)]) = _$AdminResetRequest;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminResetRequestBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminResetRequest> get serializer => _$AdminResetRequestSerializer();
}

class _$AdminResetRequestSerializer implements PrimitiveSerializer<AdminResetRequest> {
  @override
  final Iterable<Type> types = const [AdminResetRequest, _$AdminResetRequest];

  @override
  final String wireName = r'AdminResetRequest';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminResetRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'newPassword';
    yield serializers.serialize(
      object.newPassword,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminResetRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminResetRequestBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'newPassword':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.newPassword = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminResetRequest deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminResetRequestBuilder();
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

