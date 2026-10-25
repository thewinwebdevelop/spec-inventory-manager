//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'role_write_verdict.g.dart';

/// The server's verdict for THIS caller at read time — whether to enable a button and why not. It is a UX input: every write re-reads the caller's permissions inside its transaction and may still refuse (AC-5.7). 
///
/// Properties:
/// * [allowed] 
/// * [reason] - `null` when `allowed` is `true`. OPEN SET (api-spec §3), first match wins in this fixed order: `writes_disabled` → `role_locked` → `exceeds_your_permissions` → `in_use_requires_manage_members` → `equal_permissions_in_use` → `in_use` → `history_limit_reached`; `canClone` uses `owner_role` · `exceeds_your_permissions` · `role_limit_reached` · `writes_disabled`; `canCreate` uses `role_limit_reached` · `writes_disabled`. `writes_disabled` outranks every other reason while role writes are switched off. Any other value → generic copy. 
@BuiltValue()
abstract class RoleWriteVerdict implements Built<RoleWriteVerdict, RoleWriteVerdictBuilder> {
  @BuiltValueField(wireName: r'allowed')
  bool get allowed;

  /// `null` when `allowed` is `true`. OPEN SET (api-spec §3), first match wins in this fixed order: `writes_disabled` → `role_locked` → `exceeds_your_permissions` → `in_use_requires_manage_members` → `equal_permissions_in_use` → `in_use` → `history_limit_reached`; `canClone` uses `owner_role` · `exceeds_your_permissions` · `role_limit_reached` · `writes_disabled`; `canCreate` uses `role_limit_reached` · `writes_disabled`. `writes_disabled` outranks every other reason while role writes are switched off. Any other value → generic copy. 
  @BuiltValueField(wireName: r'reason')
  String? get reason;

  RoleWriteVerdict._();

  factory RoleWriteVerdict([void updates(RoleWriteVerdictBuilder b)]) = _$RoleWriteVerdict;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(RoleWriteVerdictBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<RoleWriteVerdict> get serializer => _$RoleWriteVerdictSerializer();
}

class _$RoleWriteVerdictSerializer implements PrimitiveSerializer<RoleWriteVerdict> {
  @override
  final Iterable<Type> types = const [RoleWriteVerdict, _$RoleWriteVerdict];

  @override
  final String wireName = r'RoleWriteVerdict';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    RoleWriteVerdict object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'allowed';
    yield serializers.serialize(
      object.allowed,
      specifiedType: const FullType(bool),
    );
    yield r'reason';
    yield object.reason == null ? null : serializers.serialize(
      object.reason,
      specifiedType: const FullType.nullable(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    RoleWriteVerdict object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required RoleWriteVerdictBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'allowed':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.allowed = valueDes;
          break;
        case r'reason':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.reason = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  RoleWriteVerdict deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = RoleWriteVerdictBuilder();
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

