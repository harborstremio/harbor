use super::*;
use super::super::tests::fixture;
use serde_json::json;
fn task(id:&str,state:&str,file:Value,folder:Value)->Value { json!({"id":id,"name":"Project 日本.zip","status":state,"progress":0.42,"file_id":file,"folder_id":folder,"created_at":1700000000}) }
fn list(value:Value)->Value { json!({"status":"success","transfers":[value]}) }

#[tokio::test]
async fn submission_is_explicit_form_post_and_job_pagination_preserves_exact_provider_order() {
    let jobs=(0..105).map(|n|task(&format!("job-{n}"),"queued",Value::Null,Value::Null)).collect::<Vec<_>>();
    let (api,calls,worker)=fixture("pm",vec![(200,json!({"status":"success","id":"job-ab_7"})),(200,json!({"status":"success","transfers":jobs})),(200,json!({"status":"success","transfers":jobs}))]);
    assert_eq!(api.pm_create("https://host.example/project?part=2#fixture-key").await.unwrap(),"job-ab_7");
    let first=api.pm_list(0).await.unwrap();assert_eq!(first.jobs.len(),100);assert_eq!(first.next,Some(1));assert_eq!(first.jobs[0].job.id,"job-0");
    let second=api.pm_list(1).await.unwrap();assert_eq!(second.jobs.len(),5);assert_eq!(second.next,None);assert_eq!(second.jobs[0].job.id,"job-100");
    worker.join().unwrap();let calls=calls.lock().unwrap();assert!(calls[0].starts_with("POST /transfer/create "));assert!(calls[0].contains("src=https%3A%2F%2Fhost.example%2Fproject%3Fpart%3D2%23fixture-key"));assert!(calls[1].starts_with("GET /transfer/list "));assert!(!calls[1].contains("src="));
}
#[tokio::test]
async fn ready_single_file_uses_current_identity_and_original_link_not_legacy_stream_metadata() {
    let ready=list(task("job-A","seeding",json!("file-X"),json!("folder-P")));
    let details=json!({"status":"success","id":"file-X","name":"Project 日本.zip","size":42,"link":"https://cdn.example/original.zip","stream_link":"https://cdn.example/wrong.mp4"});
    let (api,calls,worker)=fixture("pm",vec![(200,ready.clone()),(200,details.clone()),(200,ready),(200,details)]);
    let job=api.pm_status("job-A").await.unwrap();assert_eq!(job.job.status,"ready");assert_eq!(job.job.files[0].id,"file-X");assert_eq!(job.created_at,Some(1700000000));
    let file=api.pm_download("job-A","file-X").await.unwrap();assert_eq!(file.url,"https://cdn.example/original.zip");assert_eq!(file.expected_bytes,Some(42));
    worker.join().unwrap();let calls=calls.lock().unwrap();assert!(calls[2].starts_with("GET /transfer/list "));assert!(calls[3].starts_with("GET /item/details?id=file-X "));
}
#[tokio::test]
async fn multi_file_jobs_preserve_folder_hierarchy_and_external_clouds_do_not_invent_local_files() {
    let (api,_,worker)=fixture("pm",vec![(200,list(task("folder-job","finished",Value::Null,json!("folder-X")))),(200,list(task("external","finished",Value::Null,Value::Null)))]);
    let result=api.pm_status("folder-job").await.unwrap();assert_eq!(result.job.files[0].kind,"folder");assert_eq!(result.job.files[0].id,"folder-X");
    assert!(api.pm_status("external").await.unwrap().job.files.is_empty());worker.join().unwrap();
}
#[tokio::test]
async fn retry_reuses_failed_job_and_rejects_unready_or_unrelated_downloads() {
    let (api,calls,worker)=fixture("pm",vec![(200,list(task("job-X","error",Value::Null,Value::Null))),(200,json!({"status":"success"})),(200,list(task("job-X","running",Value::Null,Value::Null))),(200,list(task("job-X","finished",json!("actual"),Value::Null)))]);
    api.pm_retry("job-X").await.unwrap();assert_eq!(api.pm_download("job-X","anything").await.unwrap_err(),"cloud_not_ready");assert_eq!(api.pm_download("job-X","other").await.unwrap_err(),"cloud_missing");
    worker.join().unwrap();let calls=calls.lock().unwrap();assert!(calls[1].starts_with("POST /transfer/retry "));assert!(calls[1].ends_with("id=job-X"));assert!(calls.iter().all(|v|!v.contains("/transfer/create")));
}
#[tokio::test]
async fn missing_or_malformed_records_and_container_responses_never_become_ready_jobs() {
    let (api,_,worker)=fixture("pm",vec![(200,json!({"status":"success","transfers":[]})),(200,json!({"status":"success","type":"container","content":["https://files.example/part"]}))]);
    assert_eq!(api.pm_status("missing").await.unwrap_err(),"cloud_missing");assert_eq!(api.pm_create("https://files.example/set.dlc").await.unwrap_err(),"cloud_container");worker.join().unwrap();
    assert!(transfer(&task("../bad","queued",Value::Null,Value::Null)).is_err());assert!(transfer(&task("valid","unexpected",Value::Null,Value::Null)).is_err());
}

#[tokio::test]
async fn documented_business_errors_keep_account_missing_and_rate_states_without_private_messages() {
    let replies=["authentication_failed","not_found","rate_limit_reached","service_down"].map(|code|(200,json!({"status":"error","code":code,"message":"private fixture-secret"}))).to_vec();
    let (api,_,worker)=fixture("pm",replies);
    for expected in ["cloud_key","cloud_missing","cloud_rate_limit","cloud_service"] {
        assert_eq!(api.pm_status("job-X").await.unwrap_err(),expected);
    }
    worker.join().unwrap();
}
