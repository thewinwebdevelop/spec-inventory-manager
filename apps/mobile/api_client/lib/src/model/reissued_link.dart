//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'reissued_link.g.dart';

/// `200` of `POST /orgs/{orgId}/invitations/{invitationId}/link` — 200 and not 201: nothing was created, an existing invitation's token was rotated. ⚠️ THE PREVIOUS LINK STOPS WORKING IMMEDIATELY and the expiry restarts from now (D-027), so the UI needs a confirmation dialog and must not say \"copy the existing link\". 
///
/// Properties:
/// * [token] 
/// * [inviteUrl] 
/// * [expiresAt] - `now + TTL(role)` — recomputed, not inherited.
/// * [tokenIssuedAt] 
/// * [rotated] 
@BuiltValue()
abstract class ReissuedLink implements Built<ReissuedLink, ReissuedLinkBuilder> {
  @BuiltValueField(wireName: r'token')
  String get token;

  @BuiltValueField(wireName: r'inviteUrl')
  String get inviteUrl;

  /// `now + TTL(role)` — recomputed, not inherited.
  @BuiltValueField(wireName: r'expiresAt')
  DateTime get expiresAt;

  @BuiltValueField(wireName: r'tokenIssuedAt')
  DateTime get tokenIssuedAt;

  @BuiltValueField(wireName: r'rotated')
  ReissuedLinkRotatedEnum get rotated;
  // enum rotatedEnum {  true,  };

  ReissuedLink._();

  factory ReissuedLink([void updates(ReissuedLinkBuilder b)]) = _$ReissuedLink;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(ReissuedLinkBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<ReissuedLink> get serializer => _$ReissuedLinkSerializer();
}

class _$ReissuedLinkSerializer implements PrimitiveSerializer<ReissuedLink> {
  @override
  final Iterable<Type> types = const [ReissuedLink, _$ReissuedLink];

  @override
  final String wireName = r'ReissuedLink';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    ReissuedLink object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
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
    yield r'rotated';
    yield serializers.serialize(
      object.rotated,
      specifiedType: const FullType(ReissuedLinkRotatedEnum),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    ReissuedLink object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required ReissuedLinkBuilder result,
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
        case r'inviteUrl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.inviteUrl = valueDes;
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
        case r'rotated':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(ReissuedLinkRotatedEnum),
          ) as ReissuedLinkRotatedEnum;
          result.rotated = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  ReissuedLink deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = ReissuedLinkBuilder();
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

class ReissuedLinkRotatedEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'true')
  static const ReissuedLinkRotatedEnum true_ = _$reissuedLinkRotatedEnum_true_;

  static Serializer<ReissuedLinkRotatedEnum> get serializer => _$reissuedLinkRotatedEnumSerializer;

  const ReissuedLinkRotatedEnum._(String name): super(name);

  static BuiltSet<ReissuedLinkRotatedEnum> get values => _$reissuedLinkRotatedEnumValues;
  static ReissuedLinkRotatedEnum valueOf(String name) => _$reissuedLinkRotatedEnumValueOf(name);
}

