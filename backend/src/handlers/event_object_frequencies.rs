use crate::core::event_object_frequencies::{
    histogram_builder::build_event_object_histograms, histogram_filtering::filter_ocel_histograms,
};

use crate::models::ocel::OCEL;
use axum::{
    extract::Path as AxumPath,
    http::StatusCode,
    response::IntoResponse,
    Json as AxumJson,
};
use serde_json::Value;
use tokio::fs as tokio_fs;
use uuid::Uuid;

/// GET /v1/event_object_frequencies/histogram/:file_id
/// Returns: JSON object containing event-object frequency histograms
pub async fn get_event_object_frequencies(
    AxumPath(ocel_file_id): AxumPath<String>,
) -> impl IntoResponse {
    let ocel_path = format!("./temp/ocel_v2_{}.json", ocel_file_id);

    let ocel_data: String = match tokio_fs::read_to_string(&ocel_path).await {
        Ok(s) => s,
        Err(e) => {
            return (
                StatusCode::NOT_FOUND,
                format!("OCEL not found at {}: {}", ocel_path, e),
            )
                .into_response();
        }
    };

    let ocel: OCEL = match serde_json::from_str(&ocel_data) {
        Ok(o) => o,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                format!("Failed to parse OCEL JSON ({}): {}", ocel_path, e),
            )
                .into_response();
        }
    };

    let histogram = build_event_object_histograms(&ocel);

    (StatusCode::OK, AxumJson(histogram)).into_response()
}

/// POST /v1/event_object_frequencies/histogram_filter/:file_id
/// Body: JSON following the `SelectionPayload` scheme
/// Returns: array of ids, each corresonding to one stored OCEL per provided filter mask
pub async fn post_ocel_filter(
    AxumPath(ocel_file_id): AxumPath<String>,
    AxumJson(selection_json): AxumJson<Value>,
) -> Result<AxumJson<Vec<String>>, (StatusCode, String)> {
    let ocel_path = format!("./temp/ocel_v2_{}.json", ocel_file_id);

    // 1. Load the OCEL
    let ocel_data: String = match tokio_fs::read_to_string(&ocel_path).await {
        Ok(s) => s,
        Err(e) => {
            return Err((
                StatusCode::NOT_FOUND,
                format!("OCEL not found at {}: {}", ocel_path, e),
            ));
        }
    };

    let ocel: OCEL = match serde_json::from_str(&ocel_data) {
        Ok(o) => o,
        Err(e) => {
            return Err((
                StatusCode::BAD_REQUEST,
                format!("Failed to parse OCEL JSON {}: {}", ocel_path, e),
            ));
        }
    };

    // 2. Call filtering function
    let filtered_ocels = match serde_json::to_string(&selection_json) {
        Ok(json_str) => filter_ocel_histograms(&ocel, &json_str),
        Err(e) => {
            return Err((
                StatusCode::BAD_REQUEST,
                format!("Failed to serialize selection JSON: {}", e),
            ));
        }
    };

    let mut ids = Vec::new();

    for ocel in &filtered_ocels {
        let export_id = Uuid::new_v4().to_string();
        let filename = format!("./temp/ocel_v2_{}.json", &export_id);

        let data = serde_json::to_string_pretty(ocel).map_err(|err| {
            eprintln!("serialize filtered OCEL failed: {err}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to serialize OCELs".to_string(),
            )
        })?;

        tokio_fs::write(&filename, data).await.map_err(|err| {
            eprintln!("write case notion OCELs failed: {err}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to persist case notion OCELs".to_string(),
            )
        })?;

        ids.push(export_id);
    }

    // 3. Return JSON array of filtered OCELs
    Ok(AxumJson(ids))
}
