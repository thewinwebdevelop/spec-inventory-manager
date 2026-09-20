//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:omnistock_api_client/src/model/member_row.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'member_list_page.g.dart';

/// MemberListPage
///
/// Properties:
/// * [items] 
/// * [nextCursor] 
/// * [total] - Present ONLY when the request asked with `?withTotal=true`.
@BuiltValue()
abstract class MemberListPage implements Built<MemberListPage, MemberListPageBuilder> {
  @BuiltValueField(wireName: r'items')
  BuiltList<MemberRow> get items;

  @BuiltValueField(wireName: r'nextCursor')
  String? get nextCursor;

  /// Present ONLY when the request asked with `?withTotal=true`.
  @BuiltValueField(wireName: r'total')
  int? get total;

  MemberListPage._();

  factory MemberListPage([void updates(MemberListPageBuilder b)]) = _$MemberListPage;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(MemberListPageBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<MemberListPage> get serializer => _$MemberListPageSerializer();
}

class _$MemberListPageSerializer implements PrimitiveSerializer<MemberListPage> {
  @override
  final Iterable<Type> types = const [MemberListPage, _$MemberListPage];

  @override
  final String wireName = r'MemberListPage';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    MemberListPage object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'items';
    yield serializers.serialize(
      object.items,
      specifiedType: const FullType(BuiltList, [FullType(MemberRow)]),
    );
    yield r'nextCursor';
    yield object.nextCursor == null ? null : serializers.serialize(
      object.nextCursor,
      specifiedType: const FullType.nullable(String),
    );
    if (object.total != null) {
      yield r'total';
      yield serializers.serialize(
        object.total,
        specifiedType: const FullType(int),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    MemberListPage object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required MemberListPageBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'items':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(MemberRow)]),
          ) as BuiltList<MemberRow>;
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
        case r'total':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.total = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  MemberListPage deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = MemberListPageBuilder();
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

