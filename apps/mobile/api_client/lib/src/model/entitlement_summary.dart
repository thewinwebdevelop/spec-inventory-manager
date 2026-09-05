//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'entitlement_summary.g.dart';

/// The plan bound to a shop (`OrgEntitlement`), flattened for the wire.
///
/// Properties:
/// * [planKey] 
/// * [tierLabel] 
@BuiltValue()
abstract class EntitlementSummary implements Built<EntitlementSummary, EntitlementSummaryBuilder> {
  @BuiltValueField(wireName: r'planKey')
  String get planKey;

  @BuiltValueField(wireName: r'tierLabel')
  String? get tierLabel;

  EntitlementSummary._();

  factory EntitlementSummary([void updates(EntitlementSummaryBuilder b)]) = _$EntitlementSummary;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(EntitlementSummaryBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<EntitlementSummary> get serializer => _$EntitlementSummarySerializer();
}

class _$EntitlementSummarySerializer implements PrimitiveSerializer<EntitlementSummary> {
  @override
  final Iterable<Type> types = const [EntitlementSummary, _$EntitlementSummary];

  @override
  final String wireName = r'EntitlementSummary';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    EntitlementSummary object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'planKey';
    yield serializers.serialize(
      object.planKey,
      specifiedType: const FullType(String),
    );
    yield r'tierLabel';
    yield object.tierLabel == null ? null : serializers.serialize(
      object.tierLabel,
      specifiedType: const FullType.nullable(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    EntitlementSummary object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required EntitlementSummaryBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'planKey':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.planKey = valueDes;
          break;
        case r'tierLabel':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.tierLabel = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  EntitlementSummary deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = EntitlementSummaryBuilder();
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

