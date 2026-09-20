//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'tax_profile_view.g.dart';

/// The shop's tax identity AS THIS CALLER MAY SEE IT (api-spec §3.3, three tiers). EVERY field is optional and a client MUST work when any of them is absent:   • caller with `manage_org_settings` → `entityType`, `taxIdMasked`,     `vatRegistered`, `branchCode`;   • any other active member → `vatRegistered` ONLY (no digits at all, not     even the last four — ux Q13);   • nothing declared yet → the whole object is `null` (for every tier). ⛔ There is no `taxId` here and there never will be. The full number comes from `POST /orgs/{orgId}/tax-profile/reveal` alone. ⛔ Do NOT read \"no `taxIdMasked`\" as \"not declared\" — `taxProfileComplete` on the parent answers that question. 
///
/// Properties:
/// * [entityType] 
/// * [taxIdMasked] - Last four digits only, e.g. `•••••••••4567`.
/// * [vatRegistered] 
/// * [branchCode] - 5 digits; `\"00000\"` is head office.
@BuiltValue()
abstract class TaxProfileView implements Built<TaxProfileView, TaxProfileViewBuilder> {
  @BuiltValueField(wireName: r'entityType')
  TaxProfileViewEntityTypeEnum? get entityType;
  // enum entityTypeEnum {  personal,  company,  };

  /// Last four digits only, e.g. `•••••••••4567`.
  @BuiltValueField(wireName: r'taxIdMasked')
  String? get taxIdMasked;

  @BuiltValueField(wireName: r'vatRegistered')
  bool? get vatRegistered;

  /// 5 digits; `\"00000\"` is head office.
  @BuiltValueField(wireName: r'branchCode')
  String? get branchCode;

  TaxProfileView._();

  factory TaxProfileView([void updates(TaxProfileViewBuilder b)]) = _$TaxProfileView;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(TaxProfileViewBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<TaxProfileView> get serializer => _$TaxProfileViewSerializer();
}

class _$TaxProfileViewSerializer implements PrimitiveSerializer<TaxProfileView> {
  @override
  final Iterable<Type> types = const [TaxProfileView, _$TaxProfileView];

  @override
  final String wireName = r'TaxProfileView';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    TaxProfileView object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.entityType != null) {
      yield r'entityType';
      yield serializers.serialize(
        object.entityType,
        specifiedType: const FullType(TaxProfileViewEntityTypeEnum),
      );
    }
    if (object.taxIdMasked != null) {
      yield r'taxIdMasked';
      yield serializers.serialize(
        object.taxIdMasked,
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
    TaxProfileView object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required TaxProfileViewBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'entityType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(TaxProfileViewEntityTypeEnum),
          ) as TaxProfileViewEntityTypeEnum;
          result.entityType = valueDes;
          break;
        case r'taxIdMasked':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.taxIdMasked = valueDes;
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
  TaxProfileView deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = TaxProfileViewBuilder();
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

class TaxProfileViewEntityTypeEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'personal')
  static const TaxProfileViewEntityTypeEnum personal = _$taxProfileViewEntityTypeEnum_personal;
  @BuiltValueEnumConst(wireName: r'company')
  static const TaxProfileViewEntityTypeEnum company = _$taxProfileViewEntityTypeEnum_company;

  static Serializer<TaxProfileViewEntityTypeEnum> get serializer => _$taxProfileViewEntityTypeEnumSerializer;

  const TaxProfileViewEntityTypeEnum._(String name): super(name);

  static BuiltSet<TaxProfileViewEntityTypeEnum> get values => _$taxProfileViewEntityTypeEnumValues;
  static TaxProfileViewEntityTypeEnum valueOf(String name) => _$taxProfileViewEntityTypeEnumValueOf(name);
}

