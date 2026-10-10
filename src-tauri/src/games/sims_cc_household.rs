//! Direct references in a validated household export. A reference is not a CC
//! classification or compatibility verdict. Field semantics: LlamaLogic's
//! Sims.proto, FileSerialization.proto, Outfits.proto, PersistenceBlobs.proto,
//! SimObjectAttributes.proto and Exchange.proto (October 2026 source snapshot).
#[path = "sims_cc_wire.rs"]
pub(super) mod wire;
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};
use wire::{Message, Reader, Result, Value};

const FORMAT: &str = "sims_tray_format";
const CAS_PART: u32 = 0x034aeecb;
const SCULPT: u32 = 0x9d1ab874;
const MODIFIER: u32 = 0xc5f6763e;
const SKIN_TONE: u32 = 0x0354796a;
const TRAIT: u32 = 0xcb5fddc7;
const MAX_FILE: usize = 8 * 1024 * 1024;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize)]
pub struct Resource {
    #[serde(serialize_with = "hex32")]
    pub kind: u32,
    #[serde(serialize_with = "hex64")]
    pub instance: u64,
}
fn hex32<S: serde::Serializer>(value: &u32, s: S) -> std::result::Result<S::Ok, S::Error> {
    s.serialize_str(&format!("{value:08x}"))
}
fn hex64<S: serde::Serializer>(value: &u64, s: S) -> std::result::Result<S::Ok, S::Error> {
    s.serialize_str(&format!("{value:016x}"))
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Use {
    Outfit,
    Sculpt,
    Slider,
    SkinTone,
    Trait,
    Genetic,
    Occult,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Gap {
    FutureFields,
    OtherSimData,
    OtherHouseholdData,
    DynamicTextures,
    ModifierWithoutAmount,
    ModifierWithoutKey,
}
#[derive(Debug, Serialize)]
pub struct Reference {
    pub resource: Resource,
    pub uses: BTreeSet<Use>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Sim {
    #[serde(serialize_with = "hex64")]
    pub id: u64,
    pub name: String,
    pub references: Vec<Reference>,
    pub gaps: BTreeSet<Gap>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Household {
    #[serde(serialize_with = "hex64")]
    pub id: u64,
    pub sims: Vec<Sim>,
    pub gaps: BTreeSet<Gap>,
}
struct Content {
    references: BTreeMap<Resource, BTreeSet<Use>>,
    gaps: BTreeSet<Gap>,
}
impl Content {
    fn new() -> Self {
        Self {
            references: BTreeMap::new(),
            gaps: BTreeSet::new(),
        }
    }
    fn add(&mut self, kind: u32, instance: u64, usage: Use, context: Option<Use>) -> Result<()> {
        if instance == 0 {
            return Ok(());
        }
        if self.references.len() >= 20_000 {
            return Err("sims_limit");
        }
        let uses = self
            .references
            .entry(Resource { kind, instance })
            .or_default();
        uses.insert(usage);
        if let Some(context) = context {
            uses.insert(context);
        }
        Ok(())
    }
    fn future(&mut self, fields: &Message<'_>, known: &[u32]) {
        if fields.iter().any(|(n, _)| !known.contains(n)) {
            self.gaps.insert(Gap::FutureFields);
        }
    }
}
fn framed(data: &[u8], kind: u32, trailer: bool) -> Result<&[u8]> {
    if !(8..=MAX_FILE).contains(&data.len()) {
        return Err(FORMAT);
    }
    let u32_at = |at| -> Result<u32> {
        Ok(u32::from_le_bytes(
            data.get(at..at + 4)
                .ok_or(FORMAT)?
                .try_into()
                .map_err(|_| FORMAT)?,
        ))
    };
    if u32_at(0)? != kind {
        return Err(FORMAT);
    }
    let end = 8usize.checked_add(u32_at(4)? as usize).ok_or(FORMAT)?;
    let tail = data.get(end..).ok_or(FORMAT)?;
    if !tail.is_empty() && !(trailer && tail == [1, 0, 0, 0, 0]) {
        return Err(FORMAT);
    }
    data.get(8..end).ok_or(FORMAT)
}
fn required_message<'a>(fields: &Message<'a>, key: u32) -> Result<&'a [u8]> {
    wire::bytes(fields, key)?.ok_or(FORMAT)
}
fn required_number(fields: &Message<'_>, key: u32, fixed: bool) -> Result<u64> {
    wire::number(fields, key, fixed)?
        .filter(|n| *n != 0)
        .ok_or(FORMAT)
}

/// Both content and TrayMetadata must belong to the caller-validated filename ID.
/// Supports the observed classic household wrapper; unfamiliar wrappers fail
/// without falling back to searching arbitrary bytes for plausible IDs.
pub fn read(
    data: &[u8],
    metadata: &[u8],
    expected: u64,
    check: &dyn Fn() -> Result<()>,
) -> Result<Household> {
    check()?;
    let mut reader = Reader::new(check);
    let meta = reader.message(framed(metadata, 0, false)?)?;
    if required_number(&meta, 1, false)? != expected || required_number(&meta, 2, false)? != 1 {
        return Err("sims_tray_set");
    }
    let specific = reader.message(required_message(&meta, 10)?)?;
    let household_meta = reader.message(required_message(&specific, 2)?)?;
    let mut expected_sims = BTreeSet::new();
    for sim in wire::messages(&household_meta, 2)? {
        let sim = reader.message(sim)?;
        if expected_sims.len() >= 256 {
            return Err("sims_limit");
        }
        if !expected_sims.insert(required_number(&sim, 5, false)?) {
            return Err("sims_tray_set");
        }
    }
    if expected_sims.is_empty()
        || wire::number(&household_meta, 1, false)?.is_some_and(|n| n != expected_sims.len() as u64)
    {
        return Err("sims_tray_set");
    }
    let family = reader.message(framed(data, 1, true)?)?;
    let account = reader.message(required_message(&family, 1)?)?;
    let id = required_number(&account, 2, false)?;
    if id != expected {
        return Err("sims_tray_set");
    }
    let mut gaps = BTreeSet::new();
    if account.iter().any(|(n, _)| matches!(n, 12 | 21 | 33)) {
        gaps.insert(Gap::OtherHouseholdData);
    }
    if family.iter().any(|(n, _)| *n > 5) || account.iter().any(|(n, _)| *n > 34) {
        gaps.insert(Gap::FutureFields);
    }
    let mut sims = Vec::new();
    let mut seen = BTreeSet::new();
    for raw in wire::messages(&account, 6)? {
        if sims.len() >= 256 {
            return Err("sims_limit");
        }
        let fields = reader.message(raw)?;
        let sim_id = required_number(&fields, 1, true)?;
        if !expected_sims.contains(&sim_id) || !seen.insert(sim_id) {
            return Err("sims_tray_set");
        }
        let name = format!("{} {}", wire::text(&fields, 5)?, wire::text(&fields, 6)?)
            .trim()
            .to_owned();
        let mut content = Content::new();
        sim_content(&mut reader, &fields, &mut content)?;
        sims.push(Sim {
            id: sim_id,
            name,
            references: content
                .references
                .into_iter()
                .map(|(resource, uses)| Reference { resource, uses })
                .collect(),
            gaps: content.gaps,
        });
    }
    if seen != expected_sims {
        return Err("sims_tray_set");
    }
    check()?;
    Ok(Household { id, sims, gaps })
}
fn outfits(
    reader: &mut Reader<'_>,
    raw: &[u8],
    content: &mut Content,
    context: Option<Use>,
) -> Result<()> {
    let list = reader.message(raw)?;
    content.future(&list, &[1]);
    let items = wire::messages(&list, 1)?;
    if items.len() > 512 {
        return Err("sims_limit");
    }
    for outfit in items {
        let fields = reader.message(outfit)?;
        content.future(&fields, &[1, 2, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16]);
        if let Some(parts) = wire::bytes(&fields, 5)? {
            let parts = reader.message(parts)?;
            content.future(&parts, &[1]);
            for id in reader.ids(&parts, 1, true)? {
                content.add(CAS_PART, id, Use::Outfit, context)?;
            }
        }
    }
    Ok(())
}
fn facial(
    reader: &mut Reader<'_>,
    raw: &[u8],
    content: &mut Content,
    context: Option<Use>,
) -> Result<()> {
    let fields = reader.message(raw)?;
    content.future(&fields, &[1, 2, 3, 4, 5]);
    for id in reader.ids(&fields, 1, false)? {
        content.add(SCULPT, id, Use::Sculpt, context)?;
    }
    for field in 2..=5 {
        for raw in wire::messages(&fields, field)? {
            let modifier = reader.message(raw)?;
            content.future(&modifier, &[1, 2]);
            let id = wire::number(&modifier, 1, false)?;
            let amount = match wire::one(&modifier, 2)? {
                Some(Value::Fixed32(bits)) => {
                    let value = f32::from_bits(bits);
                    if !value.is_finite() {
                        return Err(FORMAT);
                    }
                    Some(value)
                }
                None => None,
                _ => return Err(FORMAT),
            };
            // Zero-weight modifiers do not establish active content use. Missing
            // optional amounts are uncertain, rather than silently treated as 1.
            if amount == Some(0.0) {
                continue;
            }
            if amount.is_none() {
                content.gaps.insert(Gap::ModifierWithoutAmount);
                continue;
            }
            if let Some(id) = id.filter(|n| *n != 0) {
                content.add(MODIFIER, id, Use::Slider, context)?;
            } else {
                content.gaps.insert(Gap::ModifierWithoutKey);
            }
        }
    }
    Ok(())
}
fn genetics(
    reader: &mut Reader<'_>,
    raw: &[u8],
    content: &mut Content,
    context: Option<Use>,
) -> Result<()> {
    let fields = reader.message(raw)?;
    content.future(&fields, &[1, 2, 3, 4, 5, 6]);
    let mut genetic = Content::new();
    if let Some(raw) = wire::bytes(&fields, 1)? {
        facial(reader, raw, &mut genetic, Some(Use::Genetic))?;
    }
    for key in [5, 6] {
        if let Some(raw) = wire::bytes(&fields, key)? {
            let list = reader.message(raw)?;
            content.future(&list, &[1]);
            for raw in wire::messages(&list, 1)? {
                let part = reader.message(raw)?;
                content.future(&part, &[1, 2, 3, 4, 5]);
                genetic.add(
                    CAS_PART,
                    required_number(&part, 1, false)?,
                    Use::Genetic,
                    context,
                )?;
            }
        }
    }
    content.gaps.extend(genetic.gaps);
    for (resource, uses) in genetic.references {
        for usage in uses {
            content.add(resource.kind, resource.instance, usage, context)?;
        }
    }
    Ok(())
}
fn sim_content(reader: &mut Reader<'_>, fields: &Message<'_>, content: &mut Content) -> Result<()> {
    if fields.iter().any(|(n, _)| *n > 76) {
        content.gaps.insert(Gap::FutureFields);
    }
    if fields.iter().any(|(n, _)| matches!(n, 17 | 20 | 47)) {
        content.gaps.insert(Gap::OtherSimData);
    }
    if fields.iter().any(|(n, _)| matches!(n, 62 | 63 | 75)) {
        content.gaps.insert(Gap::DynamicTextures);
    }
    if let Some(id) = wire::number(fields, 10, false)? {
        content.add(SKIN_TONE, id, Use::SkinTone, None)?;
    }
    if let Some(raw) = wire::bytes(fields, 18)? {
        facial(reader, raw, content, None)?;
    }
    if let Some(raw) = wire::bytes(fields, 21)? {
        outfits(reader, raw, content, None)?;
    }
    if let Some(raw) = wire::bytes(fields, 28)? {
        genetics(reader, raw, content, None)?;
    }
    if let Some(raw) = wire::bytes(fields, 30)? {
        let attributes = reader.message(raw)?;
        if attributes.iter().any(|(n, _)| !matches!(n, 10 | 17)) {
            content.gaps.insert(Gap::OtherSimData);
        }
        if let Some(raw) = wire::bytes(&attributes, 10)? {
            let traits = reader.message(raw)?;
            content.future(&traits, &[1, 2]);
            for id in reader.ids(&traits, 1, false)? {
                content.add(TRAIT, id, Use::Trait, None)?;
            }
        }
        if let Some(raw) = wire::bytes(&attributes, 17)? {
            let occult = reader.message(raw)?;
            content.future(&occult, &[1, 2, 3, 4, 5]);
            let forms = wire::messages(&occult, 3)?;
            if forms.len() > 32 {
                return Err("sims_limit");
            }
            for raw in forms {
                let form = reader.message(raw)?;
                content.future(&form, &[1, 11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24]);
                if form.iter().any(|(n, _)| *n == 23) {
                    content.gaps.insert(Gap::DynamicTextures);
                }
                if let Some(id) = wire::number(&form, 16, false)? {
                    content.add(SKIN_TONE, id, Use::SkinTone, Some(Use::Occult))?;
                }
                if let Some(raw) = wire::bytes(&form, 12)? {
                    facial(reader, raw, content, Some(Use::Occult))?;
                }
                if let Some(raw) = wire::bytes(&form, 21)? {
                    outfits(reader, raw, content, Some(Use::Occult))?;
                }
                if let Some(raw) = wire::bytes(&form, 17)? {
                    genetics(reader, raw, content, Some(Use::Occult))?;
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
#[path = "sims_cc_household_tests.rs"]
mod tests;
