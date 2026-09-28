//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:omnistock_api_client/src/model/role_detail_list_viewer.dart';
import 'package:built_collection/built_collection.dart';
import 'package:omnistock_api_client/src/model/role_detail.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'role_detail_list_page.g.dart';

/// RoleDetailListPage
///
/// Properties:
/// * [items] - Every live role of the shop, `createdAt asc, id asc`.
/// * [nextCursor] - Always `null` while the role ceiling fits in one page. Present so a client written today survives the day it is not. 
/// * [viewer] 
@BuiltValue()
abstract class RoleDetailListPage implements Built<RoleDetailListPage, RoleDetailListPageBuilder> {
  /// Every live role of the shop, `createdAt asc, id asc`.
  @BuiltValueField(wireName: r'items')
  BuiltList<RoleDetail> get items;

  /// Always `null` while the role ceiling fits in one page. Present so a client written today survives the day it is not. 
  @BuiltValueField(wireName: r'nextCursor')
  String? get nextCursor;

  @BuiltValueField(wireName: r'viewer')
  RoleDetailListViewer get viewer;

  RoleDetailListPage._();

  factory RoleDetailListPage([void updates(RoleDetailListPageBuilder b)]) = _$RoleDetailListPage;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(RoleDetailListPageBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<RoleDetailListPage> get serializer => _$RoleDetailListPageSerializer();
}

class _$RoleDetailListPageSerializer implements PrimitiveSerializer<RoleDetailListPage> {
  @override
  final Iterable<Type> types = const [RoleDetailListPage, _$RoleDetailListPage];

  @override
  final String wireName = r'RoleDetailListPage';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    RoleDetailListPage object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'items';
    yield serializers.serialize(
      object.items,
      specifiedType: const FullType(BuiltList, [FullType(RoleDetail)]),
    );
    yield r'nextCursor';
    yield object.nextCursor == null ? null : serializers.serialize(
      object.nextCursor,
      specifiedType: const FullType.nullable(String),
    );
    yield r'viewer';
    yield serializers.serialize(
      object.viewer,
      specifiedType: const FullType(RoleDetailListViewer),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    RoleDetailListPage object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required RoleDetailListPageBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'items':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(RoleDetail)]),
          ) as BuiltList<RoleDetail>;
          result.items.replace(valueDes);
          break;
        case r'nextCursor':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.nextCursor = valueDes;
          break;
        case r'viewer':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(RoleDetailListViewer),
          ) as RoleDetailListViewer;
          result.viewer.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  RoleDetailListPage deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = RoleDetailListPageBuilder();
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

