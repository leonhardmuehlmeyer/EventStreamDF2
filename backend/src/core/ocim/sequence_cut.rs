use rustc_hash::{FxHashMap, FxHashSet};

use crate::core::ocim::auxiliary_methods::{get_divergent_types, get_non_divergent_types};
use crate::core::ocim::common_data::{GlobalData, LocalData};

/// Rust port of `is_sequence_cut_valid` from the Python OCIM prototype.
/// Validates whether a given alphabet partition is a proper sequence cut
/// according to the conditions in Section 3.1 (Eq. 23-25).
pub fn is_sequence_cut_valid(
    local_data: &LocalData,
    global_data: &GlobalData,
    partition_list: &[Vec<String>],
) -> bool {
    let part_set: FxHashSet<_> = partition_list.iter().flatten().cloned().collect();
    let alphabet_set: FxHashSet<_> = local_data.alphabet.iter().cloned().collect();
    if part_set != alphabet_set {
        return false;
    }

    for i in 0..partition_list.len() {
        for j in (i + 1)..partition_list.len() {
            let segment: Vec<String> = partition_list[i..=j]
                .iter()
                .flat_map(|p| p.iter().cloned())
                .collect();

            for a in &partition_list[i] {
                for b in &partition_list[j] {
                    // Fully divergent object types -> require bi-directional directly-follows
                    let segment_divergent = get_divergent_types(a, b, &segment, global_data);
                    for ot in &segment_divergent {
                        if let Some((dfg, _, _)) = local_data.dfgs.get(ot) {
                            let ab = (a.clone(), b.clone());
                            let ba = (b.clone(), a.clone());
                            if !dfg.contains_key(&ab) || !dfg.contains_key(&ba) {
                                return false;
                            }
                        } else {
                            return false;
                        }
                    }

                    // Non-divergent object types -> require one-directional reachability
                    for ot in get_non_divergent_types(a, b, &segment, global_data) {
                        if let Some(clos) = local_data.clos.get(&ot) {
                            let ab = (a.clone(), b.clone());
                            let ba = (b.clone(), a.clone());
                            if !clos.contains(&ab) || clos.contains(&ba) {
                                return false;
                            }
                        } else {
                            return false;
                        }
                    }
                }
            }
        }
    }

    // Adjacent partitions must share at least one non-divergent object type
    for i in 0..partition_list.len().saturating_sub(1) {
        let j = i + 1;
        let segment: Vec<String> = partition_list[i]
            .iter()
            .chain(&partition_list[j])
            .cloned()
            .collect();

        let mut found = false;
        'outer: for a in &partition_list[i] {
            for b in &partition_list[j] {
                if !get_non_divergent_types(a, b, &segment, global_data).is_empty() {
                    found = true;
                    break 'outer;
                }
            }
        }

        if !found {
            return false;
        }
    }

    true
}

