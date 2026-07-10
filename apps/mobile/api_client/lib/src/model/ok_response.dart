//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'ok_response.g.dart';

/// OkResponse
///
/// Properties:
/// * [ok] 
@BuiltValue()
abstract class OkResponse implements Built<OkResponse, OkResponseBuilder> {
  @BuiltValueField(wireName: r'ok')
  OkResponseOkEnum get ok;
  // enum okEnum {  true,  };

  OkResponse._();

  factory OkResponse([void updates(OkResponseBuilder b)]) = _$OkResponse;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(OkResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<OkResponse> get serializer => _$OkResponseSerializer();
}

class _$OkResponseSerializer implements PrimitiveSerializer<OkResponse> {
  @override
  final Iterable<Type> types = const [OkResponse, _$OkResponse];

  @override
  final String wireName = r'OkResponse';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    OkResponse object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'ok';
    yield serializers.serialize(
      object.ok,
      specifiedType: const FullType(OkResponseOkEnum),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    OkResponse object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required OkResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'ok':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(OkResponseOkEnum),
          ) as OkResponseOkEnum;
          result.ok = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  OkResponse deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = OkResponseBuilder();
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

class OkResponseOkEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'true')
  static const OkResponseOkEnum true_ = _$okResponseOkEnum_true_;

  static Serializer<OkResponseOkEnum> get serializer => _$okResponseOkEnumSerializer;

  const OkResponseOkEnum._(String name): super(name);

  static BuiltSet<OkResponseOkEnum> get values => _$okResponseOkEnumValues;
  static OkResponseOkEnum valueOf(String name) => _$okResponseOkEnumValueOf(name);
}

