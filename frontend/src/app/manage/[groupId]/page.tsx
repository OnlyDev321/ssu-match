"use client";

import { ScrambleText } from "@/design-system/components/ScrambleText";
import { use, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, ClipboardList, SlidersHorizontal, Trash2, Users } from "lucide-react";
import { Avatar, Badge, Button, Card, RoleQuota, type BadgeVariant } from "@/design-system";
import ManageGroupEditor from "@/components/group/ManageGroupEditor";
import ApplicationCard from "@/components/application/ApplicationCard";
import DeleteGroupModal from "@/components/group/DeleteGroupModal";
import { CardSkeletonList, EmptyState, ErrorState } from "@/components/common/AsyncState";
import { getMyGroups, deleteGroup } from "@/services/groupService";
import {
  acceptApplication,
  getGroupApplications,
  rejectApplication,
} from "@/services/applicationService";
import { toApiErrorCode } from "@/lib/api";
import { useRequireLogin, useServiceData } from "@/lib/hooks";
import { useLanguageStore } from "@/stores/languageStore";
import type {
  ApiErrorCode,
  ApplicationAction,
  GroupStatusCode,
  ManageGroupData,
  ManageGroupPageProps,
  ManageGroupContentProps,
} from "@/lib/types";

// Trang duyệt đơn xin gia nhập của một nhóm tôi làm Leader (/manage/[groupId]).
// Quyền Leader xác định bằng myRole từ Backend (getMyGroups), không so sánh theo tên.

const statusVariant: Record<GroupStatusCode, BadgeVariant> = {
  RECRUITING: "recruiting",
  COMPLETED: "active",
  CLOSED: "closed",
};

const omitKey = <V,>(record: Record<number, V>, key: number): Record<number, V> => {
  const next = { ...record };
  delete next[key];
  return next;
};

const backLinkClass =
  "inline-flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors";

export default function ManageGroupPage({ params }: ManageGroupPageProps) {
  const { groupId: groupIdParam } = use(params);
  return <ManageGroupContent key={groupIdParam} groupIdParam={groupIdParam} />;
}

