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
    BUILD_SCRIPT = "mkdir out\nnpx node ./dist/pixelToPicture.js -4182 -15889 7585 -5727 \"./out/Europe.png\""
  }
  secrets = ["ACCESS_TOKEN"]
}
