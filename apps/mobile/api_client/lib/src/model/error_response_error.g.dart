// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'error_response_error.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$ErrorResponseError extends ErrorResponseError {
  @override
  final String code;
  @override
  final String message;
  @override
  final BuiltMap<String, JsonObject?>? details;
  @override
  final BuiltMap<String, String>? fieldErrors;
  @override
  final String? traceId;

  factory _$ErrorResponseError(
          [void Function(ErrorResponseErrorBuilder)? updates]) =>
      (ErrorResponseErrorBuilder()..update(updates))._build();

  _$ErrorResponseError._(
      {required this.code,
      required this.message,
      this.details,
      this.fieldErrors,
      this.traceId})
      : super._();
  @override
  ErrorResponseError rebuild(
          void Function(ErrorResponseErrorBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  ErrorResponseErrorBuilder toBuilder() =>
      ErrorResponseErrorBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is ErrorResponseError &&
        code == other.code &&
        message == other.message &&
        details == other.details &&
        fieldErrors == other.fieldErrors &&
        traceId == other.traceId;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, code.hashCode);
    _$hash = $jc(_$hash, message.hashCode);
    _$hash = $jc(_$hash, details.hashCode);
    _$hash = $jc(_$hash, fieldErrors.hashCode);
    _$hash = $jc(_$hash, traceId.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'ErrorResponseError')
          ..add('code', code)
          ..add('message', message)
          ..add('details', details)
          ..add('fieldErrors', fieldErrors)
          ..add('traceId', traceId))
        .toString();
  }
}

class ErrorResponseErrorBuilder
    implements Builder<ErrorResponseError, ErrorResponseErrorBuilder> {
  _$ErrorResponseError? _$v;

  String? _code;
  String? get code => _$this._code;
  set code(String? code) => _$this._code = code;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  MapBuilder<String, JsonObject?>? _details;
  MapBuilder<String, JsonObject?> get details =>
      _$this._details ??= MapBuilder<String, JsonObject?>();
  set details(MapBuilder<String, JsonObject?>? details) =>
      _$this._details = details;

  MapBuilder<String, String>? _fieldErrors;
  MapBuilder<String, String> get fieldErrors =>
      _$this._fieldErrors ??= MapBuilder<String, String>();
  set fieldErrors(MapBuilder<String, String>? fieldErrors) =>
      _$this._fieldErrors = fieldErrors;

  String? _traceId;
  String? get traceId => _$this._traceId;
  set traceId(String? traceId) => _$this._traceId = traceId;

  ErrorResponseErrorBuilder() {
    ErrorResponseError._defaults(this);
  }

  ErrorResponseErrorBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _code = $v.code;
      _message = $v.message;
      _details = $v.details?.toBuilder();
      _fieldErrors = $v.fieldErrors?.toBuilder();
      _traceId = $v.traceId;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(ErrorResponseError other) {
    _$v = other as _$ErrorResponseError;
  }

  @override
  void update(void Function(ErrorResponseErrorBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  ErrorResponseError build() => _build();

  _$ErrorResponseError _build() {
    _$ErrorResponseError _$result;
    try {
      _$result = _$v ??
          _$ErrorResponseError._(
            code: BuiltValueNullFieldError.checkNotNull(
                code, r'ErrorResponseError', 'code'),
            message: BuiltValueNullFieldError.checkNotNull(
                message, r'ErrorResponseError', 'message'),
            details: _details?.build(),
            fieldErrors: _fieldErrors?.build(),
            traceId: traceId,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'details';
        _details?.build();
        _$failedField = 'fieldErrors';
        _fieldErrors?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'ErrorResponseError', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
