use crate::core::case_notion::main::{
    CaseMeasure, CaseNotionCase, CaseNotionContext, CaseNotionEvaluation,
    best_advanced_case_notion, best_traditional_case_notion, case_notion_to_cases,
    case_notion_to_ocels, connected_components_case_notion, sanitize_for_file_name, calculate_measures, average_score, f1_from_measures,
};
use crate::traits::import_export::ImportableFromPath;
use crate::core::case_notion::generic::generic_case_notion;
use crate::models::case_notion::GenericCaseNotion;
use crate::models::ocel::OCEL;
use axum::{
    Json,
    extract::{Path, Query},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use serde_json;
use tokio::fs;
use uuid::Uuid;


#[derive(Deserialize)]
pub(crate) struct CaseNotionQuery {
    object_type: Option<String>,
}

#[derive(Serialize)]
struct CaseNotionResponse {
    case_notion: &'static str,
    file_id: String,
    export_id: String,
    object_type: Option<String>,
    cases: Vec<CaseNotionCase>,
    measures: Vec<CaseMeasure>,
    total_score: f64,
    f1_score: Option<f64>,
    saved_as: String,
}

#[derive(Serialize)]
struct CaseOcelFile {
    case_notion: &'static str,
    export_id: String,
    file_id: String,
    object_type: Option<String>,
    measures: Vec<CaseMeasure>,
    total_score: f64,
    f1_score: Option<f64>,
    cases: Vec<OCEL>,
}

enum ObjectTypeSelection {
    Default,
    Specific(String),
}

impl ObjectTypeSelection {
    fn from_query_param(param: Option<String>) -> Self {
        match param {
            Some(value) => {
                let trimmed = value.trim();
                if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("default") {
                    ObjectTypeSelection::Default
                } else {
                    ObjectTypeSelection::Specific(trimmed.to_string())
                }
            }
            None => ObjectTypeSelection::Default,
        }
    }

    fn as_option(&self) -> Option<&str> {
        match self {
            ObjectTypeSelection::Default => None,
            ObjectTypeSelection::Specific(value) => Some(value.as_str()),
        }
    }
}


#[derive(Clone, Copy)]
enum CaseKind {
    Advanced,
    ConnectedComponents,
    Traditional,
}

impl CaseKind {
    fn key(self) -> &'static str {
        match self {
            CaseKind::Advanced => "acn_mt",
            CaseKind::ConnectedComponents => "cccn",
            CaseKind::Traditional => "tdcn",
        }
    }

    fn label(self) -> &'static str {
        match self {
            CaseKind::Advanced => "Advanced Case Notion",
            CaseKind::ConnectedComponents => "Connected Components Case Notion",
            CaseKind::Traditional => "Traditional Case Notion",
        }
    }
}

fn not_found_response(kind: CaseKind, selection: &ObjectTypeSelection) -> (StatusCode, String) {
    let message = match kind {
        CaseKind::Advanced => match selection {
            ObjectTypeSelection::Default => {
                "No advanced case notion could be derived for any object type".to_string()
            }
            ObjectTypeSelection::Specific(value) => format!(
                "No advanced case notion could be derived for object type: {}",
                value
            ),
        },
        CaseKind::Traditional => match selection {
            ObjectTypeSelection::Default => {
                "No traditional case notion could be derived for any object type".to_string()
            }
            ObjectTypeSelection::Specific(value) => format!(
                "No traditional case notion could be derived for object type: {}",
                value
            ),
        },
        CaseKind::ConnectedComponents => unreachable!(
            "not_found_response should not be called for connected components case notion"
        ),
    };

    (StatusCode::NOT_FOUND, message)
}

pub async fn get_advanced_case_notion(
    Path(file_id): Path<String>,
    Query(query): Query<CaseNotionQuery>,
) -> impl IntoResponse {
    let selection = ObjectTypeSelection::from_query_param(query.object_type);
    match compute_response(CaseKind::Advanced, file_id, selection).await {
        Ok(payload) => (StatusCode::OK, Json(payload)).into_response(),
        Err((status, msg)) => (status, msg).into_response(),
    }
}

pub async fn get_connected_components_case_notion(
    Path(file_id): Path<String>,
) -> impl IntoResponse {
    match compute_response(
        CaseKind::ConnectedComponents,
        file_id,
        ObjectTypeSelection::Default,
    )
    .await
    {
        Ok(payload) => (StatusCode::OK, Json(payload)).into_response(),
        Err((status, msg)) => (status, msg).into_response(),
    }
}

pub async fn get_traditional_case_notion(
    Path(file_id): Path<String>,
    Query(query): Query<CaseNotionQuery>,
) -> impl IntoResponse {
    let selection = ObjectTypeSelection::from_query_param(query.object_type);
    match compute_response(CaseKind::Traditional, file_id, selection).await {
        Ok(payload) => (StatusCode::OK, Json(payload)).into_response(),
        Err((status, msg)) => (status, msg).into_response(),
    }
}

