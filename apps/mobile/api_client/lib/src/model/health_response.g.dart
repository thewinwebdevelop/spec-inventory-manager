// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'health_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const HealthResponseStatusEnum _$healthResponseStatusEnum_ok =
    const HealthResponseStatusEnum._('ok');
const HealthResponseStatusEnum _$healthResponseStatusEnum_error =
    const HealthResponseStatusEnum._('error');

HealthResponseStatusEnum _$healthResponseStatusEnumValueOf(String name) {
  switch (name) {
    case 'ok':
      return _$healthResponseStatusEnum_ok;
    case 'error':
      return _$healthResponseStatusEnum_error;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<HealthResponseStatusEnum> _$healthResponseStatusEnumValues =
    BuiltSet<HealthResponseStatusEnum>(const <HealthResponseStatusEnum>[
  _$healthResponseStatusEnum_ok,
  _$healthResponseStatusEnum_error,
]);

Serializer<HealthResponseStatusEnum> _$healthResponseStatusEnumSerializer =
    _$HealthResponseStatusEnumSerializer();

class _$HealthResponseStatusEnumSerializer
    implements PrimitiveSerializer<HealthResponseStatusEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'ok': 'ok',
    'error': 'error',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'ok': 'ok',
    'error': 'error',
  };

  @override
  final Iterable<Type> types = const <Type>[HealthResponseStatusEnum];
  @override
  final String wireName = 'HealthResponseStatusEnum';

  @override
  Object serialize(Serializers serializers, HealthResponseStatusEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  HealthResponseStatusEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      HealthResponseStatusEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$HealthResponse extends HealthResponse {
  @override
  final HealthResponseStatusEnum status;
  @override
  final HealthResponseChecks? checks;

  factory _$HealthResponse([void Function(HealthResponseBuilder)? updates]) =>
      (HealthResponseBuilder()..update(updates))._build();

  _$HealthResponse._({required this.status, this.checks}) : super._();
  @override
  HealthResponse rebuild(void Function(HealthResponseBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  HealthResponseBuilder toBuilder() => HealthResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is HealthResponse &&
        status == other.status &&
        checks == other.checks;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jc(_$hash, checks.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'HealthResponse')
          ..add('status', status)
          ..add('checks', checks))
        .toString();
  }
}

class HealthResponseBuilder
    implements Builder<HealthResponse, HealthResponseBuilder> {
  _$HealthResponse? _$v;

  HealthResponseStatusEnum? _status;
  HealthResponseStatusEnum? get status => _$this._status;
  set status(HealthResponseStatusEnum? status) => _$this._status = status;

  HealthResponseChecksBuilder? _checks;
  HealthResponseChecksBuilder get checks =>
      _$this._checks ??= HealthResponseChecksBuilder();
  set checks(HealthResponseChecksBuilder? checks) => _$this._checks = checks;

  HealthResponseBuilder() {
    HealthResponse._defaults(this);
  }

  HealthResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _status = $v.status;
      _checks = $v.checks?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(HealthResponse other) {
    _$v = other as _$HealthResponse;
  }

  @override
  void update(void Function(HealthResponseBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  HealthResponse build() => _build();

  _$HealthResponse _build() {
    _$HealthResponse _$result;
    try {
      _$result = _$v ??
          _$HealthResponse._(
            status: BuiltValueNullFieldError.checkNotNull(
                status, r'HealthResponse', 'status'),
            checks: _checks?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'checks';
        _checks?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'HealthResponse', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
