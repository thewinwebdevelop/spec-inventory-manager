"use client";

/**
 * R3 — ฟอร์มบทบาท: สร้าง / ทำสำเนา / แก้ (ux-wireframe R3, ui.md §3) · T-003-W06.
 *
 *  - `/o/{orgId}/settings/roles/new`            → create from blank
 *  - `/o/{orgId}/settings/roles/new?from={id}`  → clone (POST, pre-filled — there is no clone endpoint)
 *  - `/o/{orgId}/settings/roles/{id}`           → edit when `viewer.canEdit.allowed`,
 *                                                  otherwise read-only (R4 — W08 builds it out)
 *
 * ⛔ Write affordances follow the SERVER's verdicts only (`canCreate`,
 * `canEdit`, `canClone`) — never `myMembership.capabilities` (repo lesson
 * "client-invented server facts"). The one local-capability read is the
 * per-row "คุณไม่มีสิทธิ์นี้" hint (ux R3), through the shared `can()` rule; it
 * is a UX guard and the server still decides (`ROLE_EXCEEDS_ACTOR`).
 *
 * ⛔ SR-14: on `409 ROLE_CHANGED` the role is re-read and shown; nothing is
 * resubmitted. Saving again is a new press of the button by the person.
 *
 * Seams left for later tasks (each is the ONLY place that task needs to touch):
 *  - W07 R3a: `EditRoleScreen.submit` — insert the confirm/diff dialog before
 *    calling the mutation when `capabilities` is in the body.
 *  - W07 R3b: `roleConflict` — holds the user's draft (`draft`) and the version
 *    they started from; W07 renders the diff + "ใส่การแก้ของฉันกลับเข้าไป".
 *  - W08 R4: `RoleReadOnlyView`. W09 R5: the delete button in "การจัดการอื่น".
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveOrg } from "../../../lib/org/org-context";
import { can } from "../../../lib/org/capability";
import { orgKey } from "../../../lib/org/org-keys";
import { toApiFailure } from "../../../lib/api/error";
import { useLeaveGuard } from "../../../hooks/use-leave-guard";
import { useThrottleCountdown } from "../../../hooks/use-throttle-countdown";
import { Banner } from "../../../components/ui/Banner";
import { Button } from "../../../components/ui/Button";
import { ButtonLink } from "../../../components/ui/ButtonLink";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { ForbiddenPanel } from "../../../components/ui/ForbiddenPanel";
import { Icon } from "../../../components/ui/Icon";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StickyActionBar } from "../../../components/ui/StickyActionBar";
import { TextField } from "../../../components/ui/TextField";
import { useToast } from "../../../components/providers/ToastProvider";
import { ROLE_NAME_MAX_LENGTH } from "@omnistock/core-domain";
import {
  bannerReasonCopy,
  createOrCloneBlockedReasonCopy,
  displayRoleName,
  lastEditedLine,
  ROLE_FORBIDDEN_PANEL_COPY,
  ROLE_NOT_FOUND_COPY,
  roleFormErrorMessage,
  roleRateLimitedMessage,
  toLastEdited,
  usageLine,
} from "../role-copy";
import { roleFormTh, rolesTh } from "./i18n";
import { CapabilityChecklist } from "./CapabilityChecklist";
import { RoleReadOnlyView } from "./RoleReadOnlyView";
import {
  buildChecklist,
  buildCreateBody,
  buildUpdateBody,
  cloneName,
  cloneSelection,
  initialSelection,
  nameLength,
  payloadCapabilities,
  toggleCapability,
  validateRoleNameInput,
} from "./role-form-model";
import { classifyRoleWriteFailure, type RoleRefetchTarget } from "./role-write-failure";
import { createHref } from "./template-options";
import {
  useCapabilityCatalog,
  useRoleDetail,
  useRoleDetails,
  type CapabilityCatalog,
  type RoleDetail,
} from "./api/use-role-details";
import { useCreateRole, useUpdateRole } from "./api/use-role-mutations";

export type RoleFormScreenProps =
  { mode: "create"; fromRoleId?: string } | { mode: "edit"; roleId: string };

export function RoleFormScreen(props: RoleFormScreenProps) {
  return props.mode === "create" ? (
    <CreateRoleScreen fromRoleId={props.fromRoleId} />
  ) : (
    <EditRoleScreen roleId={props.roleId} />
  );
}

const EMPTY_CATALOG: CapabilityCatalog = { groups: [], items: [] };

const roleName = (r: Pick<RoleDetail, "name" | "key" | "nameCustomized">) =>
  displayRoleName({ name: r.name, roleKey: r.key, nameCustomized: r.nameCustomized });

// ── page frame + shared states ─────────────────────────────────────────────

function Page({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-[var(--size-content-narrow-max-w)] flex-col gap-4 p-4 lg:p-card-padding">
      {children}
    </main>
  );
}

function BackLink({ orgId }: { orgId: string }) {
  return (
    <ButtonLink href={`/o/${orgId}/settings/roles`} variant="tertiary" className="self-start">
      <Icon role="back" />
      {roleFormTh.back}
    </ButtonLink>
  );
}

function LoadingState({ orgId }: { orgId: string }) {
  return (
    <Page>
      <BackLink orgId={orgId} />
      <div role="status" aria-label={roleFormTh.loadingLabel} className="flex flex-col gap-3">
        <div className="h-8 w-1/2 animate-shimmer rounded-card bg-surface-muted" />
        <div className="h-4 w-2/3 animate-shimmer rounded-card bg-surface-muted" />
        <div className="h-4 w-1/2 animate-shimmer rounded-card bg-surface-muted" />
        <div className="mt-2 h-12 animate-shimmer rounded-card bg-surface-muted" />
        {[0, 1].map((g) => (
          <div key={g} className="mt-4 flex flex-col gap-2">
            <div className="h-4 w-1/4 animate-shimmer rounded-card bg-surface-muted" />
            {[0, 1, 2].map((r) => (
              <div key={r} className="h-14 animate-shimmer rounded-card bg-surface-muted" />
            ))}
          </div>
        ))}
      </div>
    </Page>
  );
}

function NotFoundState({ orgId }: { orgId: string }) {
  return (
    <Page>
      <EmptyState
        icon="info"
        title={ROLE_NOT_FOUND_COPY.title}
        body={ROLE_NOT_FOUND_COPY.body}
        actions={
          <ButtonLink href={`/o/${orgId}/settings/roles`} variant="secondary">
            {roleFormTh.backToList}
          </ButtonLink>
        }
      />
    </Page>
  );
}

function LoadErrorState({
  orgId,
  title,
  body,
  onRetry,
}: {
  orgId: string;
  title: string;
  body: string;
  onRetry: () => void;
}) {
  return (
    <Page>
      <EmptyState
        icon="error"
        title={title}
        body={body}
        actions={
          <>
            <Button variant="secondary" onClick={onRetry}>
              {roleFormTh.loadError.retry}
            </Button>
            <ButtonLink href={`/o/${orgId}/settings/roles`} variant="tertiary">
              {roleFormTh.backToList}
            </ButtonLink>
          </>
        }
      />
    </Page>
  );
}

/** A 403 FORBIDDEN means our copy of the caller's capabilities is stale — re-read it once. */
function Forbidden({ orgId }: { orgId: string }) {
  return (
    <Page>
      <ForbiddenPanel orgId={orgId} copy={ROLE_FORBIDDEN_PANEL_COPY} />
    </Page>
  );
}

