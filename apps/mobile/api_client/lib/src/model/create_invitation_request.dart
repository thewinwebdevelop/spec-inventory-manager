//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'create_invitation_request.g.dart';

/// CreateInvitationRequest
///
/// Properties:
/// * [email] - Normalized server-side (lower-cased + trimmed).
/// * [roleId] - Mandatory (AC US-3) — there is no default role.
@BuiltValue()
abstract class CreateInvitationRequest implements Built<CreateInvitationRequest, CreateInvitationRequestBuilder> {
  /// Normalized server-side (lower-cased + trimmed).
  @BuiltValueField(wireName: r'email')
  String get email;

  /// Mandatory (AC US-3) — there is no default role.
  @BuiltValueField(wireName: r'roleId')
  String get roleId;

  CreateInvitationRequest._();

  factory CreateInvitationRequest([void updates(CreateInvitationRequestBuilder b)]) = _$CreateInvitationRequest;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CreateInvitationRequestBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<CreateInvitationRequest> get serializer => _$CreateInvitationRequestSerializer();
}

class _$CreateInvitationRequestSerializer implements PrimitiveSerializer<CreateInvitationRequest> {
  @override
  final Iterable<Type> types = const [CreateInvitationRequest, _$CreateInvitationRequest];

  @override
  final String wireName = r'CreateInvitationRequest';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CreateInvitationRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
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
  }

  @override
  Object serialize(
    Serializers serializers,
    CreateInvitationRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CreateInvitationRequestBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
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
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  CreateInvitationRequest deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CreateInvitationRequestBuilder();
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

