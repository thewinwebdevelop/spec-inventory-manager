//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:omnistock_api_client/src/model/role_last_edited_by.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'role_last_edited.g.dart';

/// RoleLastEdited
///
/// Properties:
/// * [at] 
/// * [by] 
@BuiltValue()
abstract class RoleLastEdited implements Built<RoleLastEdited, RoleLastEditedBuilder> {
  @BuiltValueField(wireName: r'at')
  DateTime get at;

  @BuiltValueField(wireName: r'by')
  RoleLastEditedBy get by;

  RoleLastEdited._();

  factory RoleLastEdited([void updates(RoleLastEditedBuilder b)]) = _$RoleLastEdited;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(RoleLastEditedBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<RoleLastEdited> get serializer => _$RoleLastEditedSerializer();
}

class _$RoleLastEditedSerializer implements PrimitiveSerializer<RoleLastEdited> {
  @override
  final Iterable<Type> types = const [RoleLastEdited, _$RoleLastEdited];

  @override
  final String wireName = r'RoleLastEdited';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    RoleLastEdited object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'at';
    yield serializers.serialize(
      object.at,
      specifiedType: const FullType(DateTime),
    );
    yield r'by';
    yield serializers.serialize(
      object.by,
      specifiedType: const FullType(RoleLastEditedBy),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    RoleLastEdited object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required RoleLastEditedBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'at':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.at = valueDes;
          break;
        case r'by':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(RoleLastEditedBy),
          ) as RoleLastEditedBy;
          result.by.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  RoleLastEdited deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = RoleLastEditedBuilder();
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

