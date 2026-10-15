// // End-to-end test for the whole pipeline, driven purely over HTTP like a real
// // client (the future frontend):
// //
// //   signup -> login -> auth/validation checks -> POST teacher prompt ->
// //   poll until Completed/Failed -> copy the rendered mp4 to ./output ->
// //   verify the mp4 (size + real duration) -> isolation check (other user
// //   cannot see the job).
// //
// // Usage (from this folder):
// //   cargo run                      # default scenario: pythagoras
// //   cargo run -- photosynthesis    # a named scenario
// //   cargo run -- all               # every scenario, one after another
// //   cargo run -- list              # show scenario names
// //   cargo run -- concurrent        # 6 remotion + 6 manim jobs submitted and
// //                                   # polled concurrently, proving the two
// //                                   # worker pools process jobs in parallel
// //   cargo run -- teachers          # 2 teachers signed up separately: a
// //                                   # science teacher submits 5 science jobs
// //                                   # (3 remotion + 2 manim) and a maths
// //                                   # teacher submits 7 maths jobs (3 remotion
// //                                   # + 4 manim), all 12 running concurrently.
// //                                   # 6 remotion + 6 manim total. Checks the
// //                                   # whole batch renders inside a 3-minute
// //                                   # budget and that each teacher only ever
// //                                   # sees their own jobs.
// //
// // Env overrides:
// //   API_URL           default http://localhost:5000
// //   RENDERS_DIR       default ../remotion_worker/static/renders
// //   OUTPUT_DIR        default ./output
// //   JOB_TIMEOUT_SECS  default 1500
// //
// // Everything printed is also written to ./logs/run-<timestamp>.log.
// // Full transparency: every HTTP request/response (status + full JSON body)
// // is logged, including every single poll, not just status changes. A
// // failed job's error_message (from the API) is printed prominently.

// use anyhow::{Context, Result, anyhow};
// use reqwest::{Client, Method, StatusCode};
// use serde_json::{Value, json};
// use std::{
//     env, fs,
//     io::Write,
//     path::PathBuf,
//     sync::{Arc, Mutex},
//     time::{Duration, Instant},
// };

// // ======================================================
// // Logging (stdout + file)
// // ======================================================

// static LOG_FILE: Mutex<Option<fs::File>> = Mutex::new(None);

// fn log_line(msg: &str) {
//     let line = format!("[{}] {}", chrono::Local::now().format("%H:%M:%S"), msg);
//     println!("{line}");
//     if let Ok(mut guard) = LOG_FILE.lock() {
//         if let Some(f) = guard.as_mut() {
//             let _ = writeln!(f, "{line}");
//         }
//     }
// }

// macro_rules! log {
//     ($($arg:tt)*) => { log_line(&format!($($arg)*)) };
// }

// fn truncate(s: &str, max: usize) -> String {
//     let total = s.chars().count();
//     if total <= max {
//         s.to_string()
//     } else {
//         let head: String = s.chars().take(max).collect();
//         format!("{head}... [truncated, {total} chars]")
//     }
// }

// // ======================================================
// // Scenarios: prompts written the way a teacher would type them
// // ======================================================

// struct Scenario {
//     name: &'static str,
//     /// "remotion" or "manim": sent as the `library` field; decides which
//     /// worker renders the job and which folder the mp4 is picked up from.
//     library: &'static str,
//     /// "science" or "maths": used by the `teachers` scenario to decide which
//     /// of the two simulated teachers submits this job.
//     subject: &'static str,
//     prompt: &'static str,
//     /// The prompt asks for roughly this long; the rendered video should be
//     /// at least this many seconds or the model ignored the brief.
//     min_seconds: f64,
//     /// Words that must appear (case-insensitive) in the TSX Gemini generated
//     /// for this prompt. Catches "right video, wrong topic" mix-ups.
//     keywords: &'static [&'static str],
// }

// const SCENARIOS: &[Scenario] = &[
//     Scenario {
//         name: "pythagoras",
//         library: "remotion",
//         subject: "maths",
//         min_seconds: 25.0,
//         keywords: &["pythagorean", "hypotenuse"],
//         prompt: "I'm a Class 8 maths teacher. Make a video of about 45 seconds that teaches the Pythagorean theorem to my students. Start with a title card 'The Pythagorean Theorem'. Then draw a right-angled triangle with sides 3, 4 and 5 and label each side. Next, draw a square on each side of the triangle and show their areas 9, 16 and 25, filling the squares with different colours. Then show the equation a squared + b squared = c squared appearing step by step with the numbers 9 + 16 = 25 plugged in. Finish with a short summary line: 'In a right triangle, the square of the hypotenuse equals the sum of the squares of the other two sides.' Use big readable text, a clean dark blue background and smooth animations so students can follow along.",
//     },
//     Scenario {
//         name: "photosynthesis",
//         library: "remotion",
//         subject: "science",
//         min_seconds: 25.0,
//         keywords: &["photosynthesis", "glucose", "oxygen"],
//         prompt: "hey can you make a video for my class 7 science students on how photosynthesis works. show a plant with the sun on top, water going up from the roots, carbon dioxide going into the leaf, and then glucose and oxygen coming out. label everything clearly and at the end show the equation 6CO2 + 6H2O -> C6H12O6 + 6O2. about 40 seconds. make it colourful and fun for kids, nothing too fast",
//     },
//     Scenario {
//         name: "4D animation explained ",
//         library: "remotion",
//         subject: "maths",
//         min_seconds: 25.0,
//         keywords: &["vertex", "symmetry"],
//         prompt: "explain the lifecycle of the earth and sun star in detail using a 3d animation  ",
//     },
//     Scenario {
//         name: "manim-pythagoras",
//         library: "manim",
//         subject: "maths",
//         min_seconds: 5.0,
//         keywords: &[],
//         prompt: "Explain the Pythagorean theorem with a right triangle with sides 3, 4 and 5. Draw squares on each side, show their areas 9, 16 and 25, and end with the equation a^2 + b^2 = c^2.",
//     },
//     Scenario {
//         name: "water-cycle",
//         library: "remotion",
//         subject: "science",
//         min_seconds: 20.0,
//         keywords: &["evaporation", "condensation"],
//         prompt: "I'm a Class 6 science teacher. Make a 30 second video explaining the water cycle. Show the sun heating the ocean, water evaporating into clouds, clouds forming through condensation, rain falling as precipitation, and water collecting back in rivers and oceans. Label each stage (evaporation, condensation, precipitation, collection) as it appears, use blue and white tones, and keep it simple and clear for 11-year-olds.",
//     },
//     Scenario {
//         name: "states-of-matter",
//         library: "remotion",
//         subject: "science",
//         min_seconds: 20.0,
//         keywords: &["solid", "liquid", "gas"],
//         prompt: "Class 6 science. Make a 30 second video showing the three states of matter: solid, liquid and gas, using a simple ice cube melting into water and then boiling into steam. Label each state as it appears and show the particles moving closer together for solid and further apart for gas. Bright, simple, easy for kids to follow.",
//     },
//     Scenario {
//         name: "plant-cell",
//         library: "manim",
//         subject: "science",
//         min_seconds: 5.0,
//         keywords: &[],
//         prompt: "Explain the basic structure of a plant cell for a Class 8 biology class. Draw a rectangular cell wall, then inside it draw and label the nucleus, cytoplasm, chloroplast and cell membrane one at a time, in about 30 seconds.",
//     },
//     Scenario {
//         name: "solar-system",
//         library: "manim",
//         subject: "science",
//         min_seconds: 5.0,
//         keywords: &[],
//         prompt: "Create a short animation of the solar system for Class 5 science students: draw the sun in the center and the planets Mercury, Venus, Earth and Mars orbiting around it in circles, labelling each planet as it appears.",
//     },
//     Scenario {
//         name: "fractions",
//         library: "remotion",
//         subject: "maths",
//         min_seconds: 20.0,
//         keywords: &["fraction"],
//         prompt: "I'm a Class 5 maths teacher. Make a 30 second video introducing fractions using a pizza cut into equal slices. Show a whole pizza, then cut it into 4 equal slices, shade 1 slice and label it 1/4, then shade 3 slices and label it 3/4. Finish with a text summary: 'A fraction shows a part of a whole.' Bright colours, big readable text.",
//     },
//     Scenario {
//         name: "triangle-angles",
//         library: "manim",
//         subject: "maths",
//         min_seconds: 5.0,
//         keywords: &[],
//         prompt: "Show that the angles of a triangle always add up to 180 degrees. Draw a triangle, label its three angles a, b and c, then show them combining along a straight line to demonstrate a + b + c = 180 degrees, for a Class 7 maths class.",
//     },
//     Scenario {
//         name: "number-line",
//         library: "manim",
//         subject: "maths",
//         min_seconds: 5.0,
//         keywords: &[],
//         prompt: "Explain addition of integers on a number line for Class 6 maths: draw a number line from -10 to 10, then animate the sum -3 + 5 by starting at -3 and moving 5 steps to the right, landing on 2.",
//     },
//     Scenario {
//         name: "circle-area",
//         library: "manim",
//         subject: "maths",
//         min_seconds: 5.0,
//         keywords: &[],
//         prompt: "Explain the area of a circle formula for Class 8 maths: draw a circle with radius r labelled, then show the formula Area = pi r squared appearing step by step, and finish with a worked example using radius 3.",
//     },
// ];

