workflow "Automatic backup of Europe" {
  on = "schedule(0 0 * * *)"
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

workflow "On push - Create artifact" {
  on = "push"
  resolves = ["On push - push artifact"]
}

action "On push - npm install" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  args = "install"
}

action "On push - npm run build" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  args = "run build"
  needs = ["On push - npm install"]
}

action "On push - Archive output" {
  uses = "juankaram/archive-action@master"
  args = "zip -r output.zip ./dist ./node_modules ./README.md ./package.json"
  needs = ["On push - npm run build"]
}

action "On push - push artifact" {
  uses = "JasonEtco/upload-to-release@master"
  secrets = ["GITHUB_TOKEN"]
  args = "output.zip"
  needs = ["On push - Archive output"]
}
