# Backend tests

`npm test` runs the tests with a simulated database. The PostgreSQL import test
is skipped unless `FINANTEC_TEST_DATABASE_URL` is explicitly set. Simulated
queries verify route behavior and rollback commands, not PostgreSQL concurrency.

## Isolated PostgreSQL import test (Windows)

This procedure starts a new temporary PostgreSQL cluster on loopback port 55439.
It does not use `backend/.env`, the development cluster, or development data.
Use an unused port; if startup fails, stop instead of connecting to another server.
Local PostgreSQL binaries are required; no dependency installation is needed.

Run from `backend`:

```powershell
$taskPgBin = 'C:\Program Files\PostgreSQL\18\bin'
$taskPgRoot = Join-Path ([IO.Path]::GetTempPath()) ('finantec-import-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $taskPgRoot
& "$taskPgBin\initdb.exe" -D $taskPgRoot -U finantec_test --auth=trust --encoding=UTF8 --locale=C
if ($LASTEXITCODE -ne 0) { throw 'Temporary cluster initialization failed' }
& "$taskPgBin\pg_ctl.exe" -D $taskPgRoot -l "$taskPgRoot\server.log" -o '-h 127.0.0.1 -p 55439' -w start
if ($LASTEXITCODE -ne 0) { throw 'Temporary cluster startup failed' }
try {
    & "$taskPgBin\createdb.exe" -h 127.0.0.1 -p 55439 -U finantec_test finantec_import_test
    if ($LASTEXITCODE -ne 0) { throw 'Temporary test database creation failed' }
    $env:FINANTEC_TEST_DATABASE_URL = 'postgresql://finantec_test@127.0.0.1:55439/finantec_import_test'
    node --test test/transactionImport.postgres.test.js
} finally {
    Remove-Item Env:\FINANTEC_TEST_DATABASE_URL -ErrorAction SilentlyContinue
    & "$taskPgBin\pg_ctl.exe" -D $taskPgRoot -w -m fast stop
}
```

The test requires the database name `finantec_import_test` and host `127.0.0.1`.
It creates a randomly named test schema, applies migrations 001/002 only there,
and drops that schema at the end. Never point this variable at a real dataset.
Authentication uses real session rows; password verification is outside this test.

For each concurrency scenario, a separate connection first holds a user row lock.
The test waits until PostgreSQL reports the import requests blocked on that lock,
then releases it and checks the HTTP responses and persisted rows. It verifies
duplicate exclusion, intentional duplicates, and progress for a different user.
No timing assumption is used to decide that a request has reached the lock.

After the server has stopped, the generated temporary directory can be removed
after verifying its exact path. No database or cluster from development is removed.
