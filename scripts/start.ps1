param([ValidateSet('local','demo')][string]$Mode='local', [string]$KnowledgeRoot='', [int]$Port=3210)
$ErrorActionPreference='Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
 $env:SOURCE_MODE=$Mode
 $env:PORT=[string]$Port
 if($KnowledgeRoot){$env:KNOWLEDGE_ROOT=(Resolve-Path -LiteralPath $KnowledgeRoot).Path}
 if($env:DEEPSEEK_API_KEY){node src/server.cjs}
 else{python scripts/with_deepseek.py node src/server.cjs}
 exit $LASTEXITCODE
} finally {Pop-Location}
