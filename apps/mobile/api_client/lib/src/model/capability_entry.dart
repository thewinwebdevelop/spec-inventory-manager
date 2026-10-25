//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'capability_entry.g.dart';

/// One capability. The registry's `tier` and `scope` are internal and are not published. 
///
/// Properties:
/// * [key] - Stable snake_case identifier — the value stored in `RoleDetail.capabilities`. OPEN SET: new keys ship with new features. 
/// * [labelTh] 
/// * [descriptionTh] - One sentence — what holding it actually lets someone do.
/// * [group] - A `CapabilityGroup.key`, or `null` for an entry that is not a checklist item (`full_access`). OPEN SET — an unknown group goes in a generic section. 
/// * [status] - OPEN SET. `live` · `upcoming` (shown as \"เร็ว ๆ นี้\"; may be ticked in advance, AC-7.5). Any other value → generic copy. 
/// * [implies] - Keys granted automatically with this one (one level only, e.g. `manage_X` → `view_X`). Shown ticked and disabled. 
/// * [selectable] - `false` = may never appear in a create/update request (`full_access`). 
@BuiltValue()
abstract class CapabilityEntry implements Built<CapabilityEntry, CapabilityEntryBuilder> {
  /// Stable snake_case identifier — the value stored in `RoleDetail.capabilities`. OPEN SET: new keys ship with new features. 
  @BuiltValueField(wireName: r'key')
  String get key;

  @BuiltValueField(wireName: r'labelTh')
  String get labelTh;

  /// One sentence — what holding it actually lets someone do.
  @BuiltValueField(wireName: r'descriptionTh')
  String get descriptionTh;

  /// A `CapabilityGroup.key`, or `null` for an entry that is not a checklist item (`full_access`). OPEN SET — an unknown group goes in a generic section. 
  @BuiltValueField(wireName: r'group')
  String? get group;

  /// OPEN SET. `live` · `upcoming` (shown as \"เร็ว ๆ นี้\"; may be ticked in advance, AC-7.5). Any other value → generic copy. 
  @BuiltValueField(wireName: r'status')
  String get status;

  /// Keys granted automatically with this one (one level only, e.g. `manage_X` → `view_X`). Shown ticked and disabled. 
  @BuiltValueField(wireName: r'implies')
  BuiltList<String> get implies;

  /// `false` = may never appear in a create/update request (`full_access`). 
  @BuiltValueField(wireName: r'selectable')
  bool get selectable;

  CapabilityEntry._();

  factory CapabilityEntry([void updates(CapabilityEntryBuilder b)]) = _$CapabilityEntry;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CapabilityEntryBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<CapabilityEntry> get serializer => _$CapabilityEntrySerializer();
}

class _$CapabilityEntrySerializer implements PrimitiveSerializer<CapabilityEntry> {
  @override
  final Iterable<Type> types = const [CapabilityEntry, _$CapabilityEntry];

  @override
  final String wireName = r'CapabilityEntry';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CapabilityEntry object, {
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
    yield r'descriptionTh';
    yield serializers.serialize(
      object.descriptionTh,
      specifiedType: const FullType(String),
    );
    yield r'group';
    yield object.group == null ? null : serializers.serialize(
      object.group,
      specifiedType: const FullType.nullable(String),
    );
    yield r'status';
    yield serializers.serialize(
      object.status,
      specifiedType: const FullType(String),
    );
    yield r'implies';
    yield serializers.serialize(
      object.implies,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
    yield r'selectable';
    yield serializers.serialize(
      object.selectable,
      specifiedType: const FullType(bool),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    CapabilityEntry object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CapabilityEntryBuilder result,
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
        case r'descriptionTh':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.descriptionTh = valueDes;
          break;
        case r'group':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.group = valueDes;
          break;
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.status = valueDes;
          break;
        case r'implies':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.implies.replace(valueDes);
          break;
        case r'selectable':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.selectable = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  CapabilityEntry deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CapabilityEntryBuilder();
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

