mod core;
mod handlers;
mod models;
mod routes;
mod traits;

use anyhow::Result;
use core::struct_converters::ocel_1_ocel_2_converter::convert_file;
use std::path::Path;
use tracing_subscriber::filter::EnvFilter;
use tracing_subscriber::fmt;
use tracing_subscriber::prelude::*;

#[tokio::main]
async fn main() -> Result<()> {
    // If args are provided: run the converter and exit.
    let mut args = std::env::args().skip(1);
    if let Some(in_path) = args.next() {
        let out_path: String = args.next().unwrap_or_else(|| "out.ocel.json".to_string());
        convert_file(Path::new(&in_path), Path::new(&out_path))?;
        println!("Wrote: {}", out_path);
        return Ok(()); // done
    }

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("debug"));

    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(filter)
        .init();

    log::debug!("Starting server...");

    // No args: start the HTTP server
    let app = routes::create_routes();
    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], 3000));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
