//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:omnistock_api_client/src/model/invitation.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'issued_invitation.g.dart';

/// `201` of `POST /orgs/{orgId}/invitations`. ⚠️ `token` and `inviteUrl` are shown THIS ONCE — only an HMAC is stored. No email is sent (D-012), so the UI must offer a copy button. 
///
/// Properties:
/// * [invitation] 
/// * [token] - The raw invitation token. Never retrievable again.
/// * [inviteUrl] - Ready-to-share link containing the token.
@BuiltValue()
abstract class IssuedInvitation implements Built<IssuedInvitation, IssuedInvitationBuilder> {
  @BuiltValueField(wireName: r'invitation')
  Invitation get invitation;

  /// The raw invitation token. Never retrievable again.
  @BuiltValueField(wireName: r'token')
  String get token;

  /// Ready-to-share link containing the token.
  @BuiltValueField(wireName: r'inviteUrl')
  String get inviteUrl;

  IssuedInvitation._();

  factory IssuedInvitation([void updates(IssuedInvitationBuilder b)]) = _$IssuedInvitation;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(IssuedInvitationBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<IssuedInvitation> get serializer => _$IssuedInvitationSerializer();
}

class _$IssuedInvitationSerializer implements PrimitiveSerializer<IssuedInvitation> {
  @override
  final Iterable<Type> types = const [IssuedInvitation, _$IssuedInvitation];

  @override
  final String wireName = r'IssuedInvitation';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    IssuedInvitation object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'invitation';
    yield serializers.serialize(
      object.invitation,
      specifiedType: const FullType(Invitation),
    );
    yield r'token';
    yield serializers.serialize(
      object.token,
      specifiedType: const FullType(String),
    );
    yield r'inviteUrl';
    yield serializers.serialize(
      object.inviteUrl,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    IssuedInvitation object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required IssuedInvitationBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'invitation':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(Invitation),
          ) as Invitation;
          result.invitation.replace(valueDes);
          break;
        case r'token':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.token = valueDes;
          break;
        case r'inviteUrl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.inviteUrl = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  IssuedInvitation deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = IssuedInvitationBuilder();
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

