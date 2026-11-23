import { NextRequest, NextResponse } from "next/server";
import { fetchTimetableTermFromSap } from "@/lib/usaint";
import type { TimetableTerm } from "@/lib/types";

export const maxDuration = 20;

const COOKIE_NAME = "usaint_timetable_session";

function backendConfig() {
  return {
    baseUrl: process.env.SPRING_BOOT_API_URL || "http://localhost:8080",
    secret: process.env.SPRING_BOOT_INTERNAL_SECRET,
  };
}

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get(COOKIE_NAME)?.value;
  const { baseUrl, secret } = backendConfig();
  if (!sessionId || !secret) {
    return NextResponse.json({ success: false, errorCode: "SESSION_EXPIRED" }, { status: 401 });
  }

  try {
    const sessionResponse = await fetch(`${baseUrl}/api/internal/usaint-sessions/${encodeURIComponent(sessionId)}`, {
      headers: { "X-Internal-Secret": secret },
      cache: "no-store",
    });
    if (!sessionResponse.ok) {
      const response = NextResponse.json({ success: false, errorCode: "SESSION_EXPIRED" }, { status: 401 });
      response.cookies.set(COOKIE_NAME, "", { path: "/api/auth/usaint", maxAge: 0 });
      return response;
    }

    const body = await request.json();
    const term: TimetableTerm = {
      yearKey: String(body.yearKey ?? ""),
      yearLabel: String(body.yearLabel ?? ""),
      semesterKey: String(body.semesterKey ?? ""),
      semesterLabel: String(body.semesterLabel ?? ""),
    };
    if (!/^\d{4}$/.test(term.yearKey) || !term.semesterKey || !term.semesterLabel) {
      return NextResponse.json({ success: false, errorCode: "INVALID_TERM" }, { status: 400 });
    }

    const { sessionCookies } = await sessionResponse.json();
    const result = await fetchTimetableTermFromSap(sessionCookies, term);
    if (!result.ok) {
      if (result.reason === "no timetable data for selected term") {
        return NextResponse.json({
          success: true,
          timetable: {
            term,
            periods: [],
            hasSaturday: false,
            courses: [],
            fetchedAt: new Date().toISOString(),
          },
        });
      }
      return NextResponse.json({ success: false, errorCode: "TIMETABLE_UNAVAILABLE" }, { status: 502 });
    }
    return NextResponse.json({ success: true, timetable: result.timetable });
  } catch (error) {
    console.warn("Không tải được thời khóa biểu theo kỳ đã chọn:", error);
    return NextResponse.json({ success: false, errorCode: "TIMETABLE_UNAVAILABLE" }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  const sessionId = request.cookies.get(COOKIE_NAME)?.value;
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, "", { path: "/api/auth/usaint", maxAge: 0 });
  const { baseUrl, secret } = backendConfig();
  if (sessionId && secret) {
    try {
      await fetch(`${baseUrl}/api/internal/usaint-sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        headers: { "X-Internal-Secret": secret },
        cache: "no-store",
      });
    } catch {
      // Bộ nhớ phiên sẽ tự hết hạn nếu backend không thể xóa tại thời điểm đăng xuất.
    }
  }
  return response;
}
