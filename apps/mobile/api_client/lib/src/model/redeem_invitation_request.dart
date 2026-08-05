//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'redeem_invitation_request.g.dart';

/// Body of `POST /invitations/preview` and `POST /invitations/accept`. ⛔ THE TOKEN TRAVELS IN THE BODY AND ONLY IN THE BODY (I-6) — that is why both routes are POSTs. In a query string it would land in access logs, in every proxy in front of us, and in the `Referer` of anything the invite page loads. @frontend: read it out of the URL, `history.replaceState` it away immediately, and keep it in memory (never localStorage). 
///
/// Properties:
/// * [token] 
@BuiltValue()
abstract class RedeemInvitationRequest implements Built<RedeemInvitationRequest, RedeemInvitationRequestBuilder> {
  @BuiltValueField(wireName: r'token')
  String get token;

  RedeemInvitationRequest._();

  factory RedeemInvitationRequest([void updates(RedeemInvitationRequestBuilder b)]) = _$RedeemInvitationRequest;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(RedeemInvitationRequestBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<RedeemInvitationRequest> get serializer => _$RedeemInvitationRequestSerializer();
}

class _$RedeemInvitationRequestSerializer implements PrimitiveSerializer<RedeemInvitationRequest> {
  @override
  final Iterable<Type> types = const [RedeemInvitationRequest, _$RedeemInvitationRequest];

  @override
  final String wireName = r'RedeemInvitationRequest';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    RedeemInvitationRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'token';
    yield serializers.serialize(
      object.token,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    RedeemInvitationRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required RedeemInvitationRequestBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'token':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.token = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  RedeemInvitationRequest deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = RedeemInvitationRequestBuilder();
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

