use axum::Router;
use axum::http::HeaderValue;
use axum::http::Method;
use tower_http::cors::{Any, CorsLayer};
pub mod v1;

pub fn create_routes() -> Router {
    let cors = CorsLayer::new()
        .allow_origin(
            [
                "http://localhost:5173".parse::<HeaderValue>().unwrap(),
                "http://localhost:4173".parse::<HeaderValue>().unwrap(),
            ]
            .to_vec(),
        ) // frontend origins
        .allow_methods([Method::GET, Method::POST, Method::DELETE, Method::PUT])
        .allow_headers(Any);

    Router::new().nest("/v1", v1::router()).layer(cors)
}
