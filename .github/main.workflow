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
  resolves = [
    "Get package version",
    "JasonEtco/upload-to-release",
    "On push - npm run build",
  ]
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

action "Get package version" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  needs = ["On push - npm run build"]
  runs = "PACKAGE_VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[\",]//g')"
}

action "juankaram/archive-action-1" {
  uses = "juankaram/archive-action@master"
  needs = ["Get package version"]
  args = "zip -r output.zip ./dist ./node_modules ./README.md ./package.json"
}

action "frankjuniorr/github-create-release-action-1" {
  uses = "frankjuniorr/github-create-release-action@master"
  needs = ["juankaram/archive-action-1"]
  secrets = ["GITHUB_TOKEN"]
  env = {
    VERSION = "$PACKAGE_VERSION"
    DESCRIPTION = "Just another release"
  }
}

action "JasonEtco/upload-to-release" {
  uses = "JasonEtco/upload-to-release@master"
  needs = ["frankjuniorr/github-create-release-action-1"]
  args = "output.zip"
  secrets = ["GITHUB_TOKEN"]
}
