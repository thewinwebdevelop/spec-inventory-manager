//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'signup_response.g.dart';

/// SignupResponse
///
/// Properties:
/// * [userId] 
/// * [email] 
/// * [verified] 
@BuiltValue()
abstract class SignupResponse implements Built<SignupResponse, SignupResponseBuilder> {
  @BuiltValueField(wireName: r'userId')
  String get userId;

  @BuiltValueField(wireName: r'email')
  String get email;

  @BuiltValueField(wireName: r'verified')
  SignupResponseVerifiedEnum get verified;
  // enum verifiedEnum {  false,  };

  SignupResponse._();

  factory SignupResponse([void updates(SignupResponseBuilder b)]) = _$SignupResponse;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(SignupResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<SignupResponse> get serializer => _$SignupResponseSerializer();
}

class _$SignupResponseSerializer implements PrimitiveSerializer<SignupResponse> {
  @override
  final Iterable<Type> types = const [SignupResponse, _$SignupResponse];

  @override
  final String wireName = r'SignupResponse';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    SignupResponse object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'userId';
    yield serializers.serialize(
      object.userId,
      specifiedType: const FullType(String),
    );
    yield r'email';
    yield serializers.serialize(
      object.email,
      specifiedType: const FullType(String),
    );
    yield r'verified';
    yield serializers.serialize(
      object.verified,
      specifiedType: const FullType(SignupResponseVerifiedEnum),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    SignupResponse object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required SignupResponseBuilder result,
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
        case r'email':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.email = valueDes;
          break;
        case r'verified':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(SignupResponseVerifiedEnum),
          ) as SignupResponseVerifiedEnum;
          result.verified = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  SignupResponse deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = SignupResponseBuilder();
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

class SignupResponseVerifiedEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'false')
  static const SignupResponseVerifiedEnum false_ = _$signupResponseVerifiedEnum_false_;

  static Serializer<SignupResponseVerifiedEnum> get serializer => _$signupResponseVerifiedEnumSerializer;

  const SignupResponseVerifiedEnum._(String name): super(name);

  static BuiltSet<SignupResponseVerifiedEnum> get values => _$signupResponseVerifiedEnumValues;
  static SignupResponseVerifiedEnum valueOf(String name) => _$signupResponseVerifiedEnumValueOf(name);
}

