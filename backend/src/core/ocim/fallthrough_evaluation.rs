use crate::core::ocim::auxiliary_methods::{get_divergent_types, get_non_divergent_types};
use crate::core::ocim::common_data::{GlobalData, LocalData};
use crate::models::ocpt::OCPTOperatorType;

pub fn evaluate_concurrent_fallthrough(
    local_data: &LocalData,
    global_data: &GlobalData,
    part_one: &[String],
    part_two: &[String],
) -> (f64, OCPTOperatorType) {
    let mut precision_violation = 0.0;
    let mut precision_correct = 0.0;

    for a in part_one {
        for b in part_two {
            if let (Some(rel_a), Some(rel_b)) =
                (global_data.related.get(a), global_data.related.get(b))
            {
                for ot in rel_a.intersection(rel_b) {
                    let (dfg, _, _) = match local_data.dfgs.get(ot) {
                        Some(tuple) => tuple,
                        None => {
                            precision_violation += 2.0;
                            continue;
                        }
                    };

                    let ab = dfg.get(&(a.clone(), b.clone())).copied().unwrap_or(0);
                    if ab == 0 {
                        precision_violation += 1.0;
                    } else {
                        precision_correct += 1.0;
                    }

                    let ba = dfg.get(&(b.clone(), a.clone())).copied().unwrap_or(0);
                    if ba == 0 {
                        precision_violation += 1.0;
                    } else {
                        precision_correct += 1.0;
                    }
                }
            }
        }
    }

    let denom = precision_correct + precision_violation;
    if denom == 0.0 {
        (1.0, OCPTOperatorType::Concurrency)
    } else {
        (
            1.0 - (precision_violation / denom),
            OCPTOperatorType::Concurrency,
        )
    }
}

pub fn evaluate_xor_fallthrough(
    local_data: &LocalData,
    global_data: &GlobalData,
    part_one: &[String],
    part_two: &[String],
) -> (f64, OCPTOperatorType) {
    let mut precision_violation = 0.0;
    let mut precision_correct = 0.0;

    for a in part_one {
        for b in part_two {
            for ot in get_divergent_types(a, b, &[part_one, part_two].concat(), global_data) {
                if let Some((dfg, _, _)) = local_data.dfgs.get(&ot) {
                    let ab = dfg.get(&(a.clone(), b.clone())).copied().unwrap_or(0);
                    if ab == 0 {
                        precision_violation += 1.0;
                    } else {
                        precision_correct += 1.0;
                    }

                    let ba = dfg.get(&(b.clone(), a.clone())).copied().unwrap_or(0);
                    if ba == 0 {
                        precision_violation += 1.0;
                    } else {
                        precision_correct += 1.0;
                    }
                } else {
                    precision_violation += 2.0;
                }
            }
        }
    }

    let denom = precision_correct + precision_violation;
    if denom == 0.0 {
        (1.0, OCPTOperatorType::ExclusiveChoice)
    } else {
        (
            1.0 - (precision_violation / denom),
            OCPTOperatorType::ExclusiveChoice,
        )
    }
}

pub fn evaluate_sequence_fallthrough(
    local_data: &LocalData,
    global_data: &GlobalData,
    part_one: &[String],
    part_two: &[String],
) -> (f64, OCPTOperatorType) {
    let mut precision_violation = 0.0;
    let mut precision_correct = 0.0;
    let context = [part_one, part_two].concat();

    for a in part_one {
        for b in part_two {
            for ot in get_divergent_types(a, b, &context, global_data) {
                if let Some((dfg, _, _)) = local_data.dfgs.get(&ot) {
                    let ab = dfg.get(&(a.clone(), b.clone())).copied().unwrap_or(0);
                    if ab == 0 {
                        precision_violation += 1.0;
                    } else {
                        precision_correct += 1.0;
                    }

                    let ba = dfg.get(&(b.clone(), a.clone())).copied().unwrap_or(0);
                    if ba == 0 {
                        precision_violation += 1.0;
                    } else {
                        precision_correct += 1.0;
                    }
                } else {
                    precision_violation += 2.0;
                }
            }

            for ot in get_non_divergent_types(a, b, &context, global_data) {
                let clos_ok = local_data
                    .clos
                    .get(&ot)
                    .map(|c| c.contains(&(a.clone(), b.clone())))
                    .unwrap_or(false);
                if !clos_ok {
                    precision_violation += 1.0;
                } else {
                    precision_correct += 1.0;
                }
            }
        }
    }

    let denom = precision_correct + precision_violation;
    if denom == 0.0 {
        (1.0, OCPTOperatorType::Sequence)
    } else {
        (
            1.0 - (precision_violation / denom),
            OCPTOperatorType::Sequence,
        )
    }
}

pub fn evaluate_loop_fallthrough(
    local_data: &LocalData,
    global_data: &GlobalData,
    part_one: &[String],
    part_two: &[String],
) -> (f64, OCPTOperatorType) {
    let mut precision_violation = 0.0;
    let mut precision_correct = 0.0;
    let context = [part_one, part_two].concat();

    for a in part_one {
        for b in part_two {
            for ot in get_divergent_types(a, b, &context, global_data) {
                if let Some((dfg, _, _)) = local_data.dfgs.get(&ot) {
                    let ab = dfg.get(&(a.clone(), b.clone())).copied().unwrap_or(0);
                    if ab == 0 {
                        precision_violation += 1.0;
                    } else {
                        precision_correct += 1.0;
                    }

                    let ba = dfg.get(&(b.clone(), a.clone())).copied().unwrap_or(0);
                    if ba == 0 {
                        precision_violation += 1.0;
                    } else {
                        precision_correct += 1.0;
                    }
                } else {
                    precision_violation += 2.0;
                }
            }
        }
    }

    for a in &context {
        for b in &context {
            if let (Some(rel_a), Some(rel_b)) =
                (global_data.related.get(a), global_data.related.get(b))
            {
                for ot in rel_a.intersection(rel_b) {
                    let clos_ok = local_data
                        .clos
                        .get(ot)
                        .map(|c| c.contains(&(a.clone(), b.clone())))
                        .unwrap_or(false);
                    if !clos_ok {
                        precision_violation += 1.0;
                    } else {
                        precision_correct += 1.0;
                    }
                }
            }
        }
    }

    let denom = precision_correct + precision_violation;
    if denom == 0.0 {
        (1.0, OCPTOperatorType::Loop(None))
    } else {
        (
            1.0 - (precision_violation / denom),
            OCPTOperatorType::Loop(None),
        )
    }
}
