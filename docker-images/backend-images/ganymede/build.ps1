

nx build ganymede-app --prod

Set-Location .\docker-images\ganymede
Copy-Item -Force ..\..\dist\apps\ganymede-app\package.json
Copy-Item -Force ..\..\dist\apps\ganymede-app\package-lock.json

Copy-Item -Force -recurse ..\..\dist\apps\ganymede-app\app
Copy-Item -Force ..\..\dist\apps\ganymede-app\main.js
Copy-Item -Force ..\..\dist\apps\ganymede-app\main.js.map

docker build -f ./Dockerfile . -t ganymede