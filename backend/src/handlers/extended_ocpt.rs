use crate::core::identity_relations::get_extended_ocpt as extend_ocpt_with_identity_relations;
use crate::core::struct_converters::ocpt_frontend_backend::backend_to_frontend;
use crate::core::utils::relations::build_relations_from_ocels;
use crate::handlers::ocpt::{ensure_temp_dir, read_ocpt_as_backend, read_ocpt_as_frontend};
use crate::models::ocel::OCEL;
use crate::models::ocel_collection::OCELCollection;
use crate::models::ocpt::OCPT;
use crate::traits::import_export::ImportableFromPath;
use axum::extract::{Path, Query};
use axum::{Json, http::StatusCode, response::IntoResponse};
use serde::Deserialize;
use serde_json::json;
use std::io::ErrorKind;
use std::path::Path as FsPath;
use tokio::fs;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct ExtendOcptQuery {
    pub ocel_id: Option<String>,
}

async fn load_source_ocels(ocel_id: &str) -> Result<Vec<OCEL>, (StatusCode, String)> {
    match OCEL::import_from_path(ocel_id).await {
        Ok(ocel) => Ok(vec![ocel]),
        Err(ocel_err) => match OCELCollection::import_from_path(ocel_id).await {
            Ok(collection) => Ok(collection.ocels),
            Err(collection_err) => Err((
                collection_err.0,
                format!(
                    "Failed to load OCEL source '{}'. OCEL error: {}; OCEL collection error: {}",
                    ocel_id, ocel_err.1, collection_err.1
                ),
            )),
        },
    }
}

async fn persist_extended_ocpt(ocpt: &OCPT) -> Result<String, (StatusCode, String)> {
    ensure_temp_dir().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to prepare storage: {e}"),
        )
    })?;

    let file_id = Uuid::new_v4().to_string();
    let path = format!("./temp/extended_ocpt_{}.json", file_id);
    let pretty = serde_json::to_string_pretty(ocpt).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Serialize extended OCPT failed: {e}"),
        )
    })?;
    fs::write(&path, pretty).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to save extended OCPT: {e}"),
        )
    })?;

    Ok(file_id)
}

pub async fn apply_extended_ocpt(
    Path(ocpt_id): Path<String>,
    Query(query): Query<ExtendOcptQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let ocel_id = query.ocel_id.ok_or((
        StatusCode::BAD_REQUEST,
        "Missing required query parameter: ocel_id".to_string(),
    ))?;
    let ocel_id = ocel_id.trim();
    if ocel_id.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "ocel_id cannot be empty".to_string(),
        ));
    }

    let ocpt_path = format!("./temp/ocpt_{}.json", ocpt_id);
    if !FsPath::new(&ocpt_path).exists() {
        return Err((
            StatusCode::NOT_FOUND,
            format!("OCPT file not found for file_id: {}", ocpt_id),
        ));
    }

    let mut ocpt = read_ocpt_as_backend(&ocpt_path).await.map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            format!("Failed to parse OCPT '{}': {}", ocpt_id, e),
        )
    })?;

    if !ocpt.is_valid() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Source OCPT is invalid".to_string(),
        ));
    }

    let source_ocels = load_source_ocels(ocel_id).await?;
    let relations = build_relations_from_ocels(&source_ocels);
    ocpt.root = extend_ocpt_with_identity_relations(ocpt.root, &relations, None);

    let new_file_id = persist_extended_ocpt(&ocpt).await?;
    let payload = json!({
        "file_id": new_file_id,
        "extended_ocpt": backend_to_frontend(&ocpt)
    });

    Ok(Json(payload))
}

pub async fn get_extended_ocpt(Path(file_id): Path<String>) -> impl IntoResponse {
    let path = format!("./temp/extended_ocpt_{}.json", file_id);
    if !FsPath::new(&path).exists() {
        return (
            StatusCode::NOT_FOUND,
            format!("Extended OCPT file not found for file_id: {}", file_id),
        )
            .into_response();
    }

    match read_ocpt_as_frontend(&path).await {
        Ok(frontend_ocpt) => (
            StatusCode::OK,
            Json(json!({
                "file_id": file_id,
                "extended_ocpt": frontend_ocpt
            })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to read stored extended OCPT: {}", e),
        )
            .into_response(),
    }
}

pub async fn delete_extended_ocpt(Path(file_id): Path<String>) -> impl IntoResponse {
    let path = format!("./temp/extended_ocpt_{}.json", file_id);
    match fs::remove_file(&path).await {
        Ok(_) => (StatusCode::NO_CONTENT, "Deleted file").into_response(),
        Err(e) if e.kind() == ErrorKind::NotFound => (
            StatusCode::NOT_FOUND,
            format!("Extended OCPT file not found for file_id: {}", file_id),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to delete extended OCPT: {}", e),
        )
            .into_response(),
    }
}
