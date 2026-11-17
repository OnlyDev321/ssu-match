"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { toApiErrorCode } from "@/lib/api";
import { useAuthHydrated, useAuthStore } from "@/stores/authStore";
import type { ApiErrorCode, AsyncStatus, ServiceDataState } from "@/lib/types";
import { fetchCachedQuery, getEmptyQuerySnapshot, getQuerySnapshot, subscribeQuery, updateCachedQuery } from "@/lib/queryCache";

/**
 * Yêu cầu đăng nhập trước khi vào trang (cùng cách làm với trang /groups):
 * chưa đăng nhập → mở modal đăng nhập kèm đường dẫn quay lại và chuyển về trang chủ.
 * Trả về true khi đã khôi phục phiên và người dùng đã đăng nhập.
 */
export const useRequireLogin = (redirectTo: string): boolean => {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const { isLoggedIn, isLoading, openLoginModal } = useAuthStore();

  useEffect(() => {
    if (hydrated && !isLoading && !isLoggedIn) {
      openLoginModal(redirectTo);
      router.push("/");
    }
  }, [hydrated, isLoggedIn, isLoading, openLoginModal, redirectTo, router]);

  return hydrated && isLoggedIn;
};

/**
 * Gọi một hàm trong services/ và quản lý trạng thái loading / error / ready.
 * `load` nên được bọc bằng useCallback để không gọi lại mỗi lần render.
 */
export const useServiceData = <T,>(
  load: () => Promise<T>,
  enabled: boolean,
): ServiceDataState<T> => {
  const [status, setStatus] = useState<AsyncStatus>("loading");
  const [data, setDataState] = useState<T | null>(null);
  const [errorCode, setErrorCode] = useState<ApiErrorCode | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) setStatus("loading"); });

    load()
      .then((result) => {
        if (cancelled) return;
        setDataState(result);
        setErrorCode(null);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setErrorCode(toApiErrorCode(error));
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [load, enabled, reloadKey]);

  const reload = useCallback(() => {
    setStatus("loading");
    setReloadKey((key) => key + 1);
  }, []);

  return { status, data, errorCode, reload, setData: setDataState };
};

/**
 * Cache service responses in tab memory and revalidate them after their TTL.
 * Cached data is shown immediately while a stale entry refreshes in the background.
 */
export const useCachedServiceData = <T,>(
  key: string,
  load: () => Promise<T>,
  enabled: boolean,
  staleTimeMs = 30_000,
): ServiceDataState<T> => {
  const snapshot = useSyncExternalStore(
    useCallback((listener) => subscribeQuery(key, listener), [key]),
    useCallback(() => getQuerySnapshot<T>(key), [key]),
    getEmptyQuerySnapshot<T>,
  );

  useEffect(() => {
    if (!enabled) return;
    void fetchCachedQuery(key, load, staleTimeMs).catch(() => undefined);
  }, [enabled, key, load, snapshot.updatedAt, staleTimeMs]);

  const reload = useCallback(() => {
    return fetchCachedQuery(key, load, staleTimeMs, true).then(() => undefined);
  }, [key, load, staleTimeMs]);

  const status: AsyncStatus = snapshot.data !== null
    ? "ready"
    : snapshot.error !== null
      ? "error"
      : "loading";

  return {
    status,
    data: snapshot.data,
    errorCode: snapshot.error === null ? null : toApiErrorCode(snapshot.error),
    reload,
    setData: (updater) => updateCachedQuery(key, updater),
  };
};

/** Trì hoãn cập nhật giá trị cho ô tìm kiếm. */
export const useDebounce = <T,>(value: T, delay: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};
