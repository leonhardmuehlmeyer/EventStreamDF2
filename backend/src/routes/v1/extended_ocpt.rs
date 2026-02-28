use crate::handlers::extended_ocpt::apply_extended_ocpt;
use axum::{Router, routing::get};

pub fn router() -> Router {
    Router::new().route("/extend/{ocpt_id}", get(apply_extended_ocpt))
}
