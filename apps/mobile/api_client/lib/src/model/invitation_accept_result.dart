//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:omnistock_api_client/src/model/accepted_membership.dart';
import 'package:omnistock_api_client/src/model/invitation_accept_result_organization.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'invitation_accept_result.g.dart';

/// `200` of `POST /invitations/accept` (api-spec §3.15). Carries no email, no invitation id and no token — the response is the last place a redeemed credential could still leak. 
///
/// Properties:
/// * [organization] 
/// * [membership] 
@BuiltValue()
abstract class InvitationAcceptResult implements Built<InvitationAcceptResult, InvitationAcceptResultBuilder> {
  @BuiltValueField(wireName: r'organization')
  InvitationAcceptResultOrganization get organization;

  @BuiltValueField(wireName: r'membership')
  AcceptedMembership get membership;

  InvitationAcceptResult._();

  factory InvitationAcceptResult([void updates(InvitationAcceptResultBuilder b)]) = _$InvitationAcceptResult;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(InvitationAcceptResultBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<InvitationAcceptResult> get serializer => _$InvitationAcceptResultSerializer();
}

class _$InvitationAcceptResultSerializer implements PrimitiveSerializer<InvitationAcceptResult> {
  @override
  final Iterable<Type> types = const [InvitationAcceptResult, _$InvitationAcceptResult];

  @override
  final String wireName = r'InvitationAcceptResult';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    InvitationAcceptResult object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'organization';
    yield serializers.serialize(
      object.organization,
      specifiedType: const FullType(InvitationAcceptResultOrganization),
    );
    yield r'membership';
    yield serializers.serialize(
      object.membership,
      specifiedType: const FullType(AcceptedMembership),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    InvitationAcceptResult object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required InvitationAcceptResultBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'organization':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(InvitationAcceptResultOrganization),
          ) as InvitationAcceptResultOrganization;
          result.organization.replace(valueDes);
          break;
        case r'membership':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AcceptedMembership),
          ) as AcceptedMembership;
          result.membership.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  InvitationAcceptResult deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = InvitationAcceptResultBuilder();
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

