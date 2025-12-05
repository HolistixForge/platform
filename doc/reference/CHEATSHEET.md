# Cheat Sheet

## sshfs on Windows with WinFsp and SSHFS-Win

See [here](https://www.petergirnus.com/blog/how-to-sshfs-on-windows)

Then

```powershell
& 'C:\Program Files\SSHFS-Win\bin\sshfs-win.exe' svc \sshfs.k\ubuntu@dev.dev-001.your-domain.com X:
```

## use curl (from git install) on windows powershell

```powershell
$json = @"
{\"token\":\"eyJwYXlsb2FkIjogIntcImRhdGVcIjpcIjIwMjMtMDQtMjBUMDg6MTM6MDguNjczOTg1XCIsXCJzb3VyY2VcIjpcImp1cHl0ZXJodWJcIn0iLCAic2lnbiI6ICIwOTg3MDg1MGM3OWE3Y2I5NmVmMzA3OGJmZjkyNzNmYjdhNjVlY2RmYWNkYjQzMzZhMjA0OTAyMTA2NmEzYjJiZWQ0ZjZlZGI3ZWJkYzY0Zjg3MzNmNWFmZGUwOGUyYWE4ZjRhOTIyNGEyNTJjZDJlZmNlNDlmNzM3NzVlYWUwNyJ9\", \"pod_description\": {\"metadata\": { \"annotations\":{\"hub.jupyter.org/username\": \"bfdafab0-d914-4989-ad17-e8a4f4d7601d\"}}}}
"@
& 'C:\Program Files\Git\mingw64\bin\curl.exe' http://ganymede.dev.local:8080/pod -d $json -H 'Content-Type: application/json' -X GET
```

## docker: get container IP from host

```
docker ps
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' XXXXXXXXXXX
```

## npm package info

```shell
npm info $name
npm list $name
npm view $name versions
```
