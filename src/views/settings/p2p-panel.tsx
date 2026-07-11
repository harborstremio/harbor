import { LocalEngineSection, P2PAdvancedSection, RemoteServerSection, ServerAddressSection } from "./player-panel";

export function P2PPanel() {
  return (
    <>
      <LocalEngineSection />
      <P2PAdvancedSection />
      <ServerAddressSection />
      <RemoteServerSection />
    </>
  );
}
