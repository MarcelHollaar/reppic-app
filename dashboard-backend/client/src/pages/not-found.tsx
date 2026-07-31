import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
        <h2 className="text-2xl font-semibold">Pagina niet gevonden</h2>
        <p className="text-muted-foreground">
          De pagina die u zoekt bestaat niet of is verplaatst.
        </p>
      </div>
      <Button asChild>
        <Link href="/">
          <Home className="w-4 h-4 mr-2" />
          Terug naar Dashboard
        </Link>
      </Button>
    </div>
  );
}
