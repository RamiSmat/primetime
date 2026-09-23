<#
  PrimeTime warmup repo setup script (Windows PowerShell).

  Review this before you run it -- that's the whole point of it being a
  plain, readable script instead of a black box:
    https://github.com/RamiSmat/primetime/blob/main/scripts/setup-warmup-repo.ps1

  This is the Windows PowerShell twin of setup-warmup-repo.sh (the
  macOS/Linux version) -- keep the two behaviorally in sync.

  Usage (run in a stock Windows PowerShell 5.1+ console):
    &([scriptblock]::Create((irm <raw-url-to-this-file>))) <owner>/<repo> <primetime-web-url> [provider...]

  <provider...> is one or more of: codex, claude-code. Defaults to "codex"
  alone when omitted.

  What this does, in order (each step below is announced before it runs):
    1. Checks that git, node, npm, gh, and each selected provider's CLI are
       all on your PATH.
    2. Makes sure you're logged into `gh` and each selected provider,
       prompting you to log in (in your terminal / browser) only if you
       aren't already.
    3. Creates <repo> (as private) via `gh repo create`, if it doesn't
       already exist. PrimeTime's backend never creates repositories
       itself -- GitHub rejects that from any kind of GitHub App token, by
       design -- so this always runs as your own full `gh` login.
    4. Clones and builds PrimeTime into a throwaway temp directory that is
       deleted when this script exits -- PrimeTime isn't published as an
       installable package yet, so this is how the CLI is run for now.
    5. Sends your local session/token for each selected provider to
       <repo>'s secrets. `gh` encrypts it and sends it directly to GitHub's
       API -- this script and PrimeTime's own backend never see it.
    6. Adds or updates the scheduled workflow file for each selected
       provider in <repo> via the GitHub API -- no local clone of <repo>
       needed.

  Safe to re-run at any time.
#>

param(
  [Parameter(Position = 0)]
  [string]$Repo,

  [Parameter(Position = 1)]
  [string]$PrimeTimeWebUrl,

  [Parameter(Position = 2, ValueFromRemainingArguments = $true)]
  [string[]]$Providers
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $Repo -or -not $PrimeTimeWebUrl) {
  Write-Host "error: Usage: setup-warmup-repo.ps1 <owner>/<repo> <primetime-web-url> [provider...]"
  exit 1
}

if (-not $Providers -or $Providers.Count -eq 0) {
  $Providers = @("codex")
}

$PrimeTimeSourceRepo = "https://github.com/RamiSmat/primetime.git"

function Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Die([string]$Message) {
  Write-Host "error: $Message" -ForegroundColor Red
  exit 1
}

function Get-ProviderLabel([string]$Provider) {
  switch ($Provider) {
    "codex" { return "Codex" }
    "claude-code" { return "Claude Code" }
    default { Die "Unknown provider '$Provider'. Supported providers: codex, claude-code." }
  }
}

function Get-ProviderCliBinary([string]$Provider) {
  switch ($Provider) {
    "codex" { return "codex" }
    "claude-code" { return "claude" }
  }
}

function Get-ProviderTemplateUrl([string]$Provider) {
  switch ($Provider) {
    "codex" { return "https://raw.githubusercontent.com/RamiSmat/primetime/main/templates/github-actions/codex-prime-hosted.yml" }
    "claude-code" { return "https://raw.githubusercontent.com/RamiSmat/primetime/main/templates/github-actions/claude-code-prime.yml" }
  }
}

function Get-ProviderWorkflowPath([string]$Provider) {
  switch ($Provider) {
    "codex" { return ".github/workflows/primetime-codex-primer.yml" }
    "claude-code" { return ".github/workflows/primetime-claude-code-primer.yml" }
  }
}