// // ======================================================
// // Config
// // ======================================================

// #[derive(Clone)]
// struct Config {
//     api: String,
//     renders_dir: PathBuf,
//     renders_dir_manim: PathBuf,
//     generated_dir: PathBuf,
//     output_dir: PathBuf,
//     job_timeout: Duration,
// }

// impl Config {
//     fn from_env() -> Self {
//         Config {
//             api: env::var("API_URL")
//                 .unwrap_or_else(|_| "http://localhost:5000".into())
//                 .trim_end_matches('/')
//                 .to_string(),
//             renders_dir: PathBuf::from(
//                 env::var("RENDERS_DIR")
//                     .unwrap_or_else(|_| "../remotion_worker/static/renders".into()),
//             ),
//             renders_dir_manim: PathBuf::from(
//                 env::var("RENDERS_DIR_MANIM")
//                     .unwrap_or_else(|_| "../manim_worker/static/renders".into()),
//             ),
//             generated_dir: PathBuf::from(
//                 env::var("GENERATED_DIR")
//                     .unwrap_or_else(|_| "../remotion_worker/static/generated".into()),
//             ),
//             output_dir: PathBuf::from(env::var("OUTPUT_DIR").unwrap_or_else(|_| "output".into())),
//             job_timeout: Duration::from_secs(
//                 env::var("JOB_TIMEOUT_SECS")
//                     .ok()
//                     .and_then(|v| v.parse().ok())
//                     .unwrap_or(1500),
//             ),
//         }
//     }
// }

// // ======================================================
// // HTTP helper: logs every request/response, never hides errors
// // ======================================================

// struct Resp {
//     status: StatusCode,
//     json: Value,
// }

// fn summarize_body(body: &Value) -> String {
//     let mut b = body.clone();
//     if let Some(obj) = b.as_object_mut() {
//         if obj.contains_key("password") {
//             obj.insert("password".into(), json!("***"));
//         }
//     }
//     truncate(&b.to_string(), 4000)
// }

// async fn call(
//     client: &Client,
//     method: Method,
//     url: &str,
//     body: Option<&Value>,
//     verbose: bool,
// ) -> Result<Resp> {
//     let started = Instant::now();

//     if verbose {
//         log!(
//             "--> {} {}{}",
//             method,
//             url,
//             body.map(|b| format!("  body={}", summarize_body(b)))
//                 .unwrap_or_default()
//         );
//     }

//     let mut req = client.request(method, url);
//     if let Some(b) = body {
//         req = req.json(b);
//     }

//     let res = req.send().await.map_err(|e| {
//         log!("<-- REQUEST FAILED after {:?}: {:#?}", started.elapsed(), e);
//         anyhow!("request to {url} failed: {e} (is the api_server running?)")
//     })?;

//     let status = res.status();
//     let text = res.text().await.context("reading response body")?;
//     let json = serde_json::from_str::<Value>(&text).unwrap_or(Value::Null);

//     if verbose || !status.is_success() {
//         log!(
//             "<-- {} in {:?}  body={}",
//             status,
//             started.elapsed(),
//             truncate(&text, 20_000)
//         );
//     }

//     Ok(Resp { status, json })
// }

// // ======================================================
// // Report
// // ======================================================

// // Wrapped in a Mutex (rather than requiring &mut) so a single Report can be
// // shared via Arc across concurrently-spawned scenario tasks.
// #[derive(Default)]
// struct Report {
//     rows: Mutex<Vec<(String, bool, String)>>,
// }

// impl Report {
//     fn check(&self, name: &str, ok: bool, detail: impl Into<String>) -> bool {
//         let detail = detail.into();
//         log!("{} {} - {}", if ok { "PASS" } else { "FAIL" }, name, detail);
//         self.rows
//             .lock()
//             .unwrap()
//             .push((name.to_string(), ok, detail));
//         ok
//     }

//     fn failures(&self) -> usize {
//         self.rows.lock().unwrap().iter().filter(|(_, ok, _)| !ok).count()
//     }

//     fn len(&self) -> usize {
//         self.rows.lock().unwrap().len()
//     }

//     fn rows_snapshot(&self) -> Vec<(String, bool, String)> {
//         self.rows.lock().unwrap().clone()
//     }
// }

// fn new_client(cookies: bool) -> Result<Client> {
//     Ok(Client::builder()
//         .cookie_store(cookies)
//         .timeout(Duration::from_secs(30))
//         .build()?)
// }

// // ======================================================
// // MP4 inspection: real duration from the `mvhd` box
// // ======================================================

// fn mp4_duration_secs(data: &[u8]) -> Option<f64> {
//     let pos = data.windows(4).position(|w| w == b"mvhd")?;
//     let b = data.get(pos + 4..)?;
//     let version = *b.first()?;

//     let (timescale, duration) = if version == 1 {
//         let ts = u32::from_be_bytes(b.get(20..24)?.try_into().ok()?);
//         let du = u64::from_be_bytes(b.get(24..32)?.try_into().ok()?);
//         (ts, du)
//     } else {
//         let ts = u32::from_be_bytes(b.get(12..16)?.try_into().ok()?);
//         let du = u32::from_be_bytes(b.get(16..20)?.try_into().ok()?) as u64;
//         (ts, du)
//     };

//     if timescale == 0 {
//         return None;
//     }
//     Some(duration as f64 / timescale as f64)
// }

// // ======================================================
// // Auth + API sanity checks (run once)
// // ======================================================

// #[derive(Clone)]
// struct Users {
//     teacher: Client,
//     other: Client,
// }

// async fn setup_users(cfg: &Config, rep: &Report) -> Result<Users> {
//     let stamp = chrono::Utc::now().timestamp_millis();
//     let password = "E2eTest#12345";

//     let teacher_email = format!("e2e.teacher.{stamp}@example.com");
//     let other_email = format!("e2e.other.{stamp}@example.com");

//     log!("Test users: {teacher_email}, {other_email}");

//     let anon = new_client(false)?;

//     // 0. reachability
//     let r = call(&anon, Method::GET, &format!("{}/api/auth/check-auth", cfg.api), None, true)
//         .await?;
//     rep.check(
//         "server reachable / check-auth without cookie -> 401",
//         r.status == StatusCode::UNAUTHORIZED,
//         format!("HTTP {}", r.status),
//     );

//     // 1. protected route without a cookie
//     let r = call(
//         &anon,
//         Method::POST,
//         &format!("{}/api/jobs", cfg.api),
//         Some(&json!({"prompt": "A blue circle that grows and fades in"})),
//         true,
//     )
//     .await?;
//     rep.check(
//         "POST /api/jobs without login -> 401",
//         r.status == StatusCode::UNAUTHORIZED,
//         format!("HTTP {}", r.status),
//     );