function ManageGroupContent({ groupIdParam }: ManageGroupContentProps) {
  const groupId = Number(groupIdParam);
  const { t } = useLanguageStore();
  const isReady = useRequireLogin(`/manage/${groupIdParam}`);

  const loadGroupData = useCallback(async (): Promise<ManageGroupData> => {
    if (!/^[1-9]\d*$/.test(groupIdParam) || !Number.isSafeInteger(groupId)) return { group: null, applications: [] };
    const groups = await getMyGroups();
    const group = groups.find((g) => g.id === groupId && g.myRole === "LEADER") ?? null;
    if (!group) return { group: null, applications: [] };
    try {
      const applications = await getGroupApplications(groupId);
      return { group, applications };
    } catch (error) {
      return { group, applications: [], applicationsErrorCode: toApiErrorCode(error) };
    }
  }, [groupId, groupIdParam]);

  const { status, data, errorCode, reload, setData } = useServiceData(loadGroupData, isReady);
  const router = useRouter();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pendingActions, setPendingActions] = useState<Record<number, ApplicationAction>>({});
  const [actionErrors, setActionErrors] = useState<Record<number, ApiErrorCode>>({});

  const handleDeleteConfirm = async () => {
    if (!group) return;
    await deleteGroup(group.id);
    router.push("/manage");
  };

  const handleAction = async (applicationId: number, action: ApplicationAction) => {
    if (data?.group?.myRole !== "LEADER" || Object.keys(pendingActions).length > 0) return;
    if (action === "accept" && (data.group.status !== "RECRUITING" || data.group.memberCount >= data.group.maxMembers)) return;
    setPendingActions((prev) => ({ ...prev, [applicationId]: action }));
    setActionErrors((prev) => omitKey(prev, applicationId));
    try {
      const updated =
        action === "accept"
          ? await acceptApplication(applicationId)
          : await rejectApplication(applicationId);

      // Làm mới thông tin nhóm (số thành viên, trạng thái) sau khi duyệt; lỗi làm mới không chặn kết quả duyệt.
      const freshGroup = await getMyGroups()
        .then((groups) => groups.find((g) => g.id === groupId) ?? null)
        .catch(() => null);

      setData((prev) =>
        prev && {
          group: freshGroup ?? prev.group,
          applications: prev.applications.map((a) => (a.id === updated.id ? updated : a)),
        },
      );
    } catch (error) {
      setActionErrors((prev) => ({ ...prev, [applicationId]: toApiErrorCode(error) }));
    } finally {
      setPendingActions((prev) => omitKey(prev, applicationId));
    }
  };

  if (!isReady) return null;

  // Không tồn tại / không phải Leader: getMyGroups không trả về nhóm, hoặc Backend trả 403/404.
  const isUnavailable =
    (status === "ready" && !data?.group) ||
    (status === "error" && (errorCode === "FORBIDDEN" || errorCode === "NOT_FOUND"));

  const group = data?.group ?? null;
  const pendingApplications = (data?.applications ?? []).filter((a) => a.status === "PENDING");
  const courseLabel = group
    ? [group.courseCode, group.courseName].filter(Boolean).join(" • ") || group.department
    : "";

  return (
    <div className="@container mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Link href="/manage" className={backLinkClass}>
        <ArrowLeft className="w-3.5 h-3.5" />
        <ScrambleText text={t.manage.backToManage} />
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-muted)] pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
          <ScrambleText text={t.manage.title} />
        </h1>
        {group && (
          <Link
            href={`/groups/${group.id}`}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-(--shadow-level-1) transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <ScrambleText text={t.manage.groupDetailLink} />
          </Link>
        )}
      </div>

      {status === "loading" ? (
        <CardSkeletonList count={2} />
      ) : isUnavailable ? (
        <EmptyState
          text={`${t.manage.notAvailableTitle}. ${t.manage.notAvailableDesc}`}
          action={
            <Link
              href="/manage"
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
            >
              <ScrambleText text={t.manage.backToManage} />
            </Link>
          }
        />
      ) : status === "error" || !group ? (
        <ErrorState
          title={t.manage.applicationsError}
          message={t.apiErrors[errorCode ?? "SERVER_ERROR"]}
          retryLabel={t.manage.retry}
          onRetry={reload}
        />
      ) : (
        <>
          <Card className="relative overflow-hidden border-[var(--border)] p-5 sm:p-7">
            <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[var(--primary)]" />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-center">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  {courseLabel && <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">{courseLabel}</span>}
                  <Badge variant={statusVariant[group.status]} size="sm" dot pulse={group.status === "RECRUITING"} mono>
                    <ScrambleText text={t.groupStatus[group.status]} />
                  </Badge>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">{group.title}</h2>
                {group.description && <p className="max-w-3xl whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-secondary)]">{group.description}</p>}
                {(group.college || group.department) && <p className="text-sm font-medium text-[var(--text-muted)]">{[group.college, group.department].filter(Boolean).join(" · ")}</p>}
              </div>
              <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--surface-container-low)] p-4 sm:p-5">
                <RoleQuota current={group.memberCount} max={group.maxMembers} label={t.myGroupCard.membersLabel} className="w-full justify-start text-sm" />
              </div>
            </div>
          </Card>

          <nav aria-label={t.manage.title} className="flex gap-2 overflow-x-auto rounded-xl border border-[var(--border-muted)] bg-[var(--surface)] p-1.5 shadow-(--shadow-level-1)">
            {[
              { href: "#members", label: t.manageDetails.members, icon: Users },
              { href: "#edit-group", label: t.manageDetails.editTitle, icon: SlidersHorizontal },
              { href: "#applications", label: t.manage.applicationsTitle, icon: ClipboardList },
            ].map(({ href, label, icon: Icon }) => (
              <a key={href} href={href} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
                <Icon aria-hidden="true" className="h-4 w-4" />
                <ScrambleText text={label} />
              </a>
            ))}
          </nav>

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(17rem,0.8fr)]">
            <div id="edit-group" className="scroll-mt-6">
              <ManageGroupEditor
                key={group.id}
                group={group}
                onSaved={(updated) => {
                  setData((previous) => previous?.group ? {
                    ...previous,
                    group: {
                      ...previous.group,
                      title: updated.title,
                      description: updated.description,
                      maxMembers: updated.maxMembers,
                      status: updated.status,
                      rolesQuota: updated.rolesQuota,
                      courseCode: updated.courseCode,
                      courseName: updated.courseName,
                      meetingFormat: updated.meetingFormat,
                      tags: updated.tags,
                      contactEmail: updated.contactEmail,
                      contactPhone: updated.contactPhone,
                    },
                  } : previous);
                }}
              />
            </div>

            <Card id="members" className="scroll-mt-6 min-w-0 space-y-3 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border-muted)] pb-3">
                <h2 className="font-semibold tracking-tight"><ScrambleText text={t.manageDetails.members} /></h2>
                <Badge variant="neutral" size="sm" mono>{group.members.length}</Badge>
              </div>
              {group.members.length === 0 ? <EmptyState text={t.manageDetails.membersEmpty} /> : (
                <ul className="divide-y divide-[var(--border-muted)]">
                  {group.members.map((member) => (
                    <li key={member.userId} className="flex min-w-0 items-center gap-3 py-3 first:pt-1 last:pb-1">
                      <Avatar name={member.name} size="sm" />
                      <span className="min-w-0 flex-1 break-words text-sm font-medium">{member.name}</span>
                      <Badge size="sm" variant={member.role === "LEADER" ? "primary" : "neutral"}>
                        <ScrambleText text={member.role === "LEADER" ? t.myGroupCard.leader : t.myGroupCard.member} />
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Pending applications */}
          <section id="applications" className="scroll-mt-6 space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-muted)] pb-3">
              <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
                <ScrambleText text={t.manage.applicationsTitle} />
              </h2>
              <Badge variant={pendingApplications.length ? "primary" : "neutral"} size="sm" mono>
                {pendingApplications.length}
              </Badge>
            </div>

            {data?.applicationsErrorCode ? (
              <ErrorState title={t.manage.applicationsError} message={t.apiErrors[data.applicationsErrorCode]} retryLabel={t.manage.retry} onRetry={reload} />
            ) : pendingApplications.length === 0 ? (
              <EmptyState text={t.manage.pendingEmpty} />
            ) : (
              <div className="space-y-4">
                {pendingApplications.map((application) => (
                  <ApplicationCard
                    key={application.id}
                    application={application}
                    pendingAction={pendingActions[application.id] ?? null}
                    errorCode={actionErrors[application.id] ?? null}
                    acceptDisabled={group.status !== "RECRUITING" || group.memberCount >= group.maxMembers}
                    onAccept={(id) => handleAction(id, "accept")}
                    onReject={(id) => handleAction(id, "reject")}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Danger Zone: Giải tán / Xóa nhóm học tập */}
          <section className="pt-4 border-t border-[var(--border)]">
            <Card className="border border-[var(--error-border)] bg-[var(--surface)] p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[var(--error)]">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <h3 className="text-sm font-bold tracking-tight">
                      <ScrambleText text={t.manageDetails.dangerZoneTitle} />
                    </h3>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] max-w-xl leading-relaxed">
                    <ScrambleText text={t.manageDetails.dangerZoneDesc} />
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeleteModalOpen(true)}
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  className="border-[var(--error-border)] text-[var(--error)] hover:bg-[var(--error-bg)] hover:border-[var(--error)] font-medium shrink-0"
                >
                  <ScrambleText text={t.manageDetails.deleteGroupBtn} />
                </Button>
              </div>
            </Card>

            {isDeleteModalOpen && <DeleteGroupModal
              isOpen={isDeleteModalOpen}
              onClose={() => setIsDeleteModalOpen(false)}
              groupId={group.id}
              groupTitle={group.title}
              onDeleteConfirm={handleDeleteConfirm}
            />}
          </section>
        </>
      )}
    </div>
  );
}
