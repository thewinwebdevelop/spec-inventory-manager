// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'role_detail.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$RoleDetail extends RoleDetail {
  @override
  final String id;
  @override
  final String name;
  @override
  final String? key;
  @override
  final bool nameCustomized;
  @override
  final bool isSystem;
  @override
  final bool grantsOwnership;
  @override
  final BuiltList<String> capabilities;
  @override
  final int version;
  @override
  final RoleUsage usage;
  @override
  final RoleLastEdited? lastEdited;
  @override
  final RoleDetailViewer viewer;
  @override
  final DateTime createdAt;

  factory _$RoleDetail([void Function(RoleDetailBuilder)? updates]) =>
      (RoleDetailBuilder()..update(updates))._build();

  _$RoleDetail._(
      {required this.id,
      required this.name,
      this.key,
      required this.nameCustomized,
      required this.isSystem,
      required this.grantsOwnership,
      required this.capabilities,
      required this.version,
      required this.usage,
      this.lastEdited,
      required this.viewer,
      required this.createdAt})
      : super._();
  @override
  RoleDetail rebuild(void Function(RoleDetailBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  RoleDetailBuilder toBuilder() => RoleDetailBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is RoleDetail &&
        id == other.id &&
        name == other.name &&
        key == other.key &&
        nameCustomized == other.nameCustomized &&
        isSystem == other.isSystem &&
        grantsOwnership == other.grantsOwnership &&
        capabilities == other.capabilities &&
        version == other.version &&
        usage == other.usage &&
        lastEdited == other.lastEdited &&
        viewer == other.viewer &&
        createdAt == other.createdAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, key.hashCode);
    _$hash = $jc(_$hash, nameCustomized.hashCode);
    _$hash = $jc(_$hash, isSystem.hashCode);
    _$hash = $jc(_$hash, grantsOwnership.hashCode);
    _$hash = $jc(_$hash, capabilities.hashCode);
    _$hash = $jc(_$hash, version.hashCode);
    _$hash = $jc(_$hash, usage.hashCode);
    _$hash = $jc(_$hash, lastEdited.hashCode);
    _$hash = $jc(_$hash, viewer.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'RoleDetail')
          ..add('id', id)
          ..add('name', name)
          ..add('key', key)
          ..add('nameCustomized', nameCustomized)
          ..add('isSystem', isSystem)
          ..add('grantsOwnership', grantsOwnership)
          ..add('capabilities', capabilities)
          ..add('version', version)
          ..add('usage', usage)
          ..add('lastEdited', lastEdited)
          ..add('viewer', viewer)
          ..add('createdAt', createdAt))
        .toString();
  }
}

class RoleDetailBuilder implements Builder<RoleDetail, RoleDetailBuilder> {
  _$RoleDetail? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  String? _key;
  String? get key => _$this._key;
  set key(String? key) => _$this._key = key;

  bool? _nameCustomized;
  bool? get nameCustomized => _$this._nameCustomized;
  set nameCustomized(bool? nameCustomized) =>
      _$this._nameCustomized = nameCustomized;

  bool? _isSystem;
  bool? get isSystem => _$this._isSystem;
  set isSystem(bool? isSystem) => _$this._isSystem = isSystem;

  bool? _grantsOwnership;
  bool? get grantsOwnership => _$this._grantsOwnership;
  set grantsOwnership(bool? grantsOwnership) =>
      _$this._grantsOwnership = grantsOwnership;

  ListBuilder<String>? _capabilities;
  ListBuilder<String> get capabilities =>
      _$this._capabilities ??= ListBuilder<String>();
  set capabilities(ListBuilder<String>? capabilities) =>
      _$this._capabilities = capabilities;

  int? _version;
  int? get version => _$this._version;
  set version(int? version) => _$this._version = version;

  RoleUsageBuilder? _usage;
  RoleUsageBuilder get usage => _$this._usage ??= RoleUsageBuilder();
  set usage(RoleUsageBuilder? usage) => _$this._usage = usage;

  RoleLastEditedBuilder? _lastEdited;
  RoleLastEditedBuilder get lastEdited =>
      _$this._lastEdited ??= RoleLastEditedBuilder();
  set lastEdited(RoleLastEditedBuilder? lastEdited) =>
      _$this._lastEdited = lastEdited;

  RoleDetailViewerBuilder? _viewer;
  RoleDetailViewerBuilder get viewer =>
      _$this._viewer ??= RoleDetailViewerBuilder();
  set viewer(RoleDetailViewerBuilder? viewer) => _$this._viewer = viewer;

  DateTime? _createdAt;
  DateTime? get createdAt => _$this._createdAt;
  set createdAt(DateTime? createdAt) => _$this._createdAt = createdAt;

  RoleDetailBuilder() {
    RoleDetail._defaults(this);
  }

  RoleDetailBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _name = $v.name;
      _key = $v.key;
      _nameCustomized = $v.nameCustomized;
      _isSystem = $v.isSystem;
      _grantsOwnership = $v.grantsOwnership;
      _capabilities = $v.capabilities.toBuilder();
      _version = $v.version;
      _usage = $v.usage.toBuilder();
      _lastEdited = $v.lastEdited?.toBuilder();
      _viewer = $v.viewer.toBuilder();
      _createdAt = $v.createdAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(RoleDetail other) {
    _$v = other as _$RoleDetail;
  }

  @override
  void update(void Function(RoleDetailBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  RoleDetail build() => _build();

  _$RoleDetail _build() {
    _$RoleDetail _$result;
    try {
      _$result = _$v ??
          _$RoleDetail._(
            id: BuiltValueNullFieldError.checkNotNull(id, r'RoleDetail', 'id'),
            name: BuiltValueNullFieldError.checkNotNull(
                name, r'RoleDetail', 'name'),
            key: key,
            nameCustomized: BuiltValueNullFieldError.checkNotNull(
                nameCustomized, r'RoleDetail', 'nameCustomized'),
            isSystem: BuiltValueNullFieldError.checkNotNull(
                isSystem, r'RoleDetail', 'isSystem'),
            grantsOwnership: BuiltValueNullFieldError.checkNotNull(
                grantsOwnership, r'RoleDetail', 'grantsOwnership'),
            capabilities: capabilities.build(),
            version: BuiltValueNullFieldError.checkNotNull(
                version, r'RoleDetail', 'version'),
            usage: usage.build(),
            lastEdited: _lastEdited?.build(),
            viewer: viewer.build(),
            createdAt: BuiltValueNullFieldError.checkNotNull(
                createdAt, r'RoleDetail', 'createdAt'),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'capabilities';
        capabilities.build();

        _$failedField = 'usage';
        usage.build();
        _$failedField = 'lastEdited';
        _lastEdited?.build();
        _$failedField = 'viewer';
        viewer.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'RoleDetail', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
