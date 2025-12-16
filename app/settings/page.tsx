"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Mail } from "lucide-react";

interface EmailConfig {
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  imapTls: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpTls: boolean;
  rememberCredentials: boolean;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<EmailConfig>({
    imapHost: "",
    imapPort: 993,
    imapUser: "",
    imapPass: "",
    imapTls: true,
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    smtpTls: true,
    rememberCredentials: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/settings/email");
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setConfig({
            ...data.config,
            imapPass: data.config.imapPass ? "••••••••" : "",
            smtpPass: data.config.smtpPass ? "••••••••" : "",
          });
        }
      }
    } catch (error) {
      console.error("Error fetching config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Email konfiguracija je sačuvana!" });
        // Ako je rememberCredentials false, obriši šifre iz state-a
        if (!config.rememberCredentials) {
          setConfig((prev) => ({
            ...prev,
            imapPass: "",
            smtpPass: "",
          }));
        } else {
          // Inače, postavi placeholder
          setConfig((prev) => ({
            ...prev,
            imapPass: prev.imapPass || "••••••••",
            smtpPass: prev.smtpPass || "••••••••",
          }));
        }
      } else {
        setMessage({ type: "error", text: data.error || "Greška pri čuvanju konfiguracije" });
      }
    } catch (error) {
      console.error("Error saving config:", error);
      setMessage({ type: "error", text: "Greška pri čuvanju konfiguracije" });
    } finally {
      setSaving(false);
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
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Email Konfiguracija</h2>
        </div>

        {message && (
          <div
            className={`mb-4 p-3 rounded ${
              message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-4">IMAP (Primanje emaila)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>IMAP Host</Label>
                <Input
                  value={config.imapHost}
                  onChange={(e) => setConfig({ ...config, imapHost: e.target.value })}
                  placeholder="mail.mrgroup.rs"
                />
              </div>
              <div>
                <Label>IMAP Port</Label>
                <Input
                  type="number"
                  value={config.imapPort}
                  onChange={(e) => setConfig({ ...config, imapPort: parseInt(e.target.value) || 993 })}
                />
              </div>
              <div>
                <Label>Email adresa (IMAP User)</Label>
                <Input
                  value={config.imapUser}
                  onChange={(e) => setConfig({ ...config, imapUser: e.target.value })}
                  placeholder="claims@mrgrup.rs"
                />
              </div>
              <div>
                <Label>Šifra (IMAP Pass)</Label>
                <Input
                  type="password"
                  value={config.imapPass === "••••••••" ? "" : config.imapPass}
                  onChange={(e) => setConfig({ ...config, imapPass: e.target.value })}
                  placeholder={config.imapPass === "••••••••" ? "Unesite novu šifru ili ostavite prazno" : "Unesite šifru"}
                />
                {config.imapPass === "••••••••" && (
                  <p className="text-sm text-muted-foreground mt-1">Šifra je sačuvana. Unesite novu šifru da je promenite.</p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="imap-tls"
                  checked={config.imapTls}
                  onCheckedChange={(checked) => setConfig({ ...config, imapTls: checked })}
                />
                <Label htmlFor="imap-tls">Koristi TLS/SSL</Label>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-4">SMTP (Slanje emaila)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>SMTP Host</Label>
                <Input
                  value={config.smtpHost}
                  onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })}
                  placeholder="mail.mrgroup.rs"
                />
              </div>
              <div>
                <Label>SMTP Port</Label>
                <Input
                  type="number"
                  value={config.smtpPort}
                  onChange={(e) => setConfig({ ...config, smtpPort: parseInt(e.target.value) || 587 })}
                />
              </div>
              <div>
                <Label>Email adresa (SMTP User)</Label>
                <Input
                  value={config.smtpUser}
                  onChange={(e) => setConfig({ ...config, smtpUser: e.target.value })}
                  placeholder="claims@mrgrup.rs"
                />
              </div>
              <div>
                <Label>Šifra (SMTP Pass)</Label>
                <Input
                  type="password"
                  value={config.smtpPass === "••••••••" ? "" : config.smtpPass}
                  onChange={(e) => setConfig({ ...config, smtpPass: e.target.value })}
                  placeholder={config.smtpPass === "••••••••" ? "Unesite novu šifru ili ostavite prazno" : "Unesite šifru"}
                />
                {config.smtpPass === "••••••••" && (
                  <p className="text-sm text-muted-foreground mt-1">Šifra je sačuvana. Unesite novu šifru da je promenite.</p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="smtp-tls"
                  checked={config.smtpTls}
                  onCheckedChange={(checked) => setConfig({ ...config, smtpTls: checked })}
                />
                <Label htmlFor="smtp-tls">Koristi TLS/SSL</Label>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="remember"
                checked={config.rememberCredentials}
                onCheckedChange={(checked) => setConfig({ ...config, rememberCredentials: checked })}
              />
              <Label htmlFor="remember">Zapamti email i šifru</Label>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Ako je isključeno, šifre se neće čuvati u bazi podataka i moraćete ih unositi svaki put.
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Čuvanje..." : "Sačuvaj konfiguraciju"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

