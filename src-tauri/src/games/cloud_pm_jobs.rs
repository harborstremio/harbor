//! Explicit Premiumize cloud transfers. Recovery requires user selection: list metadata has no source identity.
use super::*;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PmJob {
    #[serde(flatten)]
    pub job: WebJob,
    pub created_at: Option<u64>,
}
#[derive(Serialize)]
pub struct PmPage { pub jobs: Vec<PmJob>, pub next: Option<u32> }
struct Transfer { value: PmJob, folder: Option<String>, file: Option<String> }

fn optional_id(value: &Value) -> Result<Option<String>> {
    if value.is_null() { Ok(None) } else { record_id(value).map(Some) }
}
fn transfer(value: &Value) -> Result<Transfer> {
    let status = match value["status"].as_str() {
        Some("queued" | "running") => "preparing",
        Some("finished" | "seeding") => "ready",
        Some("error") => "failed",
        _ => return Err("cloud_metadata"),
    };
    Ok(Transfer {
        value: PmJob {
            job: WebJob { id: record_id(&value["id"])?, name: text(value,"name",500), hash: String::new(),
                status: status.into(), progress: value["progress"].as_f64().filter(|v|v.is_finite() && *v >= 0. && *v <= 1.), bytes: None, files: vec![] },
            created_at: value["created_at"].as_u64().filter(|v| *v <= 8_640_000_000_000),
        },
        folder: optional_id(&value["folder_id"])?, file: optional_id(&value["file_id"])?,
    })
}
impl Api {
    async fn pm_create(&self, link: &str) -> Result<String> {
        let link = super::links::source_link(link)?;
        let result = self.request("/transfer/create", &[], Some(&[("src",link)])).await?;
        if result["type"].as_str() == Some("container") { return Err("cloud_container"); }
        record_id(&result["id"])
    }
    async fn pm_transfers(&self) -> Result<Vec<Transfer>> {
        let result = self.request("/transfer/list", &[], None).await?;
        array(&result["transfers"])?.iter().map(transfer).collect()
    }
    async fn pm_transfer(&self, id: &str) -> Result<Transfer> {
        if !identifier(id) { return Err("cloud_request"); }
        self.pm_transfers().await?.into_iter().find(|v|v.value.job.id == id).ok_or("cloud_missing")
    }
    async fn pm_list(&self, page: u32) -> Result<PmPage> {
        if page > 100 { return Err("cloud_request"); }
        let records = self.pm_transfers().await?;
        let start = page as usize * 100;
        Ok(PmPage { next: (records.len() > start + 100 && page < 100).then_some(page + 1), jobs: records.into_iter().skip(start).take(100).map(|v|v.value).collect() })
    }
    async fn pm_status(&self, id: &str) -> Result<PmJob> {
        let mut record = self.pm_transfer(id).await?;
        if record.value.job.status == "ready" {
            if let Some(file) = record.file {
                let details = self.request("/item/details", &[("id",file.clone())], None).await?;
                if record_id(&details["id"])? != file { return Err("cloud_metadata"); }
                let bytes = size(&details["size"]);
                record.value.job.bytes = bytes;
                record.value.job.files.push(CloudEntry { id: file, name: clean_name(&text(&details,"name",1000))?, kind: "file".into(), bytes, ready: true, status: "ready".into() });
            } else if let Some(folder) = record.folder {
                // Retain the exact folder identity. The existing cloud browser handles its full hierarchy.
                record.value.job.files.push(CloudEntry { id: folder, name: record.value.job.name.clone(), kind: "folder".into(), bytes: None, ready: true, status: "ready".into() });
            }
        }
        Ok(record.value)
    }
    async fn pm_download(&self, id: &str, file: &str) -> Result<CloudDownload> {
        let record = self.pm_transfer(id).await?;
        if record.value.job.status != "ready" { return Err("cloud_not_ready"); }
        if record.file.as_deref() != Some(file) { return Err("cloud_missing"); }
        self.resolve("",file).await
    }
    async fn pm_retry(&self, id: &str) -> Result<()> {
        let record = self.pm_transfer(id).await?;
        if record.value.job.status != "failed" { return Err("cloud_request"); }
        self.request("/transfer/retry", &[], Some(&[("id",id.into())])).await?;
        Ok(())
    }
}
fn api(request: &Request) -> Result<Api> { if request.provider != "pm" { return Err("cloud_provider"); } Api::new(request) }
pub async fn create(request: LinkRequest) -> Result<String> {
    let api = api(&Request { provider: request.provider, key: request.key, parent: String::new(), page: 0, file: String::new() })?;
    api.pm_create(&request.url).await
}
pub async fn list(request: Request) -> Result<PmPage> { api(&request)?.pm_list(request.page).await }
pub async fn status(request: Request) -> Result<PmJob> { api(&request)?.pm_status(&request.parent).await }
pub async fn download(request: Request) -> Result<CloudDownload> { api(&request)?.pm_download(&request.parent,&request.file).await }
pub async fn retry(request: Request) -> Result<()> { api(&request)?.pm_retry(&request.parent).await }

#[cfg(test)]
#[path = "cloud_pm_jobs_tests.rs"]
mod tests;
