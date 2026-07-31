import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TwoFactorSetupModalProps {
  open: boolean;
  onClose: () => void;
}

export function TwoFactorSetupModal({ open, onClose }: TwoFactorSetupModalProps) {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<"intro" | "setup" | "disable">("intro");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStartSetup = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Fout bij opzetten 2FA");
        return;
      }
      setQrCodeDataUrl(data.qrCodeDataUrl);
      setSecret(data.secret);
      setStep("setup");
    } catch {
      setError("Verbindingsfout");
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verificatie mislukt");
        setToken("");
        return;
      }
      await refreshUser();
      toast({ title: "2FA ingeschakeld", description: "Twee-factor authenticatie is nu actief op uw account." });
      handleClose();
    } catch {
      setError("Verbindingsfout");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verificatie mislukt");
        setToken("");
        return;
      }
      await refreshUser();
      toast({ title: "2FA uitgeschakeld", description: "Twee-factor authenticatie is verwijderd van uw account." });
      handleClose();
    } catch {
      setError("Verbindingsfout");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep("intro");
    setQrCodeDataUrl("");
    setSecret("");
    setToken("");
    setError("");
    setCopied(false);
    onClose();
  };

  const copySecret = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isEnabled = user?.twoFactorEnabled;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <DialogTitle>Twee-factor authenticatie</DialogTitle>
          </div>
          <DialogDescription>
            {isEnabled
              ? "2FA is actief op uw account. U kunt het hier uitschakelen."
              : "Beveilig uw account met een authenticator-app zoals Google Authenticator of Authy."}
          </DialogDescription>
        </DialogHeader>

        {step === "intro" && (
          <div className="space-y-4">
            {isEnabled ? (
              <div className="flex items-center gap-3 p-3 rounded-md bg-green-500/10 border border-green-500/20">
                <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium">2FA is ingeschakeld</p>
                  <p className="text-xs text-muted-foreground">Uw account is beveiligd met twee-factor authenticatie</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted border">
                <ShieldOff className="w-5 h-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">2FA is uitgeschakeld</p>
                  <p className="text-xs text-muted-foreground">Schakel 2FA in voor extra beveiliging</p>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>Sluiten</Button>
              {isEnabled ? (
                <Button
                  variant="destructive"
                  onClick={() => { setStep("disable"); setError(""); setToken(""); }}
                  data-testid="button-disable-2fa"
                >
                  <ShieldOff className="w-4 h-4 mr-2" />
                  2FA uitschakelen
                </Button>
              ) : (
                <Button
                  onClick={handleStartSetup}
                  disabled={loading}
                  data-testid="button-enable-2fa"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <>
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      2FA inschakelen
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {step === "setup" && (
          <form onSubmit={handleEnable} className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Stap 1: Scan de QR-code</p>
              <p className="text-xs text-muted-foreground">
                Open uw authenticator-app en scan de onderstaande QR-code.
              </p>
              {qrCodeDataUrl && (
                <div className="flex justify-center p-4 bg-white rounded-md border">
                  <img src={qrCodeDataUrl} alt="2FA QR Code" className="w-40 h-40" />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">Of voer handmatig in:</p>
              <div className="flex gap-2">
                <code className="flex-1 px-3 py-2 text-xs font-mono bg-muted rounded-md break-all">
                  {secret}
                </code>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={copySecret}
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="verify-token" className="text-sm">Stap 2: Voer de code in</Label>
              <Input
                id="verify-token"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
                required
                className="text-center text-lg tracking-widest font-mono"
                data-testid="input-verify-token"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => { setStep("intro"); setError(""); }}>
                Terug
              </Button>
              <Button type="submit" disabled={loading || token.length !== 6} data-testid="button-confirm-2fa">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "2FA activeren"}
              </Button>
            </div>
          </form>
        )}

        {step === "disable" && (
          <form onSubmit={handleDisable} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Voer een geldige code uit uw authenticator-app in om 2FA uit te schakelen.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="disable-token" className="text-sm">Verificatiecode</Label>
              <Input
                id="disable-token"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
                className="text-center text-lg tracking-widest font-mono"
                data-testid="input-disable-token"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => { setStep("intro"); setError(""); }}>
                Terug
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={loading || token.length !== 6}
                data-testid="button-confirm-disable-2fa"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "2FA uitschakelen"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
