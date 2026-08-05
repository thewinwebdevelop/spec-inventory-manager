//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'leave_org_result.g.dart';

/// `200` of `DELETE /orgs/{orgId}/membership` (api-spec §3.17, D-029).
///
/// Properties:
/// * [organizationId] 
/// * [status] 
/// * [revokedAt] 
/// * [cancelledInvitations] 
@BuiltValue()
abstract class LeaveOrgResult implements Built<LeaveOrgResult, LeaveOrgResultBuilder> {
  @BuiltValueField(wireName: r'organizationId')
  String get organizationId;

  @BuiltValueField(wireName: r'status')
  LeaveOrgResultStatusEnum get status;
  // enum statusEnum {  revoked,  };

  @BuiltValueField(wireName: r'revokedAt')
  DateTime get revokedAt;

  @BuiltValueField(wireName: r'cancelledInvitations')
  int get cancelledInvitations;

  LeaveOrgResult._();

  factory LeaveOrgResult([void updates(LeaveOrgResultBuilder b)]) = _$LeaveOrgResult;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(LeaveOrgResultBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<LeaveOrgResult> get serializer => _$LeaveOrgResultSerializer();
}

class _$LeaveOrgResultSerializer implements PrimitiveSerializer<LeaveOrgResult> {
  @override
  final Iterable<Type> types = const [LeaveOrgResult, _$LeaveOrgResult];

  @override
  final String wireName = r'LeaveOrgResult';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    LeaveOrgResult object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'organizationId';
    yield serializers.serialize(
      object.organizationId,
      specifiedType: const FullType(String),
    );
    yield r'status';
    yield serializers.serialize(
      object.status,
      specifiedType: const FullType(LeaveOrgResultStatusEnum),
    );
    yield r'revokedAt';
    yield serializers.serialize(
      object.revokedAt,
      specifiedType: const FullType(DateTime),
    );
    yield r'cancelledInvitations';
    yield serializers.serialize(
      object.cancelledInvitations,
      specifiedType: const FullType(int),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    LeaveOrgResult object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required LeaveOrgResultBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'organizationId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.organizationId = valueDes;
          break;
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(LeaveOrgResultStatusEnum),
          ) as LeaveOrgResultStatusEnum;
          result.status = valueDes;
          break;
        case r'revokedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.revokedAt = valueDes;
          break;
        case r'cancelledInvitations':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.cancelledInvitations = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  LeaveOrgResult deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = LeaveOrgResultBuilder();
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

class LeaveOrgResultStatusEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'revoked')
  static const LeaveOrgResultStatusEnum revoked = _$leaveOrgResultStatusEnum_revoked;

  static Serializer<LeaveOrgResultStatusEnum> get serializer => _$leaveOrgResultStatusEnumSerializer;

  const LeaveOrgResultStatusEnum._(String name): super(name);

  static BuiltSet<LeaveOrgResultStatusEnum> get values => _$leaveOrgResultStatusEnumValues;
  static LeaveOrgResultStatusEnum valueOf(String name) => _$leaveOrgResultStatusEnumValueOf(name);
}

