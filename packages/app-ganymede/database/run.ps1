# Check if the directory argument is provided
if ($args.Count -lt 1) {
    Write-Host "Usage: .\run.ps1 <directory_path>"
    Exit
}

# Set the directory containing SQL scripts
$scriptFileOrDirectory = $args[0]

# Set PostgreSQL database connection parameters
$h = "dev.local"
$port = "5432"
$username = "postgres"
$database = "ganymede_db"
$env:PGPASSWORD = "test"

# Specify the full path to psql.exe
$psqlPath = "C:\Program Files\pgAdmin 4\runtime\psql.exe"


# Check if the argument is a directory or a file
if (Test-Path $scriptFileOrDirectory -PathType Container) {

    # Get a sorted list of SQL script files
    $sortedScripts = Get-ChildItem -Path $scriptFileOrDirectory -Filter *.sql | Sort-Object FullName

    # Loop through each SQL script in the sorted list
    foreach ($script in $sortedScripts) {
        $scriptPath = $script.FullName

        # Execute the SQL script using psql
        try {
            & $psqlPath -U $username -h $h -d $database -p $port -f $scriptPath -q
            Write-Host "Successfully executed script: $scriptPath" -ForegroundColor Green
        }
        catch {
            Write-Host "Failed to execute script: $scriptPath" -ForegroundColor Red
            Write-Host "Error: $_" -ForegroundColor Red
        }
    }

}
elseif (Test-Path $scriptFileOrDirectory -PathType Leaf) {
    # If it's a file, execute only that file

    # Execute the SQL script using psql
    try {
        & $psqlPath -U $username -h $h -d $database -p $port -f $scriptFileOrDirectory -q
        Write-Host "Successfully executed script: $scriptFileOrDirectory" -ForegroundColor Green
    }
    catch {
        Write-Host "Failed to execute script: $scriptPath" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
    }
}
else {
    Write-Host "Invalid argument: $scriptPath" -ForegroundColor Red
}