import type { ComponentProps } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useContextMenu, useContextTarget, type MembershipContext } from "@/lib/context-menu";

export function MetaContextButton({
  meta,
  membership,
  ...props
}: ComponentProps<"button"> & { meta: Meta; membership?: MembershipContext }) {
  const { open } = useContextMenu();
  const contextRef = useContextTarget<HTMLButtonElement>(() => ({
    kind: "meta",
    meta,
    membership,
  }));
  return (
    <button
      {...props}
      ref={contextRef}
      onContextMenu={(event) => open(event, { kind: "meta", meta, membership })}
    />
  );
}