fn partitions_cover_alphabet(partitions: &[Vec<String>], alphabet: &[String]) -> bool {
    let part_set: FxHashSet<_> = partitions.iter().flatten().cloned().collect();
    let alphabet_set: FxHashSet<_> = alphabet.iter().cloned().collect();
    part_set == alphabet_set
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ocel::OCEL;

    // Minimal OCEL stub for LocalData/GlobalData constructors.
    fn empty_ocel() -> OCEL {
        OCEL {
            events: Vec::new(),
            objects: Vec::new(),
            event_types: Vec::new(),
            object_types: Vec::new(),
        }
    }

    // Build LocalData with provided alphabet/object types and graphs.
    fn make_local_data(
        alphabet: &[&str],
        object_types: &[&str],
        dfgs: FxHashMap<
            String,
            (
                FxHashMap<(String, String), u32>,
                FxHashMap<String, u32>,
                FxHashMap<String, u32>,
            ),
        >,
        clos: FxHashMap<String, FxHashSet<(String, String)>>,
    ) -> LocalData {
        LocalData {
            oc_log_list: vec![empty_ocel()],
            alphabet: alphabet.iter().map(|s| s.to_string()).collect(),
            object_types: object_types.iter().map(|s| s.to_string()).collect(),
            object_set: FxHashSet::default(),
            expected_objects: FxHashSet::default(),
            dfgs,
            clos,
        }
    }

    // Build GlobalData with provided divergence/related maps.
    fn make_global_data(
        divergence: FxHashMap<String, FxHashSet<String>>,
        related: FxHashMap<String, FxHashSet<String>>,
    ) -> GlobalData {
        GlobalData {
            oc_log_list: vec![empty_ocel()],
            divergence,
            convergence: FxHashMap::default(),
            related,
            deficiency: FxHashMap::default(),
        }
    }

    // Convenience converter for test literals.
    fn set_of(items: &[&str]) -> FxHashSet<String> {
        items.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn valid_sequence_cut_with_non_divergent_type() {
        // Activities A -> B reachable for ot1 via closure (only forward).
        let mut clos = FxHashMap::default();
        clos.insert(
            "ot1".to_string(),
            [("A".to_string(), "B".to_string())]
                .into_iter()
                .collect(),
        );

        let local = make_local_data(&["A", "B"], &["ot1"], FxHashMap::default(), clos);

        let mut related = FxHashMap::default();
        related.insert("A".to_string(), set_of(&["ot1"]));
        related.insert("B".to_string(), set_of(&["ot1"]));

        let global = make_global_data(FxHashMap::default(), related);

        let partitions = vec![vec!["A".to_string()], vec!["B".to_string()]];
        assert!(is_sequence_cut_valid(&local, &global, &partitions));
    }

    #[test]
    fn invalid_when_partition_not_covering_alphabet() {
        let local = make_local_data(&["A", "B"], &["ot1"], FxHashMap::default(), FxHashMap::default());
        let global = make_global_data(FxHashMap::default(), FxHashMap::default());

        let partitions = vec![vec!["A".to_string()]]; // missing B
        assert!(!is_sequence_cut_valid(&local, &global, &partitions));
    }

    #[test]
    fn invalid_when_divergent_type_not_bidirectional() {
        // Divergent ot1 must have both directions in DFG; we omit (B,A).
        let mut dfg_edges = FxHashMap::default();
        dfg_edges.insert(("A".to_string(), "B".to_string()), 1);

        let mut dfgs = FxHashMap::default();
        dfgs.insert(
            "ot1".to_string(),
            (dfg_edges, FxHashMap::default(), FxHashMap::default()),
        );

        let local = make_local_data(&["A", "B"], &["ot1"], dfgs, FxHashMap::default());

        let mut divergence = FxHashMap::default();
        divergence.insert("A".to_string(), set_of(&["ot1"]));
        divergence.insert("B".to_string(), set_of(&["ot1"]));

        let mut related = FxHashMap::default();
        related.insert("A".to_string(), set_of(&["ot1"]));
        related.insert("B".to_string(), set_of(&["ot1"]));

        let global = make_global_data(divergence, related);

        let partitions = vec![vec!["A".to_string()], vec!["B".to_string()]];
        assert!(!is_sequence_cut_valid(&local, &global, &partitions));
    }

    #[test]
    fn invalid_when_non_divergent_lacks_forward_closure() {
        // Non-divergent ot1 but closure lacks forward A->B.
        let mut clos = FxHashMap::default();
        clos.insert(
            "ot1".to_string(),
            [("B".to_string(), "A".to_string())]
                .into_iter()
                .collect(),
        );

        let local = make_local_data(&["A", "B"], &["ot1"], FxHashMap::default(), clos);

        let mut related = FxHashMap::default();
        related.insert("A".to_string(), set_of(&["ot1"]));
        related.insert("B".to_string(), set_of(&["ot1"]));

        let global = make_global_data(FxHashMap::default(), related);

        let partitions = vec![vec!["A".to_string()], vec!["B".to_string()]];
        assert!(!is_sequence_cut_valid(&local, &global, &partitions));
    }
}
