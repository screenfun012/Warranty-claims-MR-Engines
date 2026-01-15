"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, CheckCircle, XCircle } from "lucide-react";

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
        <p>Učitavanje...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Podešavanja</h1>

      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Email Konfiguracija</h2>
          </div>
          <div className="flex items-center gap-2">
            {configured ? (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Konfigurisano
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                Nije konfigurisano
              </Badge>
            )}
          </div>
        </div>

        <div className="mb-4 p-3 rounded bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 flex items-center gap-2">
          <Lock className="h-4 w-4" />
          <span>Email kredencijali su definisani u .env fajlu i ne mogu se menjati kroz interfejs.</span>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-4">IMAP (Primanje emaila)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>IMAP Server</Label>
                <Input
                  value={config?.imapServer || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>IMAP Port</Label>
                <Input
                  value={config?.imapPort || 993}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>Email adresa</Label>
                <Input
                  value={config?.imapUserEmail || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>Šifra</Label>
                <Input
                  type="password"
                  value={config?.imapUserPass || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label>TLS/SSL:</Label>
                <Badge variant={config?.imapTls ? "default" : "secondary"}>
                  {config?.imapTls ? "Uključeno" : "Isključeno"}
                </Badge>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-4">SMTP (Slanje emaila)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>SMTP Server</Label>
                <Input
                  value={config?.smtpServer || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>SMTP Port</Label>
                <Input
                  value={config?.smtpPort || 587}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>Email adresa</Label>
                <Input
                  value={config?.smtpUserEmail || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>Šifra</Label>
                <Input
                  type="password"
                  value={config?.smtpUserPass || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label>TLS/SSL:</Label>
                <Badge variant={config?.smtpTls ? "default" : "secondary"}>
                  {config?.smtpTls ? "Uključeno" : "Isključeno"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-2">Environment varijable za .env fajl:</h3>
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

