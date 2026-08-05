//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:omnistock_api_client/src/model/tax_profile_view.dart';
import 'package:omnistock_api_client/src/model/org_my_membership.dart';
import 'package:omnistock_api_client/src/model/entitlement_summary.dart';
import 'package:omnistock_api_client/src/model/org_counts.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'org_profile.g.dart';

/// `GET /orgs/{orgId}`, and the `200` of `PATCH /orgs/{orgId}` and `PUT /orgs/{orgId}/tax-profile` — one mapper, one shape (api-spec §3.3). 
///
/// Properties:
/// * [id] 
/// * [name] 
/// * [logo] 
/// * [timezone] 
/// * [currency] - Fixed `THB` in Phase 0 (D-013). Never accepted from a client.
/// * [taxProfile] - `null` when the shop has declared nothing — at EVERY permission tier, so \"not declared\" is not a permission signal either. 
/// * [taxProfileComplete] - Derived (entity type + tax id + VAT flag all present). Visible to every member. F-002 only reports it; F-007 is what gates features on it. 
/// * [entitlement] - `null` only if the shop somehow has no entitlement row.
/// * [myMembership] 
/// * [counts] 
@BuiltValue()
abstract class OrgProfile implements Built<OrgProfile, OrgProfileBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  @BuiltValueField(wireName: r'name')
  String get name;

  @BuiltValueField(wireName: r'logo')
  String? get logo;

  @BuiltValueField(wireName: r'timezone')
  String get timezone;

  /// Fixed `THB` in Phase 0 (D-013). Never accepted from a client.
  @BuiltValueField(wireName: r'currency')
  String get currency;

  /// `null` when the shop has declared nothing — at EVERY permission tier, so \"not declared\" is not a permission signal either. 
  @BuiltValueField(wireName: r'taxProfile')
  TaxProfileView? get taxProfile;

  /// Derived (entity type + tax id + VAT flag all present). Visible to every member. F-002 only reports it; F-007 is what gates features on it. 
  @BuiltValueField(wireName: r'taxProfileComplete')
  bool get taxProfileComplete;

  /// `null` only if the shop somehow has no entitlement row.
  @BuiltValueField(wireName: r'entitlement')
  EntitlementSummary? get entitlement;

  @BuiltValueField(wireName: r'myMembership')
  OrgMyMembership get myMembership;

  @BuiltValueField(wireName: r'counts')
  OrgCounts get counts;

  OrgProfile._();

  factory OrgProfile([void updates(OrgProfileBuilder b)]) = _$OrgProfile;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(OrgProfileBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<OrgProfile> get serializer => _$OrgProfileSerializer();
}

class _$OrgProfileSerializer implements PrimitiveSerializer<OrgProfile> {
  @override
  final Iterable<Type> types = const [OrgProfile, _$OrgProfile];

  @override
  final String wireName = r'OrgProfile';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    OrgProfile object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'name';
    yield serializers.serialize(
      object.name,
      specifiedType: const FullType(String),
    );
    yield r'logo';
    yield object.logo == null ? null : serializers.serialize(
      object.logo,
      specifiedType: const FullType.nullable(String),
    );
    yield r'timezone';
    yield serializers.serialize(
      object.timezone,
      specifiedType: const FullType(String),
    );
    yield r'currency';
    yield serializers.serialize(
      object.currency,
      specifiedType: const FullType(String),
    );
    yield r'taxProfile';
    yield object.taxProfile == null ? null : serializers.serialize(
      object.taxProfile,
      specifiedType: const FullType.nullable(TaxProfileView),
    );
    yield r'taxProfileComplete';
    yield serializers.serialize(
      object.taxProfileComplete,
      specifiedType: const FullType(bool),
    );
    yield r'entitlement';
    yield object.entitlement == null ? null : serializers.serialize(
      object.entitlement,
      specifiedType: const FullType.nullable(EntitlementSummary),
    );
    yield r'myMembership';
    yield serializers.serialize(
      object.myMembership,
      specifiedType: const FullType(OrgMyMembership),
    );
    yield r'counts';
    yield serializers.serialize(
      object.counts,
      specifiedType: const FullType(OrgCounts),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    OrgProfile object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required OrgProfileBuilder result,
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
        case r'name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.name = valueDes;
          break;
        case r'logo':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.logo = valueDes;
          break;
        case r'timezone':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.timezone = valueDes;
          break;
        case r'currency':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.currency = valueDes;
          break;
        case r'taxProfile':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(TaxProfileView),
          ) as TaxProfileView?;
          if (valueDes == null) continue;
          result.taxProfile.replace(valueDes);
          break;
        case r'taxProfileComplete':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.taxProfileComplete = valueDes;
          break;
        case r'entitlement':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(EntitlementSummary),
          ) as EntitlementSummary?;
          if (valueDes == null) continue;
          result.entitlement.replace(valueDes);
          break;
        case r'myMembership':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(OrgMyMembership),
          ) as OrgMyMembership;
          result.myMembership.replace(valueDes);
          break;
        case r'counts':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(OrgCounts),
          ) as OrgCounts;
          result.counts.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  OrgProfile deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = OrgProfileBuilder();
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

