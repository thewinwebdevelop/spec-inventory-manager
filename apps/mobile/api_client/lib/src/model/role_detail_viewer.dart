//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:omnistock_api_client/src/model/role_write_verdict.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'role_detail_viewer.g.dart';

/// Per-role verdicts. `canEdit` covers renaming too. `canClone` is not affected by who holds the role — cloning never touches anyone's permissions. 
///
/// Properties:
/// * [canEdit] 
/// * [canDelete] 
/// * [canClone] 
@BuiltValue()
abstract class RoleDetailViewer implements Built<RoleDetailViewer, RoleDetailViewerBuilder> {
  @BuiltValueField(wireName: r'canEdit')
  RoleWriteVerdict get canEdit;

  @BuiltValueField(wireName: r'canDelete')
  RoleWriteVerdict get canDelete;

  @BuiltValueField(wireName: r'canClone')
  RoleWriteVerdict get canClone;

  RoleDetailViewer._();

  factory RoleDetailViewer([void updates(RoleDetailViewerBuilder b)]) = _$RoleDetailViewer;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(RoleDetailViewerBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<RoleDetailViewer> get serializer => _$RoleDetailViewerSerializer();
}

class _$RoleDetailViewerSerializer implements PrimitiveSerializer<RoleDetailViewer> {
  @override
  final Iterable<Type> types = const [RoleDetailViewer, _$RoleDetailViewer];

  @override
  final String wireName = r'RoleDetailViewer';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    RoleDetailViewer object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'canEdit';
    yield serializers.serialize(
      object.canEdit,
      specifiedType: const FullType(RoleWriteVerdict),
    );
    yield r'canDelete';
    yield serializers.serialize(
      object.canDelete,
      specifiedType: const FullType(RoleWriteVerdict),
    );
    yield r'canClone';
    yield serializers.serialize(
      object.canClone,
      specifiedType: const FullType(RoleWriteVerdict),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    RoleDetailViewer object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required RoleDetailViewerBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'canEdit':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(RoleWriteVerdict),
          ) as RoleWriteVerdict;
          result.canEdit.replace(valueDes);
          break;
        case r'canDelete':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(RoleWriteVerdict),
          ) as RoleWriteVerdict;
          result.canDelete.replace(valueDes);
          break;
        case r'canClone':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(RoleWriteVerdict),
          ) as RoleWriteVerdict;
          result.canClone.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  RoleDetailViewer deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = RoleDetailViewerBuilder();
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

