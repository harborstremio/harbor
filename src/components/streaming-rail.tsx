import { Row } from "@/components/row";
import { ServiceLogo } from "@/components/service-logo";
import { useT } from "@/lib/i18n";
import type { StreamingService } from "@/lib/settings";
import { useView } from "@/lib/view";

export function StreamingRail({ services }: { services: StreamingService[] }) {
  const { openService } = useView();
  const t = useT();
  if (services.length === 0) return null;

  return (
    <Row title={t("Your Streaming")} min={172} shape="service" alwaysActive>
      {services.map((svc) => (
        <ServiceTile key={svc} service={svc} onOpen={() => openService(svc)} />
      ))}
    </Row>
  );
}

function ServiceTile({ service, onOpen }: { service: StreamingService; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="harbor-service-tile group flex h-20 w-full items-center justify-center rounded-xl bg-elevated/40 transition-colors duration-200 hover:bg-elevated"
    >
      <ServiceLogo service={service} height={26} />
    </button>
  );
}
