//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'logout_request.g.dart';

/// LogoutRequest
///
/// Properties:
/// * [refreshToken] - Body-transport refresh token (mobile). Web uses the cookie.
/// * [familyId] - Optional — revoke a specific LISTED family owned by the caller (M-3).
@BuiltValue()
abstract class LogoutRequest implements Built<LogoutRequest, LogoutRequestBuilder> {
  /// Body-transport refresh token (mobile). Web uses the cookie.
  @BuiltValueField(wireName: r'refreshToken')
  String? get refreshToken;

  /// Optional — revoke a specific LISTED family owned by the caller (M-3).
  @BuiltValueField(wireName: r'familyId')
  String? get familyId;

  LogoutRequest._();

  factory LogoutRequest([void updates(LogoutRequestBuilder b)]) = _$LogoutRequest;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(LogoutRequestBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<LogoutRequest> get serializer => _$LogoutRequestSerializer();
}

class _$LogoutRequestSerializer implements PrimitiveSerializer<LogoutRequest> {
  @override
  final Iterable<Type> types = const [LogoutRequest, _$LogoutRequest];

  @override
  final String wireName = r'LogoutRequest';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    LogoutRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.refreshToken != null) {
      yield r'refreshToken';
      yield serializers.serialize(
        object.refreshToken,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.familyId != null) {
      yield r'familyId';
      yield serializers.serialize(
        object.familyId,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    LogoutRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required LogoutRequestBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'refreshToken':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.refreshToken = valueDes;
          break;
        case r'familyId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.familyId = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  LogoutRequest deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = LogoutRequestBuilder();
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

