//! A known group must match exactly. References without a group retain the
//! existing ambiguity rules; a matching filename is never resource evidence.
use super::{build, household, index, Resource, Result, Sim};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct Reference {
    pub resource: Resource,
    pub group: Option<u32>,
}

#[cfg(test)]
#[path = "sims_cc_query_tests.rs"]
mod tests;
impl From<build::Key> for Reference {
    fn from(key: build::Key) -> Self {
        Self {
            resource: Resource {
                kind: key.kind,
                instance: key.instance,
            },
            group: Some(key.group),
        }
    }
}
pub struct Query {
    pub references: BTreeMap<Reference, BTreeSet<String>>,
    pub sims: Vec<Sim>,
    pub objects: Option<usize>,
    pub other_data: bool,
}
impl Query {
    pub fn household(value: household::Household) -> Self {
        let mut references = BTreeMap::<Reference, BTreeSet<String>>::new();
        for sim in &value.sims {
            for reference in &sim.references {
                references
                    .entry(Reference {
                        resource: reference.resource,
                        group: None,
                    })
                    .or_default()
                    .insert(format!("{:016x}", sim.id));
            }
        }
        Self {
            references,
            other_data: !value.gaps.is_empty() || value.sims.iter().any(|s| !s.gaps.is_empty()),
            sims: value
                .sims
                .into_iter()
                .map(|s| Sim {
                    id: format!("{:016x}", s.id),
                    name: s.name,
                })
                .collect(),
            objects: None,
        }
    }
    pub fn build(value: build::Content) -> Self {
        let mut references = value
            .declared
            .iter()
            .map(|key| (Reference::from(*key), BTreeSet::new()))
            .collect::<BTreeMap<_, _>>();
        let catalog = value
            .declared
            .iter()
            .filter(|k| k.kind == 0x319e4f1d)
            .map(|k| k.instance)
            .collect::<BTreeSet<_>>();
        for object in &value.objects {
            // A room table already identifies the catalog resource including
            // its group. Lots expose an OBJD GUID without a group instead.
            if !catalog.contains(&object.definition) {
                references
                    .entry(Reference {
                        resource: Resource {
                            kind: 0xc0db5ae7,
                            instance: object.definition,
                        },
                        group: None,
                    })
                    .or_default();
            }
            if let Some(model) = object.model {
                references.entry(model.into()).or_default();
            }
        }
        Self {
            references,
            sims: vec![],
            objects: Some(value.objects.len()),
            other_data: value.architecture_bytes > 0
                || value.object_attributes
                || value.other_fields,
        }
    }
    pub fn validate(&self) -> Result<()> {
        if self.references.len() > 50_000 {
            Err("sims_limit")
        } else {
            Ok(())
        }
    }
    pub fn wanted(&self) -> BTreeSet<Resource> {
        self.references.keys().map(|r| r.resource).collect()
    }
    pub fn matching(&self, entry: &index::Entry) -> impl Iterator<Item = Reference> + '_ {
        let resource = entry.resource;
        [None, Some(entry.group)]
            .into_iter()
            .map(move |group| Reference { resource, group })
            .filter(|reference| self.references.contains_key(reference))
    }
}
