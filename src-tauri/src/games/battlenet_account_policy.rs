use super::battlenet_account::{self as account, Result};
pub fn account_origin(url: &url::Url) -> bool {
    url.scheme() == "https"
        && url.host_str() == Some("account.battle.net")
        && url.port().is_none()
        && url.username().is_empty()
        && url.password().is_none()
}
pub fn navigation(url: &url::Url, fresh: bool) -> bool {
    if url.as_str() == "about:blank" {
        return true;
    }
    if url.scheme() != "https"
        || url.port().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return false;
    }
    if account_origin(url) {
        return fresh || matches!(url.path(), "/" | "/overview" | "/api/");
    }
    fresh
        && matches!(
            url.host_str(),
            Some(
                "oauth.battle.net"
                    | "battle.net"
                    | "us.battle.net"
                    | "eu.battle.net"
                    | "kr.battle.net"
                    | "tw.battle.net"
            )
        )
}
pub fn result(url: &url::Url, request: &str) -> Result<account::Report> {
    if url.scheme() != "harbor-battlenet"
        || url.as_str().len() > 1024 * 1024
        || url.host_str() != Some("result")
        || url.path() != format!("/{request}")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || url.fragment().is_some()
    {
        return Err("battlenet_account_data");
    }
    let values: Vec<_> = url.query_pairs().collect();
    if values.len() != 1 || values[0].0 != "data" {
        return Err("battlenet_account_data");
    }
    if values[0].1 == "{\"error\":\"refresh\"}" {
        return Err("battlenet_account_refresh");
    }
    account::parse(&values[0].1)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn navigation_is_exact_and_refresh_cannot_switch_accounts() {
        for url in [
            "https://account.battle.net/overview",
            "https://account.battle.net/api/",
        ] {
            assert!(navigation(&url.parse().unwrap(), false));
        }
        for url in [
            "http://account.battle.net/",
            "https://account.battle.net.evil/",
            "https://evil@account.battle.net/",
            "https://account.battle.net:444/",
            "file:///C:/",
            "https://account.battle.net/login",
        ] {
            assert!(!navigation(&url.parse().unwrap(), false), "{url}");
        }
        assert!(navigation(
            &"https://oauth.battle.net/authorize".parse().unwrap(),
            true
        ));
        assert!(!navigation(
            &"https://oauth.battle.net/authorize".parse().unwrap(),
            false
        ));
    }
    #[test]
    fn result_is_request_bound_and_has_only_projected_data() {
        let id = uuid::Uuid::new_v4().to_string();
        let mut url = url::Url::parse(&format!("harbor-battlenet://result/{id}")).unwrap();
        url.query_pairs_mut().append_pair(
            "data",
            &format!(
                r#"{{"authenticated":true,"identity":"{}","modern":[],"classic":[]}}"#,
                "a".repeat(64)
            ),
        );
        assert!(result(&url, &id).is_ok());
        assert!(result(&url, &uuid::Uuid::new_v4().to_string()).is_err());
        url.query_pairs_mut().append_pair("data", "{}");
        assert!(result(&url, &id).is_err());
    }
}