//     // 2. signup
//     let signup_client = new_client(true)?;
//     let signup_body = json!({"username": "e2e_teacher", "email": teacher_email, "password": password});
//     let r = call(
//         &signup_client,
//         Method::POST,
//         &format!("{}/api/auth/signup", cfg.api),
//         Some(&signup_body),
//         true,
//     )
//     .await?;
//     if !rep.check(
//         "signup teacher -> 201",
//         r.status == StatusCode::CREATED,
//         format!("HTTP {}", r.status),
//     ) {
//         return Err(anyhow!("signup failed, cannot continue"));
//     }

//     // 3. duplicate signup
//     let r = call(
//         &anon,
//         Method::POST,
//         &format!("{}/api/auth/signup", cfg.api),
//         Some(&signup_body),
//         true,
//     )
//     .await?;
//     rep.check(
//         "duplicate signup -> 409",
//         r.status == StatusCode::CONFLICT,
//         format!("HTTP {}", r.status),
//     );

//     // 4. wrong password
//     let r = call(
//         &anon,
//         Method::POST,
//         &format!("{}/api/auth/login", cfg.api),
//         Some(&json!({"email": teacher_email, "password": "definitely-wrong"})),
//         true,
//     )
//     .await?;
//     rep.check(
//         "login with wrong password -> 401",
//         r.status == StatusCode::UNAUTHORIZED,
//         format!("HTTP {}", r.status),
//     );

//     // 5. real login on a FRESH client (proves login itself sets the cookie)
//     let teacher = new_client(true)?;
//     let r = call(
//         &teacher,
//         Method::POST,
//         &format!("{}/api/auth/login", cfg.api),
//         Some(&json!({"email": teacher_email, "password": password})),
//         true,
//     )
//     .await?;
//     if !rep.check(
//         "login teacher -> 200",
//         r.status == StatusCode::OK,
//         format!("HTTP {}", r.status),
//     ) {
//         return Err(anyhow!("login failed, cannot continue"));
//     }

//     // 6. check-auth with cookie
//     let r = call(&teacher, Method::GET, &format!("{}/api/auth/check-auth", cfg.api), None, true)
//         .await?;
//     rep.check(
//         "check-auth with cookie -> 200",
//         r.status == StatusCode::OK,
//         format!("HTTP {}", r.status),
//     );

//     // 7. prompt validation (min length is 10)
//     let r = call(
//         &teacher,
//         Method::POST,
//         &format!("{}/api/jobs", cfg.api),
//         Some(&json!({"prompt": "hi"})),
//         true,
//     )
//     .await?;
//     rep.check(
//         "too-short prompt -> 400",
//         r.status == StatusCode::BAD_REQUEST,
//         format!("HTTP {}", r.status),
//     );

//     // 8. unknown job id
//     let r = call(
//         &teacher,
//         Method::GET,
//         &format!("{}/api/jobs/00000000-0000-4000-8000-000000000000", cfg.api),
//         None,
//         true,
//     )
//     .await?;
//     rep.check(
//         "unknown job id -> 404",
//         r.status == StatusCode::NOT_FOUND,
//         format!("HTTP {}", r.status),
//     );

//     // 9. unknown library must be rejected (serde enum -> 4xx), not queued
//     let r = call(
//         &teacher,
//         Method::POST,
//         &format!("{}/api/jobs", cfg.api),
//         Some(&json!({"prompt": "A blue circle that grows and fades in", "library": "blender"})),
//         true,
//     )
//     .await?;
//     rep.check(
//         "unknown library 'blender' -> 4xx (not queued)",
//         r.status.is_client_error(),
//         format!("HTTP {}", r.status),
//     );

//     // second user, used later for the isolation check
//     let other = new_client(true)?;
//     let r = call(
//         &other,
//         Method::POST,
//         &format!("{}/api/auth/signup", cfg.api),
//         Some(&json!({"username": "e2e_other", "email": other_email, "password": password})),
//         true,
//     )
//     .await?;
//     rep.check(
//         "signup second user -> 201",
//         r.status == StatusCode::CREATED,
//         format!("HTTP {}", r.status),
//     );

//     Ok(Users { teacher, other })
// }

// // Signs up and logs in exactly two independent teacher accounts (science and
// // maths) - two real people using the platform at the same time, each with
// // their own cookie-authenticated session. Every signup/login request and its
// // full backend response is logged.
// struct TwoTeachers {
//     science: Client,
//     maths: Client,
// }

// async fn setup_two_teachers(cfg: &Config, rep: &Report) -> Result<TwoTeachers> {
//     let stamp = chrono::Utc::now().timestamp_millis();
//     let password = "E2eTest#12345";

//     let science_email = format!("e2e.science.teacher.{stamp}@example.com");
//     let maths_email = format!("e2e.maths.teacher.{stamp}@example.com");

//     log!("Teacher 1 (science): {science_email}");
//     log!("Teacher 2 (maths):   {maths_email}");

//     let science = new_client(true)?;
//     let r = call(
//         &science,
//         Method::POST,
//         &format!("{}/api/auth/signup", cfg.api),
//         Some(&json!({"username": "e2e_science_teacher", "email": science_email, "password": password})),
//         true,
//     )
//     .await?;
//     if !rep.check(
//         "signup science teacher -> 201",
//         r.status == StatusCode::CREATED,
//         format!("HTTP {}", r.status),
//     ) {
//         return Err(anyhow!("science teacher signup failed, cannot continue"));
//     }

//     let r = call(
//         &science,
//         Method::POST,
//         &format!("{}/api/auth/login", cfg.api),
//         Some(&json!({"email": science_email, "password": password})),
//         true,
//     )
//     .await?;
//     if !rep.check(
//         "login science teacher -> 200",
//         r.status == StatusCode::OK,
//         format!("HTTP {}", r.status),
//     ) {
//         return Err(anyhow!("science teacher login failed, cannot continue"));
//     }

//     let maths = new_client(true)?;
//     let r = call(
//         &maths,
//         Method::POST,
//         &format!("{}/api/auth/signup", cfg.api),
//         Some(&json!({"username": "e2e_maths_teacher", "email": maths_email, "password": password})),
//         true,
//     )
//     .await?;
//     if !rep.check(
//         "signup maths teacher -> 201",
//         r.status == StatusCode::CREATED,
//         format!("HTTP {}", r.status),
//     ) {
//         return Err(anyhow!("maths teacher signup failed, cannot continue"));
//     }

//     let r = call(
//         &maths,
//         Method::POST,
//         &format!("{}/api/auth/login", cfg.api),
//         Some(&json!({"email": maths_email, "password": password})),
//         true,
//     )
//     .await?;
//     if !rep.check(
//         "login maths teacher -> 200",
//         r.status == StatusCode::OK,
//         format!("HTTP {}", r.status),
//     ) {
//         return Err(anyhow!("maths teacher login failed, cannot continue"));
//     }

//     Ok(TwoTeachers { science, maths })
// }

// // ======================================================
// // One full prompt -> video run
// // ======================================================

// async fn run_scenario(cfg: &Config, users: &Users, sc: &Scenario, tag: &str, rep: &Report) {
//     log!("");
//     log!("==================================================");
//     log!("SCENARIO: {tag} (library={}, source scenario={})", sc.library, sc.name);
//     log!("PROMPT: {}", sc.prompt);
//     log!("==================================================");

//     // ---- submit ----
//     let r = match call(
//         &users.teacher,
//         Method::POST,
//         &format!("{}/api/jobs", cfg.api),
//         Some(&json!({ "prompt": sc.prompt, "library": sc.library })),
//         true,
//     )
//     .await
//     {
//         Ok(r) => r,
//         Err(e) => {
//             rep.check(&format!("[{tag}] submit job"), false, format!("{e:#}"));
//             return;
//         }
//     };

//     let job_id = r.json["data"]["job_id"].as_str().unwrap_or("").to_string();
//     if !rep.check(
//         &format!("[{tag}] submit job -> 200 with job_id"),
//         r.status == StatusCode::OK && !job_id.is_empty(),
//         format!("HTTP {} job_id={job_id}", r.status),
//     ) {
//         return;
//     }

