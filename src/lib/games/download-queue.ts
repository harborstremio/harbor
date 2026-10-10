import type {DownloadItem} from "./download-presentation";

export const canOrderDownload=(item:DownloadItem)=>["queued","paused","failed"].includes(item.record.status);
export const downloadQueueKey=(item:DownloadItem)=>`${item.kind}:${item.record.id}`;
export function compareDownloadQueue(a:DownloadItem,b:DownloadItem){
  const order=(item:DownloadItem)=>Number.isSafeInteger(item.record.queueOrder)&&item.record.queueOrder!>0?item.record.queueOrder!:Number.MAX_SAFE_INTEGER;
  return order(a)-order(b)||a.record.createdAt-b.record.createdAt||downloadQueueKey(a).localeCompare(downloadQueueKey(b));
}
