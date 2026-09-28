//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'role_usage.g.dart';

/// How many hold this role — counts only, never who (AC-6.4). 
///
/// Properties:
/// * [activeMembers] 
/// * [pendingInvitations] - Invitations still `pending` for this role, INCLUDING ones whose link has expired (AC-3.9) — both block deletion. 
@BuiltValue()
abstract class RoleUsage implements Built<RoleUsage, RoleUsageBuilder> {
  @BuiltValueField(wireName: r'activeMembers')
  int get activeMembers;

  /// Invitations still `pending` for this role, INCLUDING ones whose link has expired (AC-3.9) — both block deletion. 
  @BuiltValueField(wireName: r'pendingInvitations')
  int get pendingInvitations;

  RoleUsage._();

  factory RoleUsage([void updates(RoleUsageBuilder b)]) = _$RoleUsage;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(RoleUsageBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<RoleUsage> get serializer => _$RoleUsageSerializer();
}

class _$RoleUsageSerializer implements PrimitiveSerializer<RoleUsage> {
  @override
  final Iterable<Type> types = const [RoleUsage, _$RoleUsage];

  @override
  final String wireName = r'RoleUsage';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    RoleUsage object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'activeMembers';
    yield serializers.serialize(
      object.activeMembers,
      specifiedType: const FullType(int),
    );
    yield r'pendingInvitations';
    yield serializers.serialize(
      object.pendingInvitations,
      specifiedType: const FullType(int),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    RoleUsage object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required RoleUsageBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'activeMembers':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.activeMembers = valueDes;
          break;
        case r'pendingInvitations':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.pendingInvitations = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  RoleUsage deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = RoleUsageBuilder();
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

