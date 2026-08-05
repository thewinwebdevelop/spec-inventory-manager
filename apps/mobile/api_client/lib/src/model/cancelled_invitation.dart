//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'cancelled_invitation.g.dart';

/// `200` of `DELETE /orgs/{orgId}/invitations/{invitationId}`.
///
/// Properties:
/// * [id] 
/// * [status] 
@BuiltValue()
abstract class CancelledInvitation implements Built<CancelledInvitation, CancelledInvitationBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  @BuiltValueField(wireName: r'status')
  CancelledInvitationStatusEnum get status;
  // enum statusEnum {  cancelled,  };

  CancelledInvitation._();

  factory CancelledInvitation([void updates(CancelledInvitationBuilder b)]) = _$CancelledInvitation;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CancelledInvitationBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<CancelledInvitation> get serializer => _$CancelledInvitationSerializer();
}

class _$CancelledInvitationSerializer implements PrimitiveSerializer<CancelledInvitation> {
  @override
  final Iterable<Type> types = const [CancelledInvitation, _$CancelledInvitation];

  @override
  final String wireName = r'CancelledInvitation';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CancelledInvitation object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'status';
    yield serializers.serialize(
      object.status,
      specifiedType: const FullType(CancelledInvitationStatusEnum),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    CancelledInvitation object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CancelledInvitationBuilder result,
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
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(CancelledInvitationStatusEnum),
          ) as CancelledInvitationStatusEnum;
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
  CancelledInvitation deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CancelledInvitationBuilder();
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

class CancelledInvitationStatusEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'cancelled')
  static const CancelledInvitationStatusEnum cancelled = _$cancelledInvitationStatusEnum_cancelled;

  static Serializer<CancelledInvitationStatusEnum> get serializer => _$cancelledInvitationStatusEnumSerializer;

  const CancelledInvitationStatusEnum._(String name): super(name);

  static BuiltSet<CancelledInvitationStatusEnum> get values => _$cancelledInvitationStatusEnumValues;
  static CancelledInvitationStatusEnum valueOf(String name) => _$cancelledInvitationStatusEnumValueOf(name);
}

