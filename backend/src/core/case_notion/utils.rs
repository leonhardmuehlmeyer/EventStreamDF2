use crate::core::case_notion::main::{CaseNotionEvaluation};
use crate::core::case_notion::measures::measure_value;

const EPSILON: f64 = 1e-9;

pub(crate) fn is_better_evaluation(
    candidate: &CaseNotionEvaluation,
    current: Option<&CaseNotionEvaluation>,
) -> bool {
    match current {
        None => true,
        Some(best) => {
            let cand_f1 = candidate.f1_score().unwrap_or(0.0);
            let best_f1 = best.f1_score().unwrap_or(0.0);
            if (cand_f1 - best_f1).abs() > EPSILON {
                cand_f1 > best_f1
            } else {
                let cand_corr = measure_value(&candidate.measures, "Correctness").unwrap_or(0.0);
                let best_corr = measure_value(&best.measures, "Correctness").unwrap_or(0.0);
                if (cand_corr - best_corr).abs() > EPSILON {
                    cand_corr > best_corr
                } else {
                    let cand_total = candidate.total_score().unwrap_or(0.0);
                    let best_total = best.total_score().unwrap_or(0.0);
                    cand_total > best_total
                }
            }
        }
    }
}
