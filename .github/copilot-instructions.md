# Project working rules

- Use the repository directory as the workspace root. Resolve it from the current checkout so the same commands work after cloning.
- Run commands from the workspace root and prefer relative paths. In PowerShell use `-LiteralPath` for exact paths.
- For project analysis, first read `README.md`, `main.py`, and the Python source under `weather_agent/`. Read tests only when relevant.
- Never recursively enumerate a parent directory or a whole drive to rediscover this project. If the workspace path is unavailable, report that failure and stop searching.
- Exclude `.venv`, `__pycache__`, `.git`, and installed dependencies from searches and file listings. Prefer `rg --files -g '*.py' -g '!.venv/**' -g '!**/__pycache__/**'` over recursive PowerShell directory listings.
- Keep tool output short and relevant. Do not dump entire directory trees into the conversation.
- After a failed command, inspect the error and correct it once. If the same operation fails again, explain the blocker instead of repeating broad searches.
- For a read-only analysis request, do not modify files or install packages. Give a concise explanation after reading the relevant source files.
- A request for current weather requires live data. Use the project's weather tools when explicitly running the weather agent; do not infer live weather from model knowledge. Ask for a city when missing.