//     rep.check(
//         &format!("[{tag}] API echoes library '{}'", sc.library),
//         r.json["data"]["library"] == sc.library,
//         format!("data.library={}", r.json["data"]["library"]),
//     );

//     // ---- poll ----
//     let url = format!("{}/api/jobs/{}", cfg.api, job_id);
//     let started = Instant::now();
//     let mut last_status = String::new();
//     let mut last_change = Instant::now();
//     let mut last_beat = Instant::now();
//     let mut consecutive_errors = 0;

//     let data: Value = loop {
//         if started.elapsed() > cfg.job_timeout {
//             rep.check(
//                 &format!("[{tag}] job finishes within {}s", cfg.job_timeout.as_secs()),
//                 false,
//                 format!(
//                     "still '{last_status}' after {}s - check the worker terminal for the reason",
//                     started.elapsed().as_secs()
//                 ),
//             );
//             return;
//         }

//         match call(&users.teacher, Method::GET, &url, None, true).await {
//             Ok(r) if r.status == StatusCode::OK => {
//                 consecutive_errors = 0;
//                 let st = r.json["data"]["status"].as_str().unwrap_or("?").to_string();

//                 if st != last_status {
//                     log!("[{tag}] STATUS {last_status:?} -> {st:?}  (t+{}s)", started.elapsed().as_secs());
//                     last_status = st.clone();
//                     last_change = Instant::now();
//                     last_beat = Instant::now();
//                 } else if last_beat.elapsed() > Duration::from_secs(30) {
//                     log!(
//                         "[{tag}] ...still {st} after {}s in this state (t+{}s)",
//                         last_change.elapsed().as_secs(),
//                         started.elapsed().as_secs()
//                     );
//                     if last_change.elapsed() > Duration::from_secs(300) {
//                         log!("[{tag}] WARN: no status change for 5+ min - check the worker terminal");
//                     }
//                     last_beat = Instant::now();
//                 }

//                 if st == "Completed" || st == "Failed" {
//                     break r.json["data"].clone();
//                 }
//             }
//             Ok(r) => {
//                 consecutive_errors += 1;
//                 log!("[{tag}] poll got unexpected HTTP {} ({consecutive_errors}/5)", r.status);
//             }
//             Err(e) => {
//                 consecutive_errors += 1;
//                 log!("[{tag}] poll error ({consecutive_errors}/5): {e:#}");
//             }
//         }

//         if consecutive_errors >= 5 {
//             rep.check(&format!("[{tag}] polling job status"), false, "5 consecutive poll errors");
//             return;
//         }

//         tokio::time::sleep(Duration::from_secs(4)).await;
//     };

//     let total = started.elapsed();

//     // ---- failed job: surface the backend error ----
//     if data["status"] == "Failed" {
//         log!("");
//         log!("########## [{tag}] BACKEND REPORTED JOB FAILURE ##########");
//         log!("job_id:        {job_id}");
//         log!("error_message: {}", data["error_message"].as_str().unwrap_or("<none>"));
//         log!("(worker terminal has the full generated code / Docker stderr)");
//         log!("############################################################");
//         rep.check(
//             &format!("[{tag}] job completes"),
//             false,
//             format!(
//                 "Failed after {}s: {}",
//                 total.as_secs(),
//                 data["error_message"].as_str().unwrap_or("<no error_message>")
//             ),
//         );
//         return;
//     }

//     log!("Final job data from API: {}", data);

//     rep.check(
//         &format!("[{tag}] job completes"),
//         true,
//         format!("Completed in {}s", total.as_secs()),
//     );

//     rep.check(
//         &format!("[{tag}] API returns render metadata"),
//         data["duration_seconds"].is_number()
//             && data["render_time_ms"].is_number()
//             && data["file_size_bytes"].is_number(),
//         format!(
//             "duration_seconds={} render_time_ms={} file_size_bytes={} (if null: restart api_server to load the new response fields)",
//             data["duration_seconds"], data["render_time_ms"], data["file_size_bytes"]
//         ),
//     );

//     // ---- locate + copy video ----
//     let video_path = data["video_path"].as_str().unwrap_or("");
//     let file_name = video_path.rsplit('/').next().unwrap_or("");
//     let renders_dir = if sc.library == "manim" {
//         &cfg.renders_dir_manim
//     } else {
//         &cfg.renders_dir
//     };
//     let src = renders_dir.join(file_name);

//     if !rep.check(
//         &format!("[{tag}] video file exists on disk"),
//         !file_name.is_empty() && src.exists(),
//         format!("api video_path={video_path:?}, looked in {}", src.display()),
//     ) {
//         log!("Hint: set RENDERS_DIR if the worker's static/renders folder is elsewhere.");
//         return;
//     }

//     if let Err(e) = fs::create_dir_all(&cfg.output_dir) {
//         rep.check(&format!("[{tag}] create output dir"), false, format!("{e}"));
//         return;
//     }

//     let dest = cfg
//         .output_dir
//         .join(format!("{}-{}.mp4", tag, &job_id[..8.min(job_id.len())]));

//     if let Err(e) = fs::copy(&src, &dest) {
//         rep.check(&format!("[{tag}] copy video to output"), false, format!("{e}"));
//         return;
//     }

//     // ---- verify video ----
//     let bytes = match fs::read(&dest) {
//         Ok(b) => b,
//         Err(e) => {
//             rep.check(&format!("[{tag}] read copied video"), false, format!("{e}"));
//             return;
//         }
//     };

//     let abs = fs::canonicalize(&dest).unwrap_or(dest.clone());

//     rep.check(
//         &format!("[{tag}] video size is sane (>100 KB)"),
//         bytes.len() > 100_000,
//         format!("{} bytes", bytes.len()),
//     );

//     let is_mp4 = bytes.len() > 12 && &bytes[4..8] == b"ftyp";
//     rep.check(&format!("[{tag}] file is a valid mp4 (ftyp header)"), is_mp4, "");

//     match mp4_duration_secs(&bytes) {
//         Some(secs) => {
//             rep.check(
//                 &format!("[{tag}] video length matches the brief (>= {}s)", sc.min_seconds),
//                 secs >= sc.min_seconds,
//                 format!("actual mp4 duration {secs:.1}s"),
//             );

//             if let Some(reported) = data["duration_seconds"].as_f64() {
//                 rep.check(
//                     &format!("[{tag}] mp4 duration matches DB duration_seconds"),
//                     (secs - reported).abs() < 1.5,
//                     format!("mp4={secs:.1}s db={reported:.1}s"),
//                 );
//             }
//         }
//         None => {
//             rep.check(&format!("[{tag}] read mp4 duration"), false, "no mvhd box found");
//         }
//     }

//     // ---- content check: did Gemini write code for THIS prompt? ----
//     let code_src = cfg.generated_dir.join(format!("{job_id}.tsx"));
//     if sc.library != "remotion" {
//         log!("[{tag}] (generated-code topic check only applies to remotion jobs; skipped for {})", sc.library);
//     } else {
//         match fs::read_to_string(&code_src) {
//         Ok(code) => {
//             let code_dest = dest.with_extension("tsx");
//             let _ = fs::copy(&code_src, &code_dest);

//             let lower = code.to_lowercase();
//             let missing: Vec<&str> = sc
//                 .keywords
//                 .iter()
//                 .copied()
//                 .filter(|k| !lower.contains(&k.to_lowercase()))
//                 .collect();

//             rep.check(
//                 &format!("[{tag}] generated code matches the prompt topic"),
//                 missing.is_empty(),
//                 if missing.is_empty() {
//                     format!("all of {:?} found in {}", sc.keywords, code_src.display())
//                 } else {
//                     format!(
//                         "MISSING {:?} in {} - Gemini may have produced the wrong scene",
//                         missing,
//                         code_src.display()
//                     )
//                 },
//             );
//         }
//         Err(e) => {
//             rep.check(
//                 &format!("[{tag}] generated code saved by worker"),
//                 false,
//                 format!(
//                     "cannot read {}: {e} (restart the worker so it saves generated code, or set GENERATED_DIR)",
//                     code_src.display()
//                 ),
//             );
//         }
//         }
//     }

