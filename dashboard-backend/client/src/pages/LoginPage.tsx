import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Shield, Loader2, KeyRound, ArrowLeft, CheckCircle } from "lucide-react";
import reppicLogo from "@assets/Reppic (7)_1759432699720.png";

type Step = "credentials" | "2fa" | "forgotEmail" | "forgotCode" | "resetDone";

export default function LoginPage() {
  const { login, verify2FA } = useAuth();

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(email, password, rememberMe);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.requiresTwoFactor) {
      setStep("2fa");
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await verify2FA(twoFactorCode);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      setTwoFactorCode("");
    }
  };

  const handleForgotEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Er is iets misgegaan");
      } else {
        setStep("forgotCode");
      }
    } catch {
      setError("Verbindingsfout. Probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmNewPassword) {
      setError("Wachtwoorden komen niet overeen");
      return;
    }
    if (newPassword.length < 6) {
      setError("Wachtwoord moet minimaal 6 tekens bevatten");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: resetCode, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Er is iets misgegaan");
      } else {
        setStep("resetDone");
      }
    } catch {
      setError("Verbindingsfout. Probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  const goBackToLogin = () => {
    setStep("credentials");
    setError("");
    setForgotEmail("");
    setResetCode("");
    setNewPassword("");
    setConfirmNewPassword("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <img src={reppicLogo} alt="Reppic" className="h-32 w-auto object-contain" />
        </div>

        {/* Step: Login */}
        {step === "credentials" && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Inloggen</CardTitle>
              <CardDescription className="text-xs">
                Voer uw e-mailadres en wachtwoord in
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm">E-mailadres</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="naam@bedrijf.nl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm">Wachtwoord</Label>
                    <button
                      type="button"
                      onClick={() => { setForgotEmail(email); setStep("forgotEmail"); setError(""); }}
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                      data-testid="link-forgot-password"
                    >
                      Wachtwoord vergeten?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="pr-10"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(v) => setRememberMe(!!v)}
                    data-testid="checkbox-remember-me"
                  />
                  <label
                    htmlFor="remember-me"
                    className="text-sm text-muted-foreground cursor-pointer select-none"
                  >
                    Aangemeld blijven
                  </label>
                </div>

                {error && (
                  <p className="text-sm text-destructive" data-testid="text-login-error">{error}</p>
                )}

                <Button type="submit" className="w-full" disabled={loading} data-testid="button-login">
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Inloggen...</> : "Inloggen"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step: 2FA */}
        {step === "2fa" && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <CardTitle className="text-base">Twee-factor verificatie</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Voer de 6-cijferige code in van uw authenticator-app
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handle2FASubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="twofa-code" className="text-sm">Verificatiecode</Label>
                  <Input
                    id="twofa-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="000000"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                    required
                    autoFocus
                    className="text-center text-lg tracking-widest font-mono"
                    data-testid="input-2fa-code"
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive" data-testid="text-2fa-error">{error}</p>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setStep("credentials"); setError(""); setTwoFactorCode(""); }}
                    className="flex-1"
                    data-testid="button-back-login"
                  >
                    Terug
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={loading || twoFactorCode.length !== 6}
                    data-testid="button-verify-2fa"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verifiëren"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step: Forgot password — enter email */}
        {step === "forgotEmail" && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" />
                <CardTitle className="text-base">Wachtwoord vergeten</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Voer uw e-mailadres in. Als er een account bestaat, ontvangt u een 6-cijferige code.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotEmailSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email" className="text-sm">E-mailadres</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="naam@bedrijf.nl"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    autoFocus
                    data-testid="input-forgot-email"
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive" data-testid="text-forgot-error">{error}</p>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goBackToLogin}
                    className="flex-1"
                    data-testid="button-back-to-login"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Terug
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={loading}
                    data-testid="button-send-reset-code"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verstuur code"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step: Enter reset code + new password */}
        {step === "forgotCode" && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" />
                <CardTitle className="text-base">Nieuw wachtwoord instellen</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Voer de code in die naar <strong>{forgotEmail}</strong> is verstuurd, samen met uw nieuwe wachtwoord.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-code" className="text-sm">Herstelcode</Label>
                  <Input
                    id="reset-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="000000"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
                    required
                    autoFocus
                    className="text-center text-lg tracking-widest font-mono"
                    data-testid="input-reset-code"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-sm">Nieuw wachtwoord</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="pr-10"
                      data-testid="input-new-password-reset"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-new-password" className="text-sm">Bevestig nieuw wachtwoord</Label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    data-testid="input-confirm-new-password-reset"
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive" data-testid="text-reset-error">{error}</p>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setStep("forgotEmail"); setError(""); }}
                    className="flex-1"
                    data-testid="button-back-to-forgot-email"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Terug
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={loading || resetCode.length !== 6 || !newPassword}
                    data-testid="button-reset-password"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Opslaan"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step: Reset done */}
        {step === "resetDone" && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <CheckCircle className="w-12 h-12 text-green-500" />
                <div>
                  <p className="font-medium">Wachtwoord succesvol gewijzigd</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    U kunt nu inloggen met uw nieuwe wachtwoord.
                  </p>
                </div>
                <Button onClick={goBackToLogin} className="w-full" data-testid="button-go-to-login">
                  Naar inloggen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "credentials" && (
          <p className="text-center text-xs text-muted-foreground">
            Neem contact op met uw beheerder als u geen toegang kunt krijgen
          </p>
        )}
      </div>
    </div>
  );
}
