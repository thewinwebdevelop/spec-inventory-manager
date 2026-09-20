//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'invitation.g.dart';

/// One row of `GET /orgs/{orgId}/invitations`, and the `invitation` of the `201` from `POST /orgs/{orgId}/invitations` (api-spec §3.10/§3.11). ⛔ Never carries a token: only an HMAC of it is stored (D-018), so there is no \"resend the same link\" — see `POST …/invitations/{invitationId}/link`. 
///
/// Properties:
/// * [id] 
/// * [email] - Normalized (lower-cased, trimmed) at creation.
/// * [roleId] 
/// * [roleName] 
/// * [roleKey] 
/// * [status] - Resolved at read time — a stored `pending` row past `expiresAt` reads as `expired`. 
/// * [expiresAt] - NON-NULL ON EVERY ROW, accepted and cancelled ones included (ux Q14). ⛔ UI must render the remaining time FROM THIS VALUE — never hard-code \"7 days\": an elevated role's invitation lives 24 hours, and reissuing a link restarts the clock (D-027). 
/// * [tokenIssuedAt] - When the CURRENT link was minted. Moves on every reissue.
/// * [invitedByUserId] 
/// * [createdAt] - When the invitation first existed. Does NOT move on reissue.
/// * [acceptedAt] 
/// * [acceptedByUserId] 
/// * [acceptedUserCreatedAfterInvite] - Was the accepting ACCOUNT created after `createdAt`? `null` until somebody accepts — \"we do not know yet\" is not \"no\". Phase 0 cannot verify email addresses, so this is the only signal that a link may have been redeemed by whoever found it. Render it as a soft flag, not an accusation. 
@BuiltValue()
abstract class Invitation implements Built<Invitation, InvitationBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  /// Normalized (lower-cased, trimmed) at creation.
  @BuiltValueField(wireName: r'email')
  String get email;

  @BuiltValueField(wireName: r'roleId')
  String get roleId;

  @BuiltValueField(wireName: r'roleName')
  String get roleName;

  @BuiltValueField(wireName: r'roleKey')
  String? get roleKey;

  /// Resolved at read time — a stored `pending` row past `expiresAt` reads as `expired`. 
  @BuiltValueField(wireName: r'status')
  InvitationStatusEnum get status;
  // enum statusEnum {  pending,  accepted,  cancelled,  expired,  };

  /// NON-NULL ON EVERY ROW, accepted and cancelled ones included (ux Q14). ⛔ UI must render the remaining time FROM THIS VALUE — never hard-code \"7 days\": an elevated role's invitation lives 24 hours, and reissuing a link restarts the clock (D-027). 
  @BuiltValueField(wireName: r'expiresAt')
  DateTime get expiresAt;

  /// When the CURRENT link was minted. Moves on every reissue.
  @BuiltValueField(wireName: r'tokenIssuedAt')
  DateTime get tokenIssuedAt;

  @BuiltValueField(wireName: r'invitedByUserId')
  String get invitedByUserId;

  /// When the invitation first existed. Does NOT move on reissue.
  @BuiltValueField(wireName: r'createdAt')
  DateTime get createdAt;

  @BuiltValueField(wireName: r'acceptedAt')
  DateTime? get acceptedAt;

  @BuiltValueField(wireName: r'acceptedByUserId')
  String? get acceptedByUserId;

  /// Was the accepting ACCOUNT created after `createdAt`? `null` until somebody accepts — \"we do not know yet\" is not \"no\". Phase 0 cannot verify email addresses, so this is the only signal that a link may have been redeemed by whoever found it. Render it as a soft flag, not an accusation. 
  @BuiltValueField(wireName: r'acceptedUserCreatedAfterInvite')
  bool? get acceptedUserCreatedAfterInvite;

  Invitation._();

  factory Invitation([void updates(InvitationBuilder b)]) = _$Invitation;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(InvitationBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<Invitation> get serializer => _$InvitationSerializer();
}

class _$InvitationSerializer implements PrimitiveSerializer<Invitation> {
  @override
  final Iterable<Type> types = const [Invitation, _$Invitation];

