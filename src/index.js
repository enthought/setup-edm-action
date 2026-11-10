// (C) Copyright 2020 Enthought, Inc., Austin, TX
// All rights reserved.
//
// This software is provided without warranty under the terms of the BSD
// license included in LICENSE.txt and may be redistributed only under
// the conditions described in the aforementioned license. The license
// is also available online at http://www.enthought.com/licenses/BSD.txt
//
// Thanks for using Enthought open source!

const child_process = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

// This action uses only Node.js built-ins, so it runs from src/ without a
// build step. The helpers below implement the few parts of @actions/core
// and @actions/exec it needs, using the runner's documented interface:
// https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands


function getInput(name) {
    // The runner passes input `name` in the environment variable
    // INPUT_<NAME>: upper-cased, with spaces (but not hyphens) replaced
    // by underscores. Both inputs of this action are required or have a
    // default, so an empty value is an error.
    const key = "INPUT_" + name.replace(/ /g, "_").toUpperCase()
    const value = (process.env[key] || "").trim()
    if (!value) {
        throw new Error("Input required and not supplied: " + name)
    }
    return value
}


function escapeData(message) {
    // Escape a workflow command value, as @actions/core does.
    return String(message)
        .replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A")
}


function info(message) {
    console.log(message)
}


function warning(message) {
    console.log("::warning::" + escapeData(message))
}


function setFailed(message) {
    console.log("::error::" + escapeData(message))
    process.exitCode = 1
}


function addPath(dir) {
    // Prepend `dir` to PATH for the subsequent steps of the job.
    if (process.env.GITHUB_PATH) {
        fs.appendFileSync(process.env.GITHUB_PATH, dir + os.EOL, "utf8")
    }
    process.env.PATH = dir + path.delimiter + process.env.PATH
}


function expandTilde(filepath) {
    // Expand a leading ~ (home directory) or ~+ (working directory).
    if (filepath === "~" || /^~[\\/]/.test(filepath)) {
        return path.join(os.homedir(), filepath.slice(1))
    }
    if (filepath === "~+" || /^~\+[\\/]/.test(filepath)) {
        return path.join(process.cwd(), filepath.slice(2))
    }
    return filepath
}


function run(command, args, spawn = {}) {
    // Run `command` with inherited stdio; throw unless it exits with 0.
    // `spawn` may override the executable and arguments actually spawned.
    info("[command]" + [command, ...args].join(" "))
    const {file = command, argv = args, ...options} = spawn
    const result = child_process.spawnSync(
        file, argv, {stdio: "inherit", ...options}
    )
    if (result.error) {
        throw result.error
    }
    if (result.status !== 0) {
        throw new Error(
            "The process '" + command + "' failed with exit code "
            + result.status
        )
    }
}


function runCmdScript(script, args) {
    // Run a Windows .cmd script. Node refuses to spawn .cmd/.bat files
    // without a shell, so call cmd.exe the way @actions/exec does: the
    // whole command line wrapped in quotes and passed verbatim. Arguments
    // are quoted only when needed, as the script reads %1 and %3 raw.
    const quote = (arg) => /[\s"&|<>^()]/.test(arg) ? '"' + arg + '"' : arg
    const commandLine = ['"' + script + '"', ...args.map(quote)].join(" ")
    run(script, args, {
        file: process.env.COMSPEC || "cmd.exe",
        argv: ["/D", "/S", "/C", '"' + commandLine + '"'],
        windowsVerbatimArguments: true,
    })
}


// Requested EDM version, e.g. '3.7.0' or 'latest'; set in main().
let requestedVersion

// The EDM version to install; 'latest' is resolved in main().
let edmVersion

// Directory path for storing downloaded installer; set in main().
let downloadDir


function readInstallerTable() {
    // Return the rows of cli_installers.csv as {version, platform, sha256}.
    const table = fs.readFileSync(
        path.join(__dirname, "cli_installers.csv"), "utf8"
    )
    return table.split(/\r?\n/).slice(1).filter(Boolean).map((line) => {
        const [version, platform, , sha256] = line.split(",")
        return {version, platform, sha256}
    })
}


function lookupSha256(platform) {
    // Return the expected SHA256 of the installer for the given platform
    // and the requested EDM version as a list of extra script arguments,
    // or an empty list if the version is not listed.
    const row = readInstallerTable().find(
        (r) => r.version === edmVersion && r.platform === platform
    )
    if (row) {
        return [row.sha256]
    }
    warning(
        "No SHA256 checksum is known for EDM " + edmVersion + " (" + platform
        + "); the installer will not be verified."
    )
    return []
}


function compareVersions(a, b) {
    // Compare dotted numeric versions, e.g. '4.1.10' > '4.1.7'.
    const pa = a.split(".").map(Number)
    const pb = b.split(".").map(Number)
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0)
        if (diff !== 0) {
            return diff
        }
    }
    return 0
}


