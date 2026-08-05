//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:omnistock_api_client/src/model/invitation.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'invitation_list_page.g.dart';

/// InvitationListPage
///
/// Properties:
/// * [items] 
/// * [nextCursor] 
@BuiltValue()
abstract class InvitationListPage implements Built<InvitationListPage, InvitationListPageBuilder> {
  @BuiltValueField(wireName: r'items')
  BuiltList<Invitation> get items;

  @BuiltValueField(wireName: r'nextCursor')
  String? get nextCursor;

  InvitationListPage._();

  factory InvitationListPage([void updates(InvitationListPageBuilder b)]) = _$InvitationListPage;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(InvitationListPageBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<InvitationListPage> get serializer => _$InvitationListPageSerializer();
}

class _$InvitationListPageSerializer implements PrimitiveSerializer<InvitationListPage> {
  @override
  final Iterable<Type> types = const [InvitationListPage, _$InvitationListPage];

  @override
  final String wireName = r'InvitationListPage';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    InvitationListPage object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'items';
    yield serializers.serialize(
      object.items,
      specifiedType: const FullType(BuiltList, [FullType(Invitation)]),
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
    InvitationListPage object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required InvitationListPageBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'items':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(Invitation)]),
          ) as BuiltList<Invitation>;
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
  InvitationListPage deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = InvitationListPageBuilder();
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

