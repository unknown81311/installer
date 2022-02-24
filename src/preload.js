const { ipcRenderer, webFrame, shell } = require("electron")
const _path = require("path")
const fs = require("fs")

webFrame.setVisualZoomLevelLimits(1, 1)

const getPath = ipcRenderer.sendSync.bind(null, "getPath")
function quit() { ipcRenderer.sendSync("quit") }

const showMessageBox = ipcRenderer.invoke.bind(null, "showMessageBox")
const selectDirectory = ipcRenderer.invoke.bind(null, "selectDirectory")

function join(...path) { return _path.join(...path).replace(/(\\|\/)/g, "/") }

Object.defineProperty(global, "require", { value: require })

window.onkeydown = function(evt) {
  if ((evt.code == "Minus" || evt.code == "Equal") && (evt.ctrlKey || evt.metaKey)) evt.preventDefault()
}

const DrDir = join(getPath("appData"), "Discord_Re-envisioned")

function makeDrDir() {
  if (fs.existsSync(DrDir)) fs.rmSync(DrDir, { recursive: true, force: true })
  fs.mkdirSync(DrDir)
  fs.copyFileSync(join(__dirname, "..", "injection", "index.js"), join(DrDir, "index.js"))
  fs.copyFileSync(join(__dirname, "..", "injection", "preload.js"), join(DrDir, "preload.js"))
}

function getDiscordResources(type) {
  if (process.platform === "darwin") {
    const dir = `/Applications/Discord${type === "stable" ? "" : ` ${type}`}.app/Contents/Resources`
    if (!fs.existsSync(dir)) return
    return dir
  }
  if (process.platform === "linux") {
    const dir = `/usr/share/discord${type === "stable" ? "" : ` ${type}`}/Resources`
    if (!fs.existsSync(dir)) return
    return dir
  }
  if (process.platform === "win32") {
    let version = ["app-0", 0]
    const dir = join(process.env.LOCALAPPDATA, `Discord${type === "stable" ? "" : `${type}`}`)
    if (!fs.existsSync(dir)) return
    let versionFolders = fs.readdirSync(dir).filter(e => e.startsWith("app-"))
    for (let versionFolder of versionFolders) {
      let num = Number(versionFolder.replace("app-", "").replaceAll(".", ""))
      if (num > version[1]) {
        version = [
          versionFolder, num
        ]
      }
    }
    if (!fs.existsSync(join(dir, version[0], "resources"))) return
    return join(dir, version[0], "resources")
  }
}

function selectAll(selector, callback = () => {}) {
  for (const element of Array.from(document.querySelectorAll(selector))) {
    callback(element)
  }
}

const logger = new class {
  _(emoji, log) {
    document.getElementById("logs").append(Object.assign(document.createElement("div"), {
      className: "log",
      innerHTML: emoji.length === 2 ? `<span style="font-size: 13px; margin-right: 5px;">${emoji}</span><span>: ${log}</span>` : emoji
    }))
  }
  error(err) { this._("❌", err) }
  warn(warn) { this._("⚠️", warn) }
  success(success) { this._("✔️", success) }
  log(log) { this._(log) }
  space() {
    document.getElementById("logs").append(Object.assign(document.createElement("div"), {
      className: "space-log"
    }))
  }
}

const props = {
  action: null,
  release: null,
  path: null
}

const actions = {
  install: function() {
    console.log(props);
    logger.log(`Installing into discord ${props.release}`)
  
    const app = join(props.path, "app")
    if (fs.existsSync(app)) {
      logger.warn("'app' folder exists! Deleting folder...")
      try {
        fs.rmSync(app, { recursive: true, force: true })
      } catch (error) { return logger.error(error.message) }
      logger.success("Deleted 'app' folder!")
    }
    try {
      logger.log("Making 'app' folder...")
      fs.mkdirSync(app)
    } catch (error) { return logger.error(error.message) }
    logger.success("Made 'app' folder!")
    try {
      logger.log("Making 'index.js' file...")
      fs.writeFileSync(join(app, "index.js"), `require("${DrDir.replace("\\", "/")}")`)
    } catch (error) { return logger.error(error.message) }
    logger.success("Made 'index.js' file!")
    try {
      logger.log("Making 'package.json' file...")
      fs.writeFileSync(join(app, "package.json"), JSON.stringify({
        name: "discord", index: "./index.js"
      }))
    } catch (error) { return logger.error(error.message) }
    logger.success("Made 'package.json' file!")
    makeDrDir()
    logger.success("Installed perfectly!")
  },
  uninstall: function() {
    logger.log(`Uninstalling from Discord ${props.release}`)
    const app = join(props.path, "app")
    if (fs.existsSync(app)) {
      logger.log("Deleting 'app' folder...")
      try {
        fs.rmSync(app, { recursive: true, force: true })
      } catch (error) { return logger.error(error.message) }
      logger.success("Deleted 'app' folder!")
    }
    logger.success("Uninstalled perfectly!")
  }
}

function domLoaded() {
  const { version } = require(join(__dirname, "..", "package.json"))
  fetch("https://api.github.com/repos/Dr-Discord/installer/releases").then(e => e.json()).then(([e]) => {
    if (Number(e.tag_name.replaceAll(".", "")) < Number(version.replaceAll(".", ""))) showMessageBox({
      message: "Your installer is out of date! Want to update?",
      buttons: ["Cancel", "Install"],
      cancelId: 0
    }).then(({ response }) => {
      if (!response) return
      shell.openExternal(e.assets.find(r => r.name.startsWith(process.platform === "linux" ? "linux" : process.platform === "win32" ? "windows" : "mac")).browser_download_url)
    })
  })

  document.getElementById("close-app").onclick = quit
  setTimeout(() => {
    document.getElementById("loader").classList.add("fade")
    document.getElementById("body").classList.add("fade")
    setTimeout(() => document.getElementById("loader").style.display = "none", 350)
  }, 1650)

  selectAll(".discord-card", (ele) => {
    function updatePath(newPath) {
      if (!newPath) return
      ele.lastElementChild.lastElementChild.innerHTML = newPath
    }
    updatePath(getDiscordResources(ele.id))
    ele.lastElementChild.lastElementChild.onclick = () => selectDirectory(props.path || getPath("userData")).then(updatePath)
    ele.onclick = (event) => {
      if (event.target === ele.lastElementChild.lastElementChild) return
      props.path = ele.lastElementChild.lastElementChild.innerHTML
      props.release = ele.id
      document.getElementById("select-release").hidden = true
      document.getElementById("select-action").hidden = false
    }
  })

  selectAll(".select-card", (ele) => {
    ele.onclick = () => {
      props.action = ele.id
      document.getElementById("select-action").hidden = true
      document.getElementById("select-logs").hidden = false
      const fun = actions[ele.id]
      fun()
    }
  })
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", domLoaded)
else domLoaded()