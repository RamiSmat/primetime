<#
  PrimeTime warmup repo setup script (Windows PowerShell).

  Review this before you run it -- that's the whole point of it being a
  plain, readable script instead of a black box:
    https://github.com/RamiSmat/primetime/blob/main/scripts/setup-warmup-repo.ps1

  This is the Windows PowerShell twin of setup-warmup-repo.sh (the
  macOS/Linux version) -- keep the two behaviorally in sync.

  Usage (run in a stock Windows PowerShell 5.1+ console):
    &([scriptblock]::Create((irm <raw-url-to-this-file>))) <owner>/<repo> <primetime-web-url> [provider...] [--schedule-base64=<base64>]

  <provider...> is one or more of: codex, claude-code. Defaults to "codex"
  alone when omitted. --schedule-base64 (added by the PrimeTime dashboard's
  generated command) carries your saved warmup schedule as base64-encoded
  JSON; omit it to skip adding .primetime/schedule.json.

  What this does, in order (each step below is announced before it runs):
    1. Checks that git, node, npm, and gh are on your PATH (hard requirement),
       then checks each selected provider's CLI -- a provider whose CLI isn't
       found is skipped with a warning rather than aborting the whole run.
       You only need at least one selected provider's CLI installed.
    2. Makes sure you're logged into `gh` and each remaining provider,
       prompting you to log in (in your terminal / browser) only if you
       aren't already. A provider whose login or setup step fails is also
       skipped with a warning -- the run only fails outright if none of your
       selected providers end up configured.
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
    7. Adds or updates .primetime/schedule.json in <repo> from
       --schedule-base64, the same way -- this is what each scheduled
       workflow's due-check step reads to decide when to actually prime, so
       the workflow never needs to call back to PrimeTime's backend.

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

$ScheduleBase64 = ""
$RemainingProviders = @()
foreach ($arg in $Providers) {
  if ($arg -like "--schedule-base64=*") {
    $ScheduleBase64 = $arg.Substring("--schedule-base64=".Length)
  } else {
    $RemainingProviders += $arg
  }
}
$Providers = $RemainingProviders

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

# PowerShell 5.1 treats any native command that both exits non-zero and
# writes to stderr as a terminating NativeCommandError once that stream is
# redirected -- even to $null -- as long as $ErrorActionPreference is "Stop".
# Every call below that intentionally lets a native command fail (and checks
# $LASTEXITCODE afterward instead of crashing) needs to run through this
# wrapper, which scopes $ErrorActionPreference to "Continue" for just that call.
function Invoke-NativeAllowFailure([scriptblock]$Command) {
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $Command
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
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
# credential as this repo's secret via `primetime setup <provider>`. Returns
# $true/$false instead of dying, so one failing provider doesn't take the
# others down -- see the caller.
function Invoke-ProviderSetup([string]$Provider, [string]$CloneDir) {
  switch ($Provider) {
    "codex" {
      Step "Checking Codex login"
      # codex writes this status text to stderr, not stdout.
      $codexStatus = Invoke-NativeAllowFailure { (& codex login status 2>&1 | Out-String) }
      if ($codexStatus -match "(?i)not logged in") {
        Write-Host "  Not logged in -- starting 'codex login' (this will prompt you)."
        & codex login
        if ($LASTEXITCODE -ne 0) { Write-Warning "'codex login' failed."; return $false }
      } else {
        Write-Host "  Already logged in (the next step will tell you if it's not a usable login method)."
      }

      Step "Sending your Codex session to $Repo as the CODEX_AUTH_JSON secret"
      Write-Host "  gh performs GitHub's required encryption locally; nothing passes through PrimeTime's backend."
      $env:GH_REPO = $Repo
      try {
        & node (Join-Path $CloneDir "apps/cli/dist/src/bin.js") setup codex
        if ($LASTEXITCODE -ne 0) { Write-Warning "'primetime setup codex' failed."; return $false }
      } finally {
        Remove-Item Env:\GH_REPO -ErrorAction SilentlyContinue
      }
      return $true
    }
    "claude-code" {
      Step "Getting a Claude Code CI token"
      Write-Host "  Running 'claude setup-token' -- it opens a browser to authorize if needed, then prints a one-year token."
      $claudeCodeToken = (& claude setup-token | Out-String).Trim()
      if ($LASTEXITCODE -ne 0 -or -not $claudeCodeToken) { Write-Warning "'claude setup-token' failed."; return $false }

      Step "Sending it to $Repo as the CLAUDE_CODE_OAUTH_TOKEN secret"
      Write-Host "  gh performs GitHub's required encryption locally; nothing passes through PrimeTime's backend."
      $env:GH_REPO = $Repo
      try {
        $claudeCodeToken | & node (Join-Path $CloneDir "apps/cli/dist/src/bin.js") setup claude-code
        if ($LASTEXITCODE -ne 0) { Write-Warning "'primetime setup claude-code' failed."; return $false }
      } finally {
        Remove-Item Env:\GH_REPO -ErrorAction SilentlyContinue
      }
      return $true
    }
  }
}

foreach ($provider in $Providers) {
  Get-ProviderLabel $provider | Out-Null
}

Step "Checking prerequisites"
$requiredCmds = @("git", "node", "npm", "gh")
foreach ($cmd in $requiredCmds) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Die "'$cmd' is required but wasn't found on PATH. Install it and re-run this script."
  }
}

