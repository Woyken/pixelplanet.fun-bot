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
    BRANCH = "PixelPlanet-png-backup"
    FOLDER = "out"
    BUILD_SCRIPT = "mkdir out\nxCounter=-32768\nwhile [ $xCounter -le 32256 ];\ndo\n    yCounter=-32768\n    while [ $yCounter -le 32256 ];\n    do\n        npx node ./dist/pixelToPicture.js $xCounter $yCounter $((xCounter+512)) $((yCounter+512)) \"./out/$((xCounter/512)).$((yCounter/512)).png\";\n        ((yCounter=yCounter+512));\n    done\n    ((xCounter=xCounter+512));\ndone"
  }
  secrets = ["ACCESS_TOKEN"]
}
