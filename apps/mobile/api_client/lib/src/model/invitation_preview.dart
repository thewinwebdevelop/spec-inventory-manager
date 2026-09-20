//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'invitation_preview.g.dart';

/// `200` of `POST /invitations/preview` — public, for somebody who may not have an account yet (api-spec §3.14). Carries no `organizationId`, no full email address and no member list. 
///
/// Properties:
/// * [organizationName] 
/// * [roleName] 
/// * [roleKey] 
/// * [emailMasked] - `u***@example.com` — enough to pick the right account, not an address.
/// * [expiresAt] 
/// * [status] - Always `pending` on a `200`; the other states answer `409`.
@BuiltValue()
abstract class InvitationPreview implements Built<InvitationPreview, InvitationPreviewBuilder> {
  @BuiltValueField(wireName: r'organizationName')
  String get organizationName;

  @BuiltValueField(wireName: r'roleName')
  String get roleName;

  @BuiltValueField(wireName: r'roleKey')
  String? get roleKey;

  /// `u***@example.com` — enough to pick the right account, not an address.
  @BuiltValueField(wireName: r'emailMasked')
  String get emailMasked;

  @BuiltValueField(wireName: r'expiresAt')
  DateTime get expiresAt;

  /// Always `pending` on a `200`; the other states answer `409`.
  @BuiltValueField(wireName: r'status')
  InvitationPreviewStatusEnum get status;
  // enum statusEnum {  pending,  accepted,  cancelled,  expired,  };

  InvitationPreview._();

  factory InvitationPreview([void updates(InvitationPreviewBuilder b)]) = _$InvitationPreview;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(InvitationPreviewBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<InvitationPreview> get serializer => _$InvitationPreviewSerializer();
}

class _$InvitationPreviewSerializer implements PrimitiveSerializer<InvitationPreview> {
  @override
  final Iterable<Type> types = const [InvitationPreview, _$InvitationPreview];

  @override
  final String wireName = r'InvitationPreview';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    InvitationPreview object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'organizationName';
    yield serializers.serialize(
      object.organizationName,
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
    yield r'emailMasked';
    yield serializers.serialize(
      object.emailMasked,
      specifiedType: const FullType(String),
    );
    yield r'expiresAt';
    yield serializers.serialize(
      object.expiresAt,
      specifiedType: const FullType(DateTime),
    );
    yield r'status';
    yield serializers.serialize(
      object.status,
      specifiedType: const FullType(InvitationPreviewStatusEnum),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    InvitationPreview object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required InvitationPreviewBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'organizationName':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.organizationName = valueDes;
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
        case r'emailMasked':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.emailMasked = valueDes;
          break;
        case r'expiresAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.expiresAt = valueDes;
          break;
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(InvitationPreviewStatusEnum),
          ) as InvitationPreviewStatusEnum;
          result.status = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  InvitationPreview deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = InvitationPreviewBuilder();
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

class InvitationPreviewStatusEnum extends EnumClass {

  /// Always `pending` on a `200`; the other states answer `409`.
  @BuiltValueEnumConst(wireName: r'pending')
  static const InvitationPreviewStatusEnum pending = _$invitationPreviewStatusEnum_pending;
  /// Always `pending` on a `200`; the other states answer `409`.
  @BuiltValueEnumConst(wireName: r'accepted')
  static const InvitationPreviewStatusEnum accepted = _$invitationPreviewStatusEnum_accepted;
  /// Always `pending` on a `200`; the other states answer `409`.
  @BuiltValueEnumConst(wireName: r'cancelled')
  static const InvitationPreviewStatusEnum cancelled = _$invitationPreviewStatusEnum_cancelled;
  /// Always `pending` on a `200`; the other states answer `409`.
  @BuiltValueEnumConst(wireName: r'expired')
  static const InvitationPreviewStatusEnum expired = _$invitationPreviewStatusEnum_expired;

  static Serializer<InvitationPreviewStatusEnum> get serializer => _$invitationPreviewStatusEnumSerializer;

  const InvitationPreviewStatusEnum._(String name): super(name);

  static BuiltSet<InvitationPreviewStatusEnum> get values => _$invitationPreviewStatusEnumValues;
  static InvitationPreviewStatusEnum valueOf(String name) => _$invitationPreviewStatusEnumValueOf(name);
}

