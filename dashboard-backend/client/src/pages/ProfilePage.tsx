import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/lib/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, User, KeyRound, RefreshCw, Eye, EyeOff, Copy, Check } from "lucide-react";

function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*+-?";
  const all = upper + lower + digits + special;
  const guaranteed = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  const rest = Array.from({ length: 12 }, () => all[Math.floor(Math.random() * all.length)]);
  return [...guaranteed, ...rest].sort(() => Math.random() - 0.5).join("");
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { language } = useLanguage();
  const t = useTranslation(language);
  const { toast } = useToast();

  const [infoLoading, setInfoLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const [phone, setPhone] = useState(user?.phone ?? "");
  const [mobile, setMobile] = useState(user?.mobile ?? "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    setInfoLoading(true);
    try {
      const res = await apiRequest("PATCH", "/api/auth/profile", { phone, mobile });
      const data = await res.json();
      if (res.ok) {
        await refreshUser();
        toast({ title: t.profileSaved });
      } else {
        toast({ title: data.error ?? "Fout", variant: "destructive" });
      }
    } finally {
      setInfoLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: t.passwordMismatch, variant: "destructive" });
      return;
    }
    setPwLoading(true);
    try {
      const res = await apiRequest("PATCH", "/api/auth/profile", {
        currentPassword,
        newPassword,
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        toast({ title: t.passwordChanged });
      } else {
        toast({ title: data.error ?? "Fout", variant: "destructive" });
      }
    } finally {
      setPwLoading(false);
    }
  }

  function handleGeneratePassword() {
    const pw = generatePassword();
    setNewPassword(pw);
    setConfirmPassword(pw);
    setShowNew(true);
    setShowConfirm(true);
    navigator.clipboard.writeText(pw).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!user) return null;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.myProfile}</h1>
        <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" />
            {t.personalInfo}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveInfo} className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t.username ?? "Gebruikersnaam"}</Label>
              <Input value={user.username} disabled data-testid="input-profile-username" />
            </div>
            <div className="space-y-1.5">
              <Label>E-mailadres</Label>
              <Input value={user.email} disabled data-testid="input-profile-email" />
            </div>
            <Separator />
            <div className="space-y-1.5">
              <Label>Telefoonnummer</Label>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+31 20 123 4567"
                data-testid="input-profile-phone"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mobielnummer</Label>
              <Input
                value={mobile}
                onChange={e => setMobile(e.target.value)}
                placeholder="+31 6 1234 5678"
                data-testid="input-profile-mobile"
              />
            </div>
            <Button type="submit" disabled={infoLoading} data-testid="button-save-profile">
              {infoLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t.saveChanges}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            {t.changePassword}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t.currentPassword}</Label>
              <div className="relative">
                <Input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  className="pr-10"
                  data-testid="input-current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{t.newPassword}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGeneratePassword}
                  data-testid="button-generate-password"
                  className="h-7 gap-1.5 text-xs"
                >
                  {copied ? <Check className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                  {copied ? "Gekopieerd" : "Genereer"}
                </Button>
              </div>
              <div className="relative">
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  className="pr-10"
                  data-testid="input-new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        newPassword.length < 8 ? "w-1/4 bg-destructive" :
                        newPassword.length < 12 ? "w-2/4 bg-amber-500" :
                        "w-full bg-green-500"
                      }`}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {newPassword.length < 8 ? "Zwak" : newPassword.length < 12 ? "Matig" : "Sterk"}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t.confirmPassword}</Label>
              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className="pr-10"
                  data-testid="input-confirm-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Wachtwoorden komen niet overeen</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={pwLoading || (!!confirmPassword && newPassword !== confirmPassword)}
              data-testid="button-change-password"
            >
              {pwLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t.changePassword}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
