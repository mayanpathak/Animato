

use mongodb::{
    bson::{doc, Document},
    error::ErrorKind,
    options::{ClientOptions, IndexOptions, ServerApi, ServerApiVersion},
    Client, Collection, Database, IndexModel,
};
use std::env;

const DUPLICATE_KEY: i32 = 11000;

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

/// Unique index on `users.email`: the real guard against duplicate accounts.
/// If existing duplicates block it, lists the emails and stops the server.
pub async fn ensure_user_email_index(db: &Database) {
    let users: Collection<Document> = db.collection("users");

    let index = IndexModel::builder()
        .keys(doc! { "email": 1 })
        .options(IndexOptions::builder().unique(true).build())
        .build();

    let err = match users.create_index(index, None).await {
        Ok(_) => {
            println!("✅ Unique index on users.email is in place");
            return;
        }
        Err(e) => e,
    };

    let is_duplicate = matches!(
        err.kind.as_ref(),
        ErrorKind::Command(c) if c.code == DUPLICATE_KEY
    );

    if !is_duplicate {
        eprintln!("❌ Failed to create the unique index on users.email: {}", err.kind);
        std::process::exit(1);
    }

    eprintln!("❌ Cannot create the unique index on users.email: duplicate emails exist.");

    let pipeline = vec![
        doc! { "$group": { "_id": "$email", "count": { "$sum": 1 } } },
        doc! { "$match": { "count": { "$gt": 1 } } },
        doc! { "$sort": { "_id": 1 } },
    ];

    match users.aggregate(pipeline, None).await {
        Ok(mut cursor) => {
            while let Ok(true) = cursor.advance().await {
                if let Ok(row) = cursor.deserialize_current() {
                    let email = row.get_str("_id").unwrap_or("<missing or non-string email>");
                    let count = row.get_i32("count").unwrap_or(0);
                    eprintln!("   {} ({} accounts)", email, count);
                }
            }
        }
        Err(_) => eprintln!("   (could not list the duplicate emails)"),
    }

    eprintln!("Remove or merge the duplicate accounts, then start the server again.");
    std::process::exit(1);
}