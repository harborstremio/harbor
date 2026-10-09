import { useEffect, useState } from "react";
import { currentAuthor, subscribeAuthor } from "@/lib/theme-auth";
import { AuthForm } from "./author-account-panel/auth-form";
import { RecoveryReveal } from "./author-account-panel/recovery-reveal";
import { SignedInBar } from "./author-account-panel/signed-in-bar";

export function AuthorAccountPanel() {
  const [author, setAuthor] = useState(currentAuthor);
  const [recovery, setRecovery] = useState<string | null>(null);

  useEffect(() => subscribeAuthor(() => setAuthor(currentAuthor())), []);

  return (
    <>
      {author ? <SignedInBar author={author} /> : <AuthForm onRecovery={setRecovery} />}
      {recovery && <RecoveryReveal code={recovery} onDone={() => setRecovery(null)} />}
    </>
  );
}
