use super::*;
use super::super::tests::fixture;
use serde_json::json;

fn tb() -> Value { json!({"success":true,"data":[{"name":"Example host","domains":["host.test","alias.test"],"icon":"https://torbox.app/host.png","note":"Maintenance later today","status":true,"daily_link_limit":5,"daily_link_used":5,"daily_bandwidth_limit":1000,"daily_bandwidth_used":100,"per_link_size_limit":800}]}) }
fn rd() -> Value { json!({"host.test":{"name":"Example host","image":"https://fcdn.real-debrid.com/host.png","supported":1,"status":"up","competitors_status":{"torbox.app":{"status":"down"}}}}) }
fn pm() -> Value { json!({"status":"success","directdl":["host.test"],"queue":["host.test","queue.test"],"aliases":{"host.test":["alias.test"]},"fairusefactor":{"host.test":2}}) }

#[tokio::test]
async fn alldebrid_host_checks_use_account_domains_and_preserve_unknown_and_quota_states() {
    let data=json!({"hosts":{"host":{"name":"Example","domains":["host.test","alias.test"],"status":true,"quota":0,"quotaMax":500,"quotaType":"traffic"}}});
    let (api,calls,worker)=fixture("ad",vec![(200,json!({"status":"success","data":data}))]);
    let value=api.host_check("https://alias.test/private?token=source-secret").await.unwrap();
    assert_eq!(value.state,"limited"); assert_eq!(value.allowances[0].remaining,Some(0)); assert_eq!(value.allowances[0].limit,Some(500_000_000));
    worker.join().unwrap();let calls=calls.lock().unwrap();assert!(calls[0].starts_with("GET /v4.1/user/hosts "));assert!(!calls[0].contains("source-secret"));assert!(!calls[0].contains("private"));
    assert_eq!(alldebrid(&data,"host.test.evil.test",true).unwrap().state,"unknown");
    let public=alldebrid(&data,"host.test",false).unwrap();assert_eq!(public.state,"listed");assert!(public.allowances.is_empty());
    let mut missing=data.clone();missing["hosts"]["host"].as_object_mut().unwrap().remove("status");missing["hosts"]["host"].as_object_mut().unwrap().remove("quota");
    assert_eq!(alldebrid(&missing,"host.test",true).unwrap().state,"listed");
    missing["hosts"]["host"]["status"]=json!(false);assert_eq!(alldebrid(&missing,"host.test",true).unwrap().state,"down");
}

#[test]
fn domain_matching_is_exact_or_a_real_subdomain_and_missing_is_not_unsupported() {
    for host in ["host.test", "cdn.host.test", "alias.test"] { assert_eq!(torbox(&tb(),host,false).unwrap().name,"Example host"); }
    for host in ["host.test.attacker.test", "nothost.test", "unknown.test"] { assert_eq!(torbox(&tb(),host,true).unwrap().state,"unknown"); }
    for invalid in ["host.test/path", "host.test@attacker.test", "https://host.test", "host.test:443", "host.test?x", "host.test\\@attacker.test"] { assert!(domain(invalid).is_none()); }
    assert_eq!(domain("HOST.TEST."),Some("host.test".into()));
}

#[tokio::test]
async fn torbox_public_limits_never_invent_account_usage_and_authenticated_exhaustion_is_distinct() {
    let (mut api,calls,worker)=fixture("tb",vec![(200,tb()),(200,tb())]);
    api.key.clear();
    let public=api.host_check("https://cdn.host.test/private-file?token=source-secret").await.unwrap();
    assert_eq!(public.state,"available");assert_eq!(public.allowances[0].remaining,None);assert_eq!(public.max_file_bytes,Some(800));
    api.key="fixture-secret".into();
    let account=api.host_check("https://alias.test/private-file").await.unwrap();
    assert_eq!(account.state,"limited");assert_eq!(account.allowances[0].remaining,Some(0));assert_eq!(account.allowances[1].remaining,Some(900));
    worker.join().unwrap();let calls=calls.lock().unwrap();
    assert!(!calls[0].to_lowercase().contains("authorization:"));assert!(calls[1].to_lowercase().contains("authorization: bearer fixture-secret"));
    assert!(calls.iter().all(|c| c.starts_with("GET /webdl/hosters ")&&!c.contains("source-secret")&&!c.contains("private-file")));
}

