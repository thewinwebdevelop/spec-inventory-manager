//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'tax_profile_request.g.dart';

/// `PUT /orgs/{orgId}/tax-profile` — THE WHOLE SET OR NOTHING (data-model §3.3). An empty body `{}` is legitimate and CLEARS the declaration; a partial one is `422` with a message on every missing field. `branchCode` alone is a partial declaration, not an update. 
///
/// Properties:
/// * [entityType] 
/// * [taxId] - 13 digits + checksum (data-model §6). Separators are stripped before storage, so `1-1017-00207-36-6` and `1101700207366` are one value. Rejected → `422 TAX_ID_INVALID` + `fieldErrors.taxId`. ⚠️ With `entityType: personal` this IS the owner's national ID. It is never logged, never echoed back, and never appears in any response except `POST /orgs/{orgId}/tax-profile/reveal`. 
/// * [vatRegistered] - A real boolean — the string `\"true\"` is refused, not coerced.
/// * [branchCode] - Optional. `\"00000\"` = head office.
@BuiltValue()
abstract class TaxProfileRequest implements Built<TaxProfileRequest, TaxProfileRequestBuilder> {
  @BuiltValueField(wireName: r'entityType')
  TaxProfileRequestEntityTypeEnum? get entityType;
  // enum entityTypeEnum {  personal,  company,  };

  /// 13 digits + checksum (data-model §6). Separators are stripped before storage, so `1-1017-00207-36-6` and `1101700207366` are one value. Rejected → `422 TAX_ID_INVALID` + `fieldErrors.taxId`. ⚠️ With `entityType: personal` this IS the owner's national ID. It is never logged, never echoed back, and never appears in any response except `POST /orgs/{orgId}/tax-profile/reveal`. 
  @BuiltValueField(wireName: r'taxId')
  String? get taxId;

  /// A real boolean — the string `\"true\"` is refused, not coerced.
  @BuiltValueField(wireName: r'vatRegistered')
  bool? get vatRegistered;

  /// Optional. `\"00000\"` = head office.
  @BuiltValueField(wireName: r'branchCode')
  String? get branchCode;

  TaxProfileRequest._();

  factory TaxProfileRequest([void updates(TaxProfileRequestBuilder b)]) = _$TaxProfileRequest;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(TaxProfileRequestBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<TaxProfileRequest> get serializer => _$TaxProfileRequestSerializer();
}

class _$TaxProfileRequestSerializer implements PrimitiveSerializer<TaxProfileRequest> {
  @override
  final Iterable<Type> types = const [TaxProfileRequest, _$TaxProfileRequest];

  @override
  final String wireName = r'TaxProfileRequest';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    TaxProfileRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.entityType != null) {
      yield r'entityType';
      yield serializers.serialize(
        object.entityType,
        specifiedType: const FullType(TaxProfileRequestEntityTypeEnum),
      );
    }
    if (object.taxId != null) {
      yield r'taxId';
      yield serializers.serialize(
        object.taxId,
        specifiedType: const FullType(String),
      );
    }
    if (object.vatRegistered != null) {
      yield r'vatRegistered';
      yield serializers.serialize(
        object.vatRegistered,
        specifiedType: const FullType(bool),
      );
    }
    if (object.branchCode != null) {
      yield r'branchCode';
      yield serializers.serialize(
        object.branchCode,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    TaxProfileRequest object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required TaxProfileRequestBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'entityType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(TaxProfileRequestEntityTypeEnum),
          ) as TaxProfileRequestEntityTypeEnum;
          result.entityType = valueDes;
          break;
        case r'taxId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.taxId = valueDes;
          break;
        case r'vatRegistered':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.vatRegistered = valueDes;
          break;
        case r'branchCode':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.branchCode = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  TaxProfileRequest deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = TaxProfileRequestBuilder();
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

class TaxProfileRequestEntityTypeEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'personal')
  static const TaxProfileRequestEntityTypeEnum personal = _$taxProfileRequestEntityTypeEnum_personal;
  @BuiltValueEnumConst(wireName: r'company')
  static const TaxProfileRequestEntityTypeEnum company = _$taxProfileRequestEntityTypeEnum_company;

  static Serializer<TaxProfileRequestEntityTypeEnum> get serializer => _$taxProfileRequestEntityTypeEnumSerializer;

  const TaxProfileRequestEntityTypeEnum._(String name): super(name);

  static BuiltSet<TaxProfileRequestEntityTypeEnum> get values => _$taxProfileRequestEntityTypeEnumValues;
  static TaxProfileRequestEntityTypeEnum valueOf(String name) => _$taxProfileRequestEntityTypeEnumValueOf(name);
}