$originalProviders = $Providers
$ActiveProviders = @()
foreach ($provider in $Providers) {
  $cliBin = Get-ProviderCliBinary $provider
  if (Get-Command $cliBin -ErrorAction SilentlyContinue) {
    $ActiveProviders += $provider
  } else {
    Write-Host "  warning: '$cliBin' (needed for $(Get-ProviderLabel $provider)) wasn't found on PATH -- skipping $(Get-ProviderLabel $provider)." -ForegroundColor Yellow
  }
}
if ($ActiveProviders.Count -eq 0) {
  Die "None of the selected providers' CLIs were found on PATH: $($originalProviders -join ', '). Install at least one and re-run this script."
}
$Providers = $ActiveProviders
Write-Host "  $($requiredCmds -join ', ') are all installed; providers ready: $($Providers -join ', ')."

Step "Checking GitHub CLI login"
Invoke-NativeAllowFailure { & gh auth status *> $null }
if ($LASTEXITCODE -eq 0) {
  Write-Host "  Already logged in."
} else {
  Write-Host "  Not logged in -- starting 'gh auth login' (this will prompt you)."
  & gh auth login
  if ($LASTEXITCODE -ne 0) { Die "'gh auth login' failed." }
}

Step "Ensuring $Repo exists"
Invoke-NativeAllowFailure { & gh repo view $Repo *> $null }
if ($LASTEXITCODE -eq 0) {
  Write-Host "  Already exists."
} else {
  Write-Host "  Creating it as a new private repository."
  Invoke-NativeAllowFailure {
    & gh repo create $Repo --private `
      --description "Created by PrimeTime -- holds the scheduled workflow that warms up your AI coding CLI." `
      *> $null
  }
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

  $ActiveProviders = @()
  foreach ($provider in $Providers) {
    if (Invoke-ProviderSetup $provider $CloneDir) {
      $ActiveProviders += $provider
    } else {
      Write-Host "  warning: setting up $(Get-ProviderLabel $provider) failed -- skipping it. Re-run this script later to retry." -ForegroundColor Yellow
    }
  }
  if ($ActiveProviders.Count -eq 0) {
    Die "Setup failed for every selected provider. See the warnings above."
  }
  $Providers = $ActiveProviders

  foreach ($provider in $Providers) {
    $label = Get-ProviderLabel $provider
    $workflowPath = Get-ProviderWorkflowPath $provider
    $templateUrl = Get-ProviderTemplateUrl $provider

    Step "Adding the $label scheduled workflow to $Repo"
    $tmpWorkflow = Join-Path $WorkDir "workflow-$provider.yml"
    $template = Invoke-RestMethod -Uri $templateUrl
    $template = $template.Replace("https://primetime.example.invalid", $PrimeTimeWebUrl)
    [System.IO.File]::WriteAllText($tmpWorkflow, $template, (New-Object System.Text.UTF8Encoding($false)))

    $existingSha = Invoke-NativeAllowFailure { & gh api "repos/$Repo/contents/$workflowPath" --jq ".sha" 2>$null }
    if ($LASTEXITCODE -ne 0) { $existingSha = $null }

    $contentB64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($tmpWorkflow))
    if ($existingSha) {
      Write-Host "  $workflowPath already exists in $Repo -- updating it."
      Invoke-NativeAllowFailure {
        & gh api --method PUT "repos/$Repo/contents/$workflowPath" `
          -f "message=Update PrimeTime $label scheduled workflow" -f "content=$contentB64" -f "sha=$existingSha" *> $null
      }
    } else {
      Write-Host "  Creating $workflowPath."
      Invoke-NativeAllowFailure {
        & gh api --method PUT "repos/$Repo/contents/$workflowPath" `
          -f "message=Add PrimeTime $label scheduled workflow" -f "content=$contentB64" *> $null
      }
    }
    if ($LASTEXITCODE -ne 0) { Die "Failed to write $workflowPath via gh api." }
  }

  if ($ScheduleBase64) {
    Step "Adding your warmup schedule to $Repo"
    # --schedule-base64 is already base64 of the exact JSON bytes GitHub's
    # Contents API wants, so it's passed straight through as this file's
    # content -- no local decode/re-encode round trip needed.
    $existingSha = Invoke-NativeAllowFailure { & gh api "repos/$Repo/contents/.primetime/schedule.json" --jq ".sha" 2>$null }
    if ($LASTEXITCODE -ne 0) { $existingSha = $null }

    if ($existingSha) {
      Write-Host "  .primetime/schedule.json already exists in $Repo -- updating it."
      Invoke-NativeAllowFailure {
        & gh api --method PUT "repos/$Repo/contents/.primetime/schedule.json" `
          -f "message=Update PrimeTime warmup schedule" -f "content=$ScheduleBase64" -f "sha=$existingSha" *> $null
      }
    } else {
      Write-Host "  Creating .primetime/schedule.json."
      Invoke-NativeAllowFailure {
        & gh api --method PUT "repos/$Repo/contents/.primetime/schedule.json" `
          -f "message=Add PrimeTime warmup schedule" -f "content=$ScheduleBase64" *> $null
      }
    }
    if ($LASTEXITCODE -ne 0) { Die "Failed to write .primetime/schedule.json via gh api." }
  } else {
    Write-Host ""
    Write-Host "  No --schedule-base64 provided -- skipping .primetime/schedule.json."
    Write-Host "  Each scheduled workflow's due-check step will fail until one is added"
    Write-Host "  (save a schedule on the PrimeTime dashboard and re-run this command)."
  }

  Step "Done"
  Write-Host "  $Repo is set up. Each workflow added above runs on its own cron schedule --"
  Write-Host "  edit that schedule, or trigger one by hand from the repo's Actions tab to test it now."
} finally {
  Remove-Item -Recurse -Force $WorkDir -ErrorAction SilentlyContinue
}
