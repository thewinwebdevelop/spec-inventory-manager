//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'org_counts.g.dart';

/// Totals, never a list. Every active member may see HOW MANY colleagues they have; only `manage_members` may see WHO they are (D-028, PDPA). 
///
/// Properties:
/// * [activeMembers] 
/// * [pendingInvitations] 
@BuiltValue()
abstract class OrgCounts implements Built<OrgCounts, OrgCountsBuilder> {
  @BuiltValueField(wireName: r'activeMembers')
  int get activeMembers;

  @BuiltValueField(wireName: r'pendingInvitations')
  int get pendingInvitations;

  OrgCounts._();

  factory OrgCounts([void updates(OrgCountsBuilder b)]) = _$OrgCounts;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(OrgCountsBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<OrgCounts> get serializer => _$OrgCountsSerializer();
}

class _$OrgCountsSerializer implements PrimitiveSerializer<OrgCounts> {
  @override
  final Iterable<Type> types = const [OrgCounts, _$OrgCounts];

  @override
  final String wireName = r'OrgCounts';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    OrgCounts object, {
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
    OrgCounts object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required OrgCountsBuilder result,
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
  OrgCounts deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = OrgCountsBuilder();
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

