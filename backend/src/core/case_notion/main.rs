mod advanced;
mod connected_component;
mod measures;
mod traditional;
mod utils;

use advanced::advanced_case_notion_for_ot;
use connected_component::connected_components_notion;
use measures::{
    absolute_simplicity_of_case_notion, correctness_of_case_notion,
    extended_simplicity_of_case_notion, fuzzy_homogeneity_of_case_notion,
    fuzzy_homogeneity_of_case_notion_v2, normal_simplicity_of_case_notion,
    strict_homogeneity_of_case_notion,
};
use traditional::traditional_case_notion_for_ot;
use utils::{
    build_event_identifiers, build_object_identifiers, detect_diverging_object_types,
    map_object_id_to_type,
};

use anyhow::{Context, Result, anyhow};
use process_mining::{OCEL, import_ocel_json_from_path, import_ocel_xml_file};
use rayon::prelude::*;
use rustc_hash::{FxHashMap, FxHashSet};
use serde::Serialize;
use std::{
    cmp::Ordering,
    collections::BTreeSet,
    env,
    fs::File,
    io::{self, BufWriter},
    path::{Path, PathBuf},
    time::Instant,
};

#[derive(Serialize)]
struct Measure {
    name: String,
    value: f64,
}

#[derive(Serialize)]
struct ResultCaseNotion {
    case_notion: String,
    name_of_event_log: String,
    object_type: String,
    measures: Vec<Measure>,
    total_score: f64,
}

#[derive(Serialize)]
struct RuntimeCaseNotion {
    name_of_event_log: String,
    time: f64,
    method: String,
    case_notions: Vec<ResultCaseNotion>,
}

#[derive(Serialize)]
struct CaseNotionArch {
    source: String,
    target: String,
}

#[derive(Serialize)]
struct CaseNotionCase {
    events: Vec<String>,
    objects: Vec<String>,
    arches: Vec<CaseNotionArch>,
}

#[derive(Serialize)]
struct CaseNotionGraphOutput {
    case_notion: String,
    name_of_event_log: String,
    object_type: String,
    cases: Vec<CaseNotionCase>,
}

struct CaseNotionComputation {
    results: Vec<ResultCaseNotion>,
    graphs: Vec<CaseNotionGraphOutput>,
}

struct MethodExecution {
    runtime: RuntimeCaseNotion,
    graphs: Vec<CaseNotionGraphOutput>,
}

#[derive(Clone, Copy)]
enum CaseMethod {
    AdvancedMt,
    Traditional,
    ConnectedComponents,
}

impl CaseMethod {
    fn key(self) -> &'static str {
        match self {
            CaseMethod::AdvancedMt => "acn_mt",
            CaseMethod::Traditional => "tdcn",
            CaseMethod::ConnectedComponents => "cccn",
        }
    }

    fn case_label(self) -> &'static str {
        match self {
            CaseMethod::AdvancedMt => "Advanced Case Notion (Multi-Threaded)",
            CaseMethod::Traditional => "Traditional Case Notion",
            CaseMethod::ConnectedComponents => "Connected Components Case Notion",
        }
    }

    fn file_suffix(self) -> &'static str {
        self.key()
    }
}

fn main() {
    if let Err(err) = run() {
        eprintln!("Error: {err:?}");
        std::process::exit(1);
    }
}

