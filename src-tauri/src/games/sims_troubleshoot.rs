//! A resumable, user-observed batch test. Groups stay whole; results are not
//! compatibility claims. Session state commits in the same journal as toggles.
use super::*;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Session {
    pub id: String,
    pub version: String,
    pub initial: Vec<sets::Member>,
    pub selected: Vec<String>,
    pub answers: Vec<bool>,
}
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Phase {
    Baseline,
    Test,
    Suspect,
    Inconclusive,
}
struct Progress {
    phase: Phase,
    candidates: Vec<String>,
    testing: Vec<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct View {
    pub id: String,
    pub round: usize,
    pub phase: Phase,
    pub selected: Vec<sets::Member>,
    pub testing: Vec<String>,
    pub remaining: usize,
    pub fixed_enabled: usize,
    pub version_changed: bool,
}
pub struct TrialPlan {
    pub next: Option<Session>,
    pub changes: Vec<sets::Change>,
    pub backup_folder: Option<String>,
}
pub fn unlocked(state: &State) -> Result<()> {
    if state.troubleshoot.is_some() {
        return Err("sims_test_active");
    }
    Ok(())
}
fn half(items: &[String]) -> Vec<String> {
    items[..items.len().div_ceil(2)].to_vec()
}
fn progress(session: &Session) -> Result<Progress> {
    if session.answers.len() > 20 || session.selected.is_empty() || session.selected.len() > 500 {
        return Err("sims_record");
    }
    let mut p = Progress {
        phase: Phase::Baseline,
        candidates: session.selected.clone(),
        testing: vec![],
    };
    for present in &session.answers {
        match p.phase {
            Phase::Baseline => {
                if *present {
                    p.phase = Phase::Inconclusive;
                } else {
                    p.phase = Phase::Test;
                    p.testing = half(&p.candidates);
                }
            }
            Phase::Test => {
                if *present {
                    p.candidates = p.testing.clone();
                    if p.testing.len() == 1 {
                        p.phase = Phase::Suspect;
                    } else {
                        p.testing = half(&p.candidates);
                    }
                } else {
                    p.candidates.retain(|id| !p.testing.contains(id));
                    if p.candidates.is_empty() {
                        p.phase = Phase::Inconclusive;
                    } else {
                        p.testing = half(&p.candidates);
                    }
                }
            }
            _ => return Err("sims_record"),
        }
    }
    Ok(p)
}
fn validate(session: &Session, state: &State) -> Result<()> {
    uuid(&session.id)?;
    if session.version.is_empty()
        || session.version.len() > 200
        || session.version.chars().any(char::is_control)
        || session.initial.len() != state.groups.len()
        || session.initial.len() > 500
    {
        return Err("sims_record");
    }
    let mut ids = BTreeSet::new();
    for m in &session.initial {
        if !ids.insert(&m.id)
            || !state
                .groups
                .iter()
                .any(|g| g.id == m.id && g.title == m.title)
        {
            return Err("sims_record");
        }
    }
    let mut selected = BTreeSet::new();
    for id in &session.selected {
        if !selected.insert(id) || !session.initial.iter().any(|m| m.id == *id && m.enabled) {
            return Err("sims_record");
        }
    }
    progress(session)?;
    Ok(())
}
fn members(session: &Session) -> Result<Vec<sets::Member>> {
    let p = progress(session)?;
    Ok(session
        .initial
        .iter()
        .map(|m| sets::Member {
            enabled: if session.selected.contains(&m.id) {
                p.testing.contains(&m.id)
            } else {
                m.enabled
            },
            ..m.clone()
        })
        .collect())
}
pub fn validate_state(state: &State) -> Result<()> {
    if let Some(session) = &state.troubleshoot {
        validate(session, state)?;
        for member in members(session)? {
            if !state
                .groups
                .iter()
                .any(|g| g.id == member.id && g.enabled == member.enabled)
            {
                return Err("sims_record");
            }
        }
    }
    Ok(())
}
pub fn view(state: &State, version: &str) -> Result<Option<View>> {
    let Some(s) = &state.troubleshoot else {
        return Ok(None);
    };
    validate(s, state)?;
    let p = progress(s)?;
    Ok(Some(View {
        id: s.id.clone(),
        round: s.answers.len(),
        phase: p.phase,
        selected: s
            .initial
            .iter()
            .filter(|m| s.selected.contains(&m.id))
            .cloned()
            .collect(),
        testing: p.testing,
        remaining: p.candidates.len(),
        fixed_enabled: s
            .initial
            .iter()
            .filter(|m| m.enabled && !s.selected.contains(&m.id))
            .count(),
        version_changed: version != s.version,
    }))
}
fn next(state: &State, action: &Action, version: &str) -> Result<Option<Session>> {
    match action {
        Action::StartTest { groups, .. } => {
            unlocked(state)?;
            // Keep a shared library fixed during isolation. Testing its dependents
            // without it would create a new failure and invalidate the user's result.
            if state
                .groups
                .iter()
                .any(|g| g.enabled && g.source.as_ref().is_some_and(|s| s.required_core.is_some()))
                && state.groups.iter().any(|g| {
                    groups.contains(&g.id)
                        && g.source.as_ref().is_some_and(|s| {
                            s.provider == "lot51" && s.project.as_deref() == Some("core-library")
                        })
                })
            {
                return Err("sims_creator_dependency");
            }
            if groups.is_empty() || groups.len() > 500 {
                return Err("sims_request");
            }
            let mut selected = groups.clone();
            selected.sort();
            let session = Session {
                id: uuid::Uuid::new_v4().to_string(),
                version: version.into(),
                initial: state
                    .groups
                    .iter()
                    .map(|g| sets::Member {
                        id: g.id.clone(),
                        title: g.title.clone(),
                        enabled: g.enabled,
                    })
                    .collect(),
                selected,
                answers: vec![],
            };
            validate(&session, state)?;
            Ok(Some(session))
        }
        Action::AnswerTest { id, round, present } => {
            let mut s = state.troubleshoot.clone().ok_or("sims_changed")?;
            if s.id != *id || s.answers.len() != *round || s.version != version {
                return Err("sims_changed");
            }
            if !matches!(progress(&s)?.phase, Phase::Baseline | Phase::Test) {
                return Err("sims_request");
            }
            s.answers.push(*present);
            progress(&s)?;
            Ok(Some(s))
        }
        Action::RestoreTest { id } => {
            if state.troubleshoot.as_ref().is_none_or(|s| s.id != *id) {
                return Err("sims_changed");
            }
            Ok(None)
        }
        _ => Err("sims_request"),
    }
}
pub fn validate_transition(before: &State, after: &State) -> Result<()> {
    match (&before.troubleshoot, &after.troubleshoot) {
        (None, None) => return Ok(()),
        (None, Some(s)) => {
            if !s.answers.is_empty()
                || s.initial
                    != before
                        .groups
                        .iter()
                        .map(|g| sets::Member {
                            id: g.id.clone(),
                            title: g.title.clone(),
                            enabled: g.enabled,
                        })
                        .collect::<Vec<_>>()
            {
                return Err("sims_record");
            }
            validate(s, before)?;
        }
        (Some(a), Some(b)) => {
            if a == b
                || b.answers.len() != a.answers.len() + 1
                || !b.answers.starts_with(&a.answers)
            {
                return Err("sims_record");
            }
            let mut expected = a.clone();
            expected.answers = b.answers.clone();
            if &expected != b || !matches!(progress(a)?.phase, Phase::Baseline | Phase::Test) {
                return Err("sims_record");
            }
            progress(b)?;
        }
        (Some(_), None) => {}
    }
    let expected = match &after.troubleshoot {
        Some(s) => members(s)?,
        None => before
            .troubleshoot
            .as_ref()
            .ok_or("sims_record")?
            .initial
            .clone(),
    };
    if expected.len() != after.groups.len()
        || expected.iter().any(|m| {
            !after
                .groups
                .iter()
                .any(|g| g.id == m.id && g.enabled == m.enabled)
        })
    {
        return Err("sims_record");
    }
    Ok(())
}
#[cfg(test)]
pub fn plan(path: &str, action: Action) -> Result<Plan> {
    plan_checked(path, action, &|| Ok(()))
}
pub fn plan_checked(path: &str, action: Action, cancel: &dyn Fn() -> Result<()>) -> Result<Plan> {
    cancel()?;
    let folder = files::validate(path)?;
    let (state, pending) = snapshot(&folder.path)?;
    if pending {
        return Err("sims_recovery");
    }
    let next = next(&state, &action, &folder.game_version)?;
    let desired = match &next {
        Some(s) => members(s)?,
        None => state
            .troubleshoot
            .as_ref()
            .ok_or("sims_request")?
            .initial
            .clone(),
    };
    let changes = sets::changes_checked(&state, &desired, cancel)?;
    let backup_folder = if let Action::StartTest { backup_folder, .. } = &action {
        sets::backup_folder(path, backup_folder)?
    } else {
        None
    };
    let plan = Plan {
        source: None,
        tray: None,
        before: state,
        action,
        version: folder.game_version,
        payload: vec![],
        skipped: vec![],
        existing: vec![],
        restore_files: vec![],
        target_id: String::new(),
        set: None,
        adoption: None,
        trial: Some(TrialPlan {
            next,
            changes,
            backup_folder,
        }),
    };
    check_controlled(&plan, cancel)?;
    Ok(plan)
}
pub fn check(plan: &Plan) -> Result<()> {
    check_controlled(plan, &|| Ok(()))
}
fn check_controlled(plan: &Plan, cancel: &dyn Fn() -> Result<()>) -> Result<()> {
    let trial = plan.trial.as_ref().ok_or("sims_request")?;
    let mut expected = next(&plan.before, &plan.action, &plan.version)?;
    // The random ID is native-owned by this review and remains fixed through apply.
    if matches!(plan.action, Action::StartTest { .. }) {
        if let (Some(e), Some(n)) = (&mut expected, &trial.next) {
            e.id = n.id.clone();
        }
    }
    if expected != trial.next {
        return Err("sims_changed");
    }
    for group in &plan.before.groups {
        let root = Path::new(&plan.before.root);
        let tree = files::tree_checked(
            &area_path(root, &root.join(STORE), &location(group))?,
            cancel,
        )?;
        verify_owned(group, &tree)?;
    }
    sets::check_changes_controlled(plan, &trial.changes, cancel)
}

#[cfg(test)]
mod algorithm_tests {
    use super::*;
    #[test]
    fn every_single_culprit_is_actually_observed_alone_before_becoming_a_suspect() {
        for size in 1..=32 {
            for culprit in 0..size {
                let selected: Vec<_> = (0..size).map(|i| format!("mod-{i}")).collect();
                let mut s = Session {
                    id: String::new(),
                    version: String::new(),
                    initial: vec![],
                    selected,
                    answers: vec![],
                };
                s.answers.push(false);
                loop {
                    let p = progress(&s).unwrap();
                    if p.phase == Phase::Suspect {
                        assert_eq!(p.testing, vec![format!("mod-{culprit}")]);
                        break;
                    }
                    assert_eq!(p.phase, Phase::Test);
                    s.answers
                        .push(p.testing.contains(&format!("mod-{culprit}")));
                    assert!(s.answers.len() < 10);
                }
            }
        }
    }
    #[test]
    fn clean_batches_or_failing_baseline_never_claim_a_culprit() {
        let mut s = Session {
            id: String::new(),
            version: String::new(),
            initial: vec![],
            selected: vec!["a".into(), "b".into()],
            answers: vec![true],
        };
        assert_eq!(progress(&s).unwrap().phase, Phase::Inconclusive);
        s.answers = vec![false, false, false];
        assert_eq!(progress(&s).unwrap().phase, Phase::Inconclusive);
        s.answers.push(true);
        assert!(progress(&s).is_err());
    }
}
