//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:omnistock_api_client/src/model/entitlement_summary.dart';
import 'package:omnistock_api_client/src/model/organization_summary.dart';
import 'package:omnistock_api_client/src/model/my_organization_membership.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'my_organization_item.g.dart';

/// MyOrganizationItem
///
/// Properties:
/// * [organization] 
/// * [membership] 
/// * [entitlement] - Present only on the `active` (full) shape; absent on a revoked row.
@BuiltValue()
abstract class MyOrganizationItem implements Built<MyOrganizationItem, MyOrganizationItemBuilder> {
  @BuiltValueField(wireName: r'organization')
  OrganizationSummary get organization;

  @BuiltValueField(wireName: r'membership')
  MyOrganizationMembership get membership;

  /// Present only on the `active` (full) shape; absent on a revoked row.
  @BuiltValueField(wireName: r'entitlement')
  EntitlementSummary? get entitlement;

  MyOrganizationItem._();

  factory MyOrganizationItem([void updates(MyOrganizationItemBuilder b)]) = _$MyOrganizationItem;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(MyOrganizationItemBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<MyOrganizationItem> get serializer => _$MyOrganizationItemSerializer();
}

class _$MyOrganizationItemSerializer implements PrimitiveSerializer<MyOrganizationItem> {
  @override
  final Iterable<Type> types = const [MyOrganizationItem, _$MyOrganizationItem];

  @override
  final String wireName = r'MyOrganizationItem';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    MyOrganizationItem object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'organization';
    yield serializers.serialize(
      object.organization,
      specifiedType: const FullType(OrganizationSummary),
    );
    yield r'membership';
    yield serializers.serialize(
      object.membership,
      specifiedType: const FullType(MyOrganizationMembership),
    );
    if (object.entitlement != null) {
      yield r'entitlement';
      yield serializers.serialize(
        object.entitlement,
        specifiedType: const FullType.nullable(EntitlementSummary),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    MyOrganizationItem object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required MyOrganizationItemBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'organization':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(OrganizationSummary),
          ) as OrganizationSummary;
          result.organization.replace(valueDes);
          break;
        case r'membership':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(MyOrganizationMembership),
          ) as MyOrganizationMembership;
          result.membership.replace(valueDes);
          break;
        case r'entitlement':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(EntitlementSummary),
          ) as EntitlementSummary?;
          if (valueDes == null) continue;
          result.entitlement.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  MyOrganizationItem deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = MyOrganizationItemBuilder();
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

