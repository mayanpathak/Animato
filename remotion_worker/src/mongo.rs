

// //v7fN1Fbg7iJRmAks
use mongodb::{
    bson::doc,
    options::{ClientOptions, ServerApi, ServerApiVersion},
    Client, Database,
};
use std::env;

pub async fn connect_db() -> (Client, Database) {
    let uri = env::var("MONGODB_URI")
        .expect("MONGODB_URI must be set in .env");

    let db_name = env::var("DB_NAME")
        .unwrap_or_else(|_| "myapp".to_string());

    let mut client_options = ClientOptions::parse(&uri)
        .await
        .expect("Failed to parse MongoDB URI");

    let server_api = ServerApi::builder()
        .version(ServerApiVersion::V1)
        .build();

    client_options.server_api = Some(server_api);

    let client = Client::with_options(client_options)
        .expect("Failed to create MongoDB client");

    client
        .database("admin")
        .run_command(doc! { "ping": 1 }, None)
        .await
        .expect("Failed to ping MongoDB");

    println!("Connected to MongoDB successfully!");

    let db = client.database(&db_name);

    (client, db)
}