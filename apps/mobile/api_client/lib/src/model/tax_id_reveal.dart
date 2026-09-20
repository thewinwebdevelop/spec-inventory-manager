//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'tax_id_reveal.g.dart';

/// `200` of `POST /orgs/{orgId}/tax-profile/reveal` — the ONLY response in the entire system that carries a full tax id (`TAX_ID_RESPONSE_ALLOWLIST` has exactly one row and CI pins its length). Every call emits `org.tax_profile.revealed` (with no TIN in the event) and counts against 20/hour per (user, shop). @frontend: hold this in screen memory only — never persist it, never log it, and re-request it if the user hides and re-shows the number. 
///
/// Properties:
/// * [taxId] - The full 13-digit number, as stored.
/// * [entityType] - Absent on a legacy row that holds a TIN but no entity type.
/// * [revealedAt] 
@BuiltValue()
abstract class TaxIdReveal implements Built<TaxIdReveal, TaxIdRevealBuilder> {
  /// The full 13-digit number, as stored.
  @BuiltValueField(wireName: r'taxId')
  String get taxId;

  /// Absent on a legacy row that holds a TIN but no entity type.
  @BuiltValueField(wireName: r'entityType')
  TaxIdRevealEntityTypeEnum? get entityType;
  // enum entityTypeEnum {  personal,  company,  };

  @BuiltValueField(wireName: r'revealedAt')
  DateTime get revealedAt;

  TaxIdReveal._();

  factory TaxIdReveal([void updates(TaxIdRevealBuilder b)]) = _$TaxIdReveal;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(TaxIdRevealBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<TaxIdReveal> get serializer => _$TaxIdRevealSerializer();
}

class _$TaxIdRevealSerializer implements PrimitiveSerializer<TaxIdReveal> {
  @override
  final Iterable<Type> types = const [TaxIdReveal, _$TaxIdReveal];

  @override
  final String wireName = r'TaxIdReveal';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    TaxIdReveal object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'taxId';
    yield serializers.serialize(
      object.taxId,
      specifiedType: const FullType(String),
    );
    if (object.entityType != null) {
      yield r'entityType';
      yield serializers.serialize(
        object.entityType,
        specifiedType: const FullType(TaxIdRevealEntityTypeEnum),
      );
    }
    yield r'revealedAt';
    yield serializers.serialize(
      object.revealedAt,
      specifiedType: const FullType(DateTime),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    TaxIdReveal object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required TaxIdRevealBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'taxId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.taxId = valueDes;
          break;
        case r'entityType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(TaxIdRevealEntityTypeEnum),
          ) as TaxIdRevealEntityTypeEnum;
          result.entityType = valueDes;
          break;
        case r'revealedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.revealedAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  TaxIdReveal deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = TaxIdRevealBuilder();
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

class TaxIdRevealEntityTypeEnum extends EnumClass {

  /// Absent on a legacy row that holds a TIN but no entity type.
  @BuiltValueEnumConst(wireName: r'personal')
  static const TaxIdRevealEntityTypeEnum personal = _$taxIdRevealEntityTypeEnum_personal;
  /// Absent on a legacy row that holds a TIN but no entity type.
  @BuiltValueEnumConst(wireName: r'company')
  static const TaxIdRevealEntityTypeEnum company = _$taxIdRevealEntityTypeEnum_company;

  static Serializer<TaxIdRevealEntityTypeEnum> get serializer => _$taxIdRevealEntityTypeEnumSerializer;

  const TaxIdRevealEntityTypeEnum._(String name): super(name);

  static BuiltSet<TaxIdRevealEntityTypeEnum> get values => _$taxIdRevealEntityTypeEnumValues;
  static TaxIdRevealEntityTypeEnum valueOf(String name) => _$taxIdRevealEntityTypeEnumValueOf(name);
}

