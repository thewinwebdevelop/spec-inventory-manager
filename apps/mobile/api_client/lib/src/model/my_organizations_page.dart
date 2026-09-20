//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:omnistock_api_client/src/model/my_organization_item.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'my_organizations_page.g.dart';

/// MyOrganizationsPage
///
/// Properties:
/// * [items] 
/// * [nextCursor] - `null` means there is no next page.
@BuiltValue()
abstract class MyOrganizationsPage implements Built<MyOrganizationsPage, MyOrganizationsPageBuilder> {
  @BuiltValueField(wireName: r'items')
  BuiltList<MyOrganizationItem> get items;

  /// `null` means there is no next page.
  @BuiltValueField(wireName: r'nextCursor')
  String? get nextCursor;

  MyOrganizationsPage._();

  factory MyOrganizationsPage([void updates(MyOrganizationsPageBuilder b)]) = _$MyOrganizationsPage;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(MyOrganizationsPageBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<MyOrganizationsPage> get serializer => _$MyOrganizationsPageSerializer();
}

class _$MyOrganizationsPageSerializer implements PrimitiveSerializer<MyOrganizationsPage> {
  @override
  final Iterable<Type> types = const [MyOrganizationsPage, _$MyOrganizationsPage];

  @override
  final String wireName = r'MyOrganizationsPage';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    MyOrganizationsPage object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'items';
    yield serializers.serialize(
      object.items,
      specifiedType: const FullType(BuiltList, [FullType(MyOrganizationItem)]),
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
    MyOrganizationsPage object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required MyOrganizationsPageBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'items':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(MyOrganizationItem)]),
          ) as BuiltList<MyOrganizationItem>;
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
  MyOrganizationsPage deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = MyOrganizationsPageBuilder();
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