fn run() -> Result<()> {
    let log_path = obtain_input_path()?;
    if !log_path.exists() {
        return Err(anyhow!("input path does not exist: {}", log_path.display()));
    }

    let log = load_log(&log_path)?;
    let log_name = extract_log_name(&log_path)?;
    let log_name_slug = sanitize_for_file_name(&log_name);

    println!("Loaded log \"{log_name}\" from {}", log_path.display());

    let methods = [
        CaseMethod::AdvancedMt,
        CaseMethod::Traditional,
        CaseMethod::ConnectedComponents,
    ];

    let mut runtime_results = Vec::new();

    for &method in &methods {
        println!("Executing {}...", method.case_label());
        let method_execution = execute_method(&log, &log_name, method);
        let output_name = format!("{log_name_slug}_{}.json", method.file_suffix());
        write_json(
            &method_execution.runtime.case_notions,
            Path::new(&output_name),
        )
        .with_context(|| format!("failed to write results for {}", method.key()))?;
        println!("  wrote {}", output_name);

        let graph_output_name = format!("{log_name_slug}_{}_graphs.json", method.file_suffix());
        write_json(&method_execution.graphs, Path::new(&graph_output_name))
            .with_context(|| format!("failed to write graph data for {}", method.key()))?;
        println!("  wrote {}", graph_output_name);

        runtime_results.push(method_execution.runtime);
    }

    let summary_file = format!("{log_name_slug}_summary.json");
    write_json(&runtime_results, Path::new(&summary_file))
        .context("failed to write runtime summary")?;
    println!("Summary written to {summary_file}");

    Ok(())
}

fn execute_method(log: &OCEL, log_name: &str, method: CaseMethod) -> MethodExecution {
    let log_clone = log.clone();
    let start = Instant::now();
    let computation = execute_case_notion(log_clone, log_name, method);
    let elapsed = start.elapsed().as_secs_f64();

    let runtime = RuntimeCaseNotion {
        name_of_event_log: log_name.to_string(),
        time: elapsed,
        method: method.key().to_string(),
        case_notions: computation.results,
    };

    MethodExecution {
        runtime,
        graphs: computation.graphs,
    }
}

fn execute_case_notion(
    log_res_ocel: OCEL,
    log_name: &str,
    method: CaseMethod,
) -> CaseNotionComputation {
    let total_number_of_events = log_res_ocel.events.len();
    let total_number_of_objects = log_res_ocel.objects.len();

    let obj_id_to_type = map_object_id_to_type(&log_res_ocel.objects);
    let unique_object_types: FxHashSet<String> = log_res_ocel
        .object_types
        .iter()
        .map(|o| o.name.clone())
        .collect();
    let unique_activities: FxHashSet<String> = log_res_ocel
        .event_types
        .iter()
        .map(|e| e.name.clone())
        .collect();

    let event_identifiers =
        build_event_identifiers(&log_res_ocel.events, &obj_id_to_type, &unique_object_types);
    let object_identifiers = build_object_identifiers(&log_res_ocel.objects, &log_res_ocel.events);

    let cleaned_event_identifiers: FxHashMap<String, (String, BTreeSet<String>)> =
        event_identifiers
            .iter()
            .map(|(id, (activity, objects, _))| (id.clone(), (activity.clone(), objects.clone())))
            .collect();

    let mut arches: FxHashSet<(String, String)> = FxHashSet::default();
    for (event_id, (_, object_ids)) in &cleaned_event_identifiers {
        for object_id in object_ids {
            arches.insert((event_id.clone(), object_id.clone()));
        }
    }

    let mut sorted_object_types: Vec<String> = unique_object_types.iter().cloned().collect();
    sorted_object_types.sort();

    match method {
        CaseMethod::AdvancedMt => {
            let divergence_map = detect_diverging_object_types(
                &event_identifiers,
                &unique_object_types,
                &unique_activities,
            );
            let case_label = method.case_label().to_string();
            let log_name_owned = log_name.to_string();

            let mut outputs: Vec<(ResultCaseNotion, CaseNotionGraphOutput)> = sorted_object_types
                .par_iter()
                .map(|object_type| {
                    let case_notion = advanced_case_notion_for_ot(
                        &cleaned_event_identifiers,
                        &object_identifiers,
                        object_type.clone(),
                        &divergence_map,
                    );

                    let measures = calculate_measures(
                        &case_notion,
                        &event_identifiers,
                        &object_identifiers,
                        &arches,
                        total_number_of_objects,
                        total_number_of_events,
                    );
                    let total_score = average_score(&measures);

                    let result = ResultCaseNotion {
                        case_notion: case_label.clone(),
                        name_of_event_log: log_name_owned.clone(),
                        object_type: object_type.clone(),
                        measures,
                        total_score,
                    };

                    let graph_output = CaseNotionGraphOutput {
                        case_notion: case_label.clone(),
                        name_of_event_log: log_name_owned.clone(),
                        object_type: object_type.clone(),
                        cases: case_notion_to_cases(&case_notion),
                    };

                    (result, graph_output)
                })
                .collect();

            outputs.sort_by(|a, b| a.0.object_type.cmp(&b.0.object_type));
            let (results, graphs): (Vec<_>, Vec<_>) = outputs.into_iter().unzip();

            CaseNotionComputation { results, graphs }
        }
        CaseMethod::Traditional => {
            let case_label = method.case_label().to_string();
            let log_name_owned = log_name.to_string();
            let mut results = Vec::new();
            let mut graphs = Vec::new();

            for object_type in &sorted_object_types {
                let case_notion =
                    traditional_case_notion_for_ot(&object_identifiers, object_type.clone());

                let measures = calculate_measures(
                    &case_notion,
                    &event_identifiers,
                    &object_identifiers,
                    &arches,
                    total_number_of_objects,
                    total_number_of_events,
                );
                let total_score = average_score(&measures);

                results.push(ResultCaseNotion {
                    case_notion: case_label.clone(),
                    name_of_event_log: log_name_owned.clone(),
                    object_type: object_type.clone(),
                    measures,
                    total_score,
                });

                graphs.push(CaseNotionGraphOutput {
                    case_notion: case_label.clone(),
                    name_of_event_log: log_name_owned.clone(),
                    object_type: object_type.clone(),
                    cases: case_notion_to_cases(&case_notion),
                });
            }

            CaseNotionComputation { results, graphs }
        }
        CaseMethod::ConnectedComponents => {
            let case_label = method.case_label().to_string();
            let log_name_owned = log_name.to_string();
            let case_notion = connected_components_notion(
                cleaned_event_identifiers.clone(),
                object_identifiers.clone(),
            );

            let measures = calculate_measures(
                &case_notion,
                &event_identifiers,
                &object_identifiers,
                &arches,
                total_number_of_objects,
                total_number_of_events,
            );
            let total_score = average_score(&measures);

            let results = vec![ResultCaseNotion {
                case_notion: case_label.clone(),
                name_of_event_log: log_name_owned.clone(),
                object_type: "None".to_string(),
                measures,
                total_score,
            }];

            let graphs = vec![CaseNotionGraphOutput {
                case_notion: case_label,
                name_of_event_log: log_name_owned,
                object_type: "None".to_string(),
                cases: case_notion_to_cases(&case_notion),
            }];

            CaseNotionComputation { results, graphs }
        }
    }
}

