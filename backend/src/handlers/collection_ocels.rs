use axum::{Json, extract::Path, http::StatusCode, response::IntoResponse};
use serde_json::Value;
use std::path::Path as FsPath;
use tokio::fs;

pub async fn get_collection_ocels(Path(file_id): Path<String>) -> impl IntoResponse {
    let path = format!("./temp/case_ocels_{}.json", file_id);

    if !FsPath::new(&path).exists() {
        let msg = format!("Case OCEL collection not found for fileId: {}", file_id);
        eprintln!("{}", msg);
        return (StatusCode::NOT_FOUND, msg).into_response();
    }

    match fs::read_to_string(&path).await {
        Ok(content) => match serde_json::from_str::<Value>(&content) {
            Ok(value) => (StatusCode::OK, Json(value)).into_response(),
            Err(err) => {
                eprintln!(
                    "Failed to parse stored case OCEL collection {}: {}",
                    path, err
                );
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Failed to parse stored case OCEL collection".to_string(),
                )
                    .into_response()
            }
        },
        Err(err) => {
            eprintln!(
                "Failed to read stored case OCEL collection {}: {}",
                path, err
            );
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to read stored case OCEL collection".to_string(),
            )
                .into_response()
        }
    }
}
