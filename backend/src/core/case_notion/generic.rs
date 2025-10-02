use process_mining::OCEL;
use process_mining::ocel::ocel_struct::OCELType;


use std::collections::{HashMap, HashSet};

fn generic_notion(
    log: &OCEL,
    start_types: &Vec<OCELType>,
    o2o_relations: &Vec<(OCELType, OCELType)>,
    e2o_relations: &Vec<(OCELType, OCELType)>
) -> Vec<OCEL>{
    let mut result = vec![];

    // used to make lookups faster
    let start_type_names: HashSet<_> = start_types.iter().map(|t| &t.name).collect();

    let mut start_objects: Vec<_> = log.objects
        .iter()
        .filter(|obj| start_type_names.contains(&obj.object_type))
        .collect();

    let o2o_map = build_o2o_map(log, o2o_relations);
    let e2o_map = build_e2o_map(log, e2o_relations);
    let o2e_map = build_o2e_map(log, e2o_relations);


    while !start_objects.is_empty() {
        let mut events: HashSet<&String> = HashSet::new();
        let mut objects: HashSet<&String> = HashSet::new();

        let mut events_to_analyse: HashSet<&String> = HashSet::new();
        let mut objects_to_analyse: HashSet<&String> = HashSet::new();

        let o = start_objects.pop().unwrap();
        objects.insert(&o.id);
        objects_to_analyse.insert(&o.id);

        loop {
            let mut new_objects: HashSet<&String> = HashSet::new();
            let mut new_events: HashSet<&String>  = HashSet::new();

            // Step 1: from objects → other objects (O2O)
            for obj_id in &objects_to_analyse {
                if let Some(neigh) = o2o_map.get(*obj_id) {
                    for o in neigh {
                        if objects.insert(o) {
                            new_objects.insert(o);
                        }
                    }
                }
            }

            // Step 2: from objects → events (O2E)
            for obj_id in &objects_to_analyse {
                if let Some(evns) = o2e_map.get(*obj_id) {
                    for e in evns {
                        if events.insert(e) {
                            new_events.insert(e);
                        }
                    }
                }
            }

            // Step 3: from events → objects (E2O)
            for evn_id in &events_to_analyse {
                if let Some(objs) = e2o_map.get(*evn_id) {
                    for o in objs {
                        if objects.insert(o) {
                            new_objects.insert(o);
                        }
                    }
                }
            }

            // Update frontier sets
            if new_objects.is_empty() && new_events.is_empty() {
                break; // nothing new discovered → convergence
            }

            objects_to_analyse = new_objects;
            events_to_analyse = new_events;
        }

        // Create a new OCEL log from the collected events and objects
        let case = build_case(log, &events, &objects);

        // Append the new log to the result
        result.push(case);

    }
    result
}


/// HELPER FUNCTION
/// Build a lookup map for fast O2O traversal.
/// For each object ID `o'`, store the IDs of objects `o` such that
/// `(o, o')` ∈ O2O and `(ω(o), ω(o'))` ∈ rel.
pub fn build_o2o_map(
    log: &OCEL,
    o2o_relations: &Vec<(OCELType, OCELType)>,
) -> HashMap<String, Vec<String>> {
    // Precompute allowed type-pairs (by name, not struct)
    let allowed: HashMap<&str, Vec<&str>> = {
        let mut map: HashMap<&str, Vec<&str>> = HashMap::new();
        for (src, tgt) in o2o_relations {
            map.entry(&tgt.name)
                .or_default()
                .push(&src.name);
        }
        map
    };

    // Build a lookup: object_id -> object_type
    let type_of: HashMap<&str, &str> =
        log.objects.iter().map(|o| (o.id.as_str(), o.object_type.as_str())).collect();

    // Result map: for each o', which o’s are reachable
    let mut o2o_map: HashMap<String, Vec<String>> = HashMap::new();

    for o in &log.objects {
        let o_type = o.object_type.as_str();
        for rel in &o.relationships {
            if let Some(tgt_type) = type_of.get(rel.object_id.as_str()) {
                // (ω(o), ω(o′)) ∈ rel ?
                if let Some(allowed_sources) = allowed.get(tgt_type) {
                    if allowed_sources.contains(&o_type) {
                        o2o_map
                            .entry(rel.object_id.clone()) // key = o'
                            .or_default()
                            .push(o.id.clone()); // value = o
                    }
                }
            }
        }
    }

    o2o_map
}

/// HELPER FUNCTION
/// Build a lookup map for fast E2O traversal.
/// For each event ID `e`, store the IDs of objects `o` such that
/// `(e, o)` ∈ E2O and `(π_act(e), ω(o))` ∈ rel.
pub fn build_e2o_map(
    log: &OCEL,
    e2o_relations: &Vec<(OCELType, OCELType)>,
) -> HashMap<String, Vec<String>> {
    // Precompute allowed pairs: event_type -> allowed object_types
    let allowed: HashMap<&str, Vec<&str>> = {
        let mut map: HashMap<&str, Vec<&str>> = HashMap::new();
        for (evt, obj) in e2o_relations {
            map.entry(&evt.name)
                .or_default()
                .push(&obj.name);
        }
        map
    };

    // Object lookup: object_id -> object_type
    let type_of: HashMap<&str, &str> =
        log.objects.iter().map(|o| (o.id.as_str(), o.object_type.as_str())).collect();

    // Result: event_id -> reachable objects
    let mut e2o_map: HashMap<String, Vec<String>> = HashMap::new();

    for e in &log.events {
        let evt_type = e.event_type.as_str();

        // Check if this event type has allowed object types
        if let Some(allowed_objs) = allowed.get(evt_type) {
            for rel in &e.relationships {
                if let Some(obj_type) = type_of.get(rel.object_id.as_str()) {
                    if allowed_objs.contains(obj_type) {
                        e2o_map
                            .entry(e.id.clone())
                            .or_default()
                            .push(rel.object_id.clone());
                    }
                }
            }
        }
    }

    e2o_map
}

