Put the two files "authentication plan" and "auth execution guide" in api_server/docs/ (I will add them myself; if missing, tell me and stop).

Ground rules for this entire job:
1. NEVER run git push, git commit, git add, git reset, or anything that changes git state or touches the remote. I do commits and pushes myself.
2. Work ONLY inside api_server. Do not touch manim_worker or remotion_worker.
3. Make small-to-medium changes. One prompt = one focused change. No refactors, no renamed files, no new dependencies unless the prompt says so. If something seems to need a bigger change, stop and ask me.
4. Follow the plan doc and execution guide exactly. Section numbers (§) refer to the plan.
5. After each task: list the files you changed, summarise in 3-5 lines, and give me the exact curl / mongosh / redis-cli commands to run the guide's tests for that task. Then STOP and wait. Do not continue to the next phase.
6. Never print or log secrets, tokens, codes, JWTs, or passwords.
7. Run `cargo check` (and `cargo build` when you change Cargo.toml) before telling me you are done. Fix any warnings you caused.

Now read both docs and src/ (routes, controller, middleware, models, schema, utils, main.rs). Reply with a short summary of how auth works today and anything in the docs that does not match the code. Change nothing yet.