//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'organization_summary.g.dart';

/// The three fields an org switcher row needs.
///
/// Properties:
/// * [id] 
/// * [name] 
/// * [logo] - Phase 0: always `null`. Uploads arrive with F-040; until then `PATCH /orgs/{orgId}` accepts `null` and nothing else (M-4). 
@BuiltValue()
abstract class OrganizationSummary implements Built<OrganizationSummary, OrganizationSummaryBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  @BuiltValueField(wireName: r'name')
  String get name;

  /// Phase 0: always `null`. Uploads arrive with F-040; until then `PATCH /orgs/{orgId}` accepts `null` and nothing else (M-4). 
  @BuiltValueField(wireName: r'logo')
  String? get logo;

  OrganizationSummary._();

  factory OrganizationSummary([void updates(OrganizationSummaryBuilder b)]) = _$OrganizationSummary;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(OrganizationSummaryBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<OrganizationSummary> get serializer => _$OrganizationSummarySerializer();
}

class _$OrganizationSummarySerializer implements PrimitiveSerializer<OrganizationSummary> {
  @override
  final Iterable<Type> types = const [OrganizationSummary, _$OrganizationSummary];

  @override
  final String wireName = r'OrganizationSummary';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    OrganizationSummary object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'name';
    yield serializers.serialize(
      object.name,
      specifiedType: const FullType(String),
    );
    yield r'logo';
    yield object.logo == null ? null : serializers.serialize(
      object.logo,
      specifiedType: const FullType.nullable(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    OrganizationSummary object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required OrganizationSummaryBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.id = valueDes;
          break;
        case r'name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.name = valueDes;
          break;
        case r'logo':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.logo = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  OrganizationSummary deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = OrganizationSummaryBuilder();
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

