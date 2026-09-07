import { ChevronRight, GitPullRequest } from "../icons";
import { GitHubIcon } from "@/components/github-icon";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { Section } from "../shared";
import { SRow } from "../ui";

const REPO = "https://github.com/harborstremio/harbor";

function Chevron() {
  return <ChevronRight size={18} className="text-ink-subtle rtl:-scale-x-100" />;
}

export function ContributorCard() {
  const t = useT();
  return (
    <Section
      title={t("Want to fix it yourself?")}
      subtitle={t(
        "{app} is open source. Browse existing fixes or contribute a patch for the problem you found.",
        { app: "Harbor" },
      )}
    >
      <SRow
        leading={<GitHubIcon size={18} />}
        title={t("Open repo on {service}", { service: "GitHub" })}
        description={t("Read the source, file an issue, or fork it and send a patch.")}
        trailing={<Chevron />}
        onClick={() => openUrl(REPO)}
      />
      <SRow
        leading={<GitPullRequest size={18} strokeWidth={1.9} />}
        title={t("Browse pull requests")}
        description={t("See which fixes are already in review before you start on one.")}
        trailing={<Chevron />}
        onClick={() => openUrl(`${REPO}/pulls`)}
      />
    </Section>
  );
}
