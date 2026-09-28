//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'create_role_request.g.dart';

/// Creates a custom role; \"clone\" is this same request pre-filled from another role. There is no `key`, `isSystem` or `version`: unknown fields are stripped, so a created role always has `key: null` (AC-1.4). 
///
/// Properties:
/// * [name] - 1–50 code points AFTER the server normalises it (NFC, trim, collapse inner whitespace); invisible/control characters (Unicode Cc/Cf) are refused. The response carries the normalised name. 
/// * [capabilities] - Keys from the capability catalog with `selectable: true`. Stored in canonical form (api-spec §2) — the response may differ from what was sent (duplicates and implied keys removed, sorted). 
@BuiltValue()
abstract class CreateRoleRequest implements Built<CreateRoleRequest, CreateRoleRequestBuilder> {
  /// 1–50 code points AFTER the server normalises it (NFC, trim, collapse inner whitespace); invisible/control characters (Unicode Cc/Cf) are refused. The response carries the normalised name. 
  @BuiltValueField(wireName: r'name')
  String get name;

  /// Keys from the capability catalog with `selectable: true`. Stored in canonical form (api-spec §2) — the response may differ from what was sent (duplicates and implied keys removed, sorted). 
  @BuiltValueField(wireName: r'capabilities')
  BuiltList<String> get capabilities;

  CreateRoleRequest._();

  factory CreateRoleRequest([void updates(CreateRoleRequestBuilder b)]) = _$CreateRoleRequest;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CreateRoleRequestBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<CreateRoleRequest> get serializer => _$CreateRoleRequestSerializer();
}

class _$CreateRoleRequestSerializer implements PrimitiveSerializer<CreateRoleRequest> {
  @override
  final Iterable<Type> types = const [CreateRoleRequest, _$CreateRoleRequest];

  @override
  final String wireName = r'CreateRoleRequest';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CreateRoleRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'name';
    yield serializers.serialize(
      object.name,
      specifiedType: const FullType(String),
    );
    yield r'capabilities';
    yield serializers.serialize(
      object.capabilities,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    CreateRoleRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CreateRoleRequestBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.name = valueDes;
          break;
        case r'capabilities':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.capabilities.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  CreateRoleRequest deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CreateRoleRequestBuilder();
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

