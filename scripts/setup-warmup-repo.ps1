<#
  PrimeTime warmup repo setup script (Windows PowerShell).

  Review this before you run it -- that's the whole point of it being a
  plain, readable script instead of a black box:
    https://github.com/RamiSmat/primetime/blob/main/scripts/setup-warmup-repo.ps1

  This is the Windows PowerShell twin of setup-warmup-repo.sh (the
  macOS/Linux version) -- keep the two behaviorally in sync.

  Usage (run in a stock Windows PowerShell 5.1+ console):
    &([scriptblock]::Create((irm <raw-url-to-this-file>))) <owner>/<repo> <primetime-web-url>

  What this does, in order (each step below is announced before it runs):
    1. Checks that git, node, npm, gh, and codex are all on your PATH.
    2. Makes sure you're logged into `gh` and Codex, prompting you to log in
       (in your terminal / browser) only if you aren't already.
    3. Creates <repo> (as private) via `gh repo create`, if it doesn't
       already exist. PrimeTime's backend never creates repositories
       itself -- GitHub rejects that from any kind of GitHub App token, by
       design -- so this always runs as your own full `gh` login.
    4. Clones and builds PrimeTime into a throwaway temp directory that is
       deleted when this script exits -- PrimeTime isn't published as an
       installable package yet, so this is how the CLI is run for now.
    5. Sends your local Codex session to <repo>'s CODEX_AUTH_JSON secret.
       `gh` encrypts it and sends it directly to GitHub's API -- this script
       and PrimeTime's own backend never see the session itself.
    6. Adds or updates .github/workflows/primetime-codex-primer.yml in
       <repo> via the GitHub API -- no local clone of <repo> needed.

  Safe to re-run at any time.
#>

param(
  [Parameter(Position = 0)]
  [string]$Repo,

  [Parameter(Position = 1)]
  [string]$PrimeTimeWebUrl
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $Repo -or -not $PrimeTimeWebUrl) {
  Write-Host "error: Usage: setup-warmup-repo.ps1 <owner>/<repo> <primetime-web-url>"
  exit 1
}

$PrimeTimeSourceRepo = "https://github.com/RamiSmat/primetime.git"
$RawTemplateUrl = "https://raw.githubusercontent.com/RamiSmat/primetime/main/templates/github-actions/codex-prime-hosted.yml"
$WorkflowPath = ".github/workflows/primetime-codex-primer.yml"

function Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Die([string]$Message) {
  Write-Host "error: $Message" -ForegroundColor Red
  exit 1
}

Step "Checking prerequisites"
foreach ($cmd in @("git", "node", "npm", "gh", "codex")) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Die "'$cmd' is required but wasn't found on PATH. Install it and re-run this script."
  }
}
Write-Host "  git, node, npm, gh, and codex are all installed."

Step "Checking GitHub CLI login"
& gh auth status *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Host "  Already logged in."
} else {
  Write-Host "  Not logged in -- starting 'gh auth login' (this will prompt you)."
  & gh auth login
  if ($LASTEXITCODE -ne 0) { Die "'gh auth login' failed." }
}

Step "Checking Codex login"
$codexStatus = (& codex login status 2>&1 | Out-String)
if ($codexStatus -match "(?i)not logged in") {
  Write-Host "  Not logged in -- starting 'codex login' (this will prompt you)."
  & codex login
  if ($LASTEXITCODE -ne 0) { Die "'codex login' failed." }
} else {
  Write-Host "  Already logged in (the next step will tell you if it's not a usable login method)."
}

Step "Ensuring $Repo exists"
& gh repo view $Repo *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Host "  Already exists."
} else {
  Write-Host "  Creating it as a new private repository."
  & gh repo create $Repo --private `
    --description "Created by PrimeTime -- holds the scheduled workflow that warms up your AI coding CLI." `
    *> $null
  if ($LASTEXITCODE -ne 0) { Die "Failed to create '$Repo' via gh repo create." }
}

$WorkDir = Join-Path $env:TEMP ("primetime-warmup-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $WorkDir | Out-Null

try {
  Step "Cloning PrimeTime into a temporary directory"
  $CloneDir = Join-Path $WorkDir "primetime"
  Write-Host "  $CloneDir -- deleted automatically when this script exits."
  & git clone --quiet --depth 1 $PrimeTimeSourceRepo $CloneDir
  if ($LASTEXITCODE -ne 0) { Die "git clone failed." }

  Step "Building PrimeTime"
  Push-Location $CloneDir
  try {
    & npm install
    if ($LASTEXITCODE -ne 0) { Die "npm install failed." }
    & npm run build
    if ($LASTEXITCODE -ne 0) { Die "npm run build failed." }
  } finally {
    Pop-Location
  }

  Step "Sending your Codex session to $Repo as the CODEX_AUTH_JSON secret"
  Write-Host "  gh performs GitHub's required encryption locally; nothing passes through PrimeTime's backend."
  $env:GH_REPO = $Repo
  try {
    & node (Join-Path $CloneDir "apps/cli/dist/src/bin.js") setup codex
    if ($LASTEXITCODE -ne 0) { Die "'primetime setup codex' failed." }
  } finally {
    Remove-Item Env:\GH_REPO -ErrorAction SilentlyContinue
  }

  Step "Adding the scheduled workflow to $Repo"
  $TmpWorkflow = Join-Path $WorkDir "workflow.yml"
  $template = Invoke-RestMethod -Uri $RawTemplateUrl
  $template = $template.Replace("https://primetime.example.invalid", $PrimeTimeWebUrl)
  [System.IO.File]::WriteAllText($TmpWorkflow, $template, (New-Object System.Text.UTF8Encoding($false)))

  $existingSha = $null
  $existingSha = & gh api "repos/$Repo/contents/$WorkflowPath" --jq ".sha" 2>$null
  if ($LASTEXITCODE -ne 0) { $existingSha = $null }

  $contentB64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($TmpWorkflow))
  if ($existingSha) {
    Write-Host "  $WorkflowPath already exists in $Repo -- updating it."
    & gh api --method PUT "repos/$Repo/contents/$WorkflowPath" `
      -f "message=Update PrimeTime scheduled workflow" -f "content=$contentB64" -f "sha=$existingSha" *> $null
  } else {
    Write-Host "  Creating $WorkflowPath."
    & gh api --method PUT "repos/$Repo/contents/$WorkflowPath" `
      -f "message=Add PrimeTime scheduled workflow" -f "content=$contentB64" *> $null
  }
  if ($LASTEXITCODE -ne 0) { Die "Failed to write $WorkflowPath via gh api." }

  Step "Done"
  Write-Host "  $Repo is set up. $WorkflowPath runs on its own cron schedule --"
  Write-Host "  edit that schedule, or trigger it once by hand from the repo's Actions tab to test it now."
} finally {
  Remove-Item -Recurse -Force $WorkDir -ErrorAction SilentlyContinue
}