# Runs each provider's local login-check-and-transfer flow, storing its
# credential as this repo's secret via `primetime setup <provider>`.
function Invoke-ProviderSetup([string]$Provider, [string]$CloneDir) {
  switch ($Provider) {
    "codex" {
      Step "Checking Codex login"
      $codexStatus = (& codex login status 2>&1 | Out-String)
      if ($codexStatus -match "(?i)not logged in") {
        Write-Host "  Not logged in -- starting 'codex login' (this will prompt you)."
        & codex login
        if ($LASTEXITCODE -ne 0) { Die "'codex login' failed." }
      } else {
        Write-Host "  Already logged in (the next step will tell you if it's not a usable login method)."
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
    }
    "claude-code" {
      Step "Getting a Claude Code CI token"
      Write-Host "  Running 'claude setup-token' -- it opens a browser to authorize if needed, then prints a one-year token."
      $claudeCodeToken = (& claude setup-token | Out-String).Trim()
      if ($LASTEXITCODE -ne 0 -or -not $claudeCodeToken) { Die "'claude setup-token' failed." }

      Step "Sending it to $Repo as the CLAUDE_CODE_OAUTH_TOKEN secret"
      Write-Host "  gh performs GitHub's required encryption locally; nothing passes through PrimeTime's backend."
      $env:GH_REPO = $Repo
      try {
        $claudeCodeToken | & node (Join-Path $CloneDir "apps/cli/dist/src/bin.js") setup claude-code
        if ($LASTEXITCODE -ne 0) { Die "'primetime setup claude-code' failed." }
      } finally {
        Remove-Item Env:\GH_REPO -ErrorAction SilentlyContinue
      }
    }
  }
}

foreach ($provider in $Providers) {
  Get-ProviderLabel $provider | Out-Null
}

Step "Checking prerequisites"
$requiredCmds = @("git", "node", "npm", "gh") + ($Providers | ForEach-Object { Get-ProviderCliBinary $_ })
foreach ($cmd in $requiredCmds) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Die "'$cmd' is required but wasn't found on PATH. Install it and re-run this script."
  }
}
Write-Host "  $($requiredCmds -join ', ') are all installed."

Step "Checking GitHub CLI login"
& gh auth status *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Host "  Already logged in."
} else {
  Write-Host "  Not logged in -- starting 'gh auth login' (this will prompt you)."
  & gh auth login
  if ($LASTEXITCODE -ne 0) { Die "'gh auth login' failed." }
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

  foreach ($provider in $Providers) {
    Invoke-ProviderSetup $provider $CloneDir
  }

  foreach ($provider in $Providers) {
    $label = Get-ProviderLabel $provider
    $workflowPath = Get-ProviderWorkflowPath $provider
    $templateUrl = Get-ProviderTemplateUrl $provider

    Step "Adding the $label scheduled workflow to $Repo"
    $tmpWorkflow = Join-Path $WorkDir "workflow-$provider.yml"
    $template = Invoke-RestMethod -Uri $templateUrl
    $template = $template.Replace("https://primetime.example.invalid", $PrimeTimeWebUrl)
    [System.IO.File]::WriteAllText($tmpWorkflow, $template, (New-Object System.Text.UTF8Encoding($false)))

    $existingSha = $null
    $existingSha = & gh api "repos/$Repo/contents/$workflowPath" --jq ".sha" 2>$null
    if ($LASTEXITCODE -ne 0) { $existingSha = $null }

    $contentB64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($tmpWorkflow))
    if ($existingSha) {
      Write-Host "  $workflowPath already exists in $Repo -- updating it."
      & gh api --method PUT "repos/$Repo/contents/$workflowPath" `
        -f "message=Update PrimeTime $label scheduled workflow" -f "content=$contentB64" -f "sha=$existingSha" *> $null
    } else {
      Write-Host "  Creating $workflowPath."
      & gh api --method PUT "repos/$Repo/contents/$workflowPath" `
        -f "message=Add PrimeTime $label scheduled workflow" -f "content=$contentB64" *> $null
    }
    if ($LASTEXITCODE -ne 0) { Die "Failed to write $workflowPath via gh api." }
  }

  Step "Done"
  Write-Host "  $Repo is set up. Each workflow added above runs on its own cron schedule --"
  Write-Host "  edit that schedule, or trigger one by hand from the repo's Actions tab to test it now."
} finally {
  Remove-Item -Recurse -Force $WorkDir -ErrorAction SilentlyContinue
}
