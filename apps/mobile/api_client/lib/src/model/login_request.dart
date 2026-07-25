//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'login_request.g.dart';

/// LoginRequest
///
/// Properties:
/// * [email] 
/// * [password] 
/// * [deviceId] - Client session label (arch §4). Not a security boundary.
/// * [tokenTransport] - Refresh-token delivery channel (api-spec §0). Web sends \"cookie\"; mobile omits or sends \"body\". 
@BuiltValue()
abstract class LoginRequest implements Built<LoginRequest, LoginRequestBuilder> {
  @BuiltValueField(wireName: r'email')
  String get email;

  @BuiltValueField(wireName: r'password')
  String get password;

  /// Client session label (arch §4). Not a security boundary.
  @BuiltValueField(wireName: r'deviceId')
  String? get deviceId;

  /// Refresh-token delivery channel (api-spec §0). Web sends \"cookie\"; mobile omits or sends \"body\". 
  @BuiltValueField(wireName: r'tokenTransport')
  LoginRequestTokenTransportEnum? get tokenTransport;
  // enum tokenTransportEnum {  cookie,  body,  };

  LoginRequest._();

  factory LoginRequest([void updates(LoginRequestBuilder b)]) = _$LoginRequest;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(LoginRequestBuilder b) => b
      ..tokenTransport = LoginRequestTokenTransportEnum.valueOf('body');

  @BuiltValueSerializer(custom: true)
  static Serializer<LoginRequest> get serializer => _$LoginRequestSerializer();
}

class _$LoginRequestSerializer implements PrimitiveSerializer<LoginRequest> {
  @override
  final Iterable<Type> types = const [LoginRequest, _$LoginRequest];

  @override
  final String wireName = r'LoginRequest';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    LoginRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'email';
    yield serializers.serialize(
      object.email,
      specifiedType: const FullType(String),
    );
    yield r'password';
    yield serializers.serialize(
      object.password,
      specifiedType: const FullType(String),
    );
    if (object.deviceId != null) {
      yield r'deviceId';
      yield serializers.serialize(
        object.deviceId,
        specifiedType: const FullType(String),
      );
    }
    if (object.tokenTransport != null) {
      yield r'tokenTransport';
      yield serializers.serialize(
        object.tokenTransport,
        specifiedType: const FullType(LoginRequestTokenTransportEnum),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    LoginRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required LoginRequestBuilder result,
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
        case r'password':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.password = valueDes;
          break;
        case r'deviceId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.deviceId = valueDes;
          break;
        case r'tokenTransport':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(LoginRequestTokenTransportEnum),
          ) as LoginRequestTokenTransportEnum;
          result.tokenTransport = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  LoginRequest deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = LoginRequestBuilder();
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

class LoginRequestTokenTransportEnum extends EnumClass {

  /// Refresh-token delivery channel (api-spec §0). Web sends \"cookie\"; mobile omits or sends \"body\". 
  @BuiltValueEnumConst(wireName: r'cookie')
  static const LoginRequestTokenTransportEnum cookie = _$loginRequestTokenTransportEnum_cookie;
  /// Refresh-token delivery channel (api-spec §0). Web sends \"cookie\"; mobile omits or sends \"body\". 
  @BuiltValueEnumConst(wireName: r'body')
  static const LoginRequestTokenTransportEnum body = _$loginRequestTokenTransportEnum_body;

  static Serializer<LoginRequestTokenTransportEnum> get serializer => _$loginRequestTokenTransportEnumSerializer;

  const LoginRequestTokenTransportEnum._(String name): super(name);

  static BuiltSet<LoginRequestTokenTransportEnum> get values => _$loginRequestTokenTransportEnumValues;
  static LoginRequestTokenTransportEnum valueOf(String name) => _$loginRequestTokenTransportEnumValueOf(name);
}