pub async fn post_generic_case_notion(
    Path(file_id): Path<String>,
    Json(payload): Json<GenericCaseNotion>,
) -> Result<impl IntoResponse, (StatusCode, String)> { 
    log::debug!("Received GenericCaseNotion for file_id: {}", file_id);
    log::debug!("Payload: {:?}", payload);
    let ocel = OCEL::import_from_path(&file_id).await?;

    let case_notion = generic_case_notion(&ocel, &payload);

    log::debug!("case_notion: {:?}", case_notion);

    let context = CaseNotionContext::new(&ocel);
    let measures = calculate_measures(
        &case_notion,
        &context.event_identifiers_ref(),
        &context.object_identifiers_ref(),
        &context.arches_ref(),
        *context.total_number_of_objects_ref(),
        *context.total_number_of_events_ref(),
    );
    let total_score = average_score(&measures);
    let f1_score = f1_from_measures(&measures);

    log::debug!("measures: {:?}", measures);

    let evaluation = CaseNotionEvaluation {
        object_type: None,
        measures: measures.clone(),
        total_score,
        f1_score,
        case_notion,
    };
    
    Ok(axum::Json(measures))

}

async fn compute_response(
    kind: CaseKind,
    file_id: String,
    selection: ObjectTypeSelection,
) -> Result<CaseNotionResponse, (StatusCode, String)> {
    let path = format!("./temp/ocel_v2_{}.json", file_id);
    let content = fs::read_to_string(&path).await.map_err(|err| {
        eprintln!("read OCEL log failed: {err}");
        if err.kind() == std::io::ErrorKind::NotFound {
            (
                StatusCode::NOT_FOUND,
                format!("No OCEL v2 file found for fileId: {}", file_id),
            )
        } else {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to read stored OCEL log".to_string(),
            )
        }
    })?;

    let ocel: OCEL = serde_json::from_str(&content).map_err(|err| {
        eprintln!("parse OCEL log failed: {err}");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Stored OCEL log is not valid JSON".to_string(),
        )
    })?;

    let context = CaseNotionContext::new(&ocel);

    let evaluation = match kind {
        CaseKind::Advanced => best_advanced_case_notion(&context, selection.as_option())
            .ok_or_else(|| not_found_response(kind, &selection))?,
        CaseKind::Traditional => best_traditional_case_notion(&context, selection.as_option())
            .ok_or_else(|| not_found_response(kind, &selection))?,
        CaseKind::ConnectedComponents => connected_components_case_notion(&context),
    };

    build_response(kind, file_id, evaluation, &context).await
}

async fn build_response(
    kind: CaseKind,
    file_id: String,
    evaluation: CaseNotionEvaluation,
    context: &CaseNotionContext,
) -> Result<CaseNotionResponse, (StatusCode, String)> {
    let cases = case_notion_to_cases(&evaluation.case_notion);
    let ocels = case_notion_to_ocels(
        &evaluation.case_notion,
        context.cleaned_event_identifiers(),
        context.object_identifiers(),
        context.event_type_defs(),
        context.object_type_defs(),
        context.default_timestamp(),
        context.event_lookup(),
        context.object_lookup(),
    );

    let (export_id, saved_as) = persist_case_ocels(&file_id, kind, &evaluation, ocels).await?;

    Ok(CaseNotionResponse {
        case_notion: kind.label(),
        file_id,
        export_id,
        object_type: evaluation.object_type.clone(),
        cases,
        measures: evaluation.measures.clone(),
        total_score: evaluation.total_score,
        f1_score: evaluation.f1_score,
        saved_as,
    })
}

async fn persist_case_ocels(
    file_id: &str,
    kind: CaseKind,
    evaluation: &CaseNotionEvaluation,
    ocels: Vec<OCEL>,
) -> Result<(String, String), (StatusCode, String)> {
    ensure_temp_dir().await?;

    let export_id = Uuid::new_v4().to_string();
    let mut filename = format!("./temp/case_notion_{}_{}", kind.key(), &export_id);
    if let Some(object_type) = evaluation.object_type.as_deref() {
        filename.push('_');
        filename.push_str(&sanitize_for_file_name(object_type));
    }
    filename.push_str(".json");

    let payload = CaseOcelFile {
        case_notion: kind.label(),
        export_id: export_id.clone(),
        file_id: file_id.to_string(),
        object_type: evaluation.object_type.clone(),
        measures: evaluation.measures.clone(),
        total_score: evaluation.total_score,
        f1_score: evaluation.f1_score,
        cases: ocels,
    };

    let data = serde_json::to_string_pretty(&payload).map_err(|err| {
        eprintln!("serialize case notion OCELs failed: {err}");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to serialize case notion OCELs".to_string(),
        )
    })?;

    fs::write(&filename, data).await.map_err(|err| {
        eprintln!("write case notion OCELs failed: {err}");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to persist case notion OCELs".to_string(),
        )
    })?;

    Ok((export_id, filename))
}

async fn ensure_temp_dir() -> Result<(), (StatusCode, String)> {
    fs::create_dir_all("./temp").await.map_err(|err| {
        eprintln!("prepare temp dir failed: {err}");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to prepare temp directory".to_string(),
        )
    })
}
