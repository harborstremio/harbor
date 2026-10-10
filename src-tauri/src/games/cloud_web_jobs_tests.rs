use super::*;
use super::super::tests::fixture;
use serde_json::json;
fn record(ready:bool)->Value {json!({"id":42,"name":"Garden","hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","download_present":ready,"download_finished":ready,"progress":0.75,"files":[{"id":0,"name":"project/Garden.zip","size":50},{"id":1,"name":"Notes.txt","size":10}]})}
#[tokio::test]
async fn web_job_creation_is_multipart_and_listing_and_resolution_keep_exact_identity(){
 let(api,calls,worker)=fixture("tb",vec![(200,json!({"success":true,"data":{"webdownload_id":42}})),(200,json!({"success":true,"data":[record(false)]})),(200,json!({"success":true,"data":record(true)})),(200,json!({"success":true,"data":"https://cdn.test/archive"}))]);
 assert_eq!(api.web_create("https://host.test/file?part=2#fixture-key").await.unwrap(),"42");
 let list=api.web_list(1).await.unwrap();assert_eq!(list.jobs[0].status,"preparing");assert_eq!(list.jobs[0].progress,Some(0.75));
 let file=api.web_download("42","0").await.unwrap();assert_eq!(file.name,"Garden.zip");assert_eq!(file.expected_bytes,Some(50));
 worker.join().unwrap();let calls=calls.lock().unwrap();assert!(calls[0].starts_with("POST /webdl/createwebdownload "));assert!(calls[0].contains("name=\"link\""));assert!(calls[0].contains("https://host.test/file?part=2#fixture-key"));assert!(calls[0].to_lowercase().contains("multipart/form-data"));assert!(calls[1].contains("offset=100"));assert!(calls[3].contains("/webdl/requestdl?token=fixture-secret&web_id=42&file_id=0"));assert!(!calls[3].contains("torrent_id"));
}
#[test]
fn web_jobs_distinguish_expired_failed_and_preparing_and_reject_invalid_ids(){
 let mut v=record(false);assert_eq!(job(&v).unwrap().status,"preparing");v["download_finished"]=json!(true);assert_eq!(job(&v).unwrap().status,"missing");v["error"]=json!("private provider payload");assert_eq!(job(&v).unwrap().status,"failed");let parsed=serde_json::to_string(&job(&v).unwrap()).unwrap();assert!(!parsed.contains("private provider payload"));v["id"]=json!("../../private");assert_eq!(job(&v).unwrap_err(),"cloud_metadata");
}
#[tokio::test]
async fn web_resolution_requires_current_exact_job_and_ready_file(){
 for value in [record(false),{let mut v=record(true);v["download_present"]=json!(false);v}] {
  let(api,_,worker)=fixture("tb",vec![(200,json!({"success":true,"data":value}))]);assert_eq!(api.web_download("42","0").await.unwrap_err(),"cloud_not_ready");worker.join().unwrap();
 }
 let(api,_,worker)=fixture("tb",vec![(200,json!({"success":true,"data":record(true)}))]);assert_eq!(api.web_status("43").await.unwrap_err(),"cloud_metadata");worker.join().unwrap();
}

#[tokio::test]
async fn recovery_matches_exact_url_hash_and_preserves_unfiltered_page_cursor(){
 let mut records=vec![record(false);100];
 records[99]["id"]=json!(77);records[99]["hash"]=json!(format!("{:x}",md5::compute("https://host.test/archive?part=2")));
 let(api,requests,worker)=fixture("tb",vec![(200,json!({"success":true,"data":records}))]);
 let page=api.web_find("https://host.test/archive?part=2",2).await.unwrap();assert_eq!(page.jobs.len(),1);assert_eq!(page.jobs[0].id,"77");assert_eq!(page.next,Some(3));worker.join().unwrap();assert!(requests.lock().unwrap()[0].contains("offset=200"));
}
