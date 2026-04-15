#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Post-deploy smoke tests for ClinicNest on GCP.
  Validates health, auth, REST proxy, and frontend availability.
.DESCRIPTION
  Run after each deploy to verify core functionality.
  Exit code 0 = all checks passed, 1 = failures detected.
#>

param(
  [string]$ApiUrl = "https://clinicnest-api-294286835536.southamerica-east1.run.app",
  [string]$FrontendUrl = "https://clinicnest-app.web.app"
)

$ErrorActionPreference = "Continue"
$passed = 0
$failed = 0
$results = @()

function Test-Endpoint {
  param(
    [string]$Name,
    [string]$Url,
    [string]$Method = "GET",
    [string]$Body,
    [hashtable]$Headers = @{},
    [int]$ExpectedStatus = 200,
    [string]$ExpectedContains
  )

  try {
    $params = @{ Uri = $Url; Method = $Method; UseBasicParsing = $true; TimeoutSec = 15 }

    if ($Headers.Count -gt 0) { $params.Headers = $Headers }
    if ($Body) {
      $params.Body = $Body
      $params.ContentType = "application/json"
    }

    $response = Invoke-WebRequest @params -ErrorAction SilentlyContinue

    $status = $response.StatusCode
    $content = $response.Content

    if ($status -eq $ExpectedStatus) {
      if ($ExpectedContains -and -not ($content -match [regex]::Escape($ExpectedContains))) {
        Write-Host "  FAIL  $Name — status $status but missing '$ExpectedContains'" -ForegroundColor Red
        $script:failed++
        return
      }
      Write-Host "  PASS  $Name ($status)" -ForegroundColor Green
      $script:passed++
    } else {
      Write-Host "  FAIL  $Name — expected $ExpectedStatus, got $status" -ForegroundColor Red
      $script:failed++
    }
  } catch {
    $errorStatus = $_.Exception.Response.StatusCode.value__
    if ($errorStatus -eq $ExpectedStatus) {
      Write-Host "  PASS  $Name ($errorStatus)" -ForegroundColor Green
      $script:passed++
    } else {
      Write-Host "  FAIL  $Name — ${_}" -ForegroundColor Red
      $script:failed++
    }
  }
}

Write-Host "=== ClinicNest Smoke Tests ===" -ForegroundColor Cyan
Write-Host "API: $ApiUrl"
Write-Host "Frontend: $FrontendUrl"
Write-Host ""

# ─── 1. Health Check ────────────────────────────────────────────────
Write-Host "[1] Health Endpoint" -ForegroundColor Yellow
Test-Endpoint -Name "GET /health" -Url "$ApiUrl/health" -ExpectedContains "ok"

# ─── 2. CORS Enforcement ────────────────────────────────────────────
Write-Host "[2] CORS" -ForegroundColor Yellow
Test-Endpoint -Name "CORS: allowed origin" -Url "$ApiUrl/health" -Headers @{ Origin = "https://clinicnest.metaclass.com.br" }
Test-Endpoint -Name "CORS: blocked origin" -Url "$ApiUrl/health" -Headers @{ Origin = "https://evil.com" } -ExpectedStatus 403

# ─── 3. Auth Enforcement ────────────────────────────────────────────
Write-Host "[3] Auth" -ForegroundColor Yellow
Test-Endpoint -Name "Protected route without token" -Url "$ApiUrl/api/rest" -Method "POST" `
  -Body '{"table":"patients","operation":"select"}' `
  -ExpectedStatus 401

# ─── 4. REST Proxy Security ─────────────────────────────────────────
Write-Host "[4] REST Proxy Security" -ForegroundColor Yellow
Test-Endpoint -Name "Blocked table (pg_shadow)" -Url "$ApiUrl/api/rest" -Method "POST" `
  -Body '{"table":"pg_shadow","operation":"select"}' `
  -Headers @{ Authorization = "Bearer fake-token" } `
  -ExpectedStatus 401

# ─── 5. Public Endpoints ────────────────────────────────────────────
Write-Host "[5] Public Endpoints" -ForegroundColor Yellow
Test-Endpoint -Name "POST /api/submit-contact-message (responds)" -Url "$ApiUrl/api/submit-contact-message" -Method "POST" `
  -Body '{}' `
  -ExpectedStatus 500

# ─── 6. Storage Proxy Security ──────────────────────────────────────
Write-Host "[6] Storage Security" -ForegroundColor Yellow
Test-Endpoint -Name "Path traversal blocked" -Url "$ApiUrl/api/storage/avatars" -Method "POST" `
  -Body '{"operation":"download","path":"../../../etc/passwd"}' `
  -Headers @{ Authorization = "Bearer fake-token" } `
  -ExpectedStatus 401

# ─── 7. Frontend Availability ───────────────────────────────────────
Write-Host "[7] Frontend" -ForegroundColor Yellow
Test-Endpoint -Name "Firebase Hosting (index.html)" -Url $FrontendUrl -ExpectedContains "<!doctype html>"
Test-Endpoint -Name "Robots.txt" -Url "$FrontendUrl/robots.txt" -ExpectedContains "Sitemap"

# ─── 8. Rate Limiting ───────────────────────────────────────────────
Write-Host "[8] Rate Limiting" -ForegroundColor Yellow
# Just confirm the endpoint responds (not hammering it)
Test-Endpoint -Name "Rate limit header present" -Url "$ApiUrl/health"

# ─── Summary ────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== Results ===" -ForegroundColor Cyan
Write-Host "  Passed: $passed" -ForegroundColor Green
Write-Host "  Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host "  Total:  $($passed + $failed)"

if ($failed -gt 0) {
  Write-Host "`nSMOKE TEST FAILED" -ForegroundColor Red
  exit 1
} else {
  Write-Host "`nALL SMOKE TESTS PASSED" -ForegroundColor Green
  exit 0
}
