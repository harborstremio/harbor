//! Read-only provider host metadata. A listed host is not proof that a particular file exists.
use super::*;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostAllowance {
    pub remaining: Option<u64>,
    pub limit: Option<u64>,
    pub unit: String,
    pub period: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostCheck {
    pub domain: String,
    pub name: String,
    pub state: String,
    pub icon: Option<String>,
    pub note: Option<String>,
    pub allowances: Vec<HostAllowance>,
    pub max_file_bytes: Option<u64>,
    pub cost_factor: Option<f64>,
    pub limits_unavailable: bool,
    pub checked_at: u64,
}

fn domain(value: &str) -> Option<String> {
    if value.is_empty() || value.len() > 253 || value.contains(['/', '@', ':', '?', '#', '\\']) {
        return None;
    }
    let parsed = reqwest::Url::parse(&format!("https://{value}")).ok()?;
    let host = parsed.host_str()?.trim_end_matches('.').to_ascii_lowercase();
    (host.contains('.') && !host.contains(char::is_whitespace)).then_some(host)
}
fn matches(host: &str, candidate: &str) -> bool {
    domain(candidate).is_some_and(|d| host == d || host.ends_with(&format!(".{d}")))
}
fn count(value: &Value) -> Option<u64> {
    value.as_u64().filter(|v| *v <= 9_007_199_254_740_991)
}
fn image(value: &str) -> Option<String> {
    let checked = url(value).ok()?;
    let parsed = reqwest::Url::parse(&checked).ok()?;
    (parsed.query().is_none() && parsed.fragment().is_none()).then_some(checked)
}
fn initial(host: &str) -> HostCheck {
    HostCheck {
        domain: host.into(), name: host.into(), state: "unknown".into(), icon: None,
        note: None, allowances: vec![], max_file_bytes: None, cost_factor: None,
        limits_unavailable: false,
        checked_at: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default().as_millis() as u64,
    }
}
fn fields(result: &mut HostCheck, value: &Value, icon: &str) {
    let name = text(value, "name", 120);
    if !name.is_empty() { result.name = name; }
    result.icon = image(&text(value, icon, 2000));
}
fn entries(value: &Value) -> Result<&serde_json::Map<String, Value>> {
    let values = value.as_object().ok_or("cloud_metadata")?;
    if values.len() > 2000 { return Err("cloud_limit"); }
    Ok(values)
}

fn torbox(value: &Value, host: &str, authenticated: bool) -> Result<HostCheck> {
    let mut result = initial(host);
    let records = array(&value["data"])?;
    if records.len() > 2000 { return Err("cloud_limit"); }
    let record = records.iter().filter_map(|record| {
        // Older official SDK models also publish these misspelled domain fields.
        let best = ["domains", "domais", "domaisn"].iter().filter_map(|key| record[*key].as_array())
            .flatten().filter_map(Value::as_str).filter(|d| matches(host, d)).map(str::len).max();
        best.map(|length| (length, record))
    }).max_by_key(|(length, _)| *length).map(|(_, record)| record);
    let Some(record) = record else { return Ok(result); };
    fields(&mut result, record, "icon");
    result.state = match record["status"].as_bool() { Some(true) => "available", Some(false) => "down", None => "unknown" }.into();
    let note = text(record, "note", 400);
    result.note = (!note.is_empty()).then_some(note);
    for (limit_field, used_field, unit) in [
        ("daily_link_limit", "daily_link_used", "links"),
        ("daily_bandwidth_limit", "daily_bandwidth_used", "bytes"),
    ] {
        // Zero means unlimited in this provider contract; omitted/malformed is unknown.
        if let Some(limit) = count(&record[limit_field]).filter(|v| *v > 0) {
            let remaining = authenticated.then(|| count(&record[used_field])).flatten().map(|used| limit.saturating_sub(used));
            result.allowances.push(HostAllowance { remaining, limit: Some(limit), unit: unit.into(), period: "daily".into() });
        }
    }
    result.max_file_bytes = count(&record["per_link_size_limit"]).filter(|v| *v > 0);
    if result.state == "available" && result.allowances.iter().any(|v| v.remaining == Some(0)) {
        result.state = "limited".into();
    }
    Ok(result)
}

fn realdebrid(value: &Value, traffic: Option<&Value>, host: &str, authenticated: bool) -> Result<HostCheck> {
    let mut result = initial(host);
    let records = entries(value)?;
    let record = records.iter().filter(|(d, _)| matches(host, d)).max_by_key(|(d, _)| d.len());
    let Some((key, record)) = record else { return Ok(result); };
    fields(&mut result, record, "image");
    result.state = if !authenticated { "listed" } else {
        match (record["supported"].as_u64(), record["status"].as_str()) {
            (Some(0), _) | (_, Some("unsupported")) => "unsupported",
            (_, Some("down")) => "down",
            (Some(1), Some("up")) => "available",
            _ => "unknown",
        }
    }.into();
    // Only Real-Debrid's own status is used; competitor claims are deliberately ignored.
    if let Some(traffic) = traffic {
        entries(traffic)?;
        let allowance = &traffic[key];
        let unit = allowance["type"].as_str().unwrap_or_default();
        if ["links", "bytes"].contains(&unit) {
            let remaining = count(&allowance["left"]);
            let period = allowance["reset"].as_str().filter(|v| ["daily", "weekly", "monthly"].contains(v)).unwrap_or("current");
            result.allowances.push(HostAllowance { remaining, limit: count(&allowance["limit"]).filter(|v| *v > 0), unit: unit.into(), period: period.into() });
            if result.state == "available" && remaining == Some(0) { result.state = "limited".into(); }
        }
    }
    Ok(result)
}

fn pm_service<'a>(list: &'a [Value], aliases: &serde_json::Map<String, Value>, host: &str) -> Option<&'a str> {
    list.iter().filter_map(Value::as_str).find(|service| {
        matches(host, service) || aliases.get(*service).and_then(Value::as_array).is_some_and(|values| {
            values.iter().take(100).filter_map(Value::as_str).any(|d| matches(host, d))
        })
    })
}
fn premiumize(value: &Value, host: &str) -> Result<HostCheck> {
    let mut result = initial(host);
    let direct = array(&value["directdl"])?;
    let queue = array(&value["queue"])?;
    if direct.len() + queue.len() > 4000 { return Err("cloud_limit"); }
    let aliases = entries(&value["aliases"])?;
    // Alias lists are best-effort. Unmatched domains stay unknown, never unsupported.
    let direct_service = pm_service(direct, aliases, host);
    let service = direct_service.or_else(|| pm_service(queue, aliases, host));
    if let Some(service) = service {
        result.name = service.chars().filter(|c| !c.is_control()).take(120).collect();
        result.state = if direct_service.is_some() { "listed" } else { "queue" }.into();
        result.cost_factor = value["fairusefactor"][service].as_f64().filter(|v| v.is_finite() && *v >= 0. && *v <= 1000.);
    }
    Ok(result)
}

