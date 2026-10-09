//! Small Valve KeyValues reader for Steam's local manifests. It never evaluates directives.

#[derive(Debug, PartialEq)]
pub enum Value {
    Text(String),
    Object(Vec<(String, Value)>),
}

impl Value {
    pub fn get(&self, key: &str) -> Option<&Value> {
        self.entries()?
            .iter()
            .rev()
            .find(|(name, _)| name.eq_ignore_ascii_case(key))
            .map(|(_, value)| value)
    }

    pub fn text(&self) -> Option<&str> {
        match self {
            Self::Text(text) => Some(text),
            _ => None,
        }
    }

    pub fn entries(&self) -> Option<&[(String, Value)]> {
        match self {
            Self::Object(entries) => Some(entries),
            _ => None,
        }
    }
}

#[derive(Debug, PartialEq)]
enum Token {
    Text(String),
    Open,
    Close,
}

pub fn parse(input: &str) -> Result<Value, &'static str> {
    if input.len() > 4 * 1024 * 1024 {
        return Err("manifest_too_large");
    }
    let mut chars = input.trim_start_matches('\u{feff}').chars().peekable();
    let mut tokens = Vec::new();
    while let Some(character) = chars.next() {
        if character.is_whitespace() {
            continue;
        }
        if character == '/' && chars.peek() == Some(&'/') {
            for character in chars.by_ref() {
                if character == '\n' {
                    break;
                }
            }
            continue;
        }
        tokens.push(match character {
            '{' => Token::Open,
            '}' => Token::Close,
            '"' => {
                let mut text = String::new();
                let mut closed = false;
                while let Some(character) = chars.next() {
                    match character {
                        '"' => {
                            closed = true;
                            break;
                        }
                        '\\' => match chars.next() {
                            Some('\\') => text.push('\\'),
                            Some('"') => text.push('"'),
                            Some('n') => text.push('\n'),
                            Some('r') => text.push('\r'),
                            Some('t') => text.push('\t'),
                            Some(other) => {
                                text.push('\\');
                                text.push(other);
                            }
                            None => return Err("unterminated_escape"),
                        },
                        other => text.push(other),
                    }
                }
                if !closed {
                    return Err("unterminated_string");
                }
                Token::Text(text)
            }
            other => {
                let mut text = String::from(other);
                while let Some(&next) = chars.peek() {
                    if next.is_whitespace() || next == '{' || next == '}' {
                        break;
                    }
                    text.push(next);
                    chars.next();
                }
                Token::Text(text)
            }
        });
        if tokens.len() > 100_000 {
            return Err("too_many_fields");
        }
    }
    let mut at = 0;
    let value = object(&tokens, &mut at, 0, false)?;
    if at != tokens.len() {
        return Err("trailing_tokens");
    }
    Ok(value)
}

fn object(
    tokens: &[Token],
    at: &mut usize,
    depth: usize,
    nested: bool,
) -> Result<Value, &'static str> {
    if depth > 32 {
        return Err("manifest_too_deep");
    }
    let mut entries = Vec::new();
    while let Some(token) = tokens.get(*at) {
        let key = match token {
            Token::Text(key) => key.clone(),
            Token::Close if nested => {
                *at += 1;
                return Ok(Value::Object(entries));
            }
            _ => return Err("expected_key"),
        };
        *at += 1;
        let value = match tokens.get(*at) {
            Some(Token::Text(text)) => {
                *at += 1;
                Value::Text(text.clone())
            }
            Some(Token::Open) => {
                *at += 1;
                object(tokens, at, depth + 1, true)?
            }
            _ => return Err("expected_value"),
        };
        entries.push((key, value));
    }
    if nested {
        Err("unclosed_object")
    } else {
        Ok(Value::Object(entries))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_current_and_legacy_library_paths() {
        let current = parse(r#""libraryfolders" { "0" { "path" "W:\\Steam" "apps" { "123" "456" } } "1" "F:\\Steam Library" }"#).unwrap();
        let folders = current.get("LibraryFolders").unwrap();
        assert_eq!(
            folders.get("0").unwrap().get("path").unwrap().text(),
            Some(r"W:\Steam")
        );
        assert_eq!(folders.get("1").unwrap().text(), Some(r"F:\Steam Library"));
    }

    #[test]
    fn preserves_unicode_comments_escaped_quotes_and_bom() {
        let value =
            parse("\u{feff}// comment\n\"AppState\" { \"name\" \"日本語 \\\"game\\\"\" }").unwrap();
        assert_eq!(
            value.get("appstate").unwrap().get("name").unwrap().text(),
            Some("日本語 \"game\"")
        );
    }

    #[test]
    fn rejects_truncation_unbalanced_objects_and_excessive_depth() {
        for input in [
            "\"name\"",
            "\"name\" \"unfinished",
            "x { a b",
            "x y }",
            "{ x y }",
        ] {
            assert!(parse(input).is_err(), "{input}");
        }
        assert!(parse(&format!("{}{}", "x { ".repeat(34), "}".repeat(34))).is_err());
    }
}
