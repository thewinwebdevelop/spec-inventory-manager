//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:omnistock_api_client/src/model/session.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'sessions_response.g.dart';

/// SessionsResponse
///
/// Properties:
/// * [sessions] 
@BuiltValue()
abstract class SessionsResponse implements Built<SessionsResponse, SessionsResponseBuilder> {
  @BuiltValueField(wireName: r'sessions')
  BuiltList<Session> get sessions;

  SessionsResponse._();

  factory SessionsResponse([void updates(SessionsResponseBuilder b)]) = _$SessionsResponse;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(SessionsResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<SessionsResponse> get serializer => _$SessionsResponseSerializer();
}

class _$SessionsResponseSerializer implements PrimitiveSerializer<SessionsResponse> {
  @override
  final Iterable<Type> types = const [SessionsResponse, _$SessionsResponse];

  @override
  final String wireName = r'SessionsResponse';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    SessionsResponse object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'sessions';
    yield serializers.serialize(
      object.sessions,
      specifiedType: const FullType(BuiltList, [FullType(Session)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    SessionsResponse object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required SessionsResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'sessions':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(Session)]),
          ) as BuiltList<Session>;
          result.sessions.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  SessionsResponse deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = SessionsResponseBuilder();
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

