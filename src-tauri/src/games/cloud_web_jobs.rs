//! TorBox web-download jobs are distinct from instant host unrestriction and torrents.
use super::*;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all="camelCase")]
pub struct WebJob {
    pub id: String,
    pub name: String,
    pub hash: String,
    pub status: String,
    pub progress: Option<f64>,
    pub bytes: Option<u64>,
    pub files: Vec<CloudEntry>,
}
#[derive(Serialize)]
pub struct WebPage { pub jobs: Vec<WebJob>, pub next: Option<u32> }
fn numeric(value: &str) -> Result<()> { if value.is_empty() || value.parse::<u64>().is_err() { Err("cloud_request") } else { Ok(()) } }
fn job(value: &Value) -> Result<WebJob> {
    let id=record_id(&value["id"])?; numeric(&id)?;
    let failed=value["error"].as_str().is_some_and(|v|!v.is_empty()) || text(value,"download_state",100).contains("error");
    // Finished-but-expired downloads are not available files.
    let ready=value["download_present"].as_bool()==Some(true) && !failed;
    let status=if failed {"failed"} else if ready {"ready"} else if value["download_finished"].as_bool()==Some(true) {"missing"} else {"preparing"};
    let entries=if value["files"].is_null() {vec![]} else {
        array(&value["files"] )?.iter().map(|f| {
            let id=record_id(&f["id"])?; numeric(&id)?;
            Ok(CloudEntry{id,name:clean_name(&text(f,"name",1000))?,kind:"file".into(),bytes:size(&f["size"]),ready,status:if status=="missing" {"failed"} else {status}.into()})
        }).collect::<Result<Vec<_>>>()?
    };
    let hash=value["hash"].as_str().unwrap_or_default().to_ascii_lowercase();
    if hash.len()!=32 || !hash.bytes().all(|b|b.is_ascii_hexdigit()) {return Err("cloud_metadata");}
    Ok(WebJob{id,name:text(value,"name",500),hash,status:status.into(),progress:value["progress"].as_f64().filter(|v|v.is_finite()&&*v>=0.&&*v<=1.),bytes:size(&value["size"]),files:entries})
}
impl Api {
    async fn web_create(&self, link: &str) -> Result<String> {
        let link=super::links::source_link(link)?;
        let request=self.client.post(format!("{}/webdl/createwebdownload",self.base)).multipart(reqwest::multipart::Form::new().text("link",link));
        let data=self.send(request).await?;
        let id=record_id(&data["data"]["webdownload_id"])?; numeric(&id)?; Ok(id)
    }
    async fn web_list(&self,page:u32)->Result<WebPage>{
        if page>100{return Err("cloud_request");}
        let data=self.request("/webdl/mylist", &[("limit","100".into()),("offset",(page*100).to_string())],None).await?;
        let list=array(&data["data"])?;
        let jobs=list.iter().map(job).collect::<Result<Vec<_>>>()?;
        Ok(WebPage{jobs,next:(list.len()==100 && page<100).then_some(page+1)})
    }
    async fn web_find(&self,link:&str,page:u32)->Result<WebPage>{
        let link=super::links::source_link(link)?;
        let hash=format!("{:x}",md5::compute(link.as_bytes()));
        let mut result=self.web_list(page).await?;
        result.jobs.retain(|job|job.hash==hash);
        Ok(result)
    }
    async fn web_status(&self,id:&str)->Result<WebJob>{
        numeric(id)?;
        let data=self.request("/webdl/mylist", &[("id",id.into())],None).await?;
        let value=job(&data["data"])?;
        if value.id!=id{return Err("cloud_metadata");} Ok(value)
    }
    async fn web_download(&self,id:&str,file:&str)->Result<CloudDownload>{
        numeric(file)?;
        let job=self.web_status(id).await?;
        if job.status!="ready" {return Err("cloud_not_ready");}
        let item=job.files.iter().find(|item|item.id==file).ok_or("cloud_missing")?;
        let result=self.request("/webdl/requestdl", &[("token",self.key.clone()),("web_id",id.into()),("file_id",file.into()),("zip_link","false".into()),("redirect","false".into())],None).await?;
        Ok(CloudDownload{url:url(result["data"].as_str().ok_or("cloud_link")?)?,name:item.name.clone(),expected_bytes:item.bytes})
    }
}
fn api(request:&Request)->Result<Api>{if request.provider!="tb" {return Err("cloud_provider");} Api::new(request)}
pub async fn create(request:LinkRequest)->Result<String>{
    let api=api(&Request{provider:request.provider,key:request.key,parent:String::new(),file:String::new(),page:0})?;
    api.web_create(&request.url).await
}
pub async fn list(request:Request)->Result<WebPage>{api(&request)?.web_list(request.page).await}
pub async fn status(request:Request)->Result<WebJob>{api(&request)?.web_status(&request.parent).await}
pub async fn download(request:Request)->Result<CloudDownload>{api(&request)?.web_download(&request.parent,&request.file).await}
pub async fn find(request:LinkRequest,page:u32)->Result<WebPage>{
    let api=api(&Request{provider:request.provider,key:request.key,parent:String::new(),file:String::new(),page})?;
    api.web_find(&request.url,page).await
}

#[cfg(test)]
#[path="cloud_web_jobs_tests.rs"]
mod tests;
