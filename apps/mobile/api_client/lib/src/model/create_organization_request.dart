//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'create_organization_request.g.dart';

/// CreateOrganizationRequest
///
/// Properties:
/// * [name] - Not unique — two shops may share a name.
/// * [timezone] - Optional IANA zone; defaults to Asia/Bangkok.
@BuiltValue()
abstract class CreateOrganizationRequest implements Built<CreateOrganizationRequest, CreateOrganizationRequestBuilder> {
  /// Not unique — two shops may share a name.
  @BuiltValueField(wireName: r'name')
  String get name;

  /// Optional IANA zone; defaults to Asia/Bangkok.
  @BuiltValueField(wireName: r'timezone')
  String? get timezone;

  CreateOrganizationRequest._();

  factory CreateOrganizationRequest([void updates(CreateOrganizationRequestBuilder b)]) = _$CreateOrganizationRequest;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CreateOrganizationRequestBuilder b) => b
      ..timezone = 'Asia/Bangkok';

  @BuiltValueSerializer(custom: true)
  static Serializer<CreateOrganizationRequest> get serializer => _$CreateOrganizationRequestSerializer();
}

class _$CreateOrganizationRequestSerializer implements PrimitiveSerializer<CreateOrganizationRequest> {
  @override
  final Iterable<Type> types = const [CreateOrganizationRequest, _$CreateOrganizationRequest];

  @override
  final String wireName = r'CreateOrganizationRequest';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CreateOrganizationRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'name';
    yield serializers.serialize(
      object.name,
      specifiedType: const FullType(String),
    );
    if (object.timezone != null) {
      yield r'timezone';
      yield serializers.serialize(
        object.timezone,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    CreateOrganizationRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CreateOrganizationRequestBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.name = valueDes;
          break;
        case r'timezone':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.timezone = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  CreateOrganizationRequest deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CreateOrganizationRequestBuilder();
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

