use crate::handlers::ocim::apply_ocim;
use axum::{Router, routing::get};

pub fn router() -> Router {
    Router::new().route("/ocim/{file_id}", get(apply_ocim))
}
