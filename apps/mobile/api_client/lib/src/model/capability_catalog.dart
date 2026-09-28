//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:omnistock_api_client/src/model/capability_group.dart';
import 'package:built_collection/built_collection.dart';
import 'package:omnistock_api_client/src/model/capability_entry.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'capability_catalog.g.dart';

/// The capabilities this shop can see (data-model §1). Cache it PER SHOP: an entitlement-gated tier is hidden entirely, not flagged (AC-7.4). 
///
/// Properties:
/// * [groups] - Checklist sections, in display order.
/// * [items] 
@BuiltValue()
abstract class CapabilityCatalog implements Built<CapabilityCatalog, CapabilityCatalogBuilder> {
  /// Checklist sections, in display order.
  @BuiltValueField(wireName: r'groups')
  BuiltList<CapabilityGroup> get groups;

  @BuiltValueField(wireName: r'items')
  BuiltList<CapabilityEntry> get items;

  CapabilityCatalog._();

  factory CapabilityCatalog([void updates(CapabilityCatalogBuilder b)]) = _$CapabilityCatalog;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CapabilityCatalogBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<CapabilityCatalog> get serializer => _$CapabilityCatalogSerializer();
}

class _$CapabilityCatalogSerializer implements PrimitiveSerializer<CapabilityCatalog> {
  @override
  final Iterable<Type> types = const [CapabilityCatalog, _$CapabilityCatalog];

  @override
  final String wireName = r'CapabilityCatalog';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CapabilityCatalog object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'groups';
    yield serializers.serialize(
      object.groups,
      specifiedType: const FullType(BuiltList, [FullType(CapabilityGroup)]),
    );
    yield r'items';
    yield serializers.serialize(
      object.items,
      specifiedType: const FullType(BuiltList, [FullType(CapabilityEntry)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    CapabilityCatalog object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CapabilityCatalogBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'groups':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(CapabilityGroup)]),
          ) as BuiltList<CapabilityGroup>;
          result.groups.replace(valueDes);
          break;
        case r'items':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(CapabilityEntry)]),
          ) as BuiltList<CapabilityEntry>;
          result.items.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  CapabilityCatalog deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CapabilityCatalogBuilder();
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

