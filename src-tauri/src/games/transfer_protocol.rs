use reqwest::header::{
    HeaderMap, CONTENT_LENGTH, CONTENT_RANGE, CONTENT_TYPE, ETAG, LAST_MODIFIED,
};

pub struct ResponsePlan {
    pub offset: u64,
    pub total: Option<u64>,
    pub validator: Option<String>,
}

pub fn validate_url(value: &str) -> Result<reqwest::Url, &'static str> {
    let url = reqwest::Url::parse(value).map_err(|_| "transfer_url")?;
    if !["http", "https"].contains(&url.scheme())
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || value.len() > 8192
    {
        return Err("transfer_url");
    }
    Ok(url)
}

pub fn response_plan(
    status: u16,
    headers: &HeaderMap,
    requested: u64,
    expected: Option<u64>,
) -> Result<ResponsePlan, &'static str> {
    if status == 416 {
        return Err("transfer_range_restart");
    }
    if status != 200 && status != 206 {
        return Err(if status == 401 || status == 403 {
            "transfer_access"
        } else if status == 404 || status == 410 {
            "transfer_missing"
        } else {
            "transfer_http"
        });
    }
    let text = |key| headers.get(key).and_then(|v| v.to_str().ok());
    if text(CONTENT_TYPE).is_some_and(|v| {
        ["text/html", "application/xhtml", "application/json"]
            .iter()
            .any(|prefix| v.to_ascii_lowercase().starts_with(prefix))
    }) {
        return Err("transfer_not_file");
    }
    let length = text(CONTENT_LENGTH)
        .map(|v| v.parse::<u64>().map_err(|_| "transfer_length"))
        .transpose()?;
    let (offset, total) = if status == 206 {
        let value = text(CONTENT_RANGE)
            .and_then(|v| v.strip_prefix("bytes "))
            .ok_or("transfer_range")?;
        let (range, total) = value.split_once('/').ok_or("transfer_range")?;
        let (start, end) = range.split_once('-').ok_or("transfer_range")?;
        let start = start.parse::<u64>().map_err(|_| "transfer_range")?;
        let end = end.parse::<u64>().map_err(|_| "transfer_range")?;
        let total = total.parse::<u64>().map_err(|_| "transfer_range")?;
        if start != requested
            || end < start
            || end >= total
            || length.is_some_and(|len| end - start + 1 != len)
        {
            return Err("transfer_range");
        }
        (start, Some(total))
    } else {
        (0, length)
    };
    if expected.is_some_and(|expected| total.is_some_and(|total| total != expected)) {
        return Err("transfer_size_mismatch");
    }
    let validator = text(ETAG)
        .filter(|v| !v.starts_with("W/"))
        .or_else(|| text(LAST_MODIFIED))
        .map(str::to_owned);
    Ok(ResponsePlan {
        offset,
        total: expected.or(total),
        validator,
    })
}

pub fn normalized_hash(value: Option<String>) -> Result<Option<String>, &'static str> {
    value
        .filter(|v| !v.trim().is_empty())
        .map(|v| {
            let v = v.trim().to_ascii_lowercase();
            if v.len() == 64 && v.bytes().all(|b| b.is_ascii_hexdigit()) {
                Ok(v)
            } else {
                Err("transfer_hash")
            }
        })
        .transpose()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn headers(values: &[(&str, &str)]) -> HeaderMap {
        values
            .iter()
            .map(|(k, v)| {
                (
                    k.parse::<reqwest::header::HeaderName>().unwrap(),
                    v.parse().unwrap(),
                )
            })
            .collect()
    }
    #[test]
    fn resume_validates_every_range_boundary() {
        let h = headers(&[
            ("content-range", "bytes 10-19/20"),
            ("content-length", "10"),
            ("etag", "\"v1\""),
        ]);
        let p = response_plan(206, &h, 10, None).unwrap();
        assert_eq!(p.offset, 10);
        assert_eq!(p.total, Some(20));
        assert_eq!(p.validator.as_deref(), Some("\"v1\""));
        assert_eq!(
            response_plan(206, &h, 9, None).err(),
            Some("transfer_range")
        );
        assert_eq!(
            response_plan(206, &h, 10, Some(21)).err(),
            Some("transfer_size_mismatch")
        );
        for value in [
            "bytes 10-20/20",
            "bytes 10-9/20",
            "bytes 10-19/*",
            "bytes */20",
        ] {
            assert_eq!(
                response_plan(206, &headers(&[("content-range", value)]), 10, None).err(),
                Some("transfer_range")
            );
        }
    }
    #[test]
    fn ignored_or_unsatisfied_ranges_never_promote_partial_files() {
        assert_eq!(
            response_plan(200, &headers(&[("content-length", "20")]), 10, None)
                .unwrap()
                .offset,
            0
        );
        assert_eq!(
            response_plan(416, &HeaderMap::new(), 20, None).err(),
            Some("transfer_range_restart")
        );
        assert_eq!(
            response_plan(
                200,
                &headers(&[("content-type", "text/html; charset=utf-8")]),
                0,
                None
            )
            .err(),
            Some("transfer_not_file")
        );
        assert!(response_plan(200, &HeaderMap::new(), 0, None)
            .unwrap()
            .total
            .is_none());
    }
    #[test]
    fn validates_source_and_integrity_fields() {
        for value in [
            "file:///tmp/game",
            "javascript:alert(1)",
            "https://user:pass@example.com/game",
        ] {
            assert!(validate_url(value).is_err());
        }
        assert!(validate_url("https://example.com/game.zip?token=value").is_ok());
        assert!(normalized_hash(Some("0".repeat(63))).is_err());
        assert_eq!(
            normalized_hash(Some("A".repeat(64))).unwrap(),
            Some("a".repeat(64))
        );
    }
}
