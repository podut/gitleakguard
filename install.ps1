# gitleakguard installer for Windows (PowerShell 5.1+)
# Usage:
#   irm https://raw.githubusercontent.com/podut/gitleakguard/main/install.ps1 | iex
#   Or locally: .\install.ps1 [-Global] [-NoEditorSkills] [-HookOnly]
#
# Parameters:
#   -Global           Install AI editor skills globally (~/.claude, ~/.cursor, ~/.gemini)
#   -NoEditorSkills   Skip AI editor skill installation
#   -HookOnly         Only install the pre-commit hook

[CmdletBinding()]
param(
    [switch]$Global,
    [switch]$NoEditorSkills,
    [switch]$HookOnly
)

$ErrorActionPreference = "Stop"
$REPO = "https://raw.githubusercontent.com/podut/gitleakguard/main"
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

function Write-Step { param($msg) Write-Host "" ; Write-Host "> $msg" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "[!!] $msg" -ForegroundColor Yellow }
function Write-Err  { param($msg) Write-Host "[XX] $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "     $msg" -ForegroundColor Gray }

# ── Helpers ───────────────────────────────────────────────────────────────────

function Get-ScriptRoot {
    if ($PSScriptRoot) { return $PSScriptRoot }
    return (Get-Location).Path
}

function Get-RemoteContent {
    param([string]$Url)
    (Invoke-WebRequest -Uri $Url -UseBasicParsing -ErrorAction Stop).Content
}

function Get-FileContent {
    param([string]$LocalRelPath, [string]$RemoteSuffix)
    $local = Join-Path (Get-ScriptRoot) $LocalRelPath
    if (Test-Path $local) { return Get-Content $local -Raw -Encoding UTF8 }
    return Get-RemoteContent "$REPO/$RemoteSuffix"
}

function Write-FileNoBom {
    param([string]$Path, [string]$Content)
    $dir = Split-Path $Path -Parent
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

# ── Prerequisites ─────────────────────────────────────────────────────────────

function Test-Prerequisites {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Err "git is not installed. Install from: https://git-scm.com/download/win"
        exit 1
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Warn "Node.js not found. The pre-commit hook requires Node >= 18."
        Write-Info "Install from: https://nodejs.org"
    }
}

function Test-GitRepo {
    $result = git rev-parse --git-dir 2>$null
    return $LASTEXITCODE -eq 0
}

# ── Hook ──────────────────────────────────────────────────────────────────────

function Install-Hook {
    $gitDir   = (Resolve-Path (git rev-parse --git-dir 2>$null)).Path
    $hooksDir = Join-Path $gitDir "hooks"
    $hookDst  = Join-Path $hooksDir "pre-commit"

    New-Item -ItemType Directory -Force -Path $hooksDir | Out-Null

    if ((Test-Path $hookDst) -and -not (Select-String -Path $hookDst -Pattern "gitleakguard" -Quiet -ErrorAction SilentlyContinue)) {
        Write-Warn "Existing pre-commit hook found. Backing up to pre-commit.bak"
        Copy-Item $hookDst "$hookDst.bak" -Force
    }

    $content = Get-FileContent "hooks/pre-commit" "hooks/pre-commit"
    Write-FileNoBom $hookDst $content

    try { git update-index --chmod=+x $hookDst 2>$null } catch {}

    Write-Ok "Pre-commit hook installed -> $hookDst"
}

# ── .gitignore ────────────────────────────────────────────────────────────────

function Set-Gitignore {
    $gitignore = Join-Path (Get-Location).Path ".gitignore"
    $entries   = @(".env", ".env.local", ".env.*.local", "*.pem", "*.key")
    $existing  = if (Test-Path $gitignore) { Get-Content $gitignore } else { @() }
    $added     = 0

    foreach ($entry in $entries) {
        if ($existing -notcontains $entry) {
            Add-Content -Path $gitignore -Value $entry -Encoding UTF8
            $added++
        }
    }

    if ($added -gt 0) {
        Write-Ok ".gitignore updated ($added entries added)"
    } else {
        Write-Ok ".gitignore already has required entries"
    }
}

# ── .env.example ──────────────────────────────────────────────────────────────

function New-EnvExample {
    $envExample = Join-Path (Get-Location).Path ".env.example"
    if (-not (Test-Path $envExample)) {
        $lines = @(
            "# Copy this file to .env and fill in your real values",
            "# NEVER commit .env to git -- it is in .gitignore",
            "",
            "# AI / LLM",
            "OPENAI_API_KEY=your_openai_key_here",
            "ANTHROPIC_API_KEY=your_anthropic_key_here",
            "",
            "# Database",
            "DATABASE_URL=postgresql://user:password@localhost:5432/mydb",
            "",
            "# Auth",
            "SECRET_KEY=your_secret_key_here",
            "JWT_SECRET=your_jwt_secret_here",
            "",
            "# Payments",
            "STRIPE_SECRET_KEY=your_stripe_key_here"
        )
        Write-FileNoBom $envExample ($lines -join "`n")
        Write-Ok ".env.example created"
    } else {
        Write-Ok ".env.example already exists"
    }
}

# ── AI Editor Skills ───────────────────────────────────────────────────────────

function Install-ClaudeSkill {
    try {
        $target  = "$HOME\.claude\commands\gitleakguard.md"
        $content = Get-FileContent ".claude/commands/gitleakguard.md" ".claude/commands/gitleakguard.md"
        Write-FileNoBom $target $content
        Write-Ok "Claude Code -> $target"
        Write-Info "Use /gitleakguard in any Claude Code conversation"
    } catch {
        Write-Warn "Claude skill failed: $_"
    }
}

function Install-CursorSkill {
    try {
        $target  = "$HOME\.cursor\skills\gitleakguard\SKILL.md"
        $content = Get-FileContent "skills/gitleakguard/SKILL.md" "skills/gitleakguard/SKILL.md"
        Write-FileNoBom $target $content
        Write-Ok "Cursor -> $target"
        Write-Info "Use /gitleakguard in Cursor Agent mode"
    } catch {
        Write-Warn "Cursor skill failed: $_"
    }
}

function Install-GeminiSkill {
    if (-not (Get-Command gemini -ErrorAction SilentlyContinue)) {
        Write-Warn "Gemini CLI not found -- skipping"
        Write-Info "Install with: npm install -g @google/gemini-cli"
        return
    }

    $local = Join-Path (Get-ScriptRoot) "gitleakguard.skill"
    $skillFile = $null

    if (Test-Path $local) {
        $skillFile = $local
    } else {
        try {
            $tmp = [System.IO.Path]::GetTempFileName() + ".skill"
            Invoke-WebRequest -Uri "$REPO/gitleakguard.skill" -OutFile $tmp -UseBasicParsing -ErrorAction Stop
            $skillFile = $tmp
        } catch {
            Write-Warn "Could not get gitleakguard.skill -- skipping Gemini"
            return
        }
    }

    try {
        "Y" | gemini skills install $skillFile --scope user 2>$null
        Write-Ok "Gemini CLI skill installed"
        Write-Info "Run /skills reload in Gemini CLI, then use /gitleakguard"
    } catch {
        Write-Warn "Gemini install failed. Run: gemini skills install gitleakguard.skill --scope user"
    } finally {
        if ($skillFile -ne $local -and (Test-Path $skillFile)) { Remove-Item $skillFile -Force }
    }
}

function Install-ProjectInstructions {
    Write-Step "Installing AI instruction files in project"
    $cwd = (Get-Location).Path

    # GEMINI.md — Gemini CLI + Antigravity (always active)
    $geminiMd = Join-Path $cwd "GEMINI.md"
    try {
        $content = Get-FileContent "templates/GEMINI.md" "templates/GEMINI.md"
        if (-not (Test-Path $geminiMd)) {
            Write-FileNoBom $geminiMd $content
            Write-Ok "GEMINI.md -> project root (Gemini CLI + Antigravity)"
        } elseif (-not (Select-String -Path $geminiMd -Pattern "gitleakguard" -Quiet -ErrorAction SilentlyContinue)) {
            Add-Content -Path $geminiMd -Value "`n$content" -Encoding UTF8
            Write-Ok "GEMINI.md -> gitleakguard rules appended"
        } else {
            Write-Ok "GEMINI.md already has gitleakguard rules"
        }
    } catch { Write-Warn "GEMINI.md failed: $_" }

    # CLAUDE.md — Claude Code (always active)
    $claudeMd = Join-Path $cwd "CLAUDE.md"
    try {
        $content = Get-FileContent "templates/CLAUDE.md" "templates/CLAUDE.md"
        if (-not (Test-Path $claudeMd)) {
            Write-FileNoBom $claudeMd $content
            Write-Ok "CLAUDE.md -> project root (Claude Code)"
        } elseif (-not (Select-String -Path $claudeMd -Pattern "gitleakguard" -Quiet -ErrorAction SilentlyContinue)) {
            Add-Content -Path $claudeMd -Value "`n$content" -Encoding UTF8
            Write-Ok "CLAUDE.md -> gitleakguard rules appended"
        } else {
            Write-Ok "CLAUDE.md already has gitleakguard rules"
        }
    } catch { Write-Warn "CLAUDE.md failed: $_" }

    # .cursor/rules/gitleakguard.mdc — Cursor alwaysApply rule
    $cursorRule = Join-Path $cwd ".cursor/rules/gitleakguard.mdc"
    if (-not (Test-Path $cursorRule)) {
        try {
            $content = Get-FileContent "templates/cursor-rule.mdc" "templates/cursor-rule.mdc"
            Write-FileNoBom $cursorRule $content
            Write-Ok ".cursor/rules/gitleakguard.mdc -> Cursor (always active)"
        } catch { Write-Warn "Cursor rule failed: $_" }
    } else {
        Write-Ok ".cursor/rules/gitleakguard.mdc already installed"
    }

    # .vscode/tasks.json
    $vscodeTask = Join-Path $cwd ".vscode/tasks.json"
    if (-not (Test-Path $vscodeTask)) {
        try {
            $content = Get-FileContent ".vscode/tasks.json" ".vscode/tasks.json"
            Write-FileNoBom $vscodeTask $content
            Write-Ok ".vscode/tasks.json -> VSCode run tasks"
            Write-Info "Use Ctrl+Shift+P > Run Task > Gitleakguard"
        } catch { Write-Warn "VSCode tasks failed: $_" }
    } else {
        Write-Ok ".vscode/tasks.json already configured"
    }
}

function Install-GlobalSkills {
    Write-Step "Installing global AI editor skills"
    Install-ClaudeSkill
    Install-CursorSkill
    Install-GeminiSkill
}

function Install-EditorSkills {
    Install-ProjectInstructions
    Install-GlobalSkills
}

# ── Main ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  gitleakguard -- Git secret protection" -ForegroundColor Cyan
Write-Host ""

Test-Prerequisites

if (-not (Test-GitRepo)) {
    Write-Err "Not a git repository. Run: git init"
    exit 1
}

Write-Step "Installing pre-commit hook"
Install-Hook

if ($HookOnly) {
    Write-Host ""
    Write-Host "  [OK] Hook installed." -ForegroundColor Green
    Write-Host ""
    exit 0
}

Write-Step "Configuring .gitignore"
Set-Gitignore

Write-Step "Creating .env.example"
New-EnvExample

# Always install project-level instruction files
Install-ProjectInstructions

if (-not $NoEditorSkills) {
    Install-EditorSkills
}

Write-Host ""
Write-Host "  [OK] gitleakguard is active." -ForegroundColor Green
Write-Host "  Your next commit will be scanned automatically."
Write-Host ""
Write-Host "  Scan staged files now : " -NoNewline
Write-Host "node hooks/pre-commit" -ForegroundColor Cyan
Write-Host "  Scan git history      : " -NoNewline
Write-Host "node setup/scan-history.js" -ForegroundColor Cyan
Write-Host ""
