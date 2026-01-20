"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe, Check } from "lucide-react";
import { locales, localeNames, localeFlags, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  currentLocale: Locale;
  collapsed?: boolean;
}

export function LanguageSwitcher({ currentLocale, collapsed = false }: LanguageSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleLocaleChange = (newLocale: Locale) => {
    // Set cookie and refresh
    document.cookie = `locale=${newLocale};path=/;max-age=${60 * 60 * 24 * 365}`; // 1 year
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size={collapsed ? "icon" : "sm"}
          className={cn(
            "transition-all duration-200",
            collapsed ? "h-9 w-9" : "gap-2 px-3"
          )}
          disabled={isPending}
        >
          {collapsed ? (
            <span className="text-base">{localeFlags[currentLocale]}</span>
          ) : (
            <>
              <span className="text-base">{localeFlags[currentLocale]}</span>
              <span className="truncate">{localeNames[currentLocale]}</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={collapsed ? "center" : "end"} side={collapsed ? "right" : "top"}>
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => handleLocaleChange(locale)}
            className="gap-2 cursor-pointer"
          >
            <span className="text-base">{localeFlags[locale]}</span>
            <span>{localeNames[locale]}</span>
            {currentLocale === locale && <Check className="h-4 w-4 ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Hook to get current locale on client side
export function useLocale(): Locale {
  if (typeof window === 'undefined') return 'sr';
  
  const cookie = document.cookie
    .split('; ')
    .find(row => row.startsWith('locale='));
  
  const locale = cookie?.split('=')[1] as Locale | undefined;
  return locales.includes(locale as Locale) ? (locale as Locale) : 'sr';
}