function WritesDisabledBanner() {
  const copy = bannerReasonCopy("writes_disabled");
  return (
    <Banner tone="info" icon={<Icon role="info" />} role="status">
      <strong className="block">{copy.title}</strong>
      {copy.body}
    </Banner>
  );
}

function useRefetchers(
  extra: Partial<Record<RoleRefetchTarget, () => void>>,
): (targets: readonly RoleRefetchTarget[]) => void {
  const queryClient = useQueryClient();
  const { orgId } = useActiveOrg();
  return (targets) => {
    for (const t of targets) {
      if (extra[t]) extra[t]!();
      else if (t === "list")
        void queryClient.invalidateQueries({ queryKey: orgKey(orgId, "role-details") });
      else if (t === "profile")
        void queryClient.invalidateQueries({ queryKey: orgKey(orgId, "profile") });
    }
  };
}

function useInvalidateProfile() {
  const queryClient = useQueryClient();
  const { orgId } = useActiveOrg();
  return () => void queryClient.invalidateQueries({ queryKey: orgKey(orgId, "profile") });
}

// ── create / clone ─────────────────────────────────────────────────────────

function CreateRoleScreen({ fromRoleId }: { fromRoleId?: string }) {
  const { orgId } = useActiveOrg();
  const router = useRouter();
  const toast = useToast();
  const invalidateProfile = useInvalidateProfile();
  const list = useRoleDetails();
  const catalog = useCapabilityCatalog();
  const create = useCreateRole();
  const [forbidden, setForbidden] = useState(false);

  const listFailure = list.isError ? toApiFailure(list.error) : null;
  if (
    forbidden ||
    listFailure?.kind === "forbidden" ||
    (catalog.isError && toApiFailure(catalog.error).kind === "forbidden")
  ) {
    return <ForbiddenAndRefresh orgId={orgId} />;
  }
  if (listFailure) {
    return (
      <LoadErrorState
        orgId={orgId}
        title={rolesTh.error.title}
        body={rolesTh.error.body}
        onRetry={() => {
          void list.refetch();
          void catalog.refetch();
        }}
      />
    );
  }
  const page = list.data;
  if (!page || (!catalog.data && !catalog.isError)) return <LoadingState orgId={orgId} />;

  const cat = catalog.data ?? EMPTY_CATALOG;
  const source = fromRoleId ? page.items.find((r) => r.id === fromRoleId) : undefined;
  const usable = source !== undefined && source.viewer.canClone.allowed;
  const existing = page.items.flatMap((r) => [r.name, roleName(r)]);
  const seed = usable
    ? {
        name: cloneName(roleName(source), existing),
        selection: cloneSelection(source.capabilities, cat),
        passthrough: [] as string[],
      }
    : { name: "", selection: new Set<string>(), passthrough: [] as string[] };

  const verdict = page.viewer.canCreate;
  const writesOff = verdict.reason === "writes_disabled";
  const blocked =
    !verdict.allowed && !writesOff
      ? createOrCloneBlockedReasonCopy(verdict.reason, page.viewer.limit)
      : null;

  return (
    <RoleForm
      key={`${catalog.data ? "cat" : "nocat"}:${fromRoleId ?? ""}`}
      mode="create"
      isClone={usable}
      catalog={catalog.data}
      onRetryCatalog={() => void catalog.refetch()}
      seed={seed}
      canSubmit={verdict.allowed}
      submitBlockedNote={blocked?.body}
      topBanner={
        <>
          {writesOff && <WritesDisabledBanner />}
          {fromRoleId && !usable && (
            <Banner tone="info" icon={<Icon role="info" />} role="status">
              {roleFormTh.cloneUnavailable}
            </Banner>
          )}
        </>
      }
      header={
        <>
          <h1 className="m-0 text-heading-md">{roleFormTh.createTitle}</h1>
          {usable && (
            <p className="m-0 text-body-sm text-text-muted">
              {roleFormTh.cloneFrom(roleName(source))}
            </p>
          )}
        </>
      }
      submit={(values) => create.mutateAsync(buildCreateBody(values.name, values.capabilities))}
      onSaved={(saved) => {
        invalidateProfile();
        toast.success(roleFormTh.createdToast(roleName(saved)));
        router.push(`/o/${orgId}/settings/roles`);
      }}
      onRefetch={{ catalog: () => void catalog.refetch() }}
      onForbidden={() => setForbidden(true)}
    />
  );
}