/// HELPER FUNCTION
/// Build a lookup map for fast O→E traversal.
/// For each object ID `o`, store the IDs of events `e` such that
/// `(e, o)` ∈ E2O and `(ω(o), π_act(e))` ∈ rel.
pub fn build_o2e_map(
    log: &OCEL,
    e2o_relations: &Vec<(OCELType, OCELType)>,
) -> HashMap<String, Vec<String>> {
    // Precompute allowed pairs: object_type -> allowed event_types
    let allowed: HashMap<&str, Vec<&str>> = {
        let mut map: HashMap<&str, Vec<&str>> = HashMap::new();
        for (evt, obj) in e2o_relations {
            map.entry(&obj.name)
                .or_default()
                .push(&evt.name);
        }
        map
    };

    // Object lookup: object_id -> object_type
    let type_of: HashMap<&str, &str> =
        log.objects.iter().map(|o| (o.id.as_str(), o.object_type.as_str())).collect();

    // Result: object_id -> reachable events
    let mut o2e_map: HashMap<String, Vec<String>> = HashMap::new();

    for e in &log.events {
        let evt_type = e.event_type.as_str();

        for rel in &e.relationships {
            if let Some(obj_type) = type_of.get(rel.object_id.as_str()) {
                if let Some(allowed_evts) = allowed.get(obj_type) {
                    if allowed_evts.contains(&evt_type) {
                        o2e_map
                            .entry(rel.object_id.clone())
                            .or_default()
                            .push(e.id.clone());
                    }
                }
            }
        }
    }

    o2e_map
}


/// HELPER FUNCTION
/// Build a sub-OCEL containing only the collected events/objects and their types.
fn build_case(log: &OCEL, events: &HashSet<&String>, objects: &HashSet<&String>) -> OCEL {
    // Precompute the referenced event types
    let mut used_event_types: HashSet<&String> = HashSet::new();
    let filtered_events: Vec<_> = log.events
        .iter()
        .filter(|e| events.contains(&e.id))
        .map(|e| {
            used_event_types.insert(&e.event_type);
            e.clone()
        })
        .collect();

    // Precompute the referenced object types
    let mut used_object_types: HashSet<&String> = HashSet::new();
    let filtered_objects: Vec<_> = log.objects
        .iter()
        .filter(|o| objects.contains(&o.id))
        .map(|o| {
            used_object_types.insert(&o.object_type);
            o.clone()
        })
        .collect();

    // Filter event types and object types only once, based on the precomputed sets
    let filtered_event_types: Vec<_> = log.event_types
        .iter()
        .filter(|et| used_event_types.contains(&et.name))
        .cloned()
        .collect();

    let filtered_object_types: Vec<_> = log.object_types
        .iter()
        .filter(|ot| used_object_types.contains(&ot.name))
        .cloned()
        .collect();

    OCEL {
        events: filtered_events,
        objects: filtered_objects,
        event_types: filtered_event_types,
        object_types: filtered_object_types,
    }
}


#[cfg(test)]
mod tests {
    use super::*; 
    use std::path::PathBuf;
    use tokio;
    use tokio::fs as tokio_fs;

    #[tokio::test]
    async fn test_generic_case_notion() {
        // 1. Build the path to your OCEL JSON
        let ocel_path = PathBuf::from("../example_data/ocel/ocel_v2_123.json");

        // 2. Read the file
        let ocel_data = tokio_fs::read_to_string(&ocel_path)
            .await
            .expect("failed to read OCEL JSON file");

        // 3. Deserialize into OCEL
        let ocel: OCEL = serde_json::from_str(&ocel_data).expect("failed to parse OCEL JSON");

        // 4. Define start types and relations
        let start_types = vec![OCELType { name: "Truck".to_string(), attributes: vec![] }];
        let o2o_relations= vec![];
        let e2o_relations= vec![
            (OCELType { name: "Drive to Terminal".to_string(), attributes: vec![] },
             OCELType { name: "Truck".to_string(), attributes: vec![] }),
            (OCELType { name: "Load Truck".to_string(), attributes: vec![] },
             OCELType { name: "Truck".to_string(), attributes: vec![] }),
        ];

        // 5. Apply the generic notion function
        let cases = generic_notion(&ocel, &start_types, &o2o_relations, &e2o_relations);

        // 6. Print to console
        println!("Extracted cases:{} \n First case: \n\n", cases.len());
        //println!("{:#?}", cases[0]);
    }
}

