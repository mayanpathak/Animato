use axum::{
    routing::get,
    response::IntoResponse,
    http::{StatusCode, Method, HeaderValue, header},
    Router,
};

use tower_http::{
    cors::CorsLayer,
    services::ServeDir,
};

use dotenvy::dotenv;

use std::{
    env,
    net::SocketAddr,
};

use tokio::net::TcpListener;

use deadpool_redis::{
    redis::AsyncCommands,
    Pool,
};

mod db;
mod routes;
mod controller;
mod middleware;
mod utils;
mod models;
mod schema;
mod services;
mod config;

// use routes::auth_routes;
use routes::{auth_routes, job_routes};


use crate::config::{create_redis_pools, RedisPools};
#[derive(Clone)]
pub struct AppState {
    mongo_client: mongodb::Client,
    db: mongodb::Database,

    // Redis: one instance per rendering library (manim / remotion)
    redis_pools: RedisPools,

    // Email
    email_host: String,
    email_port: u16,
    email_user: String,
    email_pass: String,
    sender_name: String,

    // JWT
    jwt_secret: String,

    // Frontend origin (CORS, links in emails)
    frontend_url: String,

    // Per-user job quota
    job_limit_per_hour: u32,
    job_limit_per_day: u32,

    // S3: rendered videos (private bucket, served through presigned URLs)
    s3: aws_sdk_s3::Client,
    s3_bucket: String,
}

#[tokio::main]
async fn main() {
    dotenv().ok();


println!("Current directory: {:?}", std::env::current_dir().unwrap());


    // =========================
    // Environment Variables
    // =========================

    let port = env::var("PORT")
        .unwrap_or_else(|_| "5000".to_string());

    let env_mode = env::var("NODE_ENV")
        .unwrap_or_else(|_| "development".to_string());

    let addr: SocketAddr = format!("0.0.0.0:{}", port)
        .parse()
        .expect("Invalid address");

    // Development falls back to the Vite dev server; production must set it.
    let frontend_url = match env::var("FRONTEND_URL") {
        Ok(url) if !url.trim().is_empty() => url.trim().to_string(),

        _ if env_mode == "production" => {
            eprintln!("❌ FRONTEND_URL must be set when NODE_ENV=production");
            std::process::exit(1);
        }

        _ => "http://localhost:5173".to_string(),
    };

    // =========================
    // MongoDB Connection
    // =========================

    let (mongo_client, db) = db::connect_db().await;

    println!("✅ MongoDB connected successfully");

    db::ensure_user_email_index(&db).await;

    // =========================
    // Redis Connection
    // =========================

    let redis_pools = create_redis_pools().await;

    // Both instances must be reachable at startup, otherwise jobs for that
    // library would be accepted and then fail to enqueue.
    for (name, pool) in [
        ("manim", &redis_pools.manim),
        ("remotion", &redis_pools.remotion),
    ] {
        match pool.get().await {
            Ok(mut conn) => {
                let pong: Result<String, _> =
                    deadpool_redis::redis::cmd("PING")
                        .query_async(&mut conn)
                        .await;

                match pong {
                    Ok(response) => {
                        println!("✅ Redis [{}] connected successfully: {}", name, response);
                    }

                    Err(err) => {
                        eprintln!("❌ Redis [{}] ping failed: {:?}", name, err);
                        std::process::exit(1);
                    }
                }
            }

            Err(err) => {
                eprintln!("❌ Failed to connect to Redis [{}]: {:?}", name, err);
                std::process::exit(1);
            }
        }
    }

    // =========================
    // S3 Client
    // =========================

    // Reads AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION from the
    // environment. Only used to sign download URLs; no request is made here.
    let aws_config =
        aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;

    let s3 = aws_sdk_s3::Client::new(&aws_config);

    let s3_bucket = env::var("S3_BUCKET_NAME")
        .expect("S3_BUCKET_NAME must be set");

    // =========================
    // App State
    // =========================

    let state = AppState {
        mongo_client,
        db,

        redis_pools,

        email_host: env::var("EMAIL_HOST")
            .unwrap_or_default(),

        email_port: env::var("EMAIL_PORT")
            .unwrap_or_else(|_| "587".to_string())
            .parse()
            .unwrap_or(587),

        email_user: env::var("EMAIL_USER")
            .unwrap_or_default(),

        email_pass: env::var("EMAIL_PASS")
            .unwrap_or_default(),

        sender_name: env::var("SENDER_NAME")
            .unwrap_or_default(),

        jwt_secret: env::var("JWT_SECRET")
            .expect("JWT_SECRET must be set"),

        frontend_url,

        job_limit_per_hour: env::var("JOB_LIMIT_PER_HOUR")
            .unwrap_or_else(|_| "5".to_string())
            .parse()
            .unwrap_or(5),

        job_limit_per_day: env::var("JOB_LIMIT_PER_DAY")
            .unwrap_or_else(|_| "15".to_string())
            .parse()
            .unwrap_or(15),

        s3,
        s3_bucket,
    };

    println!("Frontend URL: {}", state.frontend_url);
    println!(
        "Job limits: {} per hour, {} per day",
        state.job_limit_per_hour, state.job_limit_per_day
    );

    // =========================
    // CORS
    // =========================

    let cors = CorsLayer::new()
        .allow_origin(
            "http://localhost:5173"
                .parse::<HeaderValue>()
                .unwrap(),
        )
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
        ])
        .allow_headers([
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            header::ACCEPT,
        ])
        .allow_credentials(true);

    // =========================
    // API Routes
    // =========================

    let api_routes = Router::new()
        .nest("/api/auth", auth_routes())
        .nest("/api/jobs", job_routes(state.clone()))
        .with_state(state);

    // =========================
    // App Router
    // =========================

    let app = if env_mode == "production" {
        Router::new()
            .merge(api_routes)
            .nest_service("/", ServeDir::new("frontend/dist"))
            .fallback(get(index_handler))
            .layer(cors)
    } else {
        Router::new()
            .merge(api_routes)
            // TEMPORARY (test 6.20): remove once the limits are applied.
            .layer(axum::middleware::from_fn(
                middleware::ratelimit::debug_peer_ip,
            ))
            .layer(cors)
    };

    println!("🚀 Server running on http://{}", addr);

    // =========================
    // TCP Listener
    // =========================

    let listener = TcpListener::bind(addr)
        .await
        .expect("Failed to bind");

    // Connection info lets handlers read the peer address (rate limiting).
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
        .await
        .expect("Server failed");
}

async fn index_handler() -> impl IntoResponse {
    match tokio::fs::read_to_string("frontend/dist/index.html").await {
        Ok(contents) => (StatusCode::OK, contents),

        Err(_) => (
            StatusCode::NOT_FOUND,
            "index.html not found".to_string(),
        ),
    }
}

// hiiiiii