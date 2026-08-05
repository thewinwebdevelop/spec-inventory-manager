//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:omnistock_api_client/src/model/warehouse_summary.dart';
import 'package:omnistock_api_client/src/model/new_organization_membership.dart';
import 'package:omnistock_api_client/src/model/entitlement_summary.dart';
import 'package:omnistock_api_client/src/model/new_organization.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'created_organization.g.dart';

/// `201` of `POST /organizations`. Deliberately complete enough to enter the new shop immediately (ux Q5): a client seeds its cache from this body and does NOT need to refetch `GET /me/organizations` first. 
///
/// Properties:
/// * [organization] 
/// * [membership] 
/// * [entitlement] 
/// * [defaultWarehouse] 
@BuiltValue()
abstract class CreatedOrganization implements Built<CreatedOrganization, CreatedOrganizationBuilder> {
  @BuiltValueField(wireName: r'organization')
  NewOrganization get organization;

  @BuiltValueField(wireName: r'membership')
  NewOrganizationMembership get membership;

  @BuiltValueField(wireName: r'entitlement')
  EntitlementSummary get entitlement;

  @BuiltValueField(wireName: r'defaultWarehouse')
  WarehouseSummary get defaultWarehouse;

  CreatedOrganization._();

  factory CreatedOrganization([void updates(CreatedOrganizationBuilder b)]) = _$CreatedOrganization;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CreatedOrganizationBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<CreatedOrganization> get serializer => _$CreatedOrganizationSerializer();
}

class _$CreatedOrganizationSerializer implements PrimitiveSerializer<CreatedOrganization> {
  @override
  final Iterable<Type> types = const [CreatedOrganization, _$CreatedOrganization];

  @override
  final String wireName = r'CreatedOrganization';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CreatedOrganization object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'organization';
    yield serializers.serialize(
      object.organization,
      specifiedType: const FullType(NewOrganization),
    );
    yield r'membership';
    yield serializers.serialize(
      object.membership,
      specifiedType: const FullType(NewOrganizationMembership),
    );
    yield r'entitlement';
    yield serializers.serialize(
      object.entitlement,
      specifiedType: const FullType(EntitlementSummary),
    );
    yield r'defaultWarehouse';
    yield serializers.serialize(
      object.defaultWarehouse,
      specifiedType: const FullType(WarehouseSummary),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    CreatedOrganization object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CreatedOrganizationBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'organization':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(NewOrganization),
          ) as NewOrganization;
          result.organization.replace(valueDes);
          break;
        case r'membership':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(NewOrganizationMembership),
          ) as NewOrganizationMembership;
          result.membership.replace(valueDes);
          break;
        case r'entitlement':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(EntitlementSummary),
          ) as EntitlementSummary;
          result.entitlement.replace(valueDes);
          break;
        case r'defaultWarehouse':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(WarehouseSummary),
          ) as WarehouseSummary;
          result.defaultWarehouse.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  CreatedOrganization deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CreatedOrganizationBuilder();
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

