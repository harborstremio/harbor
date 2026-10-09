#![cfg(feature = "asr-whisper")]

use super::asr::{AsrEngine, AsrSegment, AsrToken, ASR_SAMPLE_RATE};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

pub struct WhisperEngine {
    ctx: WhisperContext,
    n_threads: i32,
}

impl WhisperEngine {
    pub fn load(model_path: &str) -> Result<Self, String> {
        let ctx = WhisperContext::new_with_params(model_path, WhisperContextParameters::default())
            .map_err(|e| format!("load model: {}", e))?;
        let n_threads = std::thread::available_parallelism()
            .map(|v| v.get() as i32)
            .unwrap_or(4)
            .min(8);
        Ok(Self { ctx, n_threads })
    }

    fn params<'a>(&self, lang: Option<&'a str>, translate: bool) -> FullParams<'a, 'a> {
        let mut p = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        p.set_n_threads(self.n_threads);
        p.set_translate(translate);
        p.set_no_context(true);
        p.set_single_segment(false);
        p.set_token_timestamps(true);
        p.set_max_len(1);
        p.set_split_on_word(true);
        p.set_temperature(0.0);
        p.set_suppress_blank(true);
        p.set_suppress_nst(true);
        p.set_no_speech_thold(0.6);
        p.set_print_special(false);
        p.set_print_progress(false);
        p.set_print_realtime(false);
        p.set_print_timestamps(false);
        if let Some(l) = lang {
            p.set_language(Some(l));
        }
        p
    }
}

impl AsrEngine for WhisperEngine {
    fn transcribe(
        &self,
        pcm: &[f32],
        lang: Option<&str>,
        translate: bool,
    ) -> Result<Vec<AsrSegment>, String> {
        if pcm.len() < ASR_SAMPLE_RATE as usize {
            return Ok(Vec::new());
        }
        let mut state = self
            .ctx
            .create_state()
            .map_err(|e| format!("state: {}", e))?;
        let params = self.params(lang, translate);
        state
            .full(params, pcm)
            .map_err(|e| format!("full: {}", e))?;
        let n = state
            .full_n_segments()
            .map_err(|e| format!("nseg: {}", e))?;
        let mut out = Vec::with_capacity(n as usize);
        for i in 0..n {
            let text = state.full_get_segment_text(i).unwrap_or_default();
            let t0 = state.full_get_segment_t0(i).unwrap_or(0) as f32 / 100.0;
            let t1 = state.full_get_segment_t1(i).unwrap_or(0) as f32 / 100.0;
            let mut tokens = Vec::new();
            let no_speech = state.full_get_segment_no_speech_prob(i).unwrap_or(0.0);
            if let Ok(nt) = state.full_n_tokens(i) {
                for j in 0..nt {
                    let td = match state.full_get_token_data(i, j) {
                        Ok(d) => d,
                        Err(_) => continue,
                    };
                    let tt = state.full_get_token_text(i, j).unwrap_or_default();
                    if tt.starts_with("[_") || tt.starts_with("<|") {
                        continue;
                    }
                    tokens.push(AsrToken {
                        text: tt,
                        t0: td.t0 as f32 / 100.0,
                        t1: td.t1 as f32 / 100.0,
                        p: td.p,
                    });
                }
            }
            out.push(AsrSegment {
                text,
                t0,
                t1,
                no_speech,
                tokens,
            });
        }
        Ok(out)
    }
}
