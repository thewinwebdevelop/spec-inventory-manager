//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'update_organization_request.g.dart';

/// `PATCH /orgs/{orgId}` (api-spec §3.4). An absent key means \"leave alone\"; an empty body is a valid no-op that returns the current profile. 
///
/// Properties:
/// * [name] 
/// * [logo] - ⛔ Phase 0 accepts `null` and NOTHING ELSE (M-4). Any string → `422 VALIDATION_FAILED` with `fieldErrors.logo = \"ยังไม่รองรับการตั้งโลโก้ในเวอร์ชันนี้\"`. An arbitrary URL here would make every member of the shop fetch a resource chosen by whoever holds `manage_org_settings`. 
/// * [timezone] - IANA zone from `Intl.supportedValuesOf('timeZone')`; anything else is 422.
@BuiltValue()
abstract class UpdateOrganizationRequest implements Built<UpdateOrganizationRequest, UpdateOrganizationRequestBuilder> {
  @BuiltValueField(wireName: r'name')
  String? get name;

  /// ⛔ Phase 0 accepts `null` and NOTHING ELSE (M-4). Any string → `422 VALIDATION_FAILED` with `fieldErrors.logo = \"ยังไม่รองรับการตั้งโลโก้ในเวอร์ชันนี้\"`. An arbitrary URL here would make every member of the shop fetch a resource chosen by whoever holds `manage_org_settings`. 
  @BuiltValueField(wireName: r'logo')
  String? get logo;

  /// IANA zone from `Intl.supportedValuesOf('timeZone')`; anything else is 422.
  @BuiltValueField(wireName: r'timezone')
  String? get timezone;

  UpdateOrganizationRequest._();

  factory UpdateOrganizationRequest([void updates(UpdateOrganizationRequestBuilder b)]) = _$UpdateOrganizationRequest;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(UpdateOrganizationRequestBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<UpdateOrganizationRequest> get serializer => _$UpdateOrganizationRequestSerializer();
}

class _$UpdateOrganizationRequestSerializer implements PrimitiveSerializer<UpdateOrganizationRequest> {
  @override
  final Iterable<Type> types = const [UpdateOrganizationRequest, _$UpdateOrganizationRequest];

  @override
  final String wireName = r'UpdateOrganizationRequest';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    UpdateOrganizationRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.name != null) {
      yield r'name';
      yield serializers.serialize(
        object.name,
        specifiedType: const FullType(String),
      );
    }
    if (object.logo != null) {
      yield r'logo';
      yield serializers.serialize(
        object.logo,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.timezone != null) {
      yield r'timezone';
      yield serializers.serialize(
        object.timezone,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    UpdateOrganizationRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required UpdateOrganizationRequestBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
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
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  UpdateOrganizationRequest deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = UpdateOrganizationRequestBuilder();
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