  @override
  final String wireName = r'Invitation';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    Invitation object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'email';
    yield serializers.serialize(
      object.email,
      specifiedType: const FullType(String),
    );
    yield r'roleId';
    yield serializers.serialize(
      object.roleId,
      specifiedType: const FullType(String),
    );
    yield r'roleName';
    yield serializers.serialize(
      object.roleName,
      specifiedType: const FullType(String),
    );
    yield r'roleKey';
    yield object.roleKey == null ? null : serializers.serialize(
      object.roleKey,
      specifiedType: const FullType.nullable(String),
    );
    yield r'status';
    yield serializers.serialize(
      object.status,
      specifiedType: const FullType(InvitationStatusEnum),
    );
    yield r'expiresAt';
    yield serializers.serialize(
      object.expiresAt,
      specifiedType: const FullType(DateTime),
    );
    yield r'tokenIssuedAt';
    yield serializers.serialize(
      object.tokenIssuedAt,
      specifiedType: const FullType(DateTime),
    );
    yield r'invitedByUserId';
    yield serializers.serialize(
      object.invitedByUserId,
      specifiedType: const FullType(String),
    );
    yield r'createdAt';
    yield serializers.serialize(
      object.createdAt,
      specifiedType: const FullType(DateTime),
    );
    yield r'acceptedAt';
    yield object.acceptedAt == null ? null : serializers.serialize(
      object.acceptedAt,
      specifiedType: const FullType.nullable(DateTime),
    );
    yield r'acceptedByUserId';
    yield object.acceptedByUserId == null ? null : serializers.serialize(
      object.acceptedByUserId,
      specifiedType: const FullType.nullable(String),
    );
    yield r'acceptedUserCreatedAfterInvite';
    yield object.acceptedUserCreatedAfterInvite == null ? null : serializers.serialize(
      object.acceptedUserCreatedAfterInvite,
      specifiedType: const FullType.nullable(bool),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    Invitation object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required InvitationBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.id = valueDes;
          break;
        case r'email':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.email = valueDes;
          break;
        case r'roleId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.roleId = valueDes;
          break;
        case r'roleName':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.roleName = valueDes;
          break;
        case r'roleKey':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.roleKey = valueDes;
          break;
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(InvitationStatusEnum),
          ) as InvitationStatusEnum;
          result.status = valueDes;
          break;
        case r'expiresAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.expiresAt = valueDes;
          break;
        case r'tokenIssuedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.tokenIssuedAt = valueDes;
          break;
        case r'invitedByUserId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.invitedByUserId = valueDes;
          break;
        case r'createdAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.createdAt = valueDes;
          break;
        case r'acceptedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(DateTime),
          ) as DateTime?;
          if (valueDes == null) continue;
          result.acceptedAt = valueDes;
          break;
        case r'acceptedByUserId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.acceptedByUserId = valueDes;
          break;
        case r'acceptedUserCreatedAfterInvite':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.acceptedUserCreatedAfterInvite = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  Invitation deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = InvitationBuilder();
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

class InvitationStatusEnum extends EnumClass {

  /// Resolved at read time — a stored `pending` row past `expiresAt` reads as `expired`. 
  @BuiltValueEnumConst(wireName: r'pending')
  static const InvitationStatusEnum pending = _$invitationStatusEnum_pending;
  /// Resolved at read time — a stored `pending` row past `expiresAt` reads as `expired`. 
  @BuiltValueEnumConst(wireName: r'accepted')
  static const InvitationStatusEnum accepted = _$invitationStatusEnum_accepted;
  /// Resolved at read time — a stored `pending` row past `expiresAt` reads as `expired`. 
  @BuiltValueEnumConst(wireName: r'cancelled')
  static const InvitationStatusEnum cancelled = _$invitationStatusEnum_cancelled;
  /// Resolved at read time — a stored `pending` row past `expiresAt` reads as `expired`. 
  @BuiltValueEnumConst(wireName: r'expired')
  static const InvitationStatusEnum expired = _$invitationStatusEnum_expired;

  static Serializer<InvitationStatusEnum> get serializer => _$invitationStatusEnumSerializer;

  const InvitationStatusEnum._(String name): super(name);

  static BuiltSet<InvitationStatusEnum> get values => _$invitationStatusEnumValues;
  static InvitationStatusEnum valueOf(String name) => _$invitationStatusEnumValueOf(name);
}

