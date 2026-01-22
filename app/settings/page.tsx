"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, CheckCircle, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

interface EmailConfig {
  imapServer: string;
  imapPort: number;
  imapUserEmail: string;
  imapUserPass: string;
  imapTls: boolean;
  smtpServer: string;
  smtpPort: number;
  smtpUserEmail: string;
  smtpUserPass: string;
  smtpTls: boolean;
}

export default function SettingsPage() {
  const t = useTranslations();
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/settings/email");
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setConfigured(data.configured);
      }
    } catch (error) {
      console.error("Error fetching config:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <p>{t("settings.loading")}</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">{t("settings.title")}</h1>

      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <h2 className="text-xl font-semibold">{t("settings.email.title")}</h2>
          </div>
          <div className="flex items-center gap-2">
            {configured ? (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                {t("settings.email.configured")}
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                {t("settings.email.notConfigured")}
              </Badge>
            )}
          </div>
        </div>

        <div className="mb-4 p-3 rounded bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 flex items-center gap-2">
          <Lock className="h-4 w-4" />
          <span>{t("settings.email.credentialsNote")}</span>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-4">{t("settings.email.imap.title")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t("settings.email.imap.server")}</Label>
                <Input
                  value={config?.imapServer || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>{t("settings.email.imap.port")}</Label>
                <Input
                  value={config?.imapPort || 993}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>{t("settings.email.imap.email")}</Label>
                <Input
                  value={config?.imapUserEmail || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>{t("settings.email.imap.password")}</Label>
                <Input
                  type="password"
                  value={config?.imapUserPass || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label>{t("settings.email.imap.tls")}:</Label>
                <Badge variant={config?.imapTls ? "default" : "secondary"}>
                  {config?.imapTls ? t("settings.email.enabled") : t("settings.email.disabled")}
                </Badge>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-4">{t("settings.email.smtp.title")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t("settings.email.smtp.server")}</Label>
                <Input
                  value={config?.smtpServer || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>{t("settings.email.smtp.port")}</Label>
                <Input
                  value={config?.smtpPort || 587}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>{t("settings.email.smtp.email")}</Label>
                <Input
                  value={config?.smtpUserEmail || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>{t("settings.email.smtp.password")}</Label>
                <Input
                  type="password"
                  value={config?.smtpUserPass || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label>{t("settings.email.smtp.tls")}:</Label>
                <Badge variant={config?.smtpTls ? "default" : "secondary"}>
                  {config?.smtpTls ? t("settings.email.enabled") : t("settings.email.disabled")}
                </Badge>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-2">{t("settings.email.envVariables")}</h3>
            <div className="bg-muted p-3 rounded font-mono text-xs space-y-1">
              <div>IMAP_SERVER=mail.example.com</div>
              <div>IMAP_PORT=993</div>
              <div>IMAP_USER_EMAIL=claims@example.com</div>
              <div>IMAP_USER_PASS=your_password</div>
              <div>IMAP_TLS=true</div>
              <div className="mt-2">SMTP_SERVER=mail.example.com</div>
              <div>SMTP_PORT=587</div>
              <div>SMTP_USER_EMAIL=claims@example.com</div>
              <div>SMTP_USER_PASS=your_password</div>
              <div>SMTP_TLS=true</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

