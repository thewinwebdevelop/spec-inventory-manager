//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'capability_group.g.dart';

/// CapabilityGroup
///
/// Properties:
/// * [key] - OPEN SET (e.g. `team`, `shop`, `catalog_stock`, `channels`, `orders`, `finance`).
/// * [labelTh] 
@BuiltValue()
abstract class CapabilityGroup implements Built<CapabilityGroup, CapabilityGroupBuilder> {
  /// OPEN SET (e.g. `team`, `shop`, `catalog_stock`, `channels`, `orders`, `finance`).
  @BuiltValueField(wireName: r'key')
  String get key;

  @BuiltValueField(wireName: r'labelTh')
  String get labelTh;

  CapabilityGroup._();

  factory CapabilityGroup([void updates(CapabilityGroupBuilder b)]) = _$CapabilityGroup;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CapabilityGroupBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<CapabilityGroup> get serializer => _$CapabilityGroupSerializer();
}

class _$CapabilityGroupSerializer implements PrimitiveSerializer<CapabilityGroup> {
  @override
  final Iterable<Type> types = const [CapabilityGroup, _$CapabilityGroup];

  @override
  final String wireName = r'CapabilityGroup';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CapabilityGroup object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'key';
    yield serializers.serialize(
      object.key,
      specifiedType: const FullType(String),
    );
    yield r'labelTh';
    yield serializers.serialize(
      object.labelTh,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    CapabilityGroup object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CapabilityGroupBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'key':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.key = valueDes;
          break;
        case r'labelTh':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.labelTh = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  CapabilityGroup deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CapabilityGroupBuilder();
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

