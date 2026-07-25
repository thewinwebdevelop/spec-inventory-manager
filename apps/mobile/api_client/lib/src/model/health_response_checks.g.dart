// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'health_response_checks.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const HealthResponseChecksDbEnum _$healthResponseChecksDbEnum_ok =
    const HealthResponseChecksDbEnum._('ok');
const HealthResponseChecksDbEnum _$healthResponseChecksDbEnum_fail =
    const HealthResponseChecksDbEnum._('fail');

HealthResponseChecksDbEnum _$healthResponseChecksDbEnumValueOf(String name) {
  switch (name) {
    case 'ok':
      return _$healthResponseChecksDbEnum_ok;
    case 'fail':
      return _$healthResponseChecksDbEnum_fail;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<HealthResponseChecksDbEnum> _$healthResponseChecksDbEnumValues =
    BuiltSet<HealthResponseChecksDbEnum>(const <HealthResponseChecksDbEnum>[
  _$healthResponseChecksDbEnum_ok,
  _$healthResponseChecksDbEnum_fail,
]);

const HealthResponseChecksRedisEnum _$healthResponseChecksRedisEnum_ok =
    const HealthResponseChecksRedisEnum._('ok');
const HealthResponseChecksRedisEnum _$healthResponseChecksRedisEnum_fail =
    const HealthResponseChecksRedisEnum._('fail');

HealthResponseChecksRedisEnum _$healthResponseChecksRedisEnumValueOf(
    String name) {
  switch (name) {
    case 'ok':
      return _$healthResponseChecksRedisEnum_ok;
    case 'fail':
      return _$healthResponseChecksRedisEnum_fail;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<HealthResponseChecksRedisEnum>
    _$healthResponseChecksRedisEnumValues = BuiltSet<
        HealthResponseChecksRedisEnum>(const <HealthResponseChecksRedisEnum>[
  _$healthResponseChecksRedisEnum_ok,
  _$healthResponseChecksRedisEnum_fail,
]);

Serializer<HealthResponseChecksDbEnum> _$healthResponseChecksDbEnumSerializer =
    _$HealthResponseChecksDbEnumSerializer();
Serializer<HealthResponseChecksRedisEnum>
    _$healthResponseChecksRedisEnumSerializer =
    _$HealthResponseChecksRedisEnumSerializer();

class _$HealthResponseChecksDbEnumSerializer
    implements PrimitiveSerializer<HealthResponseChecksDbEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'ok': 'ok',
    'fail': 'fail',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'ok': 'ok',
    'fail': 'fail',
  };

  @override
  final Iterable<Type> types = const <Type>[HealthResponseChecksDbEnum];
  @override
  final String wireName = 'HealthResponseChecksDbEnum';

  @override
  Object serialize(Serializers serializers, HealthResponseChecksDbEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  HealthResponseChecksDbEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      HealthResponseChecksDbEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$HealthResponseChecksRedisEnumSerializer
    implements PrimitiveSerializer<HealthResponseChecksRedisEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'ok': 'ok',
    'fail': 'fail',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'ok': 'ok',
    'fail': 'fail',
  };

  @override
  final Iterable<Type> types = const <Type>[HealthResponseChecksRedisEnum];
  @override
  final String wireName = 'HealthResponseChecksRedisEnum';

  @override
  Object serialize(
          Serializers serializers, HealthResponseChecksRedisEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  HealthResponseChecksRedisEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      HealthResponseChecksRedisEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$HealthResponseChecks extends HealthResponseChecks {
  @override
  final HealthResponseChecksDbEnum? db;
  @override
  final HealthResponseChecksRedisEnum? redis;

  factory _$HealthResponseChecks(
          [void Function(HealthResponseChecksBuilder)? updates]) =>
      (HealthResponseChecksBuilder()..update(updates))._build();

  _$HealthResponseChecks._({this.db, this.redis}) : super._();
  @override
  HealthResponseChecks rebuild(
          void Function(HealthResponseChecksBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  HealthResponseChecksBuilder toBuilder() =>
      HealthResponseChecksBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is HealthResponseChecks &&
        db == other.db &&
        redis == other.redis;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, db.hashCode);
    _$hash = $jc(_$hash, redis.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'HealthResponseChecks')
          ..add('db', db)
          ..add('redis', redis))
        .toString();
  }
}

class HealthResponseChecksBuilder
    implements Builder<HealthResponseChecks, HealthResponseChecksBuilder> {
  _$HealthResponseChecks? _$v;

  HealthResponseChecksDbEnum? _db;
  HealthResponseChecksDbEnum? get db => _$this._db;
  set db(HealthResponseChecksDbEnum? db) => _$this._db = db;

  HealthResponseChecksRedisEnum? _redis;
  HealthResponseChecksRedisEnum? get redis => _$this._redis;
  set redis(HealthResponseChecksRedisEnum? redis) => _$this._redis = redis;

  HealthResponseChecksBuilder() {
    HealthResponseChecks._defaults(this);
  }

  HealthResponseChecksBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _db = $v.db;
      _redis = $v.redis;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(HealthResponseChecks other) {
    _$v = other as _$HealthResponseChecks;
  }

  @override
  void update(void Function(HealthResponseChecksBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  HealthResponseChecks build() => _build();

  _$HealthResponseChecks _build() {
    final _$result = _$v ??
        _$HealthResponseChecks._(
          db: db,
          redis: redis,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