fn alldebrid(value: &Value, host: &str, authenticated: bool) -> Result<HostCheck> {
    let mut result = initial(host);
    let records = entries(&value["hosts"])?;
    let record = records.values().filter_map(|record| {
        let best = record["domains"].as_array()?.iter().take(100).filter_map(Value::as_str)
            .filter(|d| matches(host, d)).map(str::len).max()?;
        Some((best, record))
    }).max_by_key(|(length, _)| *length).map(|(_, record)| record);
    let Some(record) = record else { return Ok(result); };
    let name = text(record, "name", 120);
    if !name.is_empty() { result.name = name; }
    result.state = if !authenticated { "listed" } else {
        match record["status"].as_bool() { Some(true) => "available", Some(false) => "down", None => "listed" }
    }.into();
    if authenticated {
        let factor = match record["quotaType"].as_str() {
            Some("traffic") => Some((1_000_000_u64, "bytes")),
            Some("nb_download") => Some((1_u64, "links")),
            _ => None,
        };
        if let Some((factor, unit)) = factor {
            let convert = |key| count(&record[key]).and_then(|v| v.checked_mul(factor));
            let remaining = convert("quota");
            result.allowances.push(HostAllowance { remaining, limit: convert("quotaMax"), unit: unit.into(), period: "current".into() });
            if remaining == Some(0) && result.state != "down" { result.state = "limited".into(); }
        }
    }
    Ok(result)
}

impl Api {
    async fn host_check(&self, link: &str) -> Result<HostCheck> {
        let link = super::links::source_link(link)?;
        let parsed = reqwest::Url::parse(&link).map_err(|_| "cloud_request")?;
        let host = parsed.host_str().ok_or("cloud_request")?.trim_end_matches('.').to_ascii_lowercase();
        let authenticated = !self.key.is_empty();
        let mut result = match self.provider.as_str() {
            "ad" => alldebrid(&self.request(if authenticated { "/v4.1/user/hosts" } else { "/v4/hosts" }, &[], None).await?, &host, authenticated)?,
            "tb" => torbox(&self.request("/webdl/hosters", &[], None).await?, &host, authenticated)?,
            "pm" => premiumize(&self.request("/services/list", &[], None).await?, &host)?,
            "rd" => {
                let data = self.request(if authenticated { "/hosts/status" } else { "/hosts" }, &[], None).await?;
                let mut result = realdebrid(&data, None, &host, authenticated)?;
                if authenticated && result.state != "unknown" && result.state != "unsupported" {
                    match self.request("/traffic", &[], None).await {
                        Ok(traffic) => match realdebrid(&data, Some(&traffic), &host, true) {
                            Ok(value) => result = value,
                            Err(_) => result.limits_unavailable = true,
                        },
                        Err(_) => result.limits_unavailable = true,
                    }
                }
                result
            },
            _ => return Err("cloud_provider"),
        };
        if !self.key.is_empty() {
            if result.note.as_ref().is_some_and(|v| v.contains(&self.key)) { result.note = None; }
            if result.icon.as_ref().is_some_and(|v| v.contains(&self.key)) { result.icon = None; }
            if result.name.contains(&self.key) { result.name = host; }
        }
        Ok(result)
    }
}

pub async fn check(request: LinkRequest) -> Result<HostCheck> {
    let api = Api::configured(&Request { provider: request.provider, key: request.key, parent: String::new(), file: String::new(), page: 0 }, true)?;
    api.host_check(&request.url).await
}

#[cfg(test)]
#[path = "cloud_hosts_tests.rs"]
mod tests;
