//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'role_last_edited_by.g.dart';

/// Who last edited the role, as the VIEWER may know it (AC-9.6). Decided at read time against this shop only. There is deliberately no e-mail, user id or display name on the wire (api-spec §3 — `displayName` waits for a profile feature; adding an optional field later is non-breaking). 
///
/// Properties:
/// * [kind] - OPEN SET. `me` → \"คุณ\" · `member` → the editor's CURRENT role in this shop (the three `role*` fields below) · `former_member` → \"อดีตสมาชิก\" (no longer an active member of this shop, including a deleted account). Any other value → generic copy. 
/// * [roleName] - Present only when `kind` is `member`. Display per AC-1.5.
/// * [roleKey] - Present only when `kind` is `member`. Translation only — OPEN SET, fall back to `roleName`. 
/// * [roleNameCustomized] - Present only when `kind` is `member`.
@BuiltValue()
abstract class RoleLastEditedBy implements Built<RoleLastEditedBy, RoleLastEditedByBuilder> {
  /// OPEN SET. `me` → \"คุณ\" · `member` → the editor's CURRENT role in this shop (the three `role*` fields below) · `former_member` → \"อดีตสมาชิก\" (no longer an active member of this shop, including a deleted account). Any other value → generic copy. 
  @BuiltValueField(wireName: r'kind')
  String get kind;

  /// Present only when `kind` is `member`. Display per AC-1.5.
  @BuiltValueField(wireName: r'roleName')
  String? get roleName;

  /// Present only when `kind` is `member`. Translation only — OPEN SET, fall back to `roleName`. 
  @BuiltValueField(wireName: r'roleKey')
  String? get roleKey;

  /// Present only when `kind` is `member`.
  @BuiltValueField(wireName: r'roleNameCustomized')
  bool? get roleNameCustomized;

  RoleLastEditedBy._();

  factory RoleLastEditedBy([void updates(RoleLastEditedByBuilder b)]) = _$RoleLastEditedBy;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(RoleLastEditedByBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<RoleLastEditedBy> get serializer => _$RoleLastEditedBySerializer();
}

class _$RoleLastEditedBySerializer implements PrimitiveSerializer<RoleLastEditedBy> {
  @override
  final Iterable<Type> types = const [RoleLastEditedBy, _$RoleLastEditedBy];

  @override
  final String wireName = r'RoleLastEditedBy';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    RoleLastEditedBy object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'kind';
    yield serializers.serialize(
      object.kind,
      specifiedType: const FullType(String),
    );
    if (object.roleName != null) {
      yield r'roleName';
      yield serializers.serialize(
        object.roleName,
        specifiedType: const FullType(String),
      );
    }
    if (object.roleKey != null) {
      yield r'roleKey';
      yield serializers.serialize(
        object.roleKey,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.roleNameCustomized != null) {
      yield r'roleNameCustomized';
      yield serializers.serialize(
        object.roleNameCustomized,
        specifiedType: const FullType(bool),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    RoleLastEditedBy object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required RoleLastEditedByBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'kind':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.kind = valueDes;
          break;
        case r'roleName':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.roleName = valueDes;
          break;
        case r'roleKey':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.roleKey = valueDes;
          break;
        case r'roleNameCustomized':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.roleNameCustomized = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  RoleLastEditedBy deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = RoleLastEditedByBuilder();
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

