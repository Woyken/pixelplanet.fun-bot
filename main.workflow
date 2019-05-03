workflow "New workflow" {
  on = "schedule(0 0 * * *)"
  resolves = ["GitHub Action for npm", "GitHub Action for npm-1"]
}

action "npm build" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  args = "run build"
}

action "GitHub Action for npm" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  needs = ["npm build"]
}

action "GitHub Action for npm-1" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
}