fn calculate_measures(
    case_notion: &FxHashSet<(Vec<String>, Vec<String>, Vec<(String, String)>)>,
    event_identifiers: &FxHashMap<
        String,
        (
            String,
            BTreeSet<String>,
            FxHashMap<String, BTreeSet<String>>,
        ),
    >,
    object_identifiers: &FxHashMap<String, (String, Vec<String>)>,
    arches: &FxHashSet<(String, String)>,
    total_number_of_objects: usize,
    total_number_of_events: usize,
) -> Vec<Measure> {
    let normal_simplicity = normal_simplicity_of_case_notion(
        case_notion,
        total_number_of_events,
        total_number_of_objects,
    );
    let extended_simplicity = extended_simplicity_of_case_notion(
        case_notion,
        total_number_of_events,
        total_number_of_objects,
        0.6,
        20,
    );
    let absolute_simplicity = absolute_simplicity_of_case_notion(case_notion, 0.8, 10);
    let correctness = correctness_of_case_notion(
        case_notion,
        arches,
        total_number_of_events,
        total_number_of_objects,
    );
    let fuzzy_homogeneity =
        fuzzy_homogeneity_of_case_notion(case_notion, event_identifiers, object_identifiers);
    let fuzzy_homogeneity_v2 =
        fuzzy_homogeneity_of_case_notion_v2(case_notion, event_identifiers, object_identifiers);
    let strict_homogeneity =
        strict_homogeneity_of_case_notion(case_notion, event_identifiers, object_identifiers);

    vec![
        Measure {
            name: "Normal Simplicity".to_string(),
            value: normal_simplicity,
        },
        Measure {
            name: "Extended Simplicity".to_string(),
            value: extended_simplicity,
        },
        Measure {
            name: "Absolute Simplicity".to_string(),
            value: absolute_simplicity,
        },
        Measure {
            name: "Correctness".to_string(),
            value: correctness,
        },
        Measure {
            name: "Fuzzy Homogeneity".to_string(),
            value: fuzzy_homogeneity,
        },
        Measure {
            name: "Fuzzy Homogeneity V2".to_string(),
            value: fuzzy_homogeneity_v2,
        },
        Measure {
            name: "Strict Homogeneity".to_string(),
            value: strict_homogeneity,
        },
    ]
}

