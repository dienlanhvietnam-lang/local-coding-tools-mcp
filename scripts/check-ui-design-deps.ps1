param(
  [ValidateSet("ui-design-core", "ui-design-full")]
  [string]$Profile = "ui-design-core",
  [switch]$Json
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Push-Location $root
try {
  npm run build 2>$null | Out-Null
  node -e "
    import { collectUiDesignDependencies, uiDesignCoreReady, uiDesignFullReady } from './dist/utils/uiDesignDependencies.js';
    const snap = await collectUiDesignDependencies();
    const profile = '$Profile';
    const ready = profile === 'ui-design-full' ? uiDesignFullReady(snap) : uiDesignCoreReady(snap);
    if ($Json) {
      console.log(JSON.stringify({ profile, ready, snap }, null, 2));
    } else {
      console.log('UI Design deps — profile:', profile);
      console.log('  systemBrowser:', snap.systemBrowser, snap.systemBrowserPath ?? '');
      console.log('  pixelmatch:', snap.pixelmatch);
      console.log('  pngjs:', snap.pngjs);
      console.log('  playwrightCore:', snap.playwrightCore);
      console.log('  axePlaywright:', snap.axePlaywright);
      console.log('  READY:', ready ? 'PASS' : 'FAIL');
    }
    process.exit(ready ? 0 : 1);
  "
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
