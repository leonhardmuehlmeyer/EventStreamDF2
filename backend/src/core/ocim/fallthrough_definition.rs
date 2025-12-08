use rustc_hash::FxHashSet;

use crate::core::ocim::auxiliary_methods::get_non_divergent_types;
use crate::core::ocim::common_data::{GlobalData, LocalData};

/// Concurrent fallthrough validity check (placeholder – Python returned True unconditionally).
pub fn is_concurrent_fallthrough_valid(
    _local_data: &LocalData,
    _global_data: &GlobalData,
    _partition_list: &[Vec<String>],
) -> bool {
    true
}

pub fn is_exclusive_fallthrough_valid(
    local_data: &LocalData,
    global_data: &GlobalData,
    partition_list: &[Vec<String>],
) -> bool {
    let all_parts: FxHashSet<String> = partition_list
        .iter()
        .flat_map(|p| p.iter().cloned())
        .collect();
    if all_parts != local_data.alphabet.iter().cloned().collect() {
        return false;
    }

    for i in 0..partition_list.len() {
        for j in (i + 1)..partition_list.len() {
            let mut context = Vec::with_capacity(partition_list[i].len() + partition_list[j].len());
            context.extend(partition_list[i].iter().cloned());
            context.extend(partition_list[j].iter().cloned());

            for a in &partition_list[i] {
                for b in &partition_list[j] {
                    for ot in get_non_divergent_types(a, b, &context, global_data) {
                        if let Some((dfg, _, _)) = local_data.dfgs.get(&ot) {
                            let ab = dfg.get(&(a.clone(), b.clone())).copied().unwrap_or(0);
                            let ba = dfg.get(&(b.clone(), a.clone())).copied().unwrap_or(0);
                            if ab > 0 || ba > 0 {
                                return false;
                            }
                        }
                    }
                }
            }
        }
    }

    for i in 0..partition_list.len() {
        for j in (i + 1)..partition_list.len() {
            let mut context = Vec::with_capacity(partition_list[i].len() + partition_list[j].len());
            context.extend(partition_list[i].iter().cloned());
            context.extend(partition_list[j].iter().cloned());

            let has_non_divergent = partition_list[i].iter().any(|a| {
                partition_list[j].iter().any(|b| {
                    !get_non_divergent_types(a, b, &context, global_data)
                        .is_empty()
                })
            });
            if !has_non_divergent {
                return false;
            }
        }
    }

    true
}

pub fn is_sequence_fallthrough_valid(
    local_data: &LocalData,
    global_data: &GlobalData,
    partition_list: &[Vec<String>],
) -> bool {
    let all_parts: FxHashSet<String> = partition_list
        .iter()
        .flat_map(|p| p.iter().cloned())
        .collect();
    if all_parts != local_data.alphabet.iter().cloned().collect() {
        return false;
    }

    for i in 0..partition_list.len() {
        for j in (i + 1)..partition_list.len() {
            let (mut i, mut j) = (i, j);
            if i > j {
                std::mem::swap(&mut i, &mut j);
            }

            let segment: Vec<String> = partition_list[i..=j]
                .iter()
                .flat_map(|p| p.iter().cloned())
                .collect();

            for a in &partition_list[i] {
                for b in &partition_list[j] {
                    for ot in get_non_divergent_types(a, b, &segment, global_data) {
                        if local_data
                            .clos
                            .get(&ot)
                            .map(|c| c.contains(&(b.clone(), a.clone())))
                            .unwrap_or(false)
                        {
                            return false;
                        }
                    }
                }
            }
        }
    }

    for i in 0..partition_list.len() {
        for j in (i + 1)..partition_list.len() {
            let mut context = Vec::with_capacity(partition_list[i].len() + partition_list[j].len());
            context.extend(partition_list[i].iter().cloned());
            context.extend(partition_list[j].iter().cloned());

            let has_non_divergent = partition_list[i].iter().any(|a| {
                partition_list[j].iter().any(|b| {
                    !get_non_divergent_types(a, b, &context, global_data)
                        .is_empty()
                })
            });
            if !has_non_divergent {
                return false;
            }
        }
    }

    true
}

pub fn is_loop_fallthrough_valid(
    local_data: &LocalData,
    global_data: &GlobalData,
    partition_list: &[Vec<String>],
) -> bool {
    if partition_list.len() < 2 {
        return false;
    }

    let all_parts: FxHashSet<String> = partition_list
        .iter()
        .flat_map(|p| p.iter().cloned())
        .collect();
    if all_parts != local_data.alphabet.iter().cloned().collect() {
        return false;
    }

    let body = &partition_list[0];
    let redo = &partition_list[1];

    let context: Vec<String> = body
        .iter()
        .chain(redo.iter())
        .cloned()
        .collect();

    let mut relevant_types: FxHashSet<String> = FxHashSet::default();
    for a in body {
        for b in redo {
            for ot in get_non_divergent_types(a, b, &context, global_data) {
                relevant_types.insert(ot);
            }
        }
    }

    if relevant_types.is_empty() {
        return false;
    }

    for ot in &relevant_types {
        if let Some((_, starts, _)) = local_data.dfgs.get(ot) {
            let ok = starts.iter().all(|(act, freq)| {
                if *freq == 0 {
                    true
                } else if body.contains(act) || redo.contains(act) {
                    body.contains(act)
                } else {
                    true
                }
            });
            if !ok {
                return false;
            }
        }
    }

    for ot in &relevant_types {
        if let Some((_, _, ends)) = local_data.dfgs.get(ot) {
            let ok = ends.iter().all(|(act, freq)| {
                if *freq == 0 {
                    true
                } else if body.contains(act) || redo.contains(act) {
                    body.contains(act)
                } else {
                    true
                }
            });
            if !ok {
                return false;
            }
        }
    }

    for a in body {
        for b in redo {
            for ot in get_non_divergent_types(a, b, &context, global_data) {
                if let Some((dfg, _, ends)) = local_data.dfgs.get(&ot) {
                    let ab = dfg.get(&(a.clone(), b.clone())).copied().unwrap_or(0);
                    let is_end = ends.get(a).copied().unwrap_or(0) > 0;
                    if ab > 0 && !is_end {
                        return false;
                    }
                }
            }
        }
    }

    for a in redo {
        for b in body {
            for ot in get_non_divergent_types(a, b, &context, global_data) {
                if let Some((dfg, starts, _)) = local_data.dfgs.get(&ot) {
                    let ab = dfg.get(&(a.clone(), b.clone())).copied().unwrap_or(0);
                    let is_start = starts.get(b).copied().unwrap_or(0) > 0;
                    if ab > 0 && !is_start {
                        return false;
                    }
                }
            }
        }
    }

    true
}