function resolveLatestVersion() {
    // The newest EDM version that has an installer for this runner, taken
    // from cli_installers.csv (the EDM releases are not publicly queryable).
    // Installers are not published for every platform of every release,
    // e.g. there are no macOS installers after 4.1.3.
    let platform
    if (process.platform == "linux") {
        platform = "linux-x86_64"
    } else if (process.platform == "darwin") {
        platform = process.arch === "arm64" ? "osx-arm64" : "osx-x86_64"
    } else if (process.platform == "win32") {
        platform = "win-x86_64"
    } else {
        throw new Error("Unsupported platform.")
    }
    const versions = readInstallerTable()
        .filter((r) => r.platform === platform)
        .map((r) => r.version)
        .sort(compareVersions)
    if (versions.length === 0) {
        throw new Error("No EDM installers are known for " + platform)
    }
    return versions[versions.length - 1]
}


function osxArch() {
    // Apple silicon installers exist from EDM 4.1 onwards; older versions
    // only have x86_64 installers (which run under Rosetta).
    const [major, minor] = edmVersion.split(".").map(Number)
    const hasArm64 = major > 4 || (major === 4 && minor >= 1)
    return (process.arch === "arm64" && hasArm64) ? "arm64" : "x86_64"
}


function main() {
    // Main function to be run when the action is invoked.
    try {
        requestedVersion = getInput("edm-version")
        edmVersion = requestedVersion
        downloadDir = expandTilde(
            path.normalize(getInput("download-directory"))
        )

        // Create the download directory.
        info(
            "Using directory for storing downloaded installer: " + downloadDir
        )
        fs.mkdirSync(downloadDir, {recursive: true})

        if (requestedVersion.toLowerCase() === "latest") {
            edmVersion = resolveLatestVersion()
            info("Resolved edm-version 'latest' to " + edmVersion)
        }

        if (process.platform == "linux") {
            installEdmLinux()
        } else if (process.platform == "darwin") {
            installEdmOSX()
        } else if (process.platform == "win32") {
            installEdmWindows()
        } else {
            setFailed("Unsupported platform.")
        }
    }
    catch (error) {
        setFailed(error.message)
    }
}


function installEdmLinux() {
    // Install EDM for Linux and add it to PATH such that edm can
    // be used directly in GitHub Actions workflows.
    run(
        "bash",
        [
            path.join(__dirname, "install-edm-linux.sh"),
            edmVersion, downloadDir, ...lookupSha256("linux-x86_64")
        ]
    )
    const edmDir = path.join(os.homedir(), "edm", "bin")
    info("Adding " + edmDir + " to PATH")
    addPath(edmDir)
}


function installEdmOSX() {
    // Install EDM for OSX
    const arch = osxArch()
    run(
        "sh",
        [
            path.join(__dirname, "install-edm-osx.sh"),
            edmVersion, downloadDir, arch, ...lookupSha256("osx-" + arch)
        ]
    )
    // no need to update path for OSX
}


function installEdmWindows() {
    // Install EDM for Windows and add it to PATH such that edm can
    // be used directly in GitHub Actions workflows.
    runCmdScript(
        path.join(__dirname, "install-edm-windows.cmd"),
        [edmVersion, downloadDir, ...lookupSha256("win-x86_64")]
    )
    const edmDir = path.join("C:\\", "Enthought", "edm")
    info("Adding " + edmDir + " to PATH")
    addPath(edmDir)
}


main()
