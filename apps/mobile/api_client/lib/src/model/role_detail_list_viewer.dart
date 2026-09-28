//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:omnistock_api_client/src/model/role_write_verdict.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'role_detail_list_viewer.g.dart';

/// RoleDetailListViewer
///
/// Properties:
/// * [canCreate] 
/// * [limit] - How many live roles this shop may have (the create ceiling).
@BuiltValue()
abstract class RoleDetailListViewer implements Built<RoleDetailListViewer, RoleDetailListViewerBuilder> {
  @BuiltValueField(wireName: r'canCreate')
  RoleWriteVerdict get canCreate;

  /// How many live roles this shop may have (the create ceiling).
  @BuiltValueField(wireName: r'limit')
  int get limit;

  RoleDetailListViewer._();

  factory RoleDetailListViewer([void updates(RoleDetailListViewerBuilder b)]) = _$RoleDetailListViewer;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(RoleDetailListViewerBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<RoleDetailListViewer> get serializer => _$RoleDetailListViewerSerializer();
}

class _$RoleDetailListViewerSerializer implements PrimitiveSerializer<RoleDetailListViewer> {
  @override
  final Iterable<Type> types = const [RoleDetailListViewer, _$RoleDetailListViewer];

  @override
  final String wireName = r'RoleDetailListViewer';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    RoleDetailListViewer object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'canCreate';
    yield serializers.serialize(
      object.canCreate,
      specifiedType: const FullType(RoleWriteVerdict),
    );
    yield r'limit';
    yield serializers.serialize(
      object.limit,
      specifiedType: const FullType(int),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    RoleDetailListViewer object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required RoleDetailListViewerBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'canCreate':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(RoleWriteVerdict),
          ) as RoleWriteVerdict;
          result.canCreate.replace(valueDes);
          break;
        case r'limit':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.limit = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  RoleDetailListViewer deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = RoleDetailListViewerBuilder();
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