fn average_score(measures: &[Measure]) -> f64 {
    if measures.is_empty() {
        0.0
    } else {
        measures.iter().map(|m| m.value).sum::<f64>() / measures.len() as f64
    }
}

fn case_notion_to_cases(
    case_notion: &FxHashSet<(Vec<String>, Vec<String>, Vec<(String, String)>)>,
) -> Vec<CaseNotionCase> {
    let mut cases: Vec<CaseNotionCase> = case_notion
        .iter()
        .map(|(events, objects, arches)| {
            let mut events_sorted = events.clone();
            events_sorted.sort();

            let mut objects_sorted = objects.clone();
            objects_sorted.sort();

            let mut edges: Vec<CaseNotionArch> = arches
                .iter()
                .map(|(source, target)| CaseNotionArch {
                    source: source.clone(),
                    target: target.clone(),
                })
                .collect();
            edges.sort_by(|a, b| {
                let mut ordering = a.source.cmp(&b.source);
                if ordering == Ordering::Equal {
                    ordering = a.target.cmp(&b.target);
                }
                ordering
            });

            CaseNotionCase {
                events: events_sorted,
                objects: objects_sorted,
                arches: edges,
            }
        })
        .collect();

    cases.sort_by(|a, b| {
        let mut ordering = a.events.cmp(&b.events);
        if ordering == Ordering::Equal {
            ordering = a.objects.cmp(&b.objects);
        }
        ordering
    });

    cases
}

fn write_json<T: Serialize>(value: &T, output_path: &Path) -> Result<()> {
    let file =
        File::create(output_path).with_context(|| format!("create {}", output_path.display()))?;
    let writer = BufWriter::new(file);
    serde_json::to_writer_pretty(writer, value)
        .with_context(|| format!("serialize {}", output_path.display()))?;
    Ok(())
}

fn obtain_input_path() -> Result<PathBuf> {
    if let Some(arg) = env::args().nth(1) {
        Ok(PathBuf::from(arg))
    } else {
        println!("Enter path to OCEL log (.json/.xml/.xmlocel):");
        let mut input = String::new();
        io::stdin()
            .read_line(&mut input)
            .context("failed to read path from stdin")?;
        let trimmed = input.trim();
        if trimmed.is_empty() {
            Err(anyhow!("no log path provided"))
        } else {
            Ok(PathBuf::from(trimmed))
        }
    }
}

fn load_log(path: &Path) -> Result<OCEL> {
    let path_str = path
        .to_str()
        .context("input path contains invalid UTF-8 characters")?;
    let ext = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "json" => import_ocel_json_from_path(path_str)
            .with_context(|| format!("failed to import json log {}", path.display())),
        "xml" | "xmlocel" => Ok(import_ocel_xml_file(path_str)),
        other => Err(anyhow!("unsupported log extension: {other}")),
    }
}

fn extract_log_name(path: &Path) -> Result<String> {
    path.file_stem()
        .and_then(|stem| stem.to_str())
        .map(|s| s.to_string())
        .ok_or_else(|| anyhow!("failed to derive log name from {}", path.display()))
}

fn sanitize_for_file_name(input: &str) -> String {
    input
        .chars()
        .map(|c| {
            if matches!(c, 'a'..='z' | 'A'..='Z' | '0'..='9' | '_' | '-') {
                c
            } else {
                '_'
            }
        })
        .collect()
}
