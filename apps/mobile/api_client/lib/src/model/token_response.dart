//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'token_response.g.dart';

/// TokenResponse
///
/// Properties:
/// * [accessToken] - HS256 JWT access token (Bearer). 15-minute TTL.
/// * [refreshToken] - The rotated refresh token on the BODY transport; `null` on the cookie transport (the token is in the httpOnly `omni_rt` cookie, never JS-readable — H-1). 
/// * [expiresIn] - Access-token TTL in seconds (900).
/// * [tokenType] 
@BuiltValue()
abstract class TokenResponse implements Built<TokenResponse, TokenResponseBuilder> {
  /// HS256 JWT access token (Bearer). 15-minute TTL.
  @BuiltValueField(wireName: r'accessToken')
  String get accessToken;

  /// The rotated refresh token on the BODY transport; `null` on the cookie transport (the token is in the httpOnly `omni_rt` cookie, never JS-readable — H-1). 
  @BuiltValueField(wireName: r'refreshToken')
  String? get refreshToken;

  /// Access-token TTL in seconds (900).
  @BuiltValueField(wireName: r'expiresIn')
  int get expiresIn;

  @BuiltValueField(wireName: r'tokenType')
  TokenResponseTokenTypeEnum get tokenType;
  // enum tokenTypeEnum {  Bearer,  };

  TokenResponse._();

  factory TokenResponse([void updates(TokenResponseBuilder b)]) = _$TokenResponse;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(TokenResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<TokenResponse> get serializer => _$TokenResponseSerializer();
}

class _$TokenResponseSerializer implements PrimitiveSerializer<TokenResponse> {
  @override
  final Iterable<Type> types = const [TokenResponse, _$TokenResponse];

  @override
  final String wireName = r'TokenResponse';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    TokenResponse object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'accessToken';
    yield serializers.serialize(
      object.accessToken,
      specifiedType: const FullType(String),
    );
    yield r'refreshToken';
    yield object.refreshToken == null ? null : serializers.serialize(
      object.refreshToken,
      specifiedType: const FullType.nullable(String),
    );
    yield r'expiresIn';
    yield serializers.serialize(
      object.expiresIn,
      specifiedType: const FullType(int),
    );
    yield r'tokenType';
    yield serializers.serialize(
      object.tokenType,
      specifiedType: const FullType(TokenResponseTokenTypeEnum),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    TokenResponse object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required TokenResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'accessToken':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.accessToken = valueDes;
          break;
        case r'refreshToken':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.refreshToken = valueDes;
          break;
        case r'expiresIn':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.expiresIn = valueDes;
          break;
        case r'tokenType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(TokenResponseTokenTypeEnum),
          ) as TokenResponseTokenTypeEnum;
          result.tokenType = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  TokenResponse deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = TokenResponseBuilder();
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

class TokenResponseTokenTypeEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'Bearer')
  static const TokenResponseTokenTypeEnum bearer = _$tokenResponseTokenTypeEnum_bearer;

  static Serializer<TokenResponseTokenTypeEnum> get serializer => _$tokenResponseTokenTypeEnumSerializer;

  const TokenResponseTokenTypeEnum._(String name): super(name);

  static BuiltSet<TokenResponseTokenTypeEnum> get values => _$tokenResponseTokenTypeEnumValues;
  static TokenResponseTokenTypeEnum valueOf(String name) => _$tokenResponseTokenTypeEnumValueOf(name);
}

