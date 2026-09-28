//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'deleted_role.g.dart';

/// The success body of deleting a role. Deletion is soft: history keeps showing the role's name (AC-3.9b), but it is gone from every live list. 
///
/// Properties:
/// * [id] 
/// * [deletedAt] 
@BuiltValue()
abstract class DeletedRole implements Built<DeletedRole, DeletedRoleBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  @BuiltValueField(wireName: r'deletedAt')
  DateTime get deletedAt;

  DeletedRole._();

  factory DeletedRole([void updates(DeletedRoleBuilder b)]) = _$DeletedRole;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(DeletedRoleBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<DeletedRole> get serializer => _$DeletedRoleSerializer();
}

class _$DeletedRoleSerializer implements PrimitiveSerializer<DeletedRole> {
  @override
  final Iterable<Type> types = const [DeletedRole, _$DeletedRole];

  @override
  final String wireName = r'DeletedRole';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    DeletedRole object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'deletedAt';
    yield serializers.serialize(
      object.deletedAt,
      specifiedType: const FullType(DateTime),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    DeletedRole object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required DeletedRoleBuilder result,
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
        case r'deletedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.deletedAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  DeletedRole deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = DeletedRoleBuilder();
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