#[tokio::test]
async fn realdebrid_uses_only_own_status_and_preserves_partial_host_status_if_traffic_fails() {
    let (api,calls,worker)=fixture("rd",vec![(200,rd()),(200,json!({"host.test":{"left":0,"limit":5,"type":"links","reset":"weekly"}})),(200,rd()),(429,json!({}))]);
    let result=api.host_check("https://host.test/file").await.unwrap();
    assert_eq!(result.state,"limited");assert_eq!(result.allowances[0].period,"weekly");
    let partial=api.host_check("https://host.test/file").await.unwrap();assert_eq!(partial.state,"available");assert!(partial.limits_unavailable);
    worker.join().unwrap();let calls=calls.lock().unwrap();assert!(calls[0].starts_with("GET /hosts/status "));assert!(calls[1].starts_with("GET /traffic "));
    let mut down=rd();down["host.test"]["status"]=json!("down");assert_eq!(realdebrid(&down,None,"host.test",true).unwrap().state,"down");
    down["host.test"]["supported"]=json!(0);assert_eq!(realdebrid(&down,None,"host.test",true).unwrap().state,"unsupported");
    assert_eq!(realdebrid(&down,None,"host.test",false).unwrap().state,"listed");
}

#[tokio::test]
async fn premiumize_distinguishes_direct_aliases_cloud_only_and_unknown_without_fetching_source() {
    let (api,calls,worker)=fixture("pm",vec![(200,pm())]);
    let result=api.host_check("https://cdn.alias.test/private-page").await.unwrap();assert_eq!(result.state,"listed");assert_eq!(result.cost_factor,Some(2.));
    worker.join().unwrap();assert!(calls.lock().unwrap()[0].starts_with("GET /services/list "));
    assert_eq!(premiumize(&pm(),"queue.test").unwrap().state,"queue");assert_eq!(premiumize(&pm(),"alias.test.evil.test").unwrap().state,"unknown");
}

#[test]
fn malformed_metadata_is_not_a_false_available_state_or_an_invented_allowance() {
    let request = Request { provider: "tb".into(), key: String::new(), parent: String::new(), page: 0, file: String::new() };
    assert!(matches!(Api::new(&request), Err("cloud_key")));
    assert!(Api::configured(&request, true).is_ok());
    assert_eq!(torbox(&json!({}),"host.test",true).unwrap_err(),"cloud_metadata");
    let mut value=tb();value["data"][0]["status"]=json!("true");value["data"][0]["daily_link_used"]=json!(-1);value["data"][0]["daily_bandwidth_limit"]=json!(0);
    let result=torbox(&value,"host.test",true).unwrap();assert_eq!(result.state,"unknown");assert_eq!(result.allowances.len(),1);assert_eq!(result.allowances[0].remaining,None);
    assert!(image("javascript:alert(1)").is_none());assert!(image("https://host.test/icon?token=secret").is_none());
}

#[tokio::test]
async fn host_notes_and_images_do_not_echo_the_connection_key() {
    let mut value=tb();value["data"][0]["note"]=json!("private fixture-secret");value["data"][0]["name"]=json!("fixture-secret");
    let (api,_,worker)=fixture("tb",vec![(200,value)]);let result=api.host_check("https://host.test/file").await.unwrap();worker.join().unwrap();
    assert!(!serde_json::to_string(&result).unwrap().contains("fixture-secret"));assert_eq!(result.name,"host.test");
}

#[tokio::test]
#[ignore = "Manual public-provider metadata smoke; no credentials or download requests"]
async fn public_provider_host_metadata_live() {
    let _ = rustls::crypto::ring::default_provider().install_default();
    for (provider,source) in [("tb","https://1fichier.com/"),("pm","https://mediafire.com/"),("rd","https://1fichier.com/")] {
        let result=check(LinkRequest{provider:provider.into(),key:String::new(),url:source.into()}).await.unwrap();
        assert_ne!(result.state,"unknown","provider {provider}");assert!(result.allowances.iter().all(|v| v.remaining.is_none()));
        println!("{provider}: {} — {}",result.name,result.state);
    }
}
