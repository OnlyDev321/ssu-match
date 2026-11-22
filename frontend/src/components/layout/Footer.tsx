"use client";

import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { ScrambleText } from "@/design-system/components/ScrambleText";
import { useLanguageStore } from "@/stores/languageStore";

export default function Footer() {
  const pathname = usePathname();
  const { t } = useLanguageStore();

  // Footer chỉ xuất hiện ở Landing Page ("/")
  if (pathname !== "/") {
    return null;
  }

  return (
    <footer className="w-full border-t border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] py-8 app-footer">
      <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-center gap-4">
        <div className="flex items-center gap-3">
          <BrandLogo size={24} />
          <span className="text-xs text-[var(--text-muted)]">
            <ScrambleText text={t.footer.copyright.replace("{year}", String(new Date().getFullYear()))} />
          </span>
        </div>
      </div>
    </footer>
  );
}
