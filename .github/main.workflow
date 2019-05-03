workflow "Build" {
  on = "push"
  resolves = ["Create backup png of the page"]
}

action "npm install" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  args = "install"
}

action "npm run build" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  args = "run build"
  needs = ["npm install"]
}

action "Create backup png of the page" {
  uses = "JamesIves/github-pages-deploy-action@master"
  needs = ["npm run build"]
  env = {
    BUILD_SCRIPT = "mkdir out\nfor x in {-32768..32767..512}\ndo\n    for y in {-32768..32767..512}\n    do\n        npx node ./dist/pixelToPicture.js $(x) $(y) $((x+512)) $((y+512)) \"./out/$((value/512)).$((value/512)).png\";\n    done\ndone"
    BRANCH = "PixelPlanet-png-backup"
    FOLDER = "out"
  }
  secrets = ["ACCESS_TOKEN"]
}
