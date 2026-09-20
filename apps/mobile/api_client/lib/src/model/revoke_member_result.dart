//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'revoke_member_result.g.dart';

/// `200` of `DELETE /orgs/{orgId}/members/{userId}` (api-spec §3.9).
///
/// Properties:
/// * [userId] 
/// * [status] - Soft delete — the row stays, so history and `revokedAt` survive.
/// * [revokedAt] 
/// * [cancelledInvitations] - Pending invitations for that email that were cancelled in the SAME transaction (normally 0 or 1) — so the UI can say \"their pending invitation was withdrawn too\". 
@BuiltValue()
abstract class RevokeMemberResult implements Built<RevokeMemberResult, RevokeMemberResultBuilder> {
  @BuiltValueField(wireName: r'userId')
  String get userId;

  /// Soft delete — the row stays, so history and `revokedAt` survive.
  @BuiltValueField(wireName: r'status')
  RevokeMemberResultStatusEnum get status;
  // enum statusEnum {  revoked,  };

  @BuiltValueField(wireName: r'revokedAt')
  DateTime get revokedAt;

  /// Pending invitations for that email that were cancelled in the SAME transaction (normally 0 or 1) — so the UI can say \"their pending invitation was withdrawn too\". 
  @BuiltValueField(wireName: r'cancelledInvitations')
  int get cancelledInvitations;

  RevokeMemberResult._();

  factory RevokeMemberResult([void updates(RevokeMemberResultBuilder b)]) = _$RevokeMemberResult;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(RevokeMemberResultBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<RevokeMemberResult> get serializer => _$RevokeMemberResultSerializer();
}

class _$RevokeMemberResultSerializer implements PrimitiveSerializer<RevokeMemberResult> {
  @override
  final Iterable<Type> types = const [RevokeMemberResult, _$RevokeMemberResult];

  @override
  final String wireName = r'RevokeMemberResult';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    RevokeMemberResult object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'userId';
    yield serializers.serialize(
      object.userId,
      specifiedType: const FullType(String),
    );
    yield r'status';
    yield serializers.serialize(
      object.status,
      specifiedType: const FullType(RevokeMemberResultStatusEnum),
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
    RevokeMemberResult object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required RevokeMemberResultBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'userId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.userId = valueDes;
          break;
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(RevokeMemberResultStatusEnum),
          ) as RevokeMemberResultStatusEnum;
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
  RevokeMemberResult deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = RevokeMemberResultBuilder();
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

class RevokeMemberResultStatusEnum extends EnumClass {

  /// Soft delete — the row stays, so history and `revokedAt` survive.
  @BuiltValueEnumConst(wireName: r'revoked')
  static const RevokeMemberResultStatusEnum revoked = _$revokeMemberResultStatusEnum_revoked;

  static Serializer<RevokeMemberResultStatusEnum> get serializer => _$revokeMemberResultStatusEnumSerializer;

  const RevokeMemberResultStatusEnum._(String name): super(name);

  static BuiltSet<RevokeMemberResultStatusEnum> get values => _$revokeMemberResultStatusEnumValues;
  static RevokeMemberResultStatusEnum valueOf(String name) => _$revokeMemberResultStatusEnumValueOf(name);
}

