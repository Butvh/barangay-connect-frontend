# Private rehearsal PHP and photo preflight

Use the exact candidate's clean composition, locked Composer dependencies and a local, disposable MySQL 8.4 schema. Run this from the composition root after loading the guarded profile and its private key and storage paths. Keep `SMS_ENABLED`, `MAKE_ENABLED` and `OUTBOX_DISPATCH_ENABLED` false.

## Verify the PHP process that serves the app

Set `$php` to the absolute path of the trusted PHP CLI executable and `$ini` to its private main `php.ini`. Use the same shell, executable, ini and scan environment to launch the probe and app. Check that GD loads once in the main ini. On Windows, if the child is losing its environment, check the private ini's `variables_order` and whether the child inherits `SystemRoot`. The P2 working profile used `EGPCS` with no extra scanned ini. Keep this device-local and leave global PHP configuration alone. Do not print environment values.

```powershell
$env:P1_PRIVATE_PHOTO_PROBE='1'
& $php -c $ini -S 127.0.0.1:8769 -t backend/public backend/tests/Support/private-photo-runtime-probe.php
```

In a second terminal, run `Invoke-RestMethod http://127.0.0.1:8769/probe` (or `curl http://127.0.0.1:8769/probe`). Expect both PHP executable fingerprints to agree, GD in both processes, child and normalization exit 0, no stderr, a 32×24 PNG and Laravel MySQL session `+00:00`. Review the reported loaded/scanned ini names, Windows environment presence flags and normalized byte count. A standalone PNG result and a raw PDO timezone are insufficient to verify the guarded app. The probe uses a fictional image, issues one read-only query through Laravel and publishes only a bounded diagnostic. Stop it with Ctrl+C when done.

## Rehearse the original upload and restart

The guarded launcher uses the existing operational browser router. In the same private profile, confirm the matching `DB_DATABASE`/`DB_TEST_DATABASE`, `DB_TEST_DISPOSABLE=1` and `P1_COMBINED_TESTS=1`, and use the already prepared fictional accounts. To stage and serve the administration, civic and photo surfaces for this isolated rehearsal:

```powershell
$env:P1_OPERATIONAL_BROWSER='1'
$env:P2_TEST_BINDINGS='true'
$env:P1_ADMIN_TEST_BINDINGS='true'
$env:P1_PHOTO_TEST_BINDINGS='true'
$env:P1_CONSENT_TEST_BINDINGS='true'
$env:P1_SMS_INTENT_TEST_BINDINGS='false'
$env:P1_LOCAL_RECOVERY_MAIL='false'
node --input-type=module -e "import { stageBackendFrontend } from './scripts/stage-backend-frontend.mjs'; await stageBackendFrontend({ operationalTest: true, administrationTest: true, photoTest: true, consentTest: true });"
& $php -c $ini -d upload_max_filesize=10M -d post_max_size=52M -d max_file_uploads=12 -S 127.0.0.1:8767 -t backend/public backend/tests/Support/operational-router.php
```

Use the original resident details form and a fictional image. Record upload 201, details 200, decoded gallery dimensions and authorized download 200. Verify denial for an unrelated account. For restart, stop only the app with Ctrl+C and rerun only the last PHP command, retaining the schema, key, private object root and launch configuration. Reopen the details form deliberately before a new upload intent. Preserve failed metadata and original files privately. Never prepare, seed or migrate a retained schema during this check.

P1's historical controlled failure used GD in the web parent only. The P2 device's historical failure involved Windows child environment loss and curl startup. P2 recovered in the original browser with the working private profile and verified app-only restart on the older retained dataset. Repeat the applicable checks on the final candidate before signing off. [P2 retained-device report](https://github.com/Butvh/barangay-connect-frontend/pull/50#issuecomment-6681816244)
