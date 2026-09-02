use harbor_core::{
    parser, scoring, trust, ParsedStream, RankedPicker, Rejection, ScoreOptions, ScoredStream,
    Stream, TrustOptions,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineResult {
    pub picker: RankedPicker,
    pub rejected: Vec<Rejection>,
}

#[tauri::command]
pub async fn streams_run_pipeline(
    streams: Vec<ParsedStream>,
    trust_opts: Option<TrustOptions>,
    score_opts: Option<ScoreOptions>,
) -> Result<PipelineResult, String> {
    let trust_opts = trust_opts.unwrap_or_default();
    let score_opts = score_opts.unwrap_or_default();
    tokio::task::spawn_blocking(move || {
        let trust_result = trust::apply_trust(streams, &trust_opts);
        let corpus = scoring::compute_corpus_stats(&trust_result.keep, &score_opts);
        let scored: Vec<ScoredStream> = trust_result
            .keep
            .into_iter()
            .map(|p| scoring::score_stream(p, &score_opts, &corpus))
            .collect();
        let picker = scoring::rank_and_pick(
            scored,
            &score_opts.active_debrids,
            score_opts.respect_addon_order,
        );
        PipelineResult {
            picker,
            rejected: trust_result.rejected,
        }
    })
    .await
    .map_err(|e| format!("join: {e}"))
}

#[tauri::command]
pub async fn streams_parse(streams: Vec<Stream>) -> Result<Vec<ParsedStream>, String> {
    tokio::task::spawn_blocking(move || streams.into_iter().map(parser::parse_stream).collect())
        .await
        .map_err(|e| format!("join: {e}"))
}

#[tauri::command]
pub fn streams_core_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
