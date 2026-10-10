import { Check, Download, Pause, CircleAlert } from "lucide-react";
import { useT } from "@/lib/i18n";
import { downloadProgress } from "@/lib/games/download-presentation";
import type { sourceTransfer } from "@/lib/games/source-transfer-state";

export function SourceTransferStatus({transfer}:{transfer:NonNullable<ReturnType<typeof sourceTransfer>>}) {
  const t=useT(),percent=transfer.status==="complete"?100:downloadProgress(transfer.received,transfer.total);
  const Icon=transfer.status==="complete"?Check:transfer.status==="paused"?Pause:transfer.status==="failed"?CircleAlert:Download;
  return <span className={`games-source-transfer is-${transfer.status}`} role="status"><span><Icon size={15} aria-hidden/><span key={transfer.status} className="games-source-transfer-label">{t(transfer.key)}</span>{percent!==undefined&&<small aria-hidden>{Math.round(percent)}%</small>}</span>{percent!==undefined&&<i aria-hidden="true"><b style={{width:`${percent}%`}}/></i>}</span>;
}