function ForbiddenAndRefresh({ orgId }: { orgId: string }) {
  const invalidateProfile = useInvalidateProfile();
  // Once per mount: the menu entry then disappears on its own (ux §0 ForbiddenPanel).
  useEffect(() => invalidateProfile(), []);
  return <Forbidden orgId={orgId} />;
}

// ── edit ───────────────────────────────────────────────────────────────────

function EditRoleScreen({ roleId }: { roleId: string }) {
  const { orgId, profile } = useActiveOrg();
  const toast = useToast();
  const invalidateProfile = useInvalidateProfile();
  const roleQ = useRoleDetail(roleId);
  const catalog = useCapabilityCatalog();
  const update = useUpdateRole(roleId);
  /** The version the form is built on — changes only on load, save, or a ROLE_CHANGED re-read. */
  const [snapshot, setSnapshot] = useState<RoleDetail | null>(null);
  const [nonce, setNonce] = useState(0);
  const [roleConflict, setRoleConflict] = useState<{ startedFromVersion: number } | null>(null);
  const [writeOutcome, setWriteOutcome] = useState<"forbidden" | "not-found" | null>(null);

  const loadFailure = roleQ.isError ? toApiFailure(roleQ.error) : null;
  const catalogFailure = catalog.isError ? toApiFailure(catalog.error) : null;

  if (
    writeOutcome === "forbidden" ||
    loadFailure?.kind === "forbidden" ||
    catalogFailure?.kind === "forbidden"
  ) {
    return <ForbiddenAndRefresh orgId={orgId} />;
  }
  if (writeOutcome === "not-found" || loadFailure?.kind === "not-found") {
    return <NotFoundState orgId={orgId} />;
  }
  if (loadFailure) {
    return (
      <LoadErrorState
        orgId={orgId}
        title={roleFormTh.loadError.title}
        body={roleFormTh.loadError.body}
        onRetry={() => {
          void roleQ.refetch();
          void catalog.refetch();
        }}
      />
    );
  }
  const current = roleQ.data;
  if (!current || (!catalog.data && !catalog.isError)) return <LoadingState orgId={orgId} />;

  const isMine = current.id === profile.myMembership.roleId;
  const conflictBanner = roleConflict && (
    <Banner tone="warning" icon={<Icon role="warn" />} role="status">
      <strong className="block">{roleFormTh.roleChanged.title}</strong>
      {roleFormTh.roleChanged.body}
    </Banner>
  );

  // The server's CURRENT verdict decides between R3 and R4 — a refusal that
  // re-read the role (TARGET_NOT_BELOW_ACTOR, ROLE_HELD_…, ROLE_LOCKED,
  // ROLE_WRITES_DISABLED) lands here.
  if (!current.viewer.canEdit.allowed) {
    return (
      <Page>
        <BackLink orgId={orgId} />
        {conflictBanner}
        <RoleReadOnlyView role={current} catalog={catalog.data} isMine={isMine} />
      </Page>
    );
  }

  const base = snapshot ?? current;
  const cat = catalog.data ?? EMPTY_CATALOG;
  const seeded = initialSelection(base.capabilities, cat);
  const initialName = roleName(base);
  const canClone = current.viewer.canClone;
  const cloneBlocked =
    !canClone.allowed && canClone.reason === "role_limit_reached"
      ? createOrCloneBlockedReasonCopy(canClone.reason, null)
      : null;

  const initialCapabilities = payloadCapabilities(seeded.selection, seeded.passthrough, cat);
  const editBody = (values: FormValues) =>
    buildUpdateBody({
      version: base.version,
      initialName,
      name: values.name,
      initialCapabilities,
      capabilities: values.capabilities,
    });

  const reread = async () => {
    const fresh = await roleQ.refetch();
    if (fresh.data) {
      setSnapshot(fresh.data);
      setNonce((n) => n + 1);
    } else if (fresh.error && toApiFailure(fresh.error).kind === "not-found") {
      setWriteOutcome("not-found");
    }
  };

  return (
    <RoleForm
      key={`${catalog.data ? "cat" : "nocat"}:${base.id}:${base.version}:${nonce}`}
      mode="edit"
      isClone={false}
      catalog={catalog.data}
      onRetryCatalog={() => void catalog.refetch()}
      seed={{ name: initialName, selection: seeded.selection, passthrough: seeded.passthrough }}
      canSubmit
      topBanner={conflictBanner}
      header={
        <>
          <h1 className="m-0 text-heading-md">{roleName(base)}</h1>
          <p className="m-0 text-body-sm text-text-muted">
            {usageLine({
              activeMembers: current.usage.activeMembers,
              pendingInvitations: current.usage.pendingInvitations,
              isViewerRole: isMine,
            })}
          </p>
          <p className="m-0 text-body-sm text-text-muted">
            {lastEditedLine(toLastEdited(base.lastEdited))}
          </p>
        </>
      }
      otherActions={(dirty) =>
        canClone.allowed || cloneBlocked ? (
          <SectionCard title={roleFormTh.otherActions}>
            <div className="flex flex-col items-start gap-2">
              {canClone.allowed ? (
                <ButtonLink href={createHref(orgId, base.id)} variant="secondary">
                  {roleFormTh.clone}
                </ButtonLink>
              ) : (
                <Button variant="secondary" disabled>
                  {roleFormTh.clone}
                </Button>
              )}
              {cloneBlocked && (
                <p className="m-0 text-body-sm text-text-muted">{cloneBlocked.body}</p>
              )}
              {canClone.allowed && dirty && (
                <p className="m-0 text-body-sm text-text-muted">{roleFormTh.cloneUsesSaved}</p>
              )}
            </div>
          </SectionCard>
        ) : null
      }
      buildBody={editBody}
      // W07 (R3a) inserts its confirm dialog here when the body carries `capabilities`.
      submit={(values) => {
        const body = editBody(values);
        if (body === null) return Promise.resolve(base);
        return update.mutateAsync(body);
      }}
      onSaved={(saved) => {
        // Own role or not, re-read who I am: PATCH's viewer.* is pre-edit (B24 review).
        invalidateProfile();
        setRoleConflict(null);
        setSnapshot(saved);
        setNonce((n) => n + 1);
        toast.success(roleFormTh.savedToast(roleName(saved)));
      }}
      onRoleChanged={async () => {
        setRoleConflict({ startedFromVersion: base.version });
        await reread();
      }}
      onRefetch={{
        role: () => void reread(),
        catalog: () => void catalog.refetch(),
      }}
      onForbidden={() => setWriteOutcome("forbidden")}
      onNotFound={() => setWriteOutcome("not-found")}
    />
  );
}

