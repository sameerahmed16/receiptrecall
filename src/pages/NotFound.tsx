import { Link } from "react-router-dom";
import { RetroWindow } from "@/components/ui/RetroWindow";
import { Button } from "@/components/ui/Button";

export function NotFound() {
  return (
    <div className="mx-auto max-w-lg">
      <RetroWindow title="404.dlg" titleBarColor="bg-tomato">
        <div className="grid place-items-center gap-4 py-10 text-center">
          <p className="font-display text-6xl font-extrabold text-hotpink bubble-shadow">
            404
          </p>
          <p className="font-display text-xl font-bold">This page wandered off</p>
          <p className="max-w-sm font-body text-sm text-ink/70">
            That receipt isn't in the shoebox. Let's get you back to your spending.
          </p>
          <Link to="/">
            <Button variant="primary">Back to dashboard</Button>
          </Link>
        </div>
      </RetroWindow>
    </div>
  );
}
