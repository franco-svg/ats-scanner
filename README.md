# ats-scanner

An ATS-focused toolkit with:

- **Home** overview page
- **ATS Scanner** (upload PDF + check keywords)
- **Job Analyzer** (extract relevant job-post words and copy one-per-line output for ATS Scanner)

## Run locally

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Merge workflow (quick)

If your latest work is already committed on branch `work`:

```bash
git push origin work
```

Then open a PR from `work` to your target branch (usually `main`) and merge from GitHub.