// ── the form ───────────────────────────────────────────────────────────────

interface FormValues {
  name: string;
  capabilities: string[];
}

interface RoleFormProps {
  mode: "create" | "edit";
  isClone: boolean;
  /** `undefined` = the catalog failed to load (the checklist shows a danger banner). */
  catalog: CapabilityCatalog | undefined;
  onRetryCatalog: () => void;
  seed: { name: string; selection: ReadonlySet<string>; passthrough: readonly string[] };
  /** The server's verdict (create: `canCreate`; edit: `canEdit`). */
  canSubmit: boolean;
  submitBlockedNote?: string;
  topBanner?: ReactNode;
  header: ReactNode;
  otherActions?: (dirty: boolean) => ReactNode;
  /** Edit: the PATCH body (`null` = nothing to save). Create: absent. */
  buildBody?: (values: FormValues) => object | null;
  submit: (values: FormValues) => Promise<RoleDetail>;
  onSaved: (saved: RoleDetail) => void;
  onRoleChanged?: () => Promise<void>;
  onRefetch: Partial<Record<RoleRefetchTarget, () => void>>;
  onForbidden: () => void;
  /** Absent (create) → a 404 shows the generic save failure. */
  onNotFound?: () => void;
}

function RoleForm(props: RoleFormProps) {
  const { orgId, capabilities: viewerCaps } = useActiveOrg();
  const refetch = useRefetchers(props.onRefetch);
  const throttle = useThrottleCountdown();
  const cat = props.catalog ?? EMPTY_CATALOG;
  const isEdit = props.mode === "edit";

  const [name, setName] = useState(props.seed.name);
  const [selection, setSelection] = useState<ReadonlySet<string>>(props.seed.selection);
  const [passthrough, setPassthrough] = useState<readonly string[]>(props.seed.passthrough);
  const [nameError, setNameError] = useState<string | null>(null);
  const [capsError, setCapsError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const checklistRef = useRef<HTMLElement>(null);
  const selectedOnFocus = useRef(false);

  const view = useMemo(
    () => buildChecklist(cat, selection, (key) => can(viewerCaps, key)),
    [cat, selection, viewerCaps],
  );
  const capabilities = payloadCapabilities(selection, passthrough, cat);
  const seedCaps = useMemo(
    () => payloadCapabilities(props.seed.selection, props.seed.passthrough, cat),
    // The seed is fixed for this mount (the parent remounts on a new seed).
    [],
  );
  const values: FormValues = { name, capabilities };
  const dirty = isEdit
    ? (props.buildBody?.(values) ?? null) !== null
    : name.trim() !== props.seed.name.trim() ||
      capabilities.length !== seedCaps.length ||
      capabilities.some((k, i) => k !== seedCaps[i]);

  const guard = useLeaveGuard(dirty && !submitting);
  const listHref = `/o/${orgId}/settings/roles`;

  // Deferred to after the render that re-enables the fieldset — focusing a
  // field inside a still-disabled <fieldset> silently does nothing.
  const [attention, setAttention] = useState<{ to: "name" | "checklist"; n: number } | null>(null);
  useEffect(() => {
    if (!attention) return;
    if (attention.to === "name") nameRef.current?.focus();
    else checklistRef.current?.scrollIntoView?.({ block: "start" });
  }, [attention]);
  const focusName = () => setAttention((a) => ({ to: "name", n: (a?.n ?? 0) + 1 }));
  const showChecklist = () => setAttention((a) => ({ to: "checklist", n: (a?.n ?? 0) + 1 }));

  const onSubmit = async () => {
    if (submitting || throttle.isActive) return;
    setBanner(null);
    const nameProblem = validateRoleNameInput(name);
    const empty = selection.size === 0;
    setNameError(
      nameProblem === "empty"
        ? roleFormTh.name.empty
        : nameProblem === "too_long"
          ? roleFormTh.name.tooLong
          : null,
    );
    setCapsError(empty ? roleFormTh.checklist.empty : null);
    if (nameProblem) {
      focusName();
      return;
    }
    if (empty) {
      showChecklist();
      return;
    }
    setSubmitting(true);
    try {
      const saved = await props.submit(values);
      setSubmitting(false);
      props.onSaved(saved);
    } catch (err) {
      setSubmitting(false);
      const f = classifyRoleWriteFailure(err);
      switch (f.kind) {
        case "role-changed":
          // SR-14: re-read and show — the person decides whether to save again.
          await props.onRoleChanged?.();
          return;
        case "field":
          if (f.field === "name") {
            setNameError(f.message);
            focusName();
          } else {
            setCapsError(f.message);
            showChecklist();
          }
          return;
        case "banner":
          setBanner(f.message);
          if (f.untick && f.untick.length > 0) {
            const gone = new Set(f.untick);
            setSelection((s) => new Set([...s].filter((k) => !gone.has(k))));
            setPassthrough((p) => p.filter((k) => !gone.has(k)));
          }
          refetch(f.refetch);
          return;
        case "throttled":
          throttle.start(f.seconds);
          return;
        case "forbidden":
          props.onForbidden();
          return;
        case "not-found":
          if (props.onNotFound) props.onNotFound();
          else setBanner(roleFormErrorMessage("__unmapped__", { action: "save" }));
          return;
      }
    }
  };

  const counterN = nameLength(name);
  const submitDisabled =
    !props.canSubmit || props.catalog === undefined || throttle.isActive || (isEdit && !dirty);

  return (
    <Page>
      <BackLink orgId={orgId} />
      {props.topBanner}
      <div className="flex flex-col gap-1">{props.header}</div>

      {throttle.isActive && (
        <Banner tone="warning" icon={<Icon role="clock" />} role="status" className="tabular-nums">
          {roleRateLimitedMessage(throttle.remainingSeconds)}
        </Banner>
      )}
      {banner && <ErrorBanner message={banner} />}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit();
        }}
        className="flex flex-col gap-4"
      >
        <fieldset disabled={submitting} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
          <TextField
            label={roleFormTh.name.label}
            value={name}
            placeholder={isEdit ? undefined : roleFormTh.name.placeholder}
            helperText={isEdit ? roleFormTh.name.helperEdit : roleFormTh.name.helperCreate}
            errorText={nameError ?? undefined}
            counter={roleFormTh.name.counter(counterN, ROLE_NAME_MAX_LENGTH)}
            counterInvalid={counterN > ROLE_NAME_MAX_LENGTH}
            inputRef={nameRef}
            onFocus={(e) => {
              // Clone: the first focus selects the suggestion so typing replaces it.
              if (props.isClone && !selectedOnFocus.current) {
                selectedOnFocus.current = true;
                e.currentTarget.select();
              }
            }}
            onChange={(v) => {
              setName(v);
              setNameError(null);
            }}
          />

          {props.catalog ? (
            <CapabilityChecklist
              ref={checklistRef}
              view={view}
              unknownCount={passthrough.length}
              errorText={capsError ?? undefined}
              disabled={submitting}
              onToggle={(key, checked) => {
                setSelection((s) => toggleCapability(s, key, checked, cat));
                setCapsError(null);
              }}
            />
          ) : (
            <Banner
              tone="danger"
              icon={<Icon role="error" />}
              role="alert"
              actions={
                <Button variant="secondary" size="sm" onClick={props.onRetryCatalog}>
                  {roleFormTh.loadError.retry}
                </Button>
              }
            >
              {roleFormTh.checklist.loadError}
            </Banner>
          )}
        </fieldset>

        {props.otherActions?.(dirty)}

        <StickyActionBar className="flex-wrap">
          {props.submitBlockedNote && (
            <p className="m-0 mr-auto max-w-xs text-body-sm text-text-muted">
              {props.submitBlockedNote}
            </p>
          )}
          <Button variant="secondary" onClick={() => guard.leave(listHref)} disabled={submitting}>
            {roleFormTh.cancel}
          </Button>
          <Button
            type="submit"
            disabled={submitDisabled}
            loading={submitting}
            loadingLabel={isEdit ? roleFormTh.submittingEdit : roleFormTh.submittingCreate}
          >
            {isEdit ? roleFormTh.submitEdit : roleFormTh.submitCreate}
          </Button>
        </StickyActionBar>
      </form>

      <ConfirmDialog
        open={guard.pendingHref !== null}
        title={roleFormTh.leave.title}
        body={roleFormTh.leave.body}
        cancelLabel={roleFormTh.leave.keep}
        confirmLabel={roleFormTh.leave.discard}
        variant="destructive"
        onCancel={guard.cancelLeave}
        onConfirm={guard.confirmLeave}
      />
    </Page>
  );
}