//     // ---- isolation: another user must not see this job ----
//     match call(&users.other, Method::GET, &url, None, true).await {
//         Ok(r) => {
//             rep.check(
//                 &format!("[{tag}] other user cannot read this job -> 404"),
//                 r.status == StatusCode::NOT_FOUND,
//                 format!("HTTP {}", r.status),
//             );
//         }
//         Err(e) => {
//             rep.check(&format!("[{tag}] isolation check"), false, format!("{e:#}"));
//         }
//     }

//     log!("");
//     log!(">>> [{tag}] FINAL VIDEO: {}", abs.display());
// }

// // ======================================================
// // main
// // ======================================================

// fn open_log_file() -> Result<String> {
//     fs::create_dir_all("logs")?;
//     let log_path = format!(
//         "logs/run-{}.log",
//         chrono::Local::now().format("%Y%m%d-%H%M%S")
//     );
//     *LOG_FILE.lock().unwrap() = Some(fs::File::create(&log_path)?);
//     Ok(log_path)
// }

// fn print_summary(rep: &Report, log_path: &str) {
//     log!("");
//     log!("================== SUMMARY ==================");
//     for (name, ok, detail) in rep.rows_snapshot() {
//         log!("{} {}{}", if ok { "PASS" } else { "FAIL" }, name,
//             if detail.is_empty() { String::new() } else { format!(" - {detail}") });
//     }
//     log!("=============================================");
//     log!(
//         "{} passed, {} failed. Full log: {log_path}",
//         rep.len() - rep.failures(),
//         rep.failures()
//     );
// }

// // Run 6 remotion jobs + 6 manim jobs at the same time, on the same logged-in
// // teacher, to prove the two worker pools actually process jobs concurrently
// // rather than serializing them. Every failure - HTTP errors, poll errors,
// // panics in a spawned task - is logged with the job's own [tag] so a bad run
// // stays diagnosable even with 12 jobs interleaving in one log file.
// async fn run_concurrent(cfg: &Config) -> Result<()> {
//     let log_path = open_log_file()?;

//     log!("E2E CONCURRENT run starting - 6 remotion + 6 manim jobs in parallel");
//     log!("API:          {}", cfg.api);
//     log!("Renders dir:  {} (remotion), {} (manim)", cfg.renders_dir.display(), cfg.renders_dir_manim.display());
//     log!("Output dir:   {}", cfg.output_dir.display());
//     log!("Job timeout:  {}s", cfg.job_timeout.as_secs());
//     log!("Log file:     {log_path}");

//     let rep = Arc::new(Report::default());

//     let remotion_scenarios: Vec<&Scenario> =
//         SCENARIOS.iter().filter(|s| s.library == "remotion").collect();
//     let manim_scenarios: Vec<&Scenario> =
//         SCENARIOS.iter().filter(|s| s.library == "manim").collect();

//     if remotion_scenarios.is_empty() || manim_scenarios.is_empty() {
//         return Err(anyhow!("need at least one remotion and one manim scenario in SCENARIOS"));
//     }

//     let users = match setup_users(cfg, &rep).await {
//         Ok(u) => u,
//         Err(e) => {
//             log!("SETUP ABORTED: {e:#}");
//             rep.check("setup", false, format!("{e:#}"));
//             print_summary(&rep, &log_path);
//             std::process::exit(1);
//         }
//     };

//     let mut set = tokio::task::JoinSet::new();

//     for i in 0..6usize {
//         let sc: &'static Scenario = remotion_scenarios[i % remotion_scenarios.len()];
//         let tag = format!("remotion-{}", i + 1);
//         let cfg = cfg.clone();
//         let users = users.clone();
//         let rep = rep.clone();
//         set.spawn(async move {
//             run_scenario(&cfg, &users, sc, &tag, &rep).await;
//         });
//     }

//     for i in 0..6usize {
//         let sc: &'static Scenario = manim_scenarios[i % manim_scenarios.len()];
//         let tag = format!("manim-{}", i + 1);
//         let cfg = cfg.clone();
//         let users = users.clone();
//         let rep = rep.clone();
//         set.spawn(async move {
//             run_scenario(&cfg, &users, sc, &tag, &rep).await;
//         });
//     }

//     log!("12 jobs submitted for concurrent execution, waiting for all to finish...");

//     while let Some(res) = set.join_next().await {
//         if let Err(e) = res {
//             log!("TASK PANICKED: {e:#}");
//             rep.check("concurrent task join", false, format!("panic: {e:#}"));
//         }
//     }

//     print_summary(&rep, &log_path);

//     if rep.failures() > 0 {
//         std::process::exit(1);
//     }
//     Ok(())
// }

// // Two teachers, using the platform independently at the same time: a science
// // teacher submits 5 science jobs (3 remotion + 2 manim) and a maths teacher
// // submits 7 maths jobs (3 remotion + 4 manim), for 12 jobs total, 6 remotion
// // + 6 manim, all submitted and rendered concurrently. Checks the whole batch
// // finishes inside a 3-minute budget, and that neither teacher can see the
// // other's jobs (isolation, using the other real teacher as the "other" user).
// const TEACHER_JOB_BUDGET: Duration = Duration::from_secs(180);

// async fn run_teachers(cfg: &Config) -> Result<()> {
//     let log_path = open_log_file()?;

//     let science_scenarios: Vec<&Scenario> =
//         SCENARIOS.iter().filter(|s| s.subject == "science").collect();
//     let maths_scenarios: Vec<&Scenario> =
//         SCENARIOS.iter().filter(|s| s.subject == "maths").collect();

//     let science_remotion = science_scenarios.iter().filter(|s| s.library == "remotion").count();
//     let science_manim = science_scenarios.iter().filter(|s| s.library == "manim").count();
//     let maths_remotion = maths_scenarios.iter().filter(|s| s.library == "remotion").count();
//     let maths_manim = maths_scenarios.iter().filter(|s| s.library == "manim").count();

//     log!("E2E TEACHERS run starting - 2 teachers, {} jobs total", science_scenarios.len() + maths_scenarios.len());
//     log!("Science teacher: {} jobs ({} remotion + {} manim)", science_scenarios.len(), science_remotion, science_manim);
//     log!("Maths teacher:   {} jobs ({} remotion + {} manim)", maths_scenarios.len(), maths_remotion, maths_manim);
//     log!("Total: {} remotion + {} manim", science_remotion + maths_remotion, science_manim + maths_manim);
//     log!("Budget:       all jobs rendered within {}s", TEACHER_JOB_BUDGET.as_secs());
//     log!("API:          {}", cfg.api);
//     log!("Renders dir:  {} (remotion), {} (manim)", cfg.renders_dir.display(), cfg.renders_dir_manim.display());
//     log!("Output dir:   {}", cfg.output_dir.display());
//     log!("Log file:     {log_path}");

//     let rep = Arc::new(Report::default());

//     let teachers = match setup_two_teachers(cfg, &rep).await {
//         Ok(t) => t,
//         Err(e) => {
//             log!("SETUP ABORTED: {e:#}");
//             rep.check("setup", false, format!("{e:#}"));
//             print_summary(&rep, &log_path);
//             std::process::exit(1);
//         }
//     };

//     // Each teacher acts as the "other" user for the opposite teacher's jobs,
//     // so run_scenario's isolation check proves a real cross-teacher boundary
//     // rather than a throwaway isolation-only account.
//     let science_users = Users { teacher: teachers.science.clone(), other: teachers.maths.clone() };
//     let maths_users = Users { teacher: teachers.maths.clone(), other: teachers.science.clone() };

//     let start = Instant::now();
//     let mut set = tokio::task::JoinSet::new();

//     for sc in science_scenarios {
//         let sc: &'static Scenario = sc;
//         let tag = format!("science-{}", sc.name);
//         let cfg = cfg.clone();
//         let users = science_users.clone();
//         let rep = rep.clone();
//         set.spawn(async move {
//             run_scenario(&cfg, &users, sc, &tag, &rep).await;
//         });
//     }

