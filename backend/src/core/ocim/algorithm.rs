use crate::models::ocel::Ocel;
use crate::models::ocpt::{OCPTNode, OCPT};
use std::collections::HashSet;

pub fn ocim_discover_ocpt(log: &Ocel) -> OCPT {
    let objects: HashSet<String> = log
        .events
        .values()
        .flat_map(|event| event.omap.iter().map(|o| o.to_string()))
        .collect();
    let root_node = ocim_recursive(vec![log], &objects);
    OCPT::new(root_node)
}

fn ocim_recursive(logs: Vec<&Ocel>, objects: &HashSet<String>) -> OCPTNode {
    // TODO: Implement the recursive logic of the OCIM algorithm
    // For now, returning a dummy leaf
    OCPTNode::new_leaf(Some("DUMMY".to_string()))
}