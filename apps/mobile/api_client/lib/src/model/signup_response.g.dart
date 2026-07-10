// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'signup_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const SignupResponseVerifiedEnum _$signupResponseVerifiedEnum_false_ =
    const SignupResponseVerifiedEnum._('false_');

SignupResponseVerifiedEnum _$signupResponseVerifiedEnumValueOf(String name) {
  switch (name) {
    case 'false_':
      return _$signupResponseVerifiedEnum_false_;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<SignupResponseVerifiedEnum> _$signupResponseVerifiedEnumValues =
    BuiltSet<SignupResponseVerifiedEnum>(const <SignupResponseVerifiedEnum>[
  _$signupResponseVerifiedEnum_false_,
]);

Serializer<SignupResponseVerifiedEnum> _$signupResponseVerifiedEnumSerializer =
    _$SignupResponseVerifiedEnumSerializer();

class _$SignupResponseVerifiedEnumSerializer
    implements PrimitiveSerializer<SignupResponseVerifiedEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'false_': 'false',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'false': 'false_',
  };

  @override
  final Iterable<Type> types = const <Type>[SignupResponseVerifiedEnum];
  @override
  final String wireName = 'SignupResponseVerifiedEnum';

  @override
  Object serialize(Serializers serializers, SignupResponseVerifiedEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  SignupResponseVerifiedEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      SignupResponseVerifiedEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$SignupResponse extends SignupResponse {
  @override
  final String userId;
  @override
  final String email;
  @override
  final SignupResponseVerifiedEnum verified;

  factory _$SignupResponse([void Function(SignupResponseBuilder)? updates]) =>
      (SignupResponseBuilder()..update(updates))._build();

  _$SignupResponse._(
      {required this.userId, required this.email, required this.verified})
      : super._();
  @override
  SignupResponse rebuild(void Function(SignupResponseBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  SignupResponseBuilder toBuilder() => SignupResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is SignupResponse &&
        userId == other.userId &&
        email == other.email &&
        verified == other.verified;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, userId.hashCode);
    _$hash = $jc(_$hash, email.hashCode);
    _$hash = $jc(_$hash, verified.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'SignupResponse')
          ..add('userId', userId)
          ..add('email', email)
          ..add('verified', verified))
        .toString();
  }
}

class SignupResponseBuilder
    implements Builder<SignupResponse, SignupResponseBuilder> {
  _$SignupResponse? _$v;

  String? _userId;
  String? get userId => _$this._userId;
  set userId(String? userId) => _$this._userId = userId;

  String? _email;
  String? get email => _$this._email;
  set email(String? email) => _$this._email = email;

  SignupResponseVerifiedEnum? _verified;
  SignupResponseVerifiedEnum? get verified => _$this._verified;
  set verified(SignupResponseVerifiedEnum? verified) =>
      _$this._verified = verified;

  SignupResponseBuilder() {
    SignupResponse._defaults(this);
  }

  SignupResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _userId = $v.userId;
      _email = $v.email;
      _verified = $v.verified;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(SignupResponse other) {
    _$v = other as _$SignupResponse;
  }

  @override
  void update(void Function(SignupResponseBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  SignupResponse build() => _build();

  _$SignupResponse _build() {
    final _$result = _$v ??
        _$SignupResponse._(
          userId: BuiltValueNullFieldError.checkNotNull(
              userId, r'SignupResponse', 'userId'),
          email: BuiltValueNullFieldError.checkNotNull(
              email, r'SignupResponse', 'email'),
          verified: BuiltValueNullFieldError.checkNotNull(
              verified, r'SignupResponse', 'verified'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
