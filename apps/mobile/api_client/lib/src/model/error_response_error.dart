//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'error_response_error.g.dart';

/// ErrorResponseError
///
/// Properties:
/// * [code] - Machine-readable error code (e.g. `INVALID_CREDENTIALS`, `ORG_ACCESS_DENIED`, `RATE_LIMITED`). A shipped value never changes.  Every code a response can carry is named in that response's `description` — an error code IS contract, because clients branch on it to choose which sentence a person reads (contract-evolution: adding a code is additive, changing or removing one is breaking).  TWO CODES BELONG TO NO SINGLE ENDPOINT and are therefore documented here instead: `INTERNAL` (`500`) — the filter's fallback for any unrecognised error, carrying no detail by design — and `UNSUPPORTED_MEDIA_TYPE` (`415`), which the transport guard can answer on any JSON route before the handler runs.  A client MUST tolerate a code it does not recognise (show the `message`), and MUST NOT parse the `message` to recover one. 
/// * [message] - User-facing Thai message. F-002 copy says \"ร้าน\" rather than \"องค์กร\" (D-029); identifiers and enum values stay English. 
/// * [details] - Optional, code-specific context. Documented cases (F-002): `INVITATION_PENDING` → `{ invitationId, expiresAt, roleId, roleName }` (§3.11) · `ORG_LIMIT_REACHED` → `{ limit }` (§3.1) · `INVITATION_EMAIL_MISMATCH` → `{ emailMasked }` (§3.15) · `CONFLICT` → `{ reason: \"busy\" }` when the request lost the race for the shop's row lock (amend #4 / NEW-4 — retryable, never a 500). A client that does not recognise a key MUST still behave correctly. 
/// * [fieldErrors] - Per-field Thai messages on a `422` (e.g. `{ \"taxId\": \"…\" }`). 
/// * [traceId] - Opaque random UUID v4 issued by the SERVER for this request, echoed in `X-Request-Id`. Present on EVERY error response in practice; it stays optional in the schema so already-shipped clients are not broken (api-spec §1, NEW-7). Never derived from client input. 
@BuiltValue()
abstract class ErrorResponseError implements Built<ErrorResponseError, ErrorResponseErrorBuilder> {
  /// Machine-readable error code (e.g. `INVALID_CREDENTIALS`, `ORG_ACCESS_DENIED`, `RATE_LIMITED`). A shipped value never changes.  Every code a response can carry is named in that response's `description` — an error code IS contract, because clients branch on it to choose which sentence a person reads (contract-evolution: adding a code is additive, changing or removing one is breaking).  TWO CODES BELONG TO NO SINGLE ENDPOINT and are therefore documented here instead: `INTERNAL` (`500`) — the filter's fallback for any unrecognised error, carrying no detail by design — and `UNSUPPORTED_MEDIA_TYPE` (`415`), which the transport guard can answer on any JSON route before the handler runs.  A client MUST tolerate a code it does not recognise (show the `message`), and MUST NOT parse the `message` to recover one. 
  @BuiltValueField(wireName: r'code')
  String get code;

  /// User-facing Thai message. F-002 copy says \"ร้าน\" rather than \"องค์กร\" (D-029); identifiers and enum values stay English. 
  @BuiltValueField(wireName: r'message')
  String get message;

  /// Optional, code-specific context. Documented cases (F-002): `INVITATION_PENDING` → `{ invitationId, expiresAt, roleId, roleName }` (§3.11) · `ORG_LIMIT_REACHED` → `{ limit }` (§3.1) · `INVITATION_EMAIL_MISMATCH` → `{ emailMasked }` (§3.15) · `CONFLICT` → `{ reason: \"busy\" }` when the request lost the race for the shop's row lock (amend #4 / NEW-4 — retryable, never a 500). A client that does not recognise a key MUST still behave correctly. 
  @BuiltValueField(wireName: r'details')
  BuiltMap<String, JsonObject?>? get details;

  /// Per-field Thai messages on a `422` (e.g. `{ \"taxId\": \"…\" }`). 
  @BuiltValueField(wireName: r'fieldErrors')
  BuiltMap<String, String>? get fieldErrors;

  /// Opaque random UUID v4 issued by the SERVER for this request, echoed in `X-Request-Id`. Present on EVERY error response in practice; it stays optional in the schema so already-shipped clients are not broken (api-spec §1, NEW-7). Never derived from client input. 
  @BuiltValueField(wireName: r'traceId')
  String? get traceId;

  ErrorResponseError._();

  factory ErrorResponseError([void updates(ErrorResponseErrorBuilder b)]) = _$ErrorResponseError;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(ErrorResponseErrorBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<ErrorResponseError> get serializer => _$ErrorResponseErrorSerializer();
}

class _$ErrorResponseErrorSerializer implements PrimitiveSerializer<ErrorResponseError> {
  @override
  final Iterable<Type> types = const [ErrorResponseError, _$ErrorResponseError];

  @override
  final String wireName = r'ErrorResponseError';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    ErrorResponseError object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'code';
    yield serializers.serialize(
      object.code,
      specifiedType: const FullType(String),
    );
    yield r'message';
    yield serializers.serialize(
      object.message,
      specifiedType: const FullType(String),
    );
    if (object.details != null) {
      yield r'details';
      yield serializers.serialize(
        object.details,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.fieldErrors != null) {
      yield r'fieldErrors';
      yield serializers.serialize(
        object.fieldErrors,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType(String)]),
      );
    }
    if (object.traceId != null) {
      yield r'traceId';
      yield serializers.serialize(
        object.traceId,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    ErrorResponseError object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required ErrorResponseErrorBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'code':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.code = valueDes;
          break;
        case r'message':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.message = valueDes;
          break;
        case r'details':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.details.replace(valueDes);
          break;
        case r'fieldErrors':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType(String)]),
          ) as BuiltMap<String, String>;
          result.fieldErrors.replace(valueDes);
          break;
        case r'traceId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.traceId = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  ErrorResponseError deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = ErrorResponseErrorBuilder();
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

