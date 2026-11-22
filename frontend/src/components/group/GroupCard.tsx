"use client";

import { ScrambleText } from "@/design-system/components/ScrambleText";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/design-system";
import type { GroupCardProps } from "@/lib/types";
import { useLanguageStore } from "@/stores/languageStore";
import { useAuthStore } from "@/stores/authStore";

const GroupCard = ({ group, isMember, isPendingApplication, membershipReady, onJoin }: GroupCardProps) => {
  const { t } = useLanguageStore();
  const userId = useAuthStore((state) => state.userId);

  const {
    id,
    course,
    title,
    description,
    college,
    department,
    postYear,
    leaderName,
    leaderAvatarUrl,
    leaderMajor,
    memberCount,
    maxMembers,
    leaderId,
    status,
    rolesQuota,
    postAnonymous,
  } = group;
  const visibleLeaderName = postAnonymous ? t.groupDetail.anonymousLeader : leaderName;
  const visibleLeaderAvatar = postAnonymous ? undefined : leaderAvatarUrl;
  const visibleLeaderMajor = postAnonymous ? "" : leaderMajor;

  const spotsLeft = Math.max(maxMembers - memberCount, 0);
  const isFull = spotsLeft === 0 || Boolean(rolesQuota?.length && rolesQuota.every((role) => role.current >= role.max));
  const canRecruit = status === "RECRUITING" && !isFull;
  const isOwnGroup = userId !== null && userId === leaderId;

  const recruitingText =
    spotsLeft === 1
      ? t.groupsPage.cardRecruitingSingle
      : t.groupsPage.cardRecruiting.replace("{spots}", String(spotsLeft));

  const yearText = t.groupsPage.cardYear.replace("{year}", String(postYear));
  const membersText = t.groupsPage.cardMembers.replace("{max}", String(maxMembers));

  return (
    <Card className="h-full flex flex-col gap-4 p-6 hover:shadow-(--shadow-level-2) hover:border-(--border-strong)">
      <CardHeader className="mb-0 flex-wrap items-center">
        {course && <Badge variant="primary" className="font-medium">{course}</Badge>}
        <Badge variant={canRecruit ? "recruiting" : "closed"} dot>
          <ScrambleText text={status !== "RECRUITING" ? t.groupStatus[status] : isFull ? t.groupsPage.cardFull : recruitingText} />
        </Badge>
      </CardHeader>

      <div className="space-y-1.5">
        <CardTitle className="text-base font-semibold leading-snug">
          {title}
        </CardTitle>
        <CardDescription className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
          {description}
        </CardDescription>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 flex-1 content-start">
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary-soft-border)]">
          {college}
        </span>
        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-[var(--surface-container-low)] text-[var(--text-secondary)] border border-[var(--border)]">
          {department}
        </span>
        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-container-low)] border border-[var(--border)]">
          <ScrambleText text={yearText} />
        </span>
      </div>

      <CardFooter className="pt-3 border-t border-[var(--border-muted)]">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Avatar
            src={visibleLeaderAvatar}
            name={visibleLeaderName}
            size="md"
            className="ring-1 ring-[var(--border)] shrink-0"
          />
          <div className="min-w-0 flex flex-col">
            <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
              {visibleLeaderName}
            </span>
            <span className="text-[11px] text-[var(--text-muted)] truncate">
              {visibleLeaderMajor}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right pl-2">
          <span className="text-xs font-semibold text-[var(--text-primary)] font-mono">
            {memberCount}
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">
            <ScrambleText text={membersText} />
          </span>
        </div>
      </CardFooter>

      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <Button
          href={`/groups/${id}`}
          variant="outline"
          className="h-10 text-xs font-semibold"
        >
          <ScrambleText text={t.groupsPage.viewDetails} />
        </Button>
        <Button
          className="h-10 text-xs font-semibold"
          disabled={!canRecruit || isOwnGroup || isMember || isPendingApplication || !membershipReady}
          onClick={() => onJoin?.(id)}
        >
          <ScrambleText text={isMember ? t.groupsPage.joined : isPendingApplication ? t.groupDetail.applicationSubmitted : t.groupsPage.join} />
        </Button>
      </div>
    </Card>
  );
};

export const GroupCardSkeleton = () => (
  <div
    aria-hidden="true"
    className="h-full min-h-[350px] flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 animate-pulse"
  >
    <div className="flex items-center justify-between gap-3">
      <div className="h-6 w-24 rounded-full bg-[var(--surface-container)]" />
      <div className="h-6 w-20 rounded-full bg-[var(--surface-container)]" />
    </div>
    <div className="space-y-2">
      <div className="h-5 w-4/5 rounded bg-[var(--surface-container)]" />
      <div className="h-3 w-full rounded bg-[var(--surface-container)]" />
      <div className="h-3 w-2/3 rounded bg-[var(--surface-container)]" />
    </div>
    <div className="flex flex-1 content-start flex-wrap gap-1.5">
      <div className="h-6 w-20 rounded-md bg-[var(--surface-container)]" />
      <div className="h-6 w-24 rounded-md bg-[var(--surface-container)]" />
      <div className="h-6 w-16 rounded-md bg-[var(--surface-container)]" />
    </div>
    <div className="flex items-center justify-between border-t border-[var(--border-muted)] pt-3">
      <div className="flex items-center gap-2.5">
        <div className="h-10 w-10 rounded-full bg-[var(--surface-container)]" />
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-[var(--surface-container)]" />
          <div className="h-2.5 w-16 rounded bg-[var(--surface-container)]" />
        </div>
      </div>
      <div className="h-4 w-16 rounded bg-[var(--surface-container)]" />
    </div>
    <div className="grid grid-cols-2 gap-2.5 pt-1">
      <div className="h-10 rounded-lg bg-[var(--surface-container)]" />
      <div className="h-10 rounded-lg bg-[var(--surface-container)]" />
    </div>
  </div>
);

export default GroupCard;
