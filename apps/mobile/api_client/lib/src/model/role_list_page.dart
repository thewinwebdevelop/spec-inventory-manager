//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:omnistock_api_client/src/model/role_row.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'role_list_page.g.dart';

/// RoleListPage
///
/// Properties:
/// * [items] 
/// * [nextCursor] - Always `null` in F-002 — a shop has exactly its three system roles until F-003. The field is present so a client written today does not need rewriting the day a fourth role exists. 
@BuiltValue()
abstract class RoleListPage implements Built<RoleListPage, RoleListPageBuilder> {
  @BuiltValueField(wireName: r'items')
  BuiltList<RoleRow> get items;

  /// Always `null` in F-002 — a shop has exactly its three system roles until F-003. The field is present so a client written today does not need rewriting the day a fourth role exists. 
  @BuiltValueField(wireName: r'nextCursor')
  String? get nextCursor;

  RoleListPage._();

  factory RoleListPage([void updates(RoleListPageBuilder b)]) = _$RoleListPage;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(RoleListPageBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<RoleListPage> get serializer => _$RoleListPageSerializer();
}

class _$RoleListPageSerializer implements PrimitiveSerializer<RoleListPage> {
  @override
  final Iterable<Type> types = const [RoleListPage, _$RoleListPage];

  @override
  final String wireName = r'RoleListPage';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    RoleListPage object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'items';
    yield serializers.serialize(
      object.items,
      specifiedType: const FullType(BuiltList, [FullType(RoleRow)]),
    );
    yield r'nextCursor';
    yield object.nextCursor == null ? null : serializers.serialize(
      object.nextCursor,
      specifiedType: const FullType.nullable(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    RoleListPage object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required RoleListPageBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'items':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(RoleRow)]),
          ) as BuiltList<RoleRow>;
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
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  RoleListPage deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = RoleListPageBuilder();
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

