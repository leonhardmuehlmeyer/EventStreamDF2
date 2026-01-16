use std::collections::HashSet;

use crate::models::ocpt::HierarchyNode;

use super::{check_relation, Relation};

fn collect_activities(node: &HierarchyNode, out: &mut HashSet<String>) {
    match node {
        HierarchyNode::Activity { value } => {
            out.insert(value.activity.clone());
        }
        HierarchyNode::Operator { children, .. } => {
            for child in children {
                collect_activities(child, out);
            }
        }
    }
}

fn build_candidates(relations: &[Relation]) -> Vec<HashSet<String>> {
    let mut seen: HashSet<String> = HashSet::new();
    let mut ordered: Vec<String> = Vec::new();

    for (_eid, _activity, _timestamp, _oid, otype) in relations {
        if seen.insert(otype.clone()) {
            ordered.push(otype.clone());
        }
    }

    ordered
        .into_iter()
        .map(|otype| {
            let mut set = HashSet::new();
            set.insert(otype);
            set
        })
        .collect()
}

pub fn get_extended_ocpt(
    ocpt: &HierarchyNode,
    relations: &[Relation],
    candidates: Option<Vec<HashSet<String>>>,
) -> HierarchyNode {
    match ocpt {
        HierarchyNode::Activity { .. } => ocpt.clone(),
        HierarchyNode::Operator { value, children } => {
            let mut candidates = candidates.unwrap_or_else(|| build_candidates(relations));
            if candidates.is_empty() {
                candidates = build_candidates(relations);
            }

            let mut activities = HashSet::new();
            collect_activities(ocpt, &mut activities);

            for ot1 in &candidates {
                for ot2 in &candidates {
                    if ot1 == ot2 {
                        continue;
                    }

                    let mut union_types = ot1.clone();
                    union_types.extend(ot2.iter().cloned());

                    let sub_relations: Vec<Relation> = relations
                        .iter()
                        .filter(|(_eid, activity, _timestamp, _oid, otype)| {
                            activities.contains(activity) && union_types.contains(otype)
                        })
                        .cloned()
                        .collect();

                    if let Some(operator) = check_relation(ot1, ot2, &sub_relations) {
                        let mut next_candidates: Vec<HashSet<String>> = candidates
                            .iter()
                            .filter(|set| *set != ot1 && *set != ot2)
                            .cloned()
                            .collect();
                        next_candidates.push(union_types);

                        return HierarchyNode::Operator {
                            value: operator,
                            children: vec![get_extended_ocpt(
                                ocpt,
                                relations,
                                Some(next_candidates),
                            )],
                        };
                    }
                }
            }

            let extended_children = children
                .iter()
                .map(|child| get_extended_ocpt(child, relations, Some(candidates.clone())))
                .collect();

            HierarchyNode::Operator {
                value: value.clone(),
                children: extended_children,
            }
        }
    }
}