//     for sc in maths_scenarios {
//         let sc: &'static Scenario = sc;
//         let tag = format!("maths-{}", sc.name);
//         let cfg = cfg.clone();
//         let users = maths_users.clone();
//         let rep = rep.clone();
//         set.spawn(async move {
//             run_scenario(&cfg, &users, sc, &tag, &rep).await;
//         });
//     }

//     log!("12 jobs submitted by 2 teachers, waiting for all to finish...");

//     while let Some(res) = set.join_next().await {
//         if let Err(e) = res {
//             log!("TASK PANICKED: {e:#}");
//             rep.check("concurrent task join", false, format!("panic: {e:#}"));
//         }
//     }

//     let elapsed = start.elapsed();
//     rep.check(
//         "all 12 videos (6 remotion + 6 manim) rendered within 3 minutes",
//         elapsed <= TEACHER_JOB_BUDGET,
//         format!("took {:.1}s (budget {}s)", elapsed.as_secs_f64(), TEACHER_JOB_BUDGET.as_secs()),
//     );

//     print_summary(&rep, &log_path);

//     if rep.failures() > 0 {
//         std::process::exit(1);
//     }
//     Ok(())
// }

// #[tokio::main]
// async fn main() -> Result<()> {
//     let cfg = Config::from_env();
//     let arg = env::args().nth(1).unwrap_or_else(|| "pythagoras".into());

//     if arg == "list" {
//         for s in SCENARIOS {
//             println!("{}", s.name);
//         }
//         return Ok(());
//     }

//     if arg == "concurrent" {
//         return run_concurrent(&cfg).await;
//     }

//     if arg == "teachers" {
//         return run_teachers(&cfg).await;
//     }

//     let selected: Vec<&Scenario> = if arg == "all" {
//         SCENARIOS.iter().collect()
//     } else {
//         match SCENARIOS.iter().find(|s| s.name == arg) {
//             Some(s) => vec![s],
//             None => {
//                 eprintln!("Unknown scenario '{arg}'. Run `cargo run -- list`.");
//                 std::process::exit(2);
//             }
//         }
//     };

//     let log_path = open_log_file()?;

//     log!("E2E run starting");
//     log!("API:          {}", cfg.api);
//     log!("Renders dir:  {}", cfg.renders_dir.display());
//     log!("Output dir:   {}", cfg.output_dir.display());
//     log!("Job timeout:  {}s", cfg.job_timeout.as_secs());
//     log!("Log file:     {log_path}");

//     let rep = Report::default();

//     match setup_users(&cfg, &rep).await {
//         Ok(users) => {
//             for sc in selected {
//                 run_scenario(&cfg, &users, sc, sc.name, &rep).await;
//             }
//         }
//         Err(e) => {
//             log!("SETUP ABORTED: {e:#}");
//             rep.check("setup", false, format!("{e:#}"));
//         }
//     }

//     print_summary(&rep, &log_path);

//     if rep.failures() > 0 {
//         std::process::exit(1);
//     }
//     Ok(())
// }








// Minimal end-to-end test, driven purely over HTTP like a real client:
//
//   signup -> login -> POST teacher prompt (remotion) -> poll until
//   Completed/Failed -> copy + verify the mp4
//   ...then the same again with library=manim.
//
// Both jobs use the same "sun lifecycle" prompt, one rendered by each
// worker pool, so this is the smallest possible smoke test that proves
// both pipelines work end to end.
//
// Usage (from this folder):
//   cargo run
//
// Env overrides:
//   API_URL             default http://localhost:5000
//   RENDERS_DIR         default ../remotion_worker/static/renders
//   RENDERS_DIR_MANIM   default ../manim_worker/static/renders
//   OUTPUT_DIR          default ./output
//   JOB_TIMEOUT_SECS    default 1500
//
// Everything printed is also written to ./logs/run-<timestamp>.log.
// Full transparency: every HTTP request/response (status + full JSON body)
// is logged, including every single poll, not just status changes. A
// failed job's error_message (from the API) is printed prominently.

use anyhow::{Context, Result, anyhow};
use reqwest::{Client, Method, StatusCode};
use serde_json::{Value, json};
use std::{
    env, fs,
    io::Write,
    path::PathBuf,
    sync::Mutex,
    time::{Duration, Instant},
};

// ======================================================
// Logging (stdout + file)
// ======================================================

static LOG_FILE: Mutex<Option<fs::File>> = Mutex::new(None);

fn log_line(msg: &str) {
    let line = format!("[{}] {}", chrono::Local::now().format("%H:%M:%S"), msg);
    println!("{line}");
    if let Ok(mut guard) = LOG_FILE.lock() {
        if let Some(f) = guard.as_mut() {
            let _ = writeln!(f, "{line}");
        }
    }
}

macro_rules! log {
    ($($arg:tt)*) => { log_line(&format!($($arg)*)) };
}

fn truncate(s: &str, max: usize) -> String {
    let total = s.chars().count();
    if total <= max {
        s.to_string()
    } else {
        let head: String = s.chars().take(max).collect();
        format!("{head}... [truncated, {total} chars]")
    }
}

// ======================================================
// The one scenario, run twice (remotion, then manim)
// ======================================================

struct Scenario {
    name: &'static str,
    library: &'static str,
    prompt: &'static str,
    min_seconds: f64,
    keywords: &'static [&'static str],
}

const SUN_LIFECYCLE_PROMPT: &str =
    "explain the lifecycle of the earth and sun star in detail using a 3d animation";

const REMOTION_SCENARIO: Scenario = Scenario {
    name: "sun-lifecycle-remotion",
    library: "remotion",
    prompt: SUN_LIFECYCLE_PROMPT,
    min_seconds: 20.0,
    keywords: &[],
};

const MANIM_SCENARIO: Scenario = Scenario {
    name: "sun-lifecycle-manim",
    library: "manim",
    prompt: SUN_LIFECYCLE_PROMPT,
    min_seconds: 5.0,
    keywords: &[],
};

// ======================================================
// Config
// ======================================================

#[derive(Clone)]
struct Config {
    api: String,
    renders_dir: PathBuf,
    renders_dir_manim: PathBuf,
    generated_dir: PathBuf,
    output_dir: PathBuf,
    job_timeout: Duration,
}

impl Config {
    fn from_env() -> Self {
        Config {
            api: env::var("API_URL")
                .unwrap_or_else(|_| "http://localhost:5000".into())
                .trim_end_matches('/')
                .to_string(),
            renders_dir: PathBuf::from(
                env::var("RENDERS_DIR")
                    .unwrap_or_else(|_| "../remotion_worker/static/renders".into()),
            ),
            renders_dir_manim: PathBuf::from(
                env::var("RENDERS_DIR_MANIM")
                    .unwrap_or_else(|_| "../manim_worker/static/renders".into()),
            ),
            generated_dir: PathBuf::from(
                env::var("GENERATED_DIR")
                    .unwrap_or_else(|_| "../remotion_worker/static/generated".into()),
            ),
            output_dir: PathBuf::from(env::var("OUTPUT_DIR").unwrap_or_else(|_| "output".into())),
            job_timeout: Duration::from_secs(
                env::var("JOB_TIMEOUT_SECS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(1500),
            ),
        }
    }
}

// ======================================================
// HTTP helper: logs every request/response, never hides errors
// ======================================================

struct Resp {
    status: StatusCode,
    json: Value,
}

fn summarize_body(body: &Value) -> String {
    let mut b = body.clone();
    if let Some(obj) = b.as_object_mut() {
        if obj.contains_key("password") {
            obj.insert("password".into(), json!("***"));
        }
    }
    truncate(&b.to_string(), 4000)
}

async fn call(
    client: &Client,
    method: Method,
    url: &str,
    body: Option<&Value>,
    verbose: bool,
) -> Result<Resp> {
    let started = Instant::now();

    if verbose {
        log!(
            "--> {} {}{}",
            method,
            url,
            body.map(|b| format!("  body={}", summarize_body(b)))
                .unwrap_or_default()
        );
    }

    let mut req = client.request(method, url);
    if let Some(b) = body {
        req = req.json(b);
    }

    let res = req.send().await.map_err(|e| {
        log!("<-- REQUEST FAILED after {:?}: {:#?}", started.elapsed(), e);
        anyhow!("request to {url} failed: {e} (is the api_server running?)")
    })?;

    let status = res.status();
    let text = res.text().await.context("reading response body")?;
    let json = serde_json::from_str::<Value>(&text).unwrap_or(Value::Null);

    if verbose || !status.is_success() {
        log!(
            "<-- {} in {:?}  body={}",
            status,
            started.elapsed(),
            truncate(&text, 20_000)
        );
    }

    Ok(Resp { status, json })
}

// ======================================================
// Report
// ======================================================

#[derive(Default)]
struct Report {
    rows: Vec<(String, bool, String)>,
}

impl Report {
    fn check(&mut self, name: &str, ok: bool, detail: impl Into<String>) -> bool {
        let detail = detail.into();
        log!("{} {} - {}", if ok { "PASS" } else { "FAIL" }, name, detail);
        self.rows.push((name.to_string(), ok, detail));
        ok
    }

