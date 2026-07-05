//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'health_response_checks.g.dart';

/// Additive (T-000-08): per-dependency readiness detail backing `status`. Optional so existing consumers of the AC11 minimal seam are unaffected (contract-evolution: additive-only against an already-shipped surface). 
///
/// Properties:
/// * [db] - Postgres reachability via PrismaService's `SELECT 1`.
/// * [redis] - Redis/BullMQ reachability via the ioredis connection's PING + a BullMQ queue call. 
@BuiltValue()
abstract class HealthResponseChecks implements Built<HealthResponseChecks, HealthResponseChecksBuilder> {
  /// Postgres reachability via PrismaService's `SELECT 1`.
  @BuiltValueField(wireName: r'db')
  HealthResponseChecksDbEnum? get db;
  // enum dbEnum {  ok,  fail,  };

  /// Redis/BullMQ reachability via the ioredis connection's PING + a BullMQ queue call. 
  @BuiltValueField(wireName: r'redis')
  HealthResponseChecksRedisEnum? get redis;
  // enum redisEnum {  ok,  fail,  };

  HealthResponseChecks._();

  factory HealthResponseChecks([void updates(HealthResponseChecksBuilder b)]) = _$HealthResponseChecks;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(HealthResponseChecksBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<HealthResponseChecks> get serializer => _$HealthResponseChecksSerializer();
}

class _$HealthResponseChecksSerializer implements PrimitiveSerializer<HealthResponseChecks> {
  @override
  final Iterable<Type> types = const [HealthResponseChecks, _$HealthResponseChecks];

  @override
  final String wireName = r'HealthResponseChecks';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    HealthResponseChecks object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.db != null) {
      yield r'db';
      yield serializers.serialize(
        object.db,
        specifiedType: const FullType(HealthResponseChecksDbEnum),
      );
    }
    if (object.redis != null) {
      yield r'redis';
      yield serializers.serialize(
        object.redis,
        specifiedType: const FullType(HealthResponseChecksRedisEnum),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    HealthResponseChecks object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required HealthResponseChecksBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'db':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(HealthResponseChecksDbEnum),
          ) as HealthResponseChecksDbEnum;
          result.db = valueDes;
          break;
        case r'redis':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(HealthResponseChecksRedisEnum),
          ) as HealthResponseChecksRedisEnum;
          result.redis = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  HealthResponseChecks deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = HealthResponseChecksBuilder();
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

class HealthResponseChecksDbEnum extends EnumClass {

  /// Postgres reachability via PrismaService's `SELECT 1`.
  @BuiltValueEnumConst(wireName: r'ok')
  static const HealthResponseChecksDbEnum ok = _$healthResponseChecksDbEnum_ok;
  /// Postgres reachability via PrismaService's `SELECT 1`.
  @BuiltValueEnumConst(wireName: r'fail')
  static const HealthResponseChecksDbEnum fail = _$healthResponseChecksDbEnum_fail;

  static Serializer<HealthResponseChecksDbEnum> get serializer => _$healthResponseChecksDbEnumSerializer;

  const HealthResponseChecksDbEnum._(String name): super(name);

  static BuiltSet<HealthResponseChecksDbEnum> get values => _$healthResponseChecksDbEnumValues;
  static HealthResponseChecksDbEnum valueOf(String name) => _$healthResponseChecksDbEnumValueOf(name);
}

class HealthResponseChecksRedisEnum extends EnumClass {

  /// Redis/BullMQ reachability via the ioredis connection's PING + a BullMQ queue call. 
  @BuiltValueEnumConst(wireName: r'ok')
  static const HealthResponseChecksRedisEnum ok = _$healthResponseChecksRedisEnum_ok;
  /// Redis/BullMQ reachability via the ioredis connection's PING + a BullMQ queue call. 
  @BuiltValueEnumConst(wireName: r'fail')
  static const HealthResponseChecksRedisEnum fail = _$healthResponseChecksRedisEnum_fail;

  static Serializer<HealthResponseChecksRedisEnum> get serializer => _$healthResponseChecksRedisEnumSerializer;

  const HealthResponseChecksRedisEnum._(String name): super(name);

  static BuiltSet<HealthResponseChecksRedisEnum> get values => _$healthResponseChecksRedisEnumValues;
  static HealthResponseChecksRedisEnum valueOf(String name) => _$healthResponseChecksRedisEnumValueOf(name);
}