    fn failures(&self) -> usize {
        self.rows.iter().filter(|(_, ok, _)| !ok).count()
    }

    fn len(&self) -> usize {
        self.rows.len()
    }
}

fn new_client(cookies: bool) -> Result<Client> {
    Ok(Client::builder()
        .cookie_store(cookies)
        .timeout(Duration::from_secs(30))
        .build()?)
}

// ======================================================
// MP4 inspection: real duration from the `mvhd` box
// ======================================================

fn mp4_duration_secs(data: &[u8]) -> Option<f64> {
    let pos = data.windows(4).position(|w| w == b"mvhd")?;
    let b = data.get(pos + 4..)?;
    let version = *b.first()?;

    let (timescale, duration) = if version == 1 {
        let ts = u32::from_be_bytes(b.get(20..24)?.try_into().ok()?);
        let du = u64::from_be_bytes(b.get(24..32)?.try_into().ok()?);
        (ts, du)
    } else {
        let ts = u32::from_be_bytes(b.get(12..16)?.try_into().ok()?);
        let du = u32::from_be_bytes(b.get(16..20)?.try_into().ok()?) as u64;
        (ts, du)
    };

    if timescale == 0 {
        return None;
    }
    Some(duration as f64 / timescale as f64)
}

// ======================================================
// Auth: signup + login one teacher, and a second user for isolation
// ======================================================

#[derive(Clone)]
struct Users {
    teacher: Client,
    other: Client,
}

async fn setup_users(cfg: &Config, rep: &mut Report) -> Result<Users> {
    let stamp = chrono::Utc::now().timestamp_millis();
    let password = "E2eTest#12345";

    let teacher_email = format!("e2e.teacher.{stamp}@example.com");
    let other_email = format!("e2e.other.{stamp}@example.com");

    log!("Test users: {teacher_email}, {other_email}");

    // signup
    let teacher = new_client(true)?;
    let signup_body =
        json!({"username": "e2e_teacher", "email": teacher_email, "password": password});
    let r = call(
        &teacher,
        Method::POST,
        &format!("{}/api/auth/signup", cfg.api),
        Some(&signup_body),
        true,
    )
    .await?;
    if !rep.check(
        "signup teacher -> 201",
        r.status == StatusCode::CREATED,
        format!("HTTP {}", r.status),
    ) {
        return Err(anyhow!("signup failed, cannot continue"));
    }

    // login (on a fresh client, proving login itself sets the cookie)
    let teacher = new_client(true)?;
    let r = call(
        &teacher,
        Method::POST,
        &format!("{}/api/auth/login", cfg.api),
        Some(&json!({"email": teacher_email, "password": password})),
        true,
    )
    .await?;
    if !rep.check(
        "login teacher -> 200",
        r.status == StatusCode::OK,
        format!("HTTP {}", r.status),
    ) {
        return Err(anyhow!("login failed, cannot continue"));
    }

    // second user, used later for the isolation check
    let other = new_client(true)?;
    let r = call(
        &other,
        Method::POST,
        &format!("{}/api/auth/signup", cfg.api),
        Some(&json!({"username": "e2e_other", "email": other_email, "password": password})),
        true,
    )
    .await?;
    rep.check(
        "signup second user -> 201",
        r.status == StatusCode::CREATED,
        format!("HTTP {}", r.status),
    );

    let r = call(
        &other,
        Method::POST,
        &format!("{}/api/auth/login", cfg.api),
        Some(&json!({"email": other_email, "password": password})),
        true,
    )
    .await?;
    rep.check(
        "login second user -> 200",
        r.status == StatusCode::OK,
        format!("HTTP {}", r.status),
    );

    Ok(Users { teacher, other })
}

// ======================================================
// One full prompt -> video run
// ======================================================

async fn run_scenario(cfg: &Config, users: &Users, sc: &Scenario, rep: &mut Report) {
    let tag = sc.name;

    log!("");
    log!("==================================================");
    log!("SCENARIO: {tag} (library={})", sc.library);
    log!("PROMPT: {}", sc.prompt);
    log!("==================================================");

    // ---- submit ----
    let r = match call(
        &users.teacher,
        Method::POST,
        &format!("{}/api/jobs", cfg.api),
        Some(&json!({ "prompt": sc.prompt, "library": sc.library })),
        true,
    )
    .await
    {
        Ok(r) => r,
        Err(e) => {
            rep.check(&format!("[{tag}] submit job"), false, format!("{e:#}"));
            return;
        }
    };

    let job_id = r.json["data"]["job_id"].as_str().unwrap_or("").to_string();
    if !rep.check(
        &format!("[{tag}] submit job -> 200 with job_id"),
        r.status == StatusCode::OK && !job_id.is_empty(),
        format!("HTTP {} job_id={job_id}", r.status),
    ) {
        return;
    }

    rep.check(
        &format!("[{tag}] API echoes library '{}'", sc.library),
        r.json["data"]["library"] == sc.library,
        format!("data.library={}", r.json["data"]["library"]),
    );

    // ---- poll ----
    let url = format!("{}/api/jobs/{}", cfg.api, job_id);
    let started = Instant::now();
    let mut last_status = String::new();
    let mut last_change = Instant::now();
    let mut last_beat = Instant::now();
    let mut consecutive_errors = 0;

    let data: Value = loop {
        if started.elapsed() > cfg.job_timeout {
            rep.check(
                &format!("[{tag}] job finishes within {}s", cfg.job_timeout.as_secs()),
                false,
                format!(
                    "still '{last_status}' after {}s - check the worker terminal for the reason",
                    started.elapsed().as_secs()
                ),
            );
            return;
        }

        match call(&users.teacher, Method::GET, &url, None, true).await {
            Ok(r) if r.status == StatusCode::OK => {
                consecutive_errors = 0;
                let st = r.json["data"]["status"].as_str().unwrap_or("?").to_string();

                if st != last_status {
                    log!(
                        "[{tag}] STATUS {last_status:?} -> {st:?}  (t+{}s)",
                        started.elapsed().as_secs()
                    );
                    last_status = st.clone();
                    last_change = Instant::now();
                    last_beat = Instant::now();
                } else if last_beat.elapsed() > Duration::from_secs(30) {
                    log!(
                        "[{tag}] ...still {st} after {}s in this state (t+{}s)",
                        last_change.elapsed().as_secs(),
                        started.elapsed().as_secs()
                    );
                    if last_change.elapsed() > Duration::from_secs(300) {
                        log!("[{tag}] WARN: no status change for 5+ min - check the worker terminal");
                    }
                    last_beat = Instant::now();
                }

                if st == "Completed" || st == "Failed" {
                    break r.json["data"].clone();
                }
            }
            Ok(r) => {
                consecutive_errors += 1;
                log!("[{tag}] poll got unexpected HTTP {} ({consecutive_errors}/5)", r.status);
            }
            Err(e) => {
                consecutive_errors += 1;
                log!("[{tag}] poll error ({consecutive_errors}/5): {e:#}");
            }
        }

        if consecutive_errors >= 5 {
            rep.check(&format!("[{tag}] polling job status"), false, "5 consecutive poll errors");
            return;
        }

        tokio::time::sleep(Duration::from_secs(4)).await;
    };

    let total = started.elapsed();

    // ---- failed job: surface the backend error ----
    if data["status"] == "Failed" {
        log!("");
        log!("########## [{tag}] BACKEND REPORTED JOB FAILURE ##########");
        log!("job_id:        {job_id}");
        log!("error_message: {}", data["error_message"].as_str().unwrap_or("<none>"));
        log!("(worker terminal has the full generated code / Docker stderr)");
        log!("############################################################");
        rep.check(
            &format!("[{tag}] job completes"),
            false,
            format!(
                "Failed after {}s: {}",
                total.as_secs(),
                data["error_message"].as_str().unwrap_or("<no error_message>")
            ),
        );
        return;
    }

    log!("Final job data from API: {}", data);

    rep.check(
        &format!("[{tag}] job completes"),
        true,
        format!("Completed in {}s", total.as_secs()),
    );

    rep.check(
        &format!("[{tag}] API returns render metadata"),
        data["duration_seconds"].is_number()
            && data["render_time_ms"].is_number()
            && data["file_size_bytes"].is_number(),
        format!(
            "duration_seconds={} render_time_ms={} file_size_bytes={} (if null: restart api_server to load the new response fields)",
            data["duration_seconds"], data["render_time_ms"], data["file_size_bytes"]
        ),
    );

    // ---- locate + copy video ----
    let video_path = data["video_path"].as_str().unwrap_or("");
    let file_name = video_path.rsplit('/').next().unwrap_or("");
    let renders_dir = if sc.library == "manim" {
        &cfg.renders_dir_manim
    } else {
        &cfg.renders_dir
    };
    let src = renders_dir.join(file_name);

    if !rep.check(
        &format!("[{tag}] video file exists on disk"),
        !file_name.is_empty() && src.exists(),
        format!("api video_path={video_path:?}, looked in {}", src.display()),
    ) {
        log!("Hint: set RENDERS_DIR / RENDERS_DIR_MANIM if the worker's static/renders folder is elsewhere.");
        return;
    }

    if let Err(e) = fs::create_dir_all(&cfg.output_dir) {
        rep.check(&format!("[{tag}] create output dir"), false, format!("{e}"));
        return;
    }

    let dest = cfg
        .output_dir
        .join(format!("{}-{}.mp4", tag, &job_id[..8.min(job_id.len())]));

    if let Err(e) = fs::copy(&src, &dest) {
        rep.check(&format!("[{tag}] copy video to output"), false, format!("{e}"));
        return;
    }

    // ---- verify video ----
    let bytes = match fs::read(&dest) {
        Ok(b) => b,
        Err(e) => {
            rep.check(&format!("[{tag}] read copied video"), false, format!("{e}"));
            return;
        }
    };

    let abs = fs::canonicalize(&dest).unwrap_or(dest.clone());

    rep.check(
        &format!("[{tag}] video size is sane (>100 KB)"),
        bytes.len() > 100_000,
        format!("{} bytes", bytes.len()),
    );

    let is_mp4 = bytes.len() > 12 && &bytes[4..8] == b"ftyp";
    rep.check(&format!("[{tag}] file is a valid mp4 (ftyp header)"), is_mp4, "");

    match mp4_duration_secs(&bytes) {
        Some(secs) => {
            rep.check(
                &format!("[{tag}] video length matches the brief (>= {}s)", sc.min_seconds),
                secs >= sc.min_seconds,
                format!("actual mp4 duration {secs:.1}s"),
            );

            if let Some(reported) = data["duration_seconds"].as_f64() {
                rep.check(
                    &format!("[{tag}] mp4 duration matches DB duration_seconds"),
                    (secs - reported).abs() < 1.5,
                    format!("mp4={secs:.1}s db={reported:.1}s"),
                );
            }
        }
        None => {
            rep.check(&format!("[{tag}] read mp4 duration"), false, "no mvhd box found");
        }
    }

    // ---- content check: did Gemini write code for THIS prompt? (remotion only) ----
    let code_src = cfg.generated_dir.join(format!("{job_id}.tsx"));
    if sc.library != "remotion" || sc.keywords.is_empty() {
        log!("[{tag}] (generated-code topic check skipped: library={}, keywords={:?})", sc.library, sc.keywords);
    } else {
        match fs::read_to_string(&code_src) {
            Ok(code) => {
                let code_dest = dest.with_extension("tsx");
                let _ = fs::copy(&code_src, &code_dest);

                let lower = code.to_lowercase();
                let missing: Vec<&str> = sc
                    .keywords
                    .iter()
                    .copied()
                    .filter(|k| !lower.contains(&k.to_lowercase()))
                    .collect();

                rep.check(
                    &format!("[{tag}] generated code matches the prompt topic"),
                    missing.is_empty(),
                    if missing.is_empty() {
                        format!("all of {:?} found in {}", sc.keywords, code_src.display())
                    } else {
                        format!(
                            "MISSING {:?} in {} - Gemini may have produced the wrong scene",
                            missing,
                            code_src.display()
                        )
                    },
                );
            }
            Err(e) => {
                rep.check(
                    &format!("[{tag}] generated code saved by worker"),
                    false,
                    format!(
                        "cannot read {}: {e} (restart the worker so it saves generated code, or set GENERATED_DIR)",
                        code_src.display()
                    ),
                );
            }
        }
    }

    // ---- isolation: another user must not see this job ----
    match call(&users.other, Method::GET, &url, None, true).await {
        Ok(r) => {
            rep.check(
                &format!("[{tag}] other user cannot read this job -> 404"),
                r.status == StatusCode::NOT_FOUND,
                format!("HTTP {}", r.status),
            );
        }
        Err(e) => {
            rep.check(&format!("[{tag}] isolation check"), false, format!("{e:#}"));
        }
    }

    log!("");
    log!(">>> [{tag}] FINAL VIDEO: {}", abs.display());
}

// ======================================================
// main
// ======================================================

fn open_log_file() -> Result<String> {
    fs::create_dir_all("logs")?;
    let log_path = format!(
        "logs/run-{}.log",
        chrono::Local::now().format("%Y%m%d-%H%M%S")
    );
    *LOG_FILE.lock().unwrap() = Some(fs::File::create(&log_path)?);
    Ok(log_path)
}

fn print_summary(rep: &Report, log_path: &str) {
    log!("");
    log!("================== SUMMARY ==================");
    for (name, ok, detail) in &rep.rows {
        log!(
            "{} {}{}",
            if *ok { "PASS" } else { "FAIL" },
            name,
            if detail.is_empty() { String::new() } else { format!(" - {detail}") }
        );
    }
    log!("=============================================");
    log!(
        "{} passed, {} failed. Full log: {log_path}",
        rep.len() - rep.failures(),
        rep.failures()
    );
}

#[tokio::main]
async fn main() -> Result<()> {
    let cfg = Config::from_env();
    let log_path = open_log_file()?;

    log!("E2E run starting - 1 remotion video + 1 manim video (sun lifecycle)");
    log!("API:                {}", cfg.api);
    log!("Renders dir:        {} (remotion)", cfg.renders_dir.display());
    log!("Renders dir manim:  {}", cfg.renders_dir_manim.display());
    log!("Output dir:         {}", cfg.output_dir.display());
    log!("Job timeout:        {}s", cfg.job_timeout.as_secs());
    log!("Log file:           {log_path}");

    let mut rep = Report::default();

    match setup_users(&cfg, &mut rep).await {
        Ok(users) => {
            run_scenario(&cfg, &users, &REMOTION_SCENARIO, &mut rep).await;
            run_scenario(&cfg, &users, &MANIM_SCENARIO, &mut rep).await;
        }
        Err(e) => {
            log!("SETUP ABORTED: {e:#}");
            rep.check("setup", false, format!("{e:#}"));
        }
    }

    print_summary(&rep, &log_path);

    if rep.failures() > 0 {
        std::process::exit(1);
    }
    Ok(())
}